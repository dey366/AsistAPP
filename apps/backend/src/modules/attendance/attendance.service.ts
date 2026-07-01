import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { BulkAttendanceDto, AttendanceStatus } from './dto/bulk-attendance.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Obtiene la lista de estudiantes inscritos en una asignatura (por carrera)
   * junto con su estado de asistencia para una fecha dada.
   */
  async getStudentsForSchedule(scheduleId: string, date: string) {
    const supabase = this.supabaseService.getClient();

    // 1. Obtener los detalles del horario y la asignatura asociada
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select('*, subject:subjects(*), classroom:classrooms(*)')
      .eq('id', scheduleId)
      .single();

    if (scheduleError || !schedule) {
      this.logger.error(`Error al obtener horario ${scheduleId}: ${scheduleError?.message}`);
      throw new NotFoundException(`El horario solicitado no existe`);
    }

    const subject = schedule.subject;
    if (!subject) {
      throw new BadRequestException('El horario no tiene una asignatura válida asignada');
    }

    // 2. Obtener todos los estudiantes activos que pertenecen a la carrera de la asignatura
    const { data: students, error: studentsError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, career_id')
      .eq('role_id', 'estudiante')
      .eq('career_id', subject.career_id)
      .eq('is_active', true)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });

    if (studentsError) {
      this.logger.error(`Error al obtener estudiantes para la carrera ${subject.career_id}: ${studentsError.message}`);
      throw new BadRequestException('No se pudieron recuperar los estudiantes inscritos');
    }

    // 3. Obtener los registros de asistencia existentes para ese horario y fecha
    const { data: attendanceRecords, error: attendanceError } = await supabase
      .from('attendance_records')
      .select('*, tardiness(delay_minutes, is_excused), justifications(reason, status)')
      .eq('schedule_id', scheduleId)
      .eq('date', date);

    if (attendanceError) {
      this.logger.error(`Error al obtener asistencia para el horario ${scheduleId} en la fecha ${date}: ${attendanceError.message}`);
      throw new BadRequestException('Error al recuperar registros de asistencia previos');
    }

    // 4. Cruzar estudiantes con sus registros de asistencia (si existen)
    const studentsWithAttendance = students.map((student) => {
      const record = attendanceRecords?.find((r) => r.student_id === student.id);
      
      return {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
        attendance: record
          ? {
              recordId: record.id,
              status: record.status,
              registeredBy: record.registered_by,
              registeredAt: record.registered_at,
              delayMinutes: record.tardiness?.delay_minutes ?? null,
              isExcusedTardiness: record.tardiness?.is_excused ?? null,
              justification: record.justifications
                ? {
                    reason: record.justifications.reason,
                    status: record.justifications.status,
                  }
                : null,
            }
          : null,
      };
    });

    return {
      schedule: {
        id: schedule.id,
        day_of_week: schedule.day_of_week,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        tolerance_minutes: schedule.tolerance_minutes ?? 15,
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
    const supabase = this.supabaseService.getClient();

    // 0. Obtener detalles del usuario para identificar su tenant_id
    const { data: currentUser } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', registeredByUserId)
      .single();

    const tenantId = currentUser?.tenant_id;

    if (tenantId) {
      // Validar si la fecha es un día feriado o inhábil
      const { data: holiday } = await supabase
        .from('holidays')
        .select('name')
        .eq('tenant_id', tenantId)
        .eq('date', date)
        .maybeSingle();

      if (holiday) {
        throw new BadRequestException(
          `La toma de asistencia está congelada en esta fecha (${date}) por ser un día feriado o inhábil institucional: "${holiday.name}".`
        );
      }
    }

    // Obtener los registros de asistencia previos antes de modificarlos para la auditoría
    const { data: previousRecords } = await supabase
      .from('attendance_records')
      .select('student_id, status')
      .eq('schedule_id', scheduleId)
      .eq('date', date);

    const oldValues = {
      scheduleId,
      date,
      records: previousRecords?.map((r) => ({
        studentId: r.student_id,
        status: r.status,
      })) || [],
    };

    // 1. Obtener detalles del horario para validar la tolerancia y hora de inicio
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select('*, subject:subjects(career_id)')
      .eq('id', scheduleId)
      .single();

    if (scheduleError || !schedule) {
      throw new NotFoundException(`El horario con ID ${scheduleId} no existe`);
    }

    let tolerance = schedule.tolerance_minutes ?? 10;
    let absentMinutes = 15; // Límite por defecto para falta automática

    if (tenantId) {
      // a. Buscar política global
      const { data: globalPolicy } = await supabase
        .from('tolerance_policies')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('scope', 'global')
        .maybeSingle();

      // b. Buscar política específica de carrera
      let careerPolicy = null;
      if (schedule.subject?.career_id) {
        const { data: cPol } = await supabase
          .from('tolerance_policies')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('scope', 'career')
          .eq('career_id', schedule.subject.career_id)
          .maybeSingle();
        careerPolicy = cPol;
      }

      // c. Buscar política específica de materia
      const { data: subjectPolicy } = await supabase
        .from('tolerance_policies')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('scope', 'subject')
        .eq('subject_id', schedule.subject_id)
        .maybeSingle();

      // Seleccionar política por orden de precedencia (Materia > Carrera > Global)
      const activePolicy = subjectPolicy || careerPolicy || globalPolicy;
      if (activePolicy) {
        tolerance = activePolicy.tolerance_minutes;
        absentMinutes = activePolicy.absent_minutes;
      }
    }

    const startTimeStr = schedule.start_time; // HH:MM:SS

    const results = [];


    // Procesar secuencialmente para garantizar la integridad y manejo de tardanzas
    for (const recordItem of records) {
      const { studentId, status: originalStatus, delayMinutes: providedDelay } = recordItem;
      let finalStatus = originalStatus;
      let calculatedDelay = 0;

      // Lógica de cálculo de retardo y tolerancia automatizada
      if (originalStatus === AttendanceStatus.TARDE) {
        if (providedDelay !== undefined && providedDelay !== null) {
          calculatedDelay = providedDelay;
        } else {
          // Si no se envía delayMinutes, pero la fecha de registro es HOY, calculamos la tardanza en base a la hora actual
          const todayStr = new Date().toISOString().split('T')[0];
          if (date === todayStr) {
            calculatedDelay = this.calculateDelayInMinutes(startTimeStr);
          } else {
            // Valor por defecto en edición retroactiva sin minutos provistos
            calculatedDelay = 1;
          }
        }

        // Si los minutos de tardanza superan el límite de ausencia automática,
        // el sistema lo computa automáticamente como inasistencia (AUSENTE)
        if (calculatedDelay > absentMinutes) {
          finalStatus = AttendanceStatus.AUSENTE;
          calculatedDelay = 0; // Al pasar a ausente, no se registra tardanza en la tabla tardiness
          this.logger.log(
            `Estudiante ${studentId} superó límite de ausencia automática (${calculatedDelay}min > ${absentMinutes}min). Registrado automáticamente como AUSENTE.`,
          );
        } else if (calculatedDelay > tolerance) {
          finalStatus = AttendanceStatus.TARDE;
          this.logger.log(
            `Estudiante ${studentId} superó tolerancia pero está dentro del margen de tardanza (${calculatedDelay}min > ${tolerance}min). Registrado como TARDE.`,
          );
        }
      }

      // 2. Buscar si ya existe un registro de asistencia previo
      const { data: existingRecord, error: searchError } = await supabase
        .from('attendance_records')
        .select('id, status')
        .eq('schedule_id', scheduleId)
        .eq('student_id', studentId)
        .eq('date', date)
        .maybeSingle();

      if (searchError) {
        this.logger.error(`Error al buscar asistencia previa para estudiante ${studentId}: ${searchError.message}`);
        continue;
      }

      let recordId: string;

      if (existingRecord) {
        recordId = existingRecord.id;

        // Actualizar registro existente
        const { error: updateError } = await supabase
          .from('attendance_records')
          .update({
            status: finalStatus,
            registered_by: registeredByUserId,
            registered_at: new Date().toISOString(),
          })
          .eq('id', recordId);

        if (updateError) {
          this.logger.error(`Error al actualizar asistencia ${recordId}: ${updateError.message}`);
          throw new BadRequestException(`No se pudo actualizar la asistencia del estudiante con ID ${studentId}`);
        }

        // Manejar tabla 'tardiness' (relación 1:1 con attendance_records)
        if (finalStatus === AttendanceStatus.TARDE) {
          const { data: existingTardiness } = await supabase
            .from('tardiness')
            .select('id')
            .eq('attendance_record_id', recordId)
            .maybeSingle();

          if (existingTardiness) {
            // Actualizar minutos de demora
            await supabase
              .from('tardiness')
              .update({ delay_minutes: calculatedDelay })
              .eq('id', existingTardiness.id);
          } else {
            // Crear registro de tardanza
            await supabase
              .from('tardiness')
              .insert({
                attendance_record_id: recordId,
                delay_minutes: calculatedDelay,
              });
          }
        } else {
          // Si el estado ya no es "tarde", eliminar registro de tardanza asociado si existiera
          await supabase
            .from('tardiness')
            .delete()
            .eq('attendance_record_id', recordId);
        }
      } else {
        // Insertar nuevo registro de asistencia
        const { data: newRecord, error: insertError } = await supabase
          .from('attendance_records')
          .insert({
            schedule_id: scheduleId,
            student_id: studentId,
            date: date,
            status: finalStatus,
            registered_by: registeredByUserId,
          })
          .select('id')
          .single();

        if (insertError || !newRecord) {
          this.logger.error(`Error al insertar asistencia para estudiante ${studentId}: ${insertError?.message}`);
          throw new BadRequestException(`No se pudo registrar la asistencia del estudiante con ID ${studentId}`);
        }

        recordId = newRecord.id;

        // Insertar en tabla tardiness si corresponde
        if (finalStatus === AttendanceStatus.TARDE) {
          const { error: tardinessError } = await supabase
            .from('tardiness')
            .insert({
              attendance_record_id: recordId,
              delay_minutes: calculatedDelay,
            });

          if (tardinessError) {
            this.logger.error(`Error al insertar tardanza para registro ${recordId}: ${tardinessError.message}`);
          }
        }
      }

      // Si el estado final es AUSENTE o TARDE, gatillar verificación de alertas en segundo plano (fire & forget)
      if (finalStatus === AttendanceStatus.AUSENTE || finalStatus === AttendanceStatus.TARDE) {
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
        delayMinutes: finalStatus === AttendanceStatus.TARDE ? calculatedDelay : null,
      });
    }

    const newValues = {
      scheduleId,
      date,
      records: results.map((r) => ({
        studentId: r.studentId,
        status: r.status,
        delayMinutes: r.delayMinutes,
      })),
    };

    // Registrar de forma asíncrona en audit_logs de Supabase Cloud
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
      records: results,
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
      return 1; // Fallback por defecto si hay error en formateo de fecha
    }
  }

  /**
   * Verifica la tasa de asistencia acumulada de un alumno en la asignatura de un horario específico
   * y dispara una alerta si cae por debajo del 80%.
   */
  private async checkAndTriggerAlerts(studentId: string, scheduleId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    try {
      // 1. Obtener la asignatura ligada a este schedule
      const { data: schedule } = await supabase
        .from('schedules')
        .select('subject_id')
        .eq('id', scheduleId)
        .single();

      if (!schedule?.subject_id) return;

      const subjectId = schedule.subject_id;

      // 2. Obtener todos los horarios para esta asignatura
      const { data: schedules } = await supabase
        .from('schedules')
        .select('id')
        .eq('subject_id', subjectId);

      const scheduleIds = schedules?.map((s) => s.id) ?? [];
      if (scheduleIds.length === 0) return;

      // 3. Obtener todos los registros de asistencia del alumno para esa asignatura
      const { data: records } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('student_id', studentId)
        .in('schedule_id', scheduleIds);

      const total = records?.length ?? 0;
      if (total < 3) return; // Esperar al menos 3 clases para generar alertas analíticas de tendencia

      let validAttendance = 0;
      records?.forEach((r) => {
        if (r.status === 'presente' || r.status === 'tarde' || r.status === 'justificado') {
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
    const supabase = this.supabaseService.getClient();

    try {
      if (!tenantId) return;

      // 1. Obtener la configuración del tenant (umbral)
      const { data: settings } = await supabase
        .from('tenant_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const thresholdPercent = settings ? parseFloat(settings.unexcused_absence_threshold_percent) : 20.0;
      const enableEmail = settings ? settings.enable_email_alerts : true;
      const alertRecipients = settings ? settings.alert_recipients : [];

      if (!enableEmail) return;

      // 2. Obtener asignatura ligada a este schedule
      const { data: schedule } = await supabase
        .from('schedules')
        .select('subject_id')
        .eq('id', scheduleId)
        .single();

      if (!schedule?.subject_id) return;
      const subjectId = schedule.subject_id;

      // 3. Obtener todos los schedules de esta asignatura
      const { data: schedules } = await supabase
        .from('schedules')
        .select('id')
        .eq('subject_id', subjectId);

      const scheduleIds = schedules?.map((s) => s.id) ?? [];
      if (scheduleIds.length === 0) return;

      // 4. Obtener todos los registros de asistencia del estudiante para esta materia
      const { data: records } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('student_id', studentId)
        .in('schedule_id', scheduleIds);

      const totalClasses = records?.length ?? 0;
      if (totalClasses < 3) return; // Se requiere un mínimo de clases tomadas para establecer métricas

      const unexcusedAbsences = records?.filter((r) => r.status === 'ausente').length ?? 0;
      const unexcusedRate = (unexcusedAbsences / totalClasses) * 100;

      // 5. Si supera el umbral configurado (ej: 20%), despachar alerta
      if (unexcusedRate > thresholdPercent) {
        // Obtener datos del alumno
        const { data: student } = await supabase
          .from('users')
          .select('first_name, last_name, email')
          .eq('id', studentId)
          .single();

        // Obtener nombre de la asignatura
        const { data: subject } = await supabase
          .from('subjects')
          .select('name')
          .eq('id', subjectId)
          .single();

        if (student && subject) {
          const studentName = `${student.first_name} ${student.last_name}`;
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
