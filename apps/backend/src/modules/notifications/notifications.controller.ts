import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { SupabaseAuthGuard } from '../../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(SupabaseAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar notificaciones del usuario autenticado',
    description: 'Devuelve una lista de todas las notificaciones recibidas, ordenadas cronológicamente.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de notificaciones obtenida con éxito.',
  })
  async getMyNotifications(@CurrentUser() currentUser: any) {
    return this.notificationsService.getUserNotifications(currentUser.id);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marcar una notificación específica como leída',
    description: 'Actualiza el estado de lectura de una notificación a verdadero.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID de la notificación',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notificación marcada como leída.',
  })
  async markNotificationAsRead(
    @Param('id') id: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.notificationsService.markAsRead(currentUser.id, id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marcar todas las notificaciones del usuario como leídas',
    description: 'Actualiza masivamente el estado de lectura de todas las notificaciones pendientes a verdadero.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Todas las notificaciones marcadas como leídas con éxito.',
  })
  async markAllNotificationsAsRead(@CurrentUser() currentUser: any) {
    await this.notificationsService.markAllAsRead(currentUser.id);
    return { success: true, message: 'Todas las notificaciones fueron marcadas como leídas.' };
  }

  @Post('test-threshold-alert')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enviar alerta de inasistencia por correo (Manual / Test)',
    description: 'Dispara el envío de correo de alerta por inasistencia crítica para un alumno y asignatura específicos.',
  })
  async testThresholdAlert(
    @Body('studentId') studentId: string,
    @Body('subjectId') subjectId: string,
    @Body('rate') rate: number,
  ) {
    await this.notificationsService.triggerCriticalAttendanceAlert(studentId, subjectId, rate);
    return { success: true, message: 'Alerta de inasistencia despachada correctamente.' };
  }
}
