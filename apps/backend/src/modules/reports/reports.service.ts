import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Obtiene estadísticas agregadas globales para el panel del administrador y supervisor.
   */
  async getDashboardStats() {
    const supabase = this.supabaseService.getClient();

    try {
      // 1. Obtener todos los estados de asistencia registrados
      const { data: records, error: recordsError } = await supabase
        .from('attendance_records')
        .select('status');

      if (recordsError) {
        throw new Error(`Error en records: ${recordsError.message}`);
      }

      const totalRecords = records?.length ?? 0;
      let presentes = 0;
      let tardes = 0;
      let ausentes = 0;
      let justificados = 0;

      records?.forEach((rec) => {
        if (rec.status === 'presente') presentes++;
        else if (rec.status === 'tarde') tardes++;
        else if (rec.status === 'ausente') ausentes++;
        else if (rec.status === 'justificado') justificados++;
      });

      // Evitar divisiones por cero
      const divisor = totalRecords || 1;
      const tasaAsistencia = ((presentes + tardes + justificados) / divisor) * 100;
      const tasaAusentismo = (ausentes / divisor) * 100;
      const tasaPuntualidad = (presentes / divisor) * 100;

      // 2. Obtener justificaciones pendientes
      const { count: pendingJustifications, error: justificationsError } = await supabase
        .from('justifications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendiente');

      if (justificationsError) {
        this.logger.error(`Error al obtener justificaciones pendientes: ${justificationsError.message}`);
      }

      // 3. Contar usuarios activos por rol
      const { data: usersCount, error: usersError } = await supabase
        .from('users')
        .select('role_id, is_active');

      if (usersError) {
        this.logger.error(`Error al obtener conteo de usuarios: ${usersError.message}`);
      }

      let totalEstudiantes = 0;
      let totalDocentes = 0;

      usersCount?.forEach((u) => {
        if (u.is_active) {
          if (u.role_id === 'estudiante') totalEstudiantes++;
          else if (u.role_id === 'docente') totalDocentes++;
        }
      });

      return {
        summary: {
          totalRecords,
          presentes,
          tardes,
          ausentes,
          justificados,
          tasaAsistencia: parseFloat(tasaAsistencia.toFixed(2)),
          tasaAusentismo: parseFloat(tasaAusentismo.toFixed(2)),
          tasaPuntualidad: parseFloat(tasaPuntualidad.toFixed(2)),
        },
        widgets: {
          pendingJustifications: pendingJustifications ?? 0,
          activeStudentsCount: totalEstudiantes,
          activeTeachersCount: totalDocentes,
        },
      };
    } catch (err: any) {
      this.logger.error(`Error en getDashboardStats: ${err.message}`);
      throw new BadRequestException('No se pudieron consolidar las estadísticas del dashboard');
    }
  }

  /**
   * Obtiene la tendencia de asistencia de los últimos X días para graficar.
   */
  async getTendenciasTemporales(limitDays = 15) {
    const supabase = this.supabaseService.getClient();

    try {
      // 1. Obtener los últimos registros agrupando por fecha de asistencia
      // Para optimizar en Supabase/JS, extraemos fecha y estado y agrupamos en memoria
      const { data: records, error } = await supabase
        .from('attendance_records')
        .select('date, status')
        .order('date', { ascending: false });

      if (error) throw error;

      // Agrupar por fecha en memoria
      const grouped: { [key: string]: any } = {};

      records?.forEach((rec) => {
        const dateStr = rec.date;
        if (!grouped[dateStr]) {
          grouped[dateStr] = {
            date: dateStr,
            presente: 0,
            tarde: 0,
            ausente: 0,
            justificado: 0,
            total: 0,
          };
        }
        grouped[dateStr][rec.status] = (grouped[dateStr][rec.status] || 0) + 1;
        grouped[dateStr].total++;
      });

      // Convertir a array, ordenar cronológicamente ascendente y limitar
      const sortedTrend = Object.values(grouped)
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-limitDays); // Tomar los últimos 'limitDays' días

      return sortedTrend;
    } catch (err: any) {
      this.logger.error(`Error en getTendenciasTemporales: ${err.message}`);
      throw new BadRequestException('Error al recuperar las tendencias temporales de asistencia');
    }
  }

  /**
   * Obtiene la analítica de asistencia detallada para un estudiante.
   */
  async getStudentStats(studentId: string) {
    const supabase = this.supabaseService.getClient();

    try {
      // 1. Validar que el estudiante existe
      const { data: student, error: studentError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, career:careers(name)')
        .eq('id', studentId)
        .eq('role_id', 'estudiante')
        .single();

      if (studentError || !student) {
        throw new NotFoundException(`El estudiante con ID ${studentId} no existe`);
      }

      // 2. Obtener todos los registros de asistencia del alumno con los datos de asignatura y horario
      const { data: records, error: recordsError } = await supabase
        .from('attendance_records')
        .select(`
          status,
          date,
          schedule:schedules(
            id,
            subject:subjects(id, name, code)
          )
        `)
        .eq('student_id', studentId);

      if (recordsError) throw recordsError;

      const totalRecords = records?.length ?? 0;
      let presentes = 0;
      let tardes = 0;
      let ausentes = 0;
      let justificados = 0;

      // Agrupación por asignatura en memoria
      const subjectsMap: { [key: string]: any } = {};

      records?.forEach((rec: any) => {
        // Métricas globales del alumno
        if (rec.status === 'presente') presentes++;
        else if (rec.status === 'tarde') tardes++;
        else if (rec.status === 'ausente') ausentes++;
        else if (rec.status === 'justificado') justificados++;

        // Métricas por asignatura
        const subject = rec.schedule?.subject;
        if (subject) {
          if (!subjectsMap[subject.id]) {
            subjectsMap[subject.id] = {
              id: subject.id,
              name: subject.name,
              code: subject.code,
              presente: 0,
              tarde: 0,
              ausente: 0,
              justificado: 0,
              total: 0,
            };
          }
          subjectsMap[subject.id][rec.status]++;
          subjectsMap[subject.id].total++;
        }
      });

      // Estructurar el desglose de asignaturas
      const subjectsSummary = Object.values(subjectsMap).map((subj: any) => {
        const subTotal = subj.total || 1;
        // Tasa de asistencia = (presentes + tardes + justificados) / total
        const attendanceRate = ((subj.presente + subj.tarde + subj.justificado) / subTotal) * 100;
        
        return {
          id: subj.id,
          name: subj.name,
          code: subj.code,
          presentes: subj.presente,
          tardes: subj.tarde,
          ausentes: subj.ausente,
          justificados: subj.justificado,
          total: subj.total,
          attendanceRate: parseFloat(attendanceRate.toFixed(2)),
          inRisk: attendanceRate < 80, // Límite del 80% para aprobar asistencia
        };
      });

      const divisor = totalRecords || 1;
      const globalAttendanceRate = ((presentes + tardes + justificados) / divisor) * 100;

      return {
        student: {
          id: student.id,
          name: `${student.first_name} ${student.last_name}`,
          email: student.email,
          career: student.career ? (student.career as any).name : 'No asignada',
        },
        globalStats: {
          totalRecords,
          presentes,
          tardes,
          ausentes,
          justificados,
          attendanceRate: parseFloat(globalAttendanceRate.toFixed(2)),
        },
        subjects: subjectsSummary,
      };
    } catch (err: any) {
      this.logger.error(`Error en getStudentStats para ${studentId}: ${err.message}`);
      if (err instanceof NotFoundException) throw err;
      throw new BadRequestException('Error al recuperar las estadísticas analíticas del estudiante');
    }
  }

  /**
   * Obtiene la analítica agregada para una asignatura en particular.
   */
  async getSubjectStats(subjectId: string) {
    const supabase = this.supabaseService.getClient();

    try {
      // 1. Validar que la asignatura existe
      const { data: subject, error: subjectError } = await supabase
        .from('subjects')
        .select('*, career:careers(name)')
        .eq('id', subjectId)
        .single();

      if (subjectError || !subject) {
        throw new NotFoundException(`La asignatura con ID ${subjectId} no existe`);
      }

      // 2. Obtener todos los horarios para esta asignatura
      const { data: schedules, error: schedulesError } = await supabase
        .from('schedules')
        .select('id')
        .eq('subject_id', subjectId);

      if (schedulesError) throw schedulesError;

      const scheduleIds = schedules?.map((s) => s.id) ?? [];

      if (scheduleIds.length === 0) {
        return {
          subject: {
            id: subject.id,
            name: subject.name,
            code: subject.code,
            career: subject.career ? (subject.career as any).name : 'No asignada',
          },
          message: 'La asignatura no tiene horarios ni registros de asistencia asignados',
          globalStats: { totalRecords: 0, attendanceRate: 100 },
          studentsList: [],
        };
      }

      // 3. Obtener todos los registros de asistencia para esos horarios
      const { data: records, error: recordsError } = await supabase
        .from('attendance_records')
        .select(`
          status,
          student_id,
          student:users(id, first_name, last_name, email)
        `)
        .in('schedule_id', scheduleIds);

      if (recordsError) throw recordsError;

      const totalRecords = records?.length ?? 0;
      let presentes = 0;
      let tardes = 0;
      let ausentes = 0;
      let justificados = 0;

      const studentsMap: { [key: string]: any } = {};

      records?.forEach((rec: any) => {
        if (rec.status === 'presente') presentes++;
        else if (rec.status === 'tarde') tardes++;
        else if (rec.status === 'ausente') ausentes++;
        else if (rec.status === 'justificado') justificados++;

        const student = rec.student;
        if (student) {
          if (!studentsMap[student.id]) {
            studentsMap[student.id] = {
              id: student.id,
              name: `${student.first_name} ${student.last_name}`,
              email: student.email,
              presente: 0,
              tarde: 0,
              ausente: 0,
              justificado: 0,
              total: 0,
            };
          }
          studentsMap[student.id][rec.status]++;
          studentsMap[student.id].total++;
        }
      });

      const studentsList = Object.values(studentsMap).map((stud: any) => {
        const studTotal = stud.total || 1;
        const rate = ((stud.presente + stud.tarde + stud.justificado) / studTotal) * 100;
        return {
          id: stud.id,
          name: stud.name,
          email: stud.email,
          presentes: stud.presente,
          tardes: stud.tarde,
          ausentes: stud.ausente,
          justificados: stud.justificado,
          total: stud.total,
          attendanceRate: parseFloat(rate.toFixed(2)),
          inRisk: rate < 80,
        };
      }).sort((a, b) => a.attendanceRate - b.attendanceRate); // Ordenar de menor asistencia a mayor (críticos primero)

      const divisor = totalRecords || 1;
      const globalAttendanceRate = ((presentes + tardes + justificados) / divisor) * 100;

      return {
        subject: {
          id: subject.id,
          name: subject.name,
          code: subject.code,
          career: subject.career ? (subject.career as any).name : 'No asignada',
        },
        globalStats: {
          totalRecords,
          presentes,
          tardes,
          ausentes,
          justificados,
          attendanceRate: parseFloat(globalAttendanceRate.toFixed(2)),
        },
        studentsList,
      };
    } catch (err: any) {
      this.logger.error(`Error en getSubjectStats para ${subjectId}: ${err.message}`);
      if (err instanceof NotFoundException) throw err;
      throw new BadRequestException('Error al recuperar las estadísticas analíticas de la asignatura');
    }
  }

  /**
   * Genera una cadena estructurada en formato CSV con registros de asistencia filtrados.
   */
  async exportAttendanceToCsv(filters: {
    startDate?: string;
    endDate?: string;
    subjectId?: string;
  }) {
    const supabase = this.supabaseService.getClient();

    try {
      let query = supabase
        .from('attendance_records')
        .select(`
          date,
          status,
          registered_at,
          student:users(first_name, last_name, email, career:careers(name)),
          schedule:schedules(
            start_time,
            end_time,
            subject:subjects(name, code)
          ),
          tardiness(delay_minutes)
        `);

      if (filters.startDate) {
        query = query.gte('date', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('date', filters.endDate);
      }

      const { data: records, error } = await query;

      if (error) throw error;

      // Filtrar por materia si se requiere (ya que no se puede hacer filtrado anidado de relación profunda de forma directa en Supabase)
      let filteredRecords = records || [];
      if (filters.subjectId) {
        filteredRecords = filteredRecords.filter(
          (rec: any) => rec.schedule?.subject?.id === filters.subjectId,
        );
      }

      // Construcción del archivo CSV
      const headers = [
        'Fecha',
        'Estudiante',
        'Correo',
        'Carrera',
        'Asignatura',
        'Código Asignatura',
        'Horario Clase',
        'Estado',
        'Minutos Retraso',
        'Registrado En (UTC)',
      ];

      const csvRows = [headers.join(',')];

      filteredRecords.forEach((rec: any) => {
        const student = rec.student;
        const schedule = rec.schedule;
        const subject = schedule?.subject;
        const delay = rec.tardiness?.delay_minutes ?? '0';

        const row = [
          rec.date,
          `"${student?.first_name ?? ''} ${student?.last_name ?? ''}"`,
          student?.email ?? '',
          `"${(student?.career as any)?.name ?? 'No asignada'}"`,
          `"${subject?.name ?? ''}"`,
          subject?.code ?? '',
          `"${schedule?.start_time ?? ''} a ${schedule?.end_time ?? ''}"`,
          rec.status.toUpperCase(),
          delay,
          rec.registered_at,
        ];

        csvRows.push(row.join(','));
      });

      return csvRows.join('\n');
    } catch (err: any) {
      this.logger.error(`Error al exportar CSV: ${err.message}`);
      throw new BadRequestException('Ocurrió un error al generar la exportación de datos');
    }
  }
}
