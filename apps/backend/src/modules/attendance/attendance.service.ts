import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BulkAttendanceDto, AttendanceStatus as DtoStatus } from './dto/bulk-attendance.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { AttendanceStatus } from '@prisma/client';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Obtiene la lista de estudiantes inscritos en una asignatura (por carrera)
   * junto con su estado de asistencia para una fecha dada.
   */
  async getStudentsForSchedule(scheduleId: string, date: string) {
    // 1. Obtener los detalles del horario y la asignatura asociada
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        subject: true,
        classroom: true,
      },
    });

    if (!schedule) {
      this.logger.error(`Horario no encontrado: ${scheduleId}`);
      throw new NotFoundException(`El horario solicitado no existe`);
    }

    const subject = schedule.subject;
    if (!subject) {
      throw new BadRequestException('El horario no tiene una asignatura válida asignada');
    }

    // 2. Obtener todos los estudiantes activos que pertenecen a la carrera de la asignatura
    const students = await this.prisma.user.findMany({
      where: {
        roleId: 'estudiante',
        careerId: subject.careerId,
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        careerId: true,
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
    });

    // 3. Obtener los registros de asistencia existentes para ese horario y fecha
    const parsedDate = new Date(date);
    const attendanceRecords = await this.prisma.attendanceRecord.findMany({
      where: {
        scheduleId: scheduleId,
        date: parsedDate,
      },
      include: {
        tardiness: {
          select: {
            delayMinutes: true,
            isExcused: true,
          },
        },
        justification: {
          select: {
            reason: true,
            status: true,
          },
        },
      },
    });

    // 4. Cruzar estudiantes con sus registros de asistencia (si existen)
    const studentsWithAttendance = students.map((student) => {
      const record = attendanceRecords.find((r) => r.studentId === student.id);
      
      return {
        id: student.id,
        first_name: student.firstName,
        last_name: student.lastName,
        email: student.email,
        attendance: record
          ? {
              recordId: record.id,
              status: record.status.toString(),
              registeredBy: record.registeredBy,
              registeredAt: record.registeredAt,
              delayMinutes: record.tardiness?.delayMinutes ?? null,
              isExcusedTardiness: record.tardiness?.isExcused ?? null,
              justification: record.justification
                ? {
                    reason: record.justification.reason,
                    status: record.justification.status.toString(),
                  }
                : null,
            }
          : null,
      };
    });

    return {
      schedule: {
        id: schedule.id,
        day_of_week: schedule.dayOfWeek,
        start_time: schedule.startTime,
        end_time: schedule.endTime,
        tolerance_minutes: schedule.toleranceMinutes ?? 15,
        classroom: schedule.classroom ? schedule.classroom.name : 'No asignada',
        subject: {
          id: subject.id,
          name: subject.name,
          code: subject.code,
        },
      },
      date,
      students: studentsWithAttendance,
    };
  }

  /**
   * Registra o actualiza en bloque la asistencia para un horario y fecha específicos,
   * aplicando de forma automatizada las reglas de tolerancia y cálculo de retrasos.
   */
  async registerBulkAttendance(dto: BulkAttendanceDto, registeredByUserId: string) {
    const { scheduleId, date, records } = dto;
    const parsedDate = new Date(date);

    // 0. Obtener detalles del usuario para identificar su tenant_id
    const currentUser = await this.prisma.user.findUnique({
      where: { id: registeredByUserId },
      select: { tenantId: true },
    });

    const tenantId = currentUser?.tenantId;

    if (tenantId) {
      // Validar si la fecha es un día feriado o inhábil
      const holiday = await this.prisma.holiday.findFirst({
        where: {
          tenantId: tenantId,
          date: parsedDate,
        },
        select: { name: true },
      });

      if (holiday) {
        throw new BadRequestException(
          `La toma de asistencia está congelada en esta fecha (${date}) por ser un día feriado o inhábil institucional: "${holiday.name}".`
        );
      }
    }

    // Obtener los registros de asistencia previos antes de modificarlos para la auditoría
    const previousRecords = await this.prisma.attendanceRecord.findMany({
      where: {
        scheduleId: scheduleId,
        date: parsedDate,
      },
      select: {
        studentId: true,
        status: true,
      },
    });

    const oldValues = {
      scheduleId,
      date,
      records: previousRecords.map((r) => ({
        studentId: r.studentId,
        status: r.status.toString(),
      })),
    };

    // 1. Obtener detalles del horario para validar la tolerancia y hora de inicio
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        subject: {
          select: { careerId: true },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException(`El horario con ID ${scheduleId} no existe`);
    }

    let tolerance = schedule.toleranceMinutes ?? 10;
    let absentMinutes = 15; // Límite por defecto para falta automática

    if (tenantId) {
      // a. Buscar política global
      const globalPolicy = await this.prisma.tolerancePolicy.findFirst({
        where: {
          tenantId: tenantId,
          scope: 'global',
        },
      });

      // b. Buscar política específica de carrera
      let careerPolicy = null;
      if (schedule.subject?.careerId) {
        careerPolicy = await this.prisma.tolerancePolicy.findFirst({
          where: {
            tenantId: tenantId,
            scope: 'career',
            careerId: schedule.subject.careerId,
          },
        });
      }

      // c. Buscar política específica de materia
      const subjectPolicy = await this.prisma.tolerancePolicy.findFirst({
        where: {
          tenantId: tenantId,
          scope: 'subject',
          subjectId: schedule.subjectId,
        },
      });

      // Seleccionar política por orden de precedencia (Materia > Carrera > Global)
      const activePolicy = subjectPolicy || careerPolicy || globalPolicy;
      if (activePolicy) {
        tolerance = activePolicy.toleranceMinutes;
        absentMinutes = activePolicy.absentMinutes;
      }
    }

    const startTimeStr = schedule.startTime; // HH:MM:SS
    const results = [];

    // Procesar secuencialmente para garantizar la integridad y manejo de tardanzas
    for (const recordItem of records) {
      const { studentId, status: originalStatus, delayMinutes: providedDelay } = recordItem;
      let finalStatus: AttendanceStatus = AttendanceStatus.presente;
      let calculatedDelay = 0;

      // Traducir el estado de DtoStatus a Prisma enum
      if (originalStatus === DtoStatus.PRESENTE) {
        finalStatus = AttendanceStatus.presente;
      } else if (originalStatus === DtoStatus.AUSENTE) {
        finalStatus = AttendanceStatus.ausente;
      } else if (originalStatus === DtoStatus.JUSTIFICADO) {
        finalStatus = AttendanceStatus.justificado;
      } else if (originalStatus === DtoStatus.TARDE) {
        finalStatus = AttendanceStatus.tarde;
      }

      // Lógica de cálculo de retardo y tolerancia automatizada
      if (originalStatus === DtoStatus.TARDE) {
        if (providedDelay !== undefined && providedDelay !== null) {
          calculatedDelay = providedDelay;
        } else {
          // Si no se envía delayMinutes, pero la fecha de registro es HOY, calculamos la tardanza en base a la hora actual
          const todayStr = new Date().toISOString().split('T')[0];
          if (date === todayStr) {
            calculatedDelay = this.calculateDelayInMinutes(startTimeStr);
          } else {
            calculatedDelay = 1;
          }
        }

        // Si los minutos de tardanza superan el límite de ausencia automática,
        // el sistema lo computa automáticamente como inasistencia (AUSENTE)
        if (calculatedDelay > absentMinutes) {
          finalStatus = AttendanceStatus.ausente;
          calculatedDelay = 0; // Al pasar a ausente, no se registra tardanza
          this.logger.log(
            `Estudiante ${studentId} superó límite de ausencia automática (${calculatedDelay}min > ${absentMinutes}min). Registrado automáticamente como AUSENTE.`,
          );
        } else if (calculatedDelay > tolerance) {
          finalStatus = AttendanceStatus.tarde;
          this.logger.log(
            `Estudiante ${studentId} superó tolerancia pero está dentro del margen de tardanza (${calculatedDelay}min > ${tolerance}min). Registrado como TARDE.`,
          );
        }
      }

      // 2. Buscar si ya existe un registro de asistencia previo
      const existingRecord = await this.prisma.attendanceRecord.findFirst({
        where: {
          studentId: studentId,
          scheduleId: scheduleId,
          date: parsedDate,
        },
        select: { id: true },
      });

      let recordId: string;

      if (existingRecord) {
        recordId = existingRecord.id;

        // Actualizar registro existente
        await this.prisma.attendanceRecord.update({
          where: { id: recordId },
          data: {
            status: finalStatus,
            registeredBy: registeredByUserId,
            registeredAt: new Date(),
          },
        });

        // Manejar tabla 'tardiness'
        if (finalStatus === AttendanceStatus.tarde) {
          const existingTardiness = await this.prisma.tardiness.findFirst({
            where: { attendanceRecordId: recordId },
          });

          if (existingTardiness) {
            await this.prisma.tardiness.update({
              where: { id: existingTardiness.id },
              data: { delayMinutes: calculatedDelay },
            });
          } else {
            await this.prisma.tardiness.create({
              data: {
                attendanceRecordId: recordId,
                delayMinutes: calculatedDelay,
              },
            });
          }
        } else {
          // Si el estado ya no es "tarde", eliminar registro de tardanza asociado si existiera
          await this.prisma.tardiness.deleteMany({
            where: { attendanceRecordId: recordId },
          });
        }
      } else {
        // Insertar nuevo registro de asistencia
        const newRecord = await this.prisma.attendanceRecord.create({
          data: {
            scheduleId,
            studentId,
            date: parsedDate,
            status: finalStatus,
            registeredBy: registeredByUserId,
            tenantId,
          },
          select: { id: true },
        });

        recordId = newRecord.id;

        // Insertar en tabla tardiness si corresponde
        if (finalStatus === AttendanceStatus.tarde) {
          await this.prisma.tardiness.create({
            data: {
              attendanceRecordId: recordId,
              delayMinutes: calculatedDelay,
            },
          });
        }
      }

      // Si el estado final es AUSENTE o TARDE, gatillar verificación de alertas en segundo plano (fire & forget)
      if (finalStatus === AttendanceStatus.ausente || finalStatus === AttendanceStatus.tarde) {
        this.checkAndTriggerAlerts(studentId, scheduleId).catch((err) =>
          this.logger.error(`Error en checkAndTriggerAlerts para estudiante ${studentId}: ${err.message}`),
        );

        // Disparar la verificación del umbral dinámico de faltas injustificadas
        if (tenantId) {
          this.checkUnexcusedAbsenceThreshold(studentId, scheduleId, tenantId).catch((err) =>
            this.logger.error(`Error en checkUnexcusedAbsenceThreshold para estudiante ${studentId}: ${err.message}`),
          );
        }
      }

      results.push({
        studentId,
        status: finalStatus,
        delayMinutes: finalStatus === AttendanceStatus.tarde ? calculatedDelay : null,
      });
    }

    const newValues = {
      scheduleId,
      date,
      records: results.map((r) => ({
        studentId: r.studentId,
        status: r.status.toString(),
        delayMinutes: r.delayMinutes,
      })),
    };

    // Registrar de forma asíncrona en audit_logs
    this.auditService
      .writeLog(
        registeredByUserId,
        'BULK_UPDATE_ATTENDANCE',
        'attendance_records',
        scheduleId,
        oldValues,
        newValues,
      )
      .catch((err) =>
        this.logger.error(`Error al registrar auditoría en bulk attendance: ${err.message}`),
      );

    return {
      message: 'Asistencia registrada exitosamente en bloque',
      scheduleId,
      date,
      processedRecordsCount: results.length,
      records: results.map((r) => ({
        studentId: r.studentId,
        status: r.status.toString(),
        delayMinutes: r.delayMinutes,
      })),
    };
  }

  /**
   * Calcula la diferencia en minutos entre la hora actual de la zona horaria del servidor
   * y la hora de inicio del horario (HH:MM:SS)
   */
  private calculateDelayInMinutes(startTimeStr: string): number {
    try {
      const now = new Date();
      const [startHours, startMinutes, startSeconds] = startTimeStr.split(':').map(Number);
      
      const startTime = new Date();
      startTime.setHours(startHours, startMinutes, startSeconds || 0, 0);

      // Si por alguna razón la hora actual es menor que la hora de inicio, el retraso es 0
      if (now.getTime() < startTime.getTime()) {
        return 0;
      }

      const diffMs = now.getTime() - startTime.getTime();
      return Math.floor(diffMs / 1000 / 60); // Convertir ms a minutos enteros
    } catch (e) {
      this.logger.error(`Error al calcular minutos de demora: ${e.message}`);
      return 1;
    }
  }

  /**
   * Verifica la tasa de asistencia acumulada de un alumno en la asignatura de un horario específico
   * y dispara una alerta si cae por debajo del 80%.
   */
  private async checkAndTriggerAlerts(studentId: string, scheduleId: string): Promise<void> {
    try {
      // 1. Obtener la asignatura ligada a este schedule
      const schedule = await this.prisma.schedule.findUnique({
        where: { id: scheduleId },
        select: { subjectId: true },
      });

      if (!schedule?.subjectId) return;

      const subjectId = schedule.subjectId;

      // 2. Obtener todos los horarios para esta asignatura
      const schedules = await this.prisma.schedule.findMany({
        where: { subjectId: subjectId },
        select: { id: true },
      });

      const scheduleIds = schedules.map((s) => s.id);
      if (scheduleIds.length === 0) return;

      // 3. Obtener todos los registros de asistencia del alumno para esa asignatura
      const records = await this.prisma.attendanceRecord.findMany({
        where: {
          studentId: studentId,
          scheduleId: { in: scheduleIds },
        },
        select: { status: true },
      });

      const total = records.length;
      if (total < 3) return; // Esperar al menos 3 clases para generar alertas analíticas de tendencia

      let validAttendance = 0;
      records.forEach((r) => {
        if (r.status === AttendanceStatus.presente || r.status === AttendanceStatus.tarde || r.status === AttendanceStatus.justificado) {
          validAttendance++;
        }
      });

      const rate = (validAttendance / total) * 100;

      // 4. Si la tasa es menor al 80%, disparar la alerta
      if (rate < 80) {
        await this.notificationsService.triggerCriticalAttendanceAlert(studentId, subjectId, rate);
      }
    } catch (e: any) {
      this.logger.error(`Error en checkAndTriggerAlerts para ${studentId}: ${e.message}`);
    }
  }

  /**
   * Verifica el umbral de inasistencias injustificadas del alumno para una materia dada.
   * Si supera el umbral configurado por el tenant (default 20%), despacha correos automáticos.
   */
  private async checkUnexcusedAbsenceThreshold(studentId: string, scheduleId: string, tenantId: string): Promise<void> {
    try {
      if (!tenantId) return;

      // 1. Obtener la configuración del tenant (umbral)
      const settings = await this.prisma.tenantSetting.findUnique({
        where: { tenantId: tenantId },
      });

      const thresholdPercent = settings ? parseFloat(settings.unexcusedAbsenceThresholdPercent.toString()) : 20.0;
      const enableEmail = settings ? settings.enableEmailAlerts : true;
      const alertRecipients = settings ? settings.alertRecipients : [];

      if (!enableEmail) return;

      // 2. Obtener asignatura ligada a este schedule
      const schedule = await this.prisma.schedule.findUnique({
        where: { id: scheduleId },
        select: { subjectId: true },
      });

      if (!schedule?.subjectId) return;
      const subjectId = schedule.subjectId;

      // 3. Obtener todos los schedules de esta asignatura
      const schedules = await this.prisma.schedule.findMany({
        where: { subjectId: subjectId },
        select: { id: true },
      });

      const scheduleIds = schedules.map((s) => s.id);
      if (scheduleIds.length === 0) return;

      // 4. Obtener todos los registros de asistencia del estudiante para esta materia
      const records = await this.prisma.attendanceRecord.findMany({
        where: {
          studentId: studentId,
          scheduleId: { in: scheduleIds },
        },
        select: { status: true },
      });

      const totalClasses = records.length;
      if (totalClasses < 3) return; // Se requiere un mínimo de clases tomadas para establecer métricas

      const unexcusedAbsences = records.filter((r) => r.status === AttendanceStatus.ausente).length;
      const unexcusedRate = (unexcusedAbsences / totalClasses) * 100;

      // 5. Si supera el umbral configurado (ej: 20%), despachar alerta
      if (unexcusedRate > thresholdPercent) {
        // Obtener datos del alumno
        const student = await this.prisma.user.findUnique({
          where: { id: studentId },
          select: { firstName: true, lastName: true, email: true },
        });

        // Obtener nombre de la asignatura
        const subject = await this.prisma.subject.findUnique({
          where: { id: subjectId },
          select: { name: true },
        });

        if (student && subject) {
          const studentName = `${student.firstName} ${student.lastName}`;
          const subjectName = subject.name;
          const subjectLine = `[RIESGO ACADÉMICO] Límite de Inasistencias Superado en ${subjectName}`;

          // Generar plantilla
          const htmlTemplate = this.notificationsService['mailService'].getUnexcusedAbsenceThresholdAlertTemplate(
            studentName,
            subjectName,
            unexcusedAbsences,
            totalClasses,
            unexcusedRate
          );

          // Enviar correo al estudiante
          await this.notificationsService['mailService'].sendMail(
            student.email,
            subjectLine,
            htmlTemplate
          );

          // Enviar copia a los supervisores configurados
          if (alertRecipients && alertRecipients.length > 0) {
            for (const recipient of alertRecipients) {
              await this.notificationsService['mailService'].sendMail(
                recipient,
                `[Aviso Supervisor] ${studentName} ha superado el ${thresholdPercent}% de faltas en ${subjectName}`,
                htmlTemplate
              );
            }
          }

          // Crear notificación del sistema para el estudiante
          await this.notificationsService.createNotification(
            studentId,
            '⚠️ Riesgo de Reprobación por Faltas',
            `Has superado el umbral del ${thresholdPercent}% de inasistencias en la materia "${subjectName}". Tu tasa actual es de ${unexcusedRate.toFixed(1)}%.`,
            'riesgo_reprobacion'
          );
        }
      }
    } catch (err: any) {
      this.logger.error(`Error en checkUnexcusedAbsenceThreshold: ${err.message}`);
    }
  }
}
