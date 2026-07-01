'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  FileWarning, 
  Save, 
  RefreshCw,
  BookOpen,
  Calendar,
  ChevronRight,
  Minus,
  Plus,
  AlertTriangle
} from 'lucide-react';

interface Schedule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  tolerance_minutes: number;
  classroom?: { name: string } | null;
  subject?: { id: string; name: string; code: string } | null;
}

interface StudentAttendanceState {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: 'presente' | 'tarde' | 'ausente' | 'justificado';
  delayMinutes: number;
  isLocked: boolean; // Justificado por supervisor o inamovible
  justificationReason?: string | null;
}

export default function DocenteDashboardPage() {
  const { user, token } = useAuthStore();
  
  // Horarios y Horario seleccionado
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
  
  // Fecha (Por defecto hoy)
  const [date, setDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  // Lista de estudiantes y sus estados de asistencia local
  const [students, setStudents] = useState<StudentAttendanceState[]>([]);
  
  // Estados de carga e interfaz
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(true);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'take' | 'history'>('take');
  const [selectedScheduleDetails, setSelectedScheduleDetails] = useState<any>(null);
  
  // Mensajes de feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  // Mostrar toast temporizado
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Cargar Horarios del Docente desde Supabase
  useEffect(() => {
    const fetchSchedules = async () => {
      if (!user?.id) return;
      setIsLoadingSchedules(true);
      try {
        const { data, error } = await supabase
          .from('schedules')
          .select(`
            id,
            day_of_week,
            start_time,
            end_time,
            tolerance_minutes,
            classroom:classrooms(name),
            subject:subjects(id, name, code)
          `)
          .eq('teacher_id', user.id);

        if (error) throw error;
        
        const typedSchedules = (data as any[]) || [];
        setSchedules(typedSchedules);
        
        if (typedSchedules.length > 0) {
          setSelectedScheduleId(typedSchedules[0].id);
        }
      } catch (err: any) {
        console.error('Error al cargar horarios:', {
          message: err?.message,
          code: err?.code,
          details: err?.details,
          hint: err?.hint,
          error: err
        });
        showToast('No se pudieron cargar tus horarios académicos', 'error');
      } finally {
        setIsLoadingSchedules(false);
      }
    };

    fetchSchedules();
  }, [user]);

  // 2. Cargar Estudiantes y Asistencia guardada
  const loadAttendanceData = async () => {
    if (!selectedScheduleId || !date || !token) return;
    
    setIsLoadingStudents(true);
    try {
      const response = await fetch(`${API_URL}/attendance/schedule/${selectedScheduleId}/date/${date}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar la asistencia desde el servidor');
      }

      const data = await response.json();
      setSelectedScheduleDetails(data.schedule);

      // Mapear los estudiantes de la API a nuestro estado local
      const mappedStudents: StudentAttendanceState[] = data.students.map((student: any) => {
        const hasRecord = student.attendance !== null;
        
        return {
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          email: student.email,
          // Si ya existe asistencia guardada, usamos esa. Si no, pre-seleccionamos "presente"
          status: hasRecord ? student.attendance.status : 'presente',
          delayMinutes: hasRecord && student.attendance.status === 'tarde' ? (student.attendance.delayMinutes || 5) : 5,
          // Si el estudiante tiene una justificación aprobada, bloqueamos su estado como inamovible (justificado)
          isLocked: hasRecord && student.attendance.justification?.status === 'aprobada',
          justificationReason: hasRecord && student.attendance.justification ? student.attendance.justification.reason : null,
        };
      });

      setStudents(mappedStudents);
    } catch (err: any) {
      console.error(err);
      showToast('Error al conectar con la API de asistencia', 'error');
    } finally {
      setIsLoadingStudents(false);
    }
  };

  useEffect(() => {
    loadAttendanceData();
  }, [selectedScheduleId, date, token]);

  // 3. Manejar cambio de estado de un alumno
  const handleStatusChange = (studentId: string, newStatus: 'presente' | 'tarde' | 'ausente' | 'justificado') => {
    setStudents(prev => prev.map(student => {
      if (student.id !== studentId || student.isLocked) return student;
      return { 
        ...student, 
        status: newStatus,
        // Si cambia a tarde, asignamos 5 min por defecto, de lo contrario 0
        delayMinutes: newStatus === 'tarde' ? student.delayMinutes || 5 : 5
      };
    }));
  };

  // 4. Manejar minutos de retraso
  const handleDelayChange = (studentId: string, increment: boolean) => {
    setStudents(prev => prev.map(student => {
      if (student.id !== studentId || student.isLocked) return student;
      const currentDelay = student.delayMinutes || 5;
      const newDelay = increment ? currentDelay + 5 : Math.max(1, currentDelay - 5);
      return { ...student, delayMinutes: newDelay };
    }));
  };

  const handleDelayValChange = (studentId: string, value: number) => {
    setStudents(prev => prev.map(student => {
      if (student.id !== studentId || student.isLocked) return student;
      return { ...student, delayMinutes: Math.max(1, value) };
    }));
  };

  // 5. Acciones Masivas
  const markAllAs = (status: 'presente' | 'ausente') => {
    setStudents(prev => prev.map(s => {
      if (s.isLocked) return s;
      return { ...s, status, delayMinutes: 5 };
    }));
    showToast(`Todos los alumnos marcados como ${status.toUpperCase()}`, 'info');
  };

  // 6. Guardar Asistencia en Bloque en NestJS
  const handleSaveAttendance = async () => {
    if (!selectedScheduleId || !date || !token) return;

    setIsSaving(true);
    try {
      const recordsPayload = students.map(student => ({
        studentId: student.id,
        status: student.status,
        delayMinutes: student.status === 'tarde' ? student.delayMinutes : undefined
      }));

      const response = await fetch(`${API_URL}/attendance/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          scheduleId: selectedScheduleId,
          date,
          records: recordsPayload
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al guardar la asistencia');
      }

      const result = await response.json();
      showToast(result.message || 'Asistencia registrada con éxito', 'success');
      
      // Recargar para sincronizar cálculos y estados desde la DB
      await loadAttendanceData();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error al guardar la asistencia masiva', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 7. Cálculos de KPIs reactivos en tiempo real
  const totalStudentsCount = students.length;
  const presentesCount = students.filter(s => s.status === 'presente').length;
  const tardesCount = students.filter(s => s.status === 'tarde').length;
  const ausentesCount = students.filter(s => s.status === 'ausente').length;
  const justificadosCount = students.filter(s => s.status === 'justificado').length;

  const attendanceRate = totalStudentsCount > 0 
    ? ((presentesCount + tardesCount) / totalStudentsCount * 100).toFixed(1)
    : '100.0';

  // Helper para obtener el día de la semana en texto
  const getDayName = (dayNum: number) => {
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    return days[dayNum - 1] || 'Desconocido';
  };

  // Formatear hora (HH:MM:SS a HH:MM AM/PM)
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '---';
    try {
      const [hours, minutes] = timeStr.split(':');
      const hrs = parseInt(hours);
      const ampm = hrs >= 12 ? 'PM' : 'AM';
      const formattedHrs = hrs % 12 || 12;
      return `${formattedHrs}:${minutes} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  return (
    <DashboardLayout>
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900' 
            : toastMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900'
              : 'bg-zinc-50 text-zinc-800 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800'
        }`}>
          {toastMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
          {toastMessage.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />}
          {toastMessage.type === 'info' && <Users className="w-5 h-5 text-zinc-500 shrink-0" />}
          <span className="text-sm font-semibold tracking-wide">{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 select-none pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-emerald-500 flex-shrink-0" />
            Asistencia en Bloque
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión inteligente de puntualidad y registro de inasistencias por materia.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Selector de Horario */}
          <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-2 py-1">
            <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
            <select
              value={selectedScheduleId}
              onChange={(e) => setSelectedScheduleId(e.target.value)}
              className="text-xs font-semibold bg-transparent border-none text-foreground focus:outline-none max-w-[200px]"
              disabled={isLoadingSchedules}
            >
              {schedules.map((schedule) => (
                <option key={schedule.id} value={schedule.id} className="bg-background text-foreground">
                  {schedule.subject?.name} ({getDayName(schedule.day_of_week)})
                </option>
              ))}
              {schedules.length === 0 && (
                <option value="">Sin horarios asignados</option>
              )}
            </select>
          </div>

          {/* Selector de Fecha */}
          <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-2 py-1">
            <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-xs font-semibold bg-transparent border-none text-foreground focus:outline-none"
            />
          </div>

          <Button 
            variant="outline" 
            size="sm"
            onClick={loadAttendanceData}
            isLoading={isLoadingStudents}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refrescar
          </Button>

          <Button 
            variant="default" 
            size="sm"
            onClick={handleSaveAttendance}
            isLoading={isSaving}
            disabled={totalStudentsCount === 0 || isLoadingStudents}
            leftIcon={<Save className="w-3.5 h-3.5" />}
            className="shadow-sm shadow-emerald-500/10"
          >
            Guardar Cambios
          </Button>
        </div>
      </div>

      {/* Detalle de Clase Seleccionada */}
      {selectedScheduleDetails && (
        <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-border rounded-xl p-4 flex flex-wrap gap-4 items-center justify-between select-none">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-100 dark:border-emerald-900/40">
              {selectedScheduleDetails.subject?.code || 'SUB'}
            </div>
            <div>
              <h4 className="font-bold text-foreground text-sm tracking-tight">{selectedScheduleDetails.subject?.name}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Aula: <span className="font-semibold text-foreground">{selectedScheduleDetails.classroom}</span> | Horario: <span className="font-semibold text-foreground">{formatTime(selectedScheduleDetails.start_time)} - {formatTime(selectedScheduleDetails.end_time)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="px-3 py-1.5 rounded-lg border border-border bg-background">
              Tolerancia: <span className="font-bold text-emerald-600">{selectedScheduleDetails.tolerance_minutes} min</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg border border-border bg-background">
              Ciclo Académico: <span className="font-bold text-zinc-700 dark:text-zinc-300">2026-I</span>
            </div>
          </div>
        </div>
      )}

      {/* KPIs Reactivos */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 select-none">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Tasa de Asistencia</p>
            <h3 className="text-2xl font-bold tracking-tight text-foreground">{attendanceRate}%</h3>
            <p className="text-xs text-muted-foreground font-medium leading-none">Presentes + Tardes</p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-xl border border-emerald-100 dark:border-emerald-900 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Tardanzas locales</p>
            <h3 className="text-2xl font-bold tracking-tight text-amber-500">{tardesCount}</h3>
            <p className="text-xs text-muted-foreground leading-none">Minutos acumulables</p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-500 rounded-xl border border-amber-100 dark:border-amber-900 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Inasistencias</p>
            <h3 className="text-2xl font-bold tracking-tight text-rose-500">{ausentesCount}</h3>
            <p className="text-xs text-muted-foreground leading-none">Por registrar en la nube</p>
          </div>
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 rounded-xl border border-rose-100 dark:border-rose-900 shrink-0">
            <FileWarning className="w-6 h-6" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Justificados</p>
            <h3 className="text-2xl font-bold tracking-tight text-indigo-500">{justificadosCount}</h3>
            <p className="text-xs text-muted-foreground leading-none">Validados por Supervisor</p>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 rounded-xl border border-indigo-100 dark:border-indigo-900 shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabla Interactiva de Estudiantes */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Alumnos Matriculados</h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-muted-foreground">
              {totalStudentsCount} estudiantes
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground">Acción masiva rápida:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllAs('presente')}
              disabled={isLoadingStudents || totalStudentsCount === 0}
              className="text-[10px] uppercase font-bold py-1 px-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-950 dark:hover:bg-emerald-950/20"
            >
              Marcar todos como Presentes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllAs('ausente')}
              disabled={isLoadingStudents || totalStudentsCount === 0}
              className="text-[10px] uppercase font-bold py-1 px-2 border-rose-200 text-rose-500 hover:bg-rose-50 dark:border-rose-950 dark:hover:bg-rose-950/20"
            >
              Marcar todos como Ausentes
            </Button>
          </div>
        </div>

        {isLoadingStudents ? (
          /* Skeletons de Carga */
          <div className="border border-border rounded-xl bg-card p-4 space-y-4">
            {[1, 2, 3, 4].map(idx => (
              <div key={idx} className="flex items-center justify-between gap-4 py-3 animate-pulse border-b border-border/40 last:border-0">
                <div className="flex items-center gap-3 w-1/3">
                  <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  <div className="space-y-2 w-full">
                    <div className="h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
                    <div className="h-2.5 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
                  </div>
                </div>
                <div className="flex items-center gap-2 w-1/2 justify-end">
                  <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-20" />
                  <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-20" />
                  <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : totalStudentsCount === 0 ? (
          /* Sin Resultados */
          <div className="border border-dashed border-border rounded-xl bg-card p-12 text-center select-none">
            <Users className="w-12 h-12 text-muted-foreground/60 mx-auto stroke-1.5" />
            <h3 className="font-bold text-foreground text-base mt-4">Sin Estudiantes Inscritos</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              No encontramos estudiantes registrados para esta carrera de asignatura. Verifica tu configuración o contacta con el supervisor académico.
            </p>
          </div>
        ) : (
          /* Listado de Estudiantes */
          <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-zinc-50 dark:bg-zinc-900/60 select-none text-xs font-semibold text-muted-foreground">
                    <th className="py-3 px-4">Estudiante</th>
                    <th className="py-3 px-4 text-right">Asistencia / Toma del Docente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {students.map((student) => {
                    const avatarInitials = `${student.first_name[0] || ''}${student.last_name[0] || ''}`.toUpperCase();
                    
                    // Gradiente dinámico de fondo para avatar
                    const isLocked = student.isLocked;
                    
                    return (
                      <tr 
                        key={student.id} 
                        className={`transition-colors duration-150 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 ${
                          isLocked ? 'bg-zinc-50/60 dark:bg-zinc-900/20 opacity-80' : ''
                        }`}
                      >
                        {/* Celda Estudiante */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-indigo-600/20 border border-border flex items-center justify-center font-bold text-xs text-foreground shrink-0 select-none">
                              {avatarInitials}
                            </div>
                            <div>
                              <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                                {student.first_name} {student.last_name}
                                {isLocked && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 uppercase tracking-wide">
                                    Aprobada
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5 font-mono">{student.email}</div>
                              {student.justificationReason && (
                                <p className="text-[10px] text-indigo-500 font-medium mt-1">
                                  Motivo de Licencia: "{student.justificationReason}"
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Botonera de Estado Semántica */}
                        <td className="py-4 px-4 text-right">
                          <div className="flex flex-wrap items-center gap-2 justify-end">
                            
                            {/* Botón Presente */}
                            <button
                              onClick={() => handleStatusChange(student.id, 'presente')}
                              disabled={isLocked}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 cursor-pointer ${
                                student.status === 'presente'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900'
                                  : 'bg-background text-muted-foreground border-border hover:bg-zinc-50 dark:hover:bg-zinc-800'
                              } ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                            >
                              Presente
                            </button>

                            {/* Botón Tarde + Control de Minutos */}
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleStatusChange(student.id, 'tarde')}
                                disabled={isLocked}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 cursor-pointer ${
                                  student.status === 'tarde'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900'
                                    : 'bg-background text-muted-foreground border-border hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                } ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                              >
                                Tarde
                              </button>

                              {student.status === 'tarde' && (
                                <div className="inline-flex items-center border border-amber-200 dark:border-amber-900 bg-amber-50/20 dark:bg-amber-950/10 rounded-lg p-1 animate-in fade-in zoom-in-95 duration-200 select-none">
                                  <button
                                    onClick={() => handleDelayChange(student.id, false)}
                                    disabled={isLocked || student.delayMinutes <= 1}
                                    className="p-1 rounded text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/50 disabled:opacity-30 cursor-pointer"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <input
                                    type="number"
                                    value={student.delayMinutes}
                                    onChange={(e) => handleDelayValChange(student.id, parseInt(e.target.value) || 1)}
                                    disabled={isLocked}
                                    className="w-10 text-center text-xs font-bold bg-transparent text-amber-700 dark:text-amber-400 border-none outline-none focus:ring-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 pr-1 select-none">min</span>
                                  <button
                                    onClick={() => handleDelayChange(student.id, true)}
                                    disabled={isLocked}
                                    className="p-1 rounded text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/50 cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Botón Ausente */}
                            <button
                              onClick={() => handleStatusChange(student.id, 'ausente')}
                              disabled={isLocked}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 cursor-pointer ${
                                student.status === 'ausente'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900'
                                  : 'bg-background text-muted-foreground border-border hover:bg-zinc-50 dark:hover:bg-zinc-800'
                              } ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                            >
                              Ausente
                            </button>

                            {/* Botón Justificado */}
                            <button
                              onClick={() => handleStatusChange(student.id, 'justificado')}
                              disabled={isLocked}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 cursor-pointer ${
                                student.status === 'justificado'
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900'
                                  : 'bg-background text-muted-foreground border-border hover:bg-zinc-50 dark:hover:bg-zinc-800'
                              } ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                            >
                              Justificado
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Floating Save Bar for better UX */}
      {!isLoadingStudents && totalStudentsCount > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between select-none shadow-md">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <Users className="w-4 h-4 text-emerald-500 shrink-0" />
            Cambios retenidos en el navegador. Haz clic en "Guardar Asistencia" para guardarlos en la nube de Supabase.
          </div>
          <Button 
            variant="default" 
            size="sm"
            onClick={handleSaveAttendance}
            isLoading={isSaving}
            leftIcon={<Save className="w-4 h-4" />}
            className="shadow-sm shadow-emerald-500/10 shrink-0"
          >
            Guardar Asistencia
          </Button>
        </div>
      )}
    </DashboardLayout>
  );
}
