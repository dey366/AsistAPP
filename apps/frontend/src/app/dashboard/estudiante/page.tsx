'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormInput } from '@/components/ui/FormInput';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';
import { StatusPieChart } from '@/components/dashboard/AttendanceCharts';
import { 
  User, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  FilePlus,
  Send,
  BookOpen,
  TrendingUp,
  FileWarning
} from 'lucide-react';

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'presente' | 'tarde' | 'ausente' | 'justificado';
  subjectName: string;
  time: string;
}

interface StudentAnalytics {
  globalStats: {
    totalRecords: number;
    presentes: number;
    tardes: number;
    ausentes: number;
    justificados: number;
    attendanceRate: number;
  };
  subjects: Array<{
    id: string;
    name: string;
    code: string;
    presentes: number;
    tardes: number;
    ausentes: number;
    justificados: number;
    total: number;
    attendanceRate: number;
    inRisk: boolean;
  }>;
}

export default function EstudianteDashboardPage() {
  const { user, token } = useAuthStore();
  
  // Estado local para datos reales
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  
  // Modal de justificaciones
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justificationReason, setJustificationReason] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  
  // Cargas
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Cargar analíticas de NestJS
  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!user?.id || !token) return;
      setIsLoadingAnalytics(true);
      try {
        const response = await fetch(`${API_URL}/reports/student/${user.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) throw new Error('Error al recuperar analíticas del estudiante');
        const data = await response.json();
        setAnalytics(data);
      } catch (err: any) {
        console.error(err);
        showToast('No se pudieron sincronizar tus analíticas académicas', 'error');
      } finally {
        setIsLoadingAnalytics(false);
      }
    };

    fetchAnalytics();
  }, [user, token]);

  // Cargar registros diarios directamente de Supabase
  const loadDailyAttendance = async () => {
    if (!user?.id) return;
    setIsLoadingList(true);
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          id,
          date,
          status,
          schedule:schedules(
            start_time,
            subject:subjects(name)
          )
        `)
        .eq('student_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;

      const formatted: AttendanceRecord[] = (data as any[] || []).map(item => ({
        id: item.id,
        date: item.date,
        status: item.status,
        subjectName: item.schedule?.subject?.name || 'Asignatura no asignada',
        time: item.schedule?.start_time ? item.schedule.start_time.substring(0, 5) : '---'
      }));

      setAttendanceList(formatted);
    } catch (err: any) {
      console.error('Error al cargar historial diario: ' + (err?.message || err) + ' (Código: ' + (err?.code || 'sin código') + ', Detalles: ' + (err?.details || 'ninguno') + ', Hint: ' + (err?.hint || 'ninguno') + ')');
      showToast('Error al cargar tu historial diario de asistencia', 'error');
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    loadDailyAttendance();
  }, [user]);

  const handleOpenJustifyModal = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setJustificationReason('');
    setIsModalOpen(true);
  };

  const handleSendJustification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || !user?.id) return;
    setIsSubmitting(true);

    try {
      // Registrar la justificación en Supabase
      const { error } = await supabase
        .from('justifications')
        .insert({
          attendance_record_id: selectedRecord.id,
          reason: justificationReason,
          status: 'pendiente'
        });

      if (error) throw error;

      // Actualizar localmente el estado del registro a justificado
      setAttendanceList(prev => 
        prev.map(item => item.id === selectedRecord.id ? { ...item, status: 'justificado' } : item)
      );

      showToast('Justificación enviada correctamente', 'success');
      setIsModalOpen(false);
      setSelectedRecord(null);

      // Recargar analíticas en background para sincronizar
      const response = await fetch(`${API_URL}/reports/student/${user.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (err: any) {
      console.error(err);
      showToast('Error al guardar la justificación académica', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Fecha',
      accessor: (item: AttendanceRecord) => (
        <span className="font-mono text-xs text-zinc-900 dark:text-zinc-50 font-semibold">{item.date}</span>
      )
    },
    {
      header: 'Asignatura',
      accessor: (item: AttendanceRecord) => (
        <div className="font-medium text-muted-foreground">{item.subjectName}</div>
      )
    },
    {
      header: 'Hora de Clase',
      accessor: (item: AttendanceRecord) => (
        <span className="font-mono text-xs">{item.time} hs</span>
      )
    },
    {
      header: 'Estado',
      accessor: (item: AttendanceRecord) => {
        const badges = {
          presente: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900',
          tarde: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-900',
          ausente: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200 dark:border-rose-900',
          justificado: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900'
        };

        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize tracking-wide ${badges[item.status]}`}>
            {item.status}
          </span>
        );
      }
    },
    {
      header: 'Acciones',
      accessor: (item: AttendanceRecord) => (
        item.status === 'ausente' ? (
          <Button 
            variant="ghost" 
            className="h-8 py-0 px-2 flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/10 rounded-lg"
            onClick={() => handleOpenJustifyModal(item)}
          >
            <FilePlus className="w-3.5 h-3.5" />
            Justificar
          </Button>
        ) : (
          <span className="text-xs text-zinc-400 dark:text-zinc-600 font-mono select-none">Ninguna</span>
        )
      )
    }
  ];

  // Variables calculadas
  const attendanceRate = analytics?.globalStats?.attendanceRate ?? 100;
  const totalInscriptions = analytics?.subjects?.length ?? 0;
  const inRiskCount = analytics?.subjects?.filter(s => s.inRisk).length ?? 0;

  return (
    <DashboardLayout>
      {/* Toast Feedback */}
      {toastMessage && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center px-4 py-3 rounded-lg shadow-lg border text-sm animate-fade-in ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-zinc-900 dark:text-emerald-400 dark:border-emerald-950'
            : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-zinc-900 dark:text-rose-400 dark:border-rose-950'
        }`}>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 select-none pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl flex items-center gap-2">
            <User className="w-8 h-8 text-violet-500 flex-shrink-0" />
            Panel del Estudiante
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sincronización académica en tiempo real. Bienvenido, {user?.first_name || 'Estudiante'} {user?.last_name || ''}.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 select-none">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Mi Asistencia</p>
            <h3 className="text-2xl font-bold tracking-tight text-foreground">
              {isLoadingAnalytics ? '...' : `${attendanceRate}%`}
            </h3>
            <p className={`text-xs font-semibold leading-none ${attendanceRate >= 80 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {attendanceRate >= 80 ? 'Cumple requisito (Min. 80%)' : 'Bajo el límite mínimo'}
            </p>
          </div>
          <div className={`p-3 rounded-xl border shrink-0 ${
            attendanceRate >= 80 
              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border-emerald-100 dark:border-emerald-900'
              : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 border-rose-100 dark:border-rose-900'
          }`}>
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Tardanzas</p>
            <h3 className="text-2xl font-bold tracking-tight text-foreground">
              {isLoadingAnalytics ? '...' : (analytics?.globalStats?.tardes ?? 0)}
            </h3>
            <p className="text-xs text-amber-600 font-semibold leading-none">Registros en el período</p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-600 rounded-xl border border-amber-100 dark:border-amber-900 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Inasistencias</p>
            <h3 className="text-2xl font-bold tracking-tight text-foreground">
              {isLoadingAnalytics ? '...' : (analytics?.globalStats?.ausentes ?? 0)}
            </h3>
            <p className="text-xs text-rose-600 font-semibold leading-none">Pendientes de justificar</p>
          </div>
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 rounded-xl border border-rose-100 dark:border-rose-900 shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Asignaturas en Riesgo</p>
            <h3 className="text-2xl font-bold tracking-tight text-foreground">
              {isLoadingAnalytics ? '...' : inRiskCount}
            </h3>
            <p className="text-xs text-muted-foreground leading-none">De un total de {totalInscriptions} cursadas</p>
          </div>
          <div className={`p-3 rounded-xl border shrink-0 ${
            inRiskCount > 0 
              ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-500 border-rose-100 dark:border-rose-900' 
              : 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-300 border-border'
          }`}>
            <BookOpen className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Gráficos y Distribución */}
      {!isLoadingAnalytics && analytics && (
        <div className="grid gap-6 md:grid-cols-3 select-none">
          {/* Gráfico de dona (Recharts) */}
          <div className="md:col-span-1 rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-violet-500" />
                Distribución de Asistencia
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Desglose porcentual del ciclo activo.</p>
            </div>
            <div className="mt-4 flex items-center justify-center">
              <StatusPieChart data={{
                presente: analytics.globalStats.presentes,
                tarde: analytics.globalStats.tardes,
                ausente: analytics.globalStats.ausentes,
                justificado: analytics.globalStats.justificados
              }} />
            </div>
          </div>

          {/* Listado de Asignaturas y Rendimiento Individual */}
          <div className="md:col-span-2 rounded-xl border border-border bg-card p-6 shadow-sm">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-violet-500" />
                Porcentaje de Asistencia por Asignatura
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Control de inasistencias en base al 80% reglamentario.</p>
            </div>

            <div className="mt-6 space-y-5 overflow-y-auto max-h-60 pr-1">
              {analytics.subjects.map((subj) => (
                <div key={subj.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-zinc-800 dark:text-zinc-200">
                      {subj.name} <span className="text-[10px] text-muted-foreground">({subj.code})</span>
                    </span>
                    <span className={subj.inRisk ? 'text-rose-600' : 'text-emerald-600'}>
                      {subj.attendanceRate}%
                    </span>
                  </div>
                  
                  {/* Barra de Progreso */}
                  <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        subj.inRisk ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, subj.attendanceRate)}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Clases Totales: {subj.total}</span>
                    {subj.inRisk && (
                      <span className="flex items-center gap-0.5 text-rose-500 font-medium">
                        <FileWarning className="w-3 h-3" />
                        Riesgo de reprobación por faltas
                      </span>
                    )}
                  </div>
                </div>
              ))}
              
              {analytics.subjects.length === 0 && (
                <div className="h-44 flex items-center justify-center text-zinc-400 text-xs">
                  No estás matriculado en ninguna asignatura este ciclo.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Historial Diario */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground select-none">Mi Historial de Asistencia Diario</h2>
        <DataTable
          columns={columns}
          data={attendanceList}
          isLoading={isLoadingList}
          emptyTitle="Sin asistencia"
          emptyMessage="No tienes registros de asistencia en este período."
        />
      </div>

      {/* Modal Justificación */}
      {selectedRecord && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Justificar Inasistencia"
          footer={
            <>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button 
                variant="default" 
                onClick={handleSendJustification} 
                isLoading={isSubmitting}
                leftIcon={<Send className="w-4 h-4" />}
              >
                Enviar Solicitud
              </Button>
            </>
          }
        >
          <form onSubmit={handleSendJustification} className="space-y-4 text-left">
            <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-border">
              <p className="text-xs text-muted-foreground font-semibold">Detalles de Inasistencia</p>
              <p className="text-sm font-semibold text-foreground mt-1">
                {selectedRecord.subjectName} ({selectedRecord.date})
              </p>
            </div>
            
            <FormInput
              label="Motivo o Justificación Académica"
              placeholder="Ej. Constancia médica por problemas de salud..."
              value={justificationReason}
              onChange={(e) => setJustificationReason(e.target.value)}
              required
            />
            
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400">
                Evidencia de Justificación (Opcional)
              </label>
              <div className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium select-none hover:border-zinc-400 dark:hover:border-zinc-700 cursor-pointer">
                <input 
                  type="file" 
                  className="opacity-0 absolute inset-0 cursor-pointer" 
                  disabled
                />
                <span className="text-xs text-muted-foreground self-center">Subir documento PDF/JPG (Deshabilitado en desarrollo)</span>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </DashboardLayout>
  );
}
