import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { SupabaseAuthGuard } from '../../auth/guards/supabase-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('reports')
@ApiBearerAuth('JWT-auth')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard-stats')
  @Roles('admin', 'supervisor')
  @ApiOperation({
    summary: 'Obtener métricas y KPIs globales para el dashboard de administración',
    description: 'Devuelve la tasa de asistencia, ausentismo y estado de justificaciones acumulado.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Estadísticas agregadas generadas correctamente.',
  })
  async getDashboardStats() {
    return this.reportsService.getDashboardStats();
  }

  @Get('tendencias')
  @Roles('admin', 'supervisor', 'docente')
  @ApiOperation({
    summary: 'Obtener historial analítico temporal para graficación',
    description: 'Retorna la asistencia total acumulada y agrupada cronológicamente por fecha.',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Número de días hacia atrás a consultar',
    required: false,
    type: 'number',
    example: 15,
  })
  async getTendenciasTemporales(@Query('limit') limit?: number) {
    const limitVal = limit ? Number(limit) : 15;
    return this.reportsService.getTendenciasTemporales(limitVal);
  }

  @Get('student/:studentId')
  @Roles('estudiante', 'docente', 'admin', 'supervisor')
  @ApiOperation({
    summary: 'Obtener analíticas y tasas de asistencia detalladas de un estudiante',
    description: 'Retorna las estadísticas del estudiante desglosadas por materia asignada.',
  })
  @ApiParam({
    name: 'studentId',
    description: 'UUID del estudiante a consultar',
    type: 'string',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
  })
  async getStudentStats(
    @Param('studentId') studentId: string,
    @CurrentUser() currentUser: any,
  ) {
    // Regla de Privacidad: Un estudiante solo puede consultar su propia información analítica.
    if (currentUser.role_id === 'estudiante' && currentUser.id !== studentId) {
      throw new ForbiddenException('No tienes permisos para consultar las estadísticas de otro estudiante.');
    }
    return this.reportsService.getStudentStats(studentId);
  }

  @Get('subject/:subjectId')
  @Roles('docente', 'admin', 'supervisor')
  @ApiOperation({
    summary: 'Obtener analíticas agregadas y listado de alumnos de una asignatura',
    description: 'Muestra el rendimiento y estado de asistencia acumulado por materia.',
  })
  @ApiParam({
    name: 'subjectId',
    description: 'UUID de la asignatura académica',
    type: 'string',
  })
  async getSubjectStats(@Param('subjectId') subjectId: string) {
    return this.reportsService.getSubjectStats(subjectId);
  }

  @Get('export/csv')
  @Roles('admin', 'supervisor')
  @ApiOperation({
    summary: 'Exportar registros de asistencia en formato tabular CSV',
    description: 'Genera un archivo CSV descargable aplicando filtros temporales o por materia.',
  })
  @ApiQuery({ name: 'startDate', required: false, type: 'string', example: '2026-05-01' })
  @ApiQuery({ name: 'endDate', required: false, type: 'string', example: '2026-05-31' })
  @ApiQuery({ name: 'subjectId', required: false, type: 'string' })
  async exportAttendanceToCsv(
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    const csvContent = await this.reportsService.exportAttendanceToCsv({
      startDate,
      endDate,
      subjectId,
    });

    const filename = `reporte_asistencia_${new Date().toISOString().split('T')[0]}.csv`;
    
    // Configurar cabeceras Express para forzar descarga del archivo
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(HttpStatus.OK).send('\uFEFF' + csvContent); // BOM UTF-8 para compatibilidad de acentos en Excel
  }
}
