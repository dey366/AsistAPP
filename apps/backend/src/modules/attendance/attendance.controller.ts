import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { BulkAttendanceDto } from './dto/bulk-attendance.dto';
import { SupabaseAuthGuard } from '../../auth/guards/supabase-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('attendance')
@ApiBearerAuth('JWT-auth')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('schedule/:scheduleId/date/:date')
  @Roles('docente', 'admin', 'supervisor')
  @ApiOperation({
    summary: 'Obtener estudiantes y su estado de asistencia para un horario y fecha específicos',
    description: 'Devuelve la lista de estudiantes inscritos y sus registros de asistencia, tardanzas y justificaciones correspondientes.',
  })
  @ApiParam({
    name: 'scheduleId',
    description: 'UUID del horario académico',
    type: 'string',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
  })
  @ApiParam({
    name: 'date',
    description: 'Fecha a consultar (formato YYYY-MM-DD)',
    type: 'string',
    example: '2026-05-20',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de estudiantes obtenida exitosamente.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Token de sesión ausente, inválido o expirado.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Rol insuficiente para acceder a este recurso.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'El horario no existe.',
  })
  async getStudentsForSchedule(
    @Param('scheduleId') scheduleId: string,
    @Param('date') date: string,
  ) {
    return this.attendanceService.getStudentsForSchedule(scheduleId, date);
  }

  @Post('bulk')
  @Roles('docente', 'admin', 'supervisor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Registrar o actualizar asistencia en bloque',
    description: 'Permite registrar la asistencia en bloque para un horario y fecha dados. Calcula de forma automática tardanzas e inasistencias en base a la tolerancia del horario.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Asistencias registradas y tardanzas procesadas de forma transaccional.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Error en la validación de los datos provistos o durante la persistencia.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Token de sesión ausente, inválido o expirado.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Rol insuficiente para registrar asistencia.',
  })
  async registerBulkAttendance(
    @Body() dto: BulkAttendanceDto,
    @CurrentUser() user: any,
  ) {
    return this.attendanceService.registerBulkAttendance(dto, user.id);
  }
}
