import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { MailService } from './mail.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Crea una nueva notificación en la base de datos y la expone vía Supabase Realtime.
   */
  async createNotification(
    userId: string,
    title: string,
    message: string,
    type: string,
  ): Promise<any> {
    const supabase = this.supabaseService.getClient();

    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title,
          message,
          type,
          is_read: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err: any) {
      this.logger.error(`Error al crear notificación para ${userId}: ${err.message}`);
      throw new BadRequestException('No se pudo guardar la notificación');
    }
  }

  /**
   * Obtiene todas las notificaciones de un usuario ordenadas cronológicamente descendente.
   */
  async getUserNotifications(userId: string): Promise<any[]> {
    const supabase = this.supabaseService.getClient();

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err: any) {
      this.logger.error(`Error al listar notificaciones para ${userId}: ${err.message}`);
      throw new BadRequestException('No se pudieron listar las notificaciones');
    }
  }

  /**
   * Marca una notificación específica como leída.
   */
  async markAsRead(userId: string, notificationId: string): Promise<any> {
    const supabase = this.supabaseService.getClient();

    try {
      // Validar propiedad de la notificación
      const { data: check, error: checkError } = await supabase
        .from('notifications')
        .select('id, user_id')
        .eq('id', notificationId)
        .single();

      if (checkError || !check) {
        throw new NotFoundException(`Notificación no encontrada`);
      }

      if (check.user_id !== userId) {
        throw new BadRequestException('Operación no autorizada');
      }

      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err: any) {
      this.logger.error(`Error al marcar como leída ${notificationId}: ${err.message}`);
      if (err instanceof NotFoundException) throw err;
      throw new BadRequestException('No se pudo actualizar el estado de lectura');
    }
  }

  /**
   * Marca todas las notificaciones de un usuario como leídas.
   */
  async markAllAsRead(userId: string): Promise<number> {
    const supabase = this.supabaseService.getClient();

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return 1;
    } catch (err: any) {
      this.logger.error(`Error al marcar todas como leídas para ${userId}: ${err.message}`);
      throw new BadRequestException('No se pudieron marcar las notificaciones como leídas');
    }
  }

  /**
   * Dispara una alerta de inasistencia crítica (Asistencia por debajo del 80%).
   * Crea una notificación en Supabase y simula el envío del correo electrónico.
   */
  async triggerCriticalAttendanceAlert(
    studentId: string,
    subjectId: string,
    currentRate: number,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    try {
      // 1. Obtener datos del alumno y de la asignatura
      const { data: student, error: studentError } = await supabase
        .from('users')
        .select('first_name, last_name, email')
        .eq('id', studentId)
        .single();

      const { data: subject, error: subjectError } = await supabase
        .from('subjects')
        .select('name')
        .eq('id', subjectId)
        .single();

      if (studentError || subjectError || !student || !subject) {
        this.logger.warn(`No se pudieron recopilar los datos para la alerta de asistencia crítica. Student: ${studentId}, Subject: ${subjectId}`);
        return;
      }

      const studentName = `${student.first_name} studentName: ${student.last_name}`;
      const subjectName = subject.name;
      const title = '⚠️ Alerta de Inasistencia Crítica';
      const message = `Tu porcentaje de asistencia en la materia "${subjectName}" ha descendido a un nivel crítico del ${currentRate.toFixed(1)}%. Podrías reprobar si continúas acumulando faltas.`;

      // 2. Crear notificación en base de datos (Supabase Realtime la expone al instante)
      await this.createNotification(
        studentId,
        title,
        message,
        'alerta_asistencia',
      );

      // 3. Simular envío de correo institucional
      const htmlTemplate = this.mailService.getAlertAttendanceCriticalTemplate(
        `${student.first_name} ${student.last_name}`,
        subjectName,
        currentRate,
      );

      await this.mailService.sendMail(
        student.email,
        `[AsistApp Alerta] Inasistencia Crítica en ${subjectName}`,
        htmlTemplate,
      );
    } catch (err: any) {
      this.logger.error(`Error en triggerCriticalAttendanceAlert: ${err.message}`);
    }
  }

  /**
   * Dispara una alerta cuando el supervisor resuelve una justificación (Aprobada / Rechazada).
   * Crea una notificación en Supabase y simula el envío del correo de resolución.
   */
  async triggerJustificationResolutionAlert(
    studentId: string,
    subjectId: string,
    dateString: string,
    status: 'aprobada' | 'rechazada',
    comments?: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    try {
      // 1. Obtener datos del alumno y de la asignatura
      const { data: student, error: studentError } = await supabase
        .from('users')
        .select('first_name, last_name, email')
        .eq('id', studentId)
        .single();

      const { data: subject, error: subjectError } = await supabase
        .from('subjects')
        .select('name')
        .eq('id', subjectId)
        .single();

      if (studentError || subjectError || !student || !subject) {
        this.logger.warn(`No se pudieron recopilar los datos para la alerta de justificación. Student: ${studentId}, Subject: ${subjectId}`);
        return;
      }

      const subjectName = subject.name;
      const title = status === 'aprobada' ? '✅ Justificación Aprobada' : '❌ Justificación Rechazada';
      const message = `Tu solicitud de justificación para la clase de "${subjectName}" el día ${dateString} fue ${status.toUpperCase()} por tu coordinador.${comments ? ` Comentarios: "${comments}"` : ''}`;

      // 2. Crear notificación en base de datos
      await this.createNotification(
        studentId,
        title,
        message,
        status === 'aprobada' ? 'justificacion_aprobada' : 'justificacion_rechazada',
      );

      // 3. Simular envío de correo institucional
      const htmlTemplate = this.mailService.getJustificationResolutionTemplate(
        `${student.first_name} ${student.last_name}`,
        subjectName,
        dateString,
        status,
        comments,
      );

      await this.mailService.sendMail(
        student.email,
        `[AsistApp] Estado de tu Justificación: ${status.toUpperCase()}`,
        htmlTemplate,
      );
    } catch (err: any) {
      this.logger.error(`Error en triggerJustificationResolutionAlert: ${err.message}`);
    }
  }
}
