'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormInput } from '@/components/ui/FormInput';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';
import { TrendAreaChart } from '@/components/dashboard/AttendanceCharts';
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Download,
  ShieldAlert,
  Eye,
  TrendingUp,
  Award
} from 'lucide-react';

interface JustificationRecord {
  id: string;
  studentName: string;
  subjectName: string;
  date: string;
  reason: string;
  status: 'pendiente' | 'aprobada' | 'rechazada';
  attendanceRecordId: string;
}

interface TrendItem {
  date: string;
  presente: number;
  tarde: number;
  ausente: number;
  justificado: number;
  total: number;
}

export default function SupervisorDashboardPage() {
  const { user, token } = useAuthStore();
  
  // Listados y Cargas reales
  const [justifications, setJustifications] = useState<JustificationRecord[]>([]);
  const [trendData, setTrendData] = useState<TrendItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  
  const [selectedJustification, setSelectedJustification] = useState<JustificationRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comments, setComments] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const [isLoadingJustifications, setIsLoadingJustifications] = useState(true);
  const [isLoadingTrends, setIsLoadingTrends] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'inbox' | 'analytics'>('inbox');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Cargar estadísticas agregadas del Dashboard
  const loadStats = async () => {
    if (!token) return;
    setIsLoadingStats(true);
    try {
      const response = await fetch(`${API_URL}/reports/dashboard-stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error(err);
      showToast('Error al sincronizar métricas institucionales', 'error');
    } finally {
      setIsLoadingStats(false);
    }
  };

  // 2. Cargar tendencias cronológicas
  const loadTrends = async () => {
    if (!token) return;
    setIsLoadingTrends(true);
    try {
      const response = await fetch(`${API_URL}/reports/tendencias?limit=14`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setTrendData(data);
    } catch (err) {
      console.error(err);
      showToast('Error al cargar historial temporal de asistencia', 'error');
    } finally {
      setIsLoadingTrends(false);
    }
  };

  // 3. Cargar justificaciones pendientes y resueltas desde Supabase
  const loadJustifications = async () => {
    setIsLoadingJustifications(true);
    try {
      const { data, error } = await supabase
        .from('justifications')
        .select(`
          id,
          reason,
          status,
          attendance_record_id,
          attendance_record:attendance_records(
            date,
            student:users(first_name, last_name),
            schedule:schedules(
              subject:subjects(name)
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted: JustificationRecord[] = (data as any[] || []).map(j => ({
        id: j.id,
        studentName: `${j.attendance_record?.student?.first_name || ''} ${j.attendance_record?.student?.last_name || ''}`.trim() || 'Estudiante',
        subjectName: j.attendance_record?.schedule?.subject?.name || 'Asignatura no asignada',
        date: j.attendance_record?.date || '---',
        reason: j.reason,
        status: j.status,
        attendanceRecordId: j.attendance_record_id
      }));

      setJustifications(formatted);
    } catch (err: any) {
      console.error(err);
      showToast('Error al cargar la bandeja de justificaciones', 'error');
    } finally {
      setIsLoadingJustifications(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadStats();
      loadTrends();
      loadJustifications();

      // Realtime subscription for interactive updates
      const channel = supabase
        .channel('supervisor-realtime-channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'attendance_records' },
          (payload) => {
            console.log('Realtime change in attendance_records:', payload);
            loadStats();
            loadTrends();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'justifications' },
          (payload) => {
            console.log('Realtime change in justifications:', payload);
            loadStats();
            loadTrends();
            loadJustifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [token]);

  const handleOpenJustification = (justification: JustificationRecord) => {
    setSelectedJustification(justification);
    setComments('');
    setIsModalOpen(true);
  };

  // Resolver la justificación con actualización en caliente de base de datos
  const handleResolve = async (status: 'aprobada' | 'rechazada') => {
    if (!selectedJustification || !user?.id) return;
    
    const MOCK_PREFIXES = ['just-', 'att-'];
    const isMockData = MOCK_PREFIXES.some(prefix => selectedJustification.id.startsWith(prefix));
    
    setIsSubmitting(true);
    try {
      if (isMockData) {
        // Handle mock/demo data locally
        const storedMocks = localStorage.getItem('asistapp_mock_justifications');
        let currentMocks = storedMocks ? JSON.parse(storedMocks) : [];
        
        currentMocks = currentMocks.map((j: any) =>
          j.id === selectedJustification.id
            ? { ...j, status, comments }
            : j
        );
        
        localStorage.setItem('asistapp_mock_justifications', JSON.stringify(currentMocks));
        
        // Update local state in supervisor justifications list
        setJustifications(prev =>
          prev.map(j =>
            j.id === selectedJustification.id
              ? { ...j, status }
              : j
          )
        );
      } else {
        // 1. Actualizar estado de la justificación real en la BD
        const { error: justError } = await supabase
          .from('justifications')
          .update({
            status,
            comments,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', selectedJustification.id);

        if (justError) throw justError;

        // 2. Sincronizar el estado del registro de asistencia correspondiente
        const targetAttendanceStatus = status === 'aprobada' ? 'justificado' : 'ausente';
        const { error: attError } = await supabase
          .from('attendance_records')
          .update({
            status: targetAttendanceStatus,
            registered_by: user.id,
            registered_at: new Date().toISOString()
          })
          .eq('id', selectedJustification.attendanceRecordId);

        if (attError) throw attError;

        // Recargar datos reales en caliente
        await loadJustifications();
        await loadStats();
        await loadTrends();
      }

      showToast(`Justificación ${status === 'aprobada' ? 'APROBADA' : 'RECHAZADA'} con éxito`, 'success');
      setIsModalOpen(false);
      setSelectedJustification(null);
    } catch (err: any) {
      console.error('handleResolve error:', err);
      showToast('Error al actualizar el estado de la justificación', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Descarga directa del CSV de reporte de NestJS
  const handleExportCSV = async () => {
    if (!token) return;
    setIsExporting(true);
    try {
      const response = await fetch(`${API_URL}/reports/export/csv`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error al descargar el archivo CSV');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_asistencia_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      showToast('Reporte exportado en CSV correctamente', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error al exportar los reportes', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const columns = [
    {
      header: 'Estudiante',
      accessor: (item: JustificationRecord) => (
        <div className="font-semibold text-zinc-900 dark:text-zinc-50">{item.studentName}</div>
      )
    },
    {
      header: 'Asignatura',
      accessor: (item: JustificationRecord) => (
        <div className="text-muted-foreground">{item.subjectName}</div>
      )
    },
    {
      header: 'Fecha Inasistencia',
      accessor: (item: JustificationRecord) => (
        <span className="font-mono text-xs">{item.date}</span>
      )
    },
    {
      header: 'Estado',
      accessor: (item: JustificationRecord) => {
        const badges = {
          pendiente: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-900',
          aprobada: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900',
          rechazada: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
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
      accessor: (item: JustificationRecord) => (
        <Button 
          variant="ghost" 
          className="h-8 py-0 px-2 flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/10 rounded-lg"
          onClick={() => handleOpenJustification(item)}
        >
          <Eye className="w-3.5 h-3.5" />
          Revisar
        </Button>
      )
    }
  ];

  const totalPending = stats?.widgets?.pendingJustifications ?? 0;
  const globalAttendanceRate = stats?.summary?.tasaAsistencia ?? 100;
  const activeStudents = stats?.widgets?.activeStudentsCount ?? 0;

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
            <FileText className="w-8 h-8 text-amber-500 flex-shrink-0" />
            Panel de Supervisión
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoreo y aprobación de inasistencias institucionales. Bienvenido, {user?.first_name || 'Supervisor'}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            isLoading={isExporting}
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleExportCSV}
          >
            Exportar Asistencias CSV
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border select-none gap-4">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`pb-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'inbox' 
              ? 'border-violet-500 text-violet-600 dark:text-violet-400' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Bandeja de Entrada
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'analytics' 
              ? 'border-violet-500 text-violet-600 dark:text-violet-400' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Tendencias & Analíticas
        </button>
      </div>

      {activeTab === 'inbox' ? (
        <>
          {/* KPIs */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 select-none">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Justificaciones Pendientes</p>
                <h3 className="text-2xl font-bold tracking-tight text-foreground">
                  {isLoadingStats ? '...' : totalPending}
                </h3>
                <p className="text-xs text-amber-600 font-semibold leading-none">Requieren acción</p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-600 rounded-xl border border-amber-100 dark:border-amber-900 shrink-0">
                <Clock className="w-6 h-6" />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Asistencia Institucional</p>
                <h3 className="text-2xl font-bold tracking-tight text-foreground">
                  {isLoadingStats ? '...' : `${globalAttendanceRate}%`}
                </h3>
                <p className="text-xs text-emerald-600 font-semibold leading-none">Promedio del ciclo</p>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-xl border border-emerald-100 dark:border-emerald-900 shrink-0">
                <CheckCircle className="w-6 h-6" />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Estudiantes Activos</p>
                <h3 className="text-2xl font-bold tracking-tight text-foreground">
                  {isLoadingStats ? '...' : activeStudents}
                </h3>
                <p className="text-xs text-muted-foreground leading-none">Matriculados actualmente</p>
              </div>
              <div className="p-3 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-300 rounded-xl border border-border shrink-0">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Resoluciones Totales</p>
                <h3 className="text-2xl font-bold tracking-tight text-foreground">
                  {justifications.filter(j => j.status !== 'pendiente').length}
                </h3>
                <p className="text-xs text-muted-foreground leading-none">Aprobadas o rechazadas</p>
              </div>
              <div className="p-3 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-300 rounded-xl border border-border shrink-0">
                <Award className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Tabla de Justificaciones */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight text-foreground select-none">Bandeja de Justificaciones Recientes</h2>
            <DataTable
              columns={columns}
              data={justifications}
              isLoading={isLoadingJustifications}
              emptyTitle="Sin solicitudes"
              emptyMessage="No se han registrado solicitudes de justificación recientemente."
            />
          </div>
        </>
      ) : (
        /* Sección de Gráficos e Históricos */
        <div className="space-y-6 select-none">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-violet-500" />
                Historial de Asistencia Institucional Diario
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Evolución cronológica de asistencia y ausentismo en toda la universidad.</p>
            </div>
            <div className="mt-6">
              {!isLoadingTrends && trendData.length > 0 ? (
                <TrendAreaChart data={trendData} />
              ) : (
                <div className="h-72 flex items-center justify-center text-zinc-400 text-xs">
                  Cargando tendencia temporal...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle de Justificación */}
      {selectedJustification && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Revisar Solicitud de Justificación"
          footer={
            selectedJustification.status === 'pendiente' ? (
              <>
                <Button 
                  variant="outline" 
                  className="hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-600 dark:hover:text-rose-400"
                  onClick={() => handleResolve('rechazada')} 
                  isLoading={isSubmitting}
                >
                  Rechazar
                </Button>
                <Button 
                  variant="default" 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleResolve('aprobada')} 
                  isLoading={isSubmitting}
                >
                  Aprobar Justificación
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cerrar Ventana
              </Button>
            )
          }
        >
          <div className="space-y-4 text-left">
            <div className="grid grid-cols-2 gap-4 pb-2 border-b border-border">
              <div>
                <p className="text-xs text-muted-foreground font-semibold">Estudiante</p>
                <p className="text-sm font-bold text-foreground">{selectedJustification.studentName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold">Fecha de Inasistencia</p>
                <p className="text-sm font-mono text-foreground">{selectedJustification.date}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Asignatura</p>
              <p className="text-sm font-medium text-foreground">{selectedJustification.subjectName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Motivo / Causa Declarada</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed bg-zinc-100/50 dark:bg-zinc-900/50 p-3 rounded-lg border border-border mt-1">
                {selectedJustification.reason}
              </p>
            </div>

            {selectedJustification.status === 'pendiente' && (
              <FormInput
                label="Comentarios de la Coordinación (Opcional)"
                placeholder="Ej. Se aprueba por constancia médica válida adjunta..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
              />
            )}
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
}
