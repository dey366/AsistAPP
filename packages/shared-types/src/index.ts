// Roles del sistema
export type UserRole = 'admin' | 'supervisor' | 'docente' | 'estudiante';

// Estados de asistencia
export type AttendanceStatus = 'presente' | 'tarde' | 'ausente' | 'justificado';

// Estado de justificaciones
export type JustificationStatus = 'pendiente' | 'aprobada' | 'rechazada';

// Contrato de perfil de usuario
export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  careerId?: string;
  tenantId?: string;
  isActive: boolean;
  avatarUrl?: string;
  createdAt: string;
}

// Datos de asistencia diaria
export interface AttendanceRecordDto {
  id: string;
  scheduleId: string;
  studentId: string;
  date: string;
  status: AttendanceStatus;
  registeredBy?: string;
  registeredAt: string;
}

// Horario simplificado
export interface ScheduleDto {
  id: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  classroomId?: string;
  classroomName?: string;
  dayOfWeek: number; // 1-7
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  toleranceMinutes: number;
}
