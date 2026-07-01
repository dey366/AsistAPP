import { IsUUID, IsNotEmpty, IsDateString, IsArray, ValidateNested, IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AttendanceStatus {
  PRESENTE = 'presente',
  TARDE = 'tarde',
  AUSENTE = 'ausente',
  JUSTIFICADO = 'justificado',
}

export class AttendanceRecordItemDto {
  @ApiProperty({
    description: 'UUID del estudiante',
    example: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
  })
  @IsUUID('4', { message: 'El ID del estudiante debe ser un UUID válido v4' })
  @IsNotEmpty({ message: 'El ID del estudiante no puede estar vacío' })
  studentId: string;

  @ApiProperty({
    description: 'Estado de la asistencia',
    enum: AttendanceStatus,
    example: AttendanceStatus.PRESENTE,
  })
  @IsEnum(AttendanceStatus, {
    message: 'El estado debe ser: presente, tarde, ausente o justificado',
  })
  @IsNotEmpty({ message: 'El estado de la asistencia no puede estar vacío' })
  status: AttendanceStatus;

  @ApiPropertyOptional({
    description: 'Minutos de retraso, requerido si el estado es tarde',
    example: 10,
    minimum: 0,
  })
  @IsOptional()
  @IsInt({ message: 'Los minutos de retraso deben ser un número entero' })
  @Min(0, { message: 'Los minutos de retraso no pueden ser negativos' })
  delayMinutes?: number;
}

export class BulkAttendanceDto {
  @ApiProperty({
    description: 'UUID del horario (schedules)',
    example: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02',
  })
  @IsUUID('4', { message: 'El ID del horario debe ser un UUID válido v4' })
  @IsNotEmpty({ message: 'El ID del horario no puede estar vacío' })
  scheduleId: string;

  @ApiProperty({
    description: 'Fecha de la asistencia (formato YYYY-MM-DD)',
    example: '2026-05-20',
  })
  @IsDateString({}, { message: 'La fecha debe estar en formato YYYY-MM-DD válido' })
  @IsNotEmpty({ message: 'La fecha es requerida' })
  date: string;

  @ApiProperty({
    description: 'Lista de registros de asistencia de los estudiantes',
    type: [AttendanceRecordItemDto],
  })
  @IsArray({ message: 'Los registros deben ser un arreglo' })
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordItemDto)
  records: AttendanceRecordItemDto[];
}
