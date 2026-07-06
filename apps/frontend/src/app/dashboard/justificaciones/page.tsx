'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormInput } from '@/components/ui/FormInput';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';
import { useUiStore } from '@/store/useUiStore';
import { supabase } from '@/lib/supabase';
import { 
  Clock, 
  Plus, 
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  FileText,
  AlertCircle,
  FileWarning,
  ExternalLink,
  MessageSquare,
  ArrowRight,
  ShieldAlert,
  Settings,
  Download,
  Printer
} from 'lucide-react';

interface Justification {
  id: string;
  attendance_record_id: string;
  reason: string;
  evidence_url: string;
  status: 'pendiente' | 'aprobada' | 'rechazada';
  comments: string;
  student_name: string;
  student_email: string;
  subject_name: string;
  date: string;
  attendance_status: string;
}

export default function JustificacionesPage() {
  const { token, user: currentUser } = useAuthStore();
  const { addToast } = useToastStore();
  const { 
    daysLimitToJustify, 
    setDaysLimitToJustify,
    autoApprovalEnabled, 
    setAutoApprovalEnabled,
    approvalWorkflow, 
    setApprovalWorkflow,
    savePreferences 
  } = useUiStore();

  const [justifications, setJustifications] = useState<Justification[]>([]);
  const [filteredJustifications, setFilteredJustifications] = useState<Justification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Reviewing modal states (for Admin / Supervisor)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedJustification, setSelectedJustification] = useState<Justification | null>(null);
  const [reviewComments, setReviewComments] = useState('');
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);

  // Student creation modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [myUnjustifiedRecords, setMyUnjustifiedRecords] = useState<{ id: string; subject_name: string; date: string; status: string }[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formEvidenceUrl, setFormEvidenceUrl] = useState('');
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false);

  // Settings Panel state (Idea B)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [localDaysLimit, setLocalDaysLimit] = useState(5);
  const [localAutoApproval, setLocalAutoApproval] = useState(false);
  const [localWorkflow, setLocalWorkflow] = useState<'supervisor' | 'docente' | 'cascading'>('supervisor');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Synchronize local states when Zustand store values load
  useEffect(() => {
    setLocalDaysLimit(daysLimitToJustify);
    setLocalAutoApproval(autoApprovalEnabled);
    setLocalWorkflow(approvalWorkflow);
  }, [daysLimitToJustify, autoApprovalEnabled, approvalWorkflow]);

  // 1. Fetch student's own unjustified attendance records (Absent or Tardy)
  const loadMyUnjustifiedRecords = async () => {
    if (currentUser?.role_id !== 'estudiante') return;
    try {
      const { data } = await supabase
        .from('attendance_records')
        .select(`
          id,
          date,
          status,
          schedules:schedule_id(
            subjects:subject_id(name)
          )
        `)
        .eq('student_id', currentUser.id)
        .in('status', ['ausente', 'tarde']);

      const now = new Date();
      // limit in milliseconds
      const limitMs = daysLimitToJustify * 24 * 60 * 60 * 1000;

      const formatted = (data || [])
        .map((r: any) => ({
          id: r.id,
          subject_name: r.schedules?.subjects?.name || 'Asignatura',
          date: r.date,
          status: r.status
        }))
        .filter((r: any) => {
          const recordDate = new Date(r.date);
          const timeDiff = Math.abs(now.getTime() - recordDate.getTime());
          return timeDiff <= limitMs;
        });

      setMyUnjustifiedRecords(formatted);
      if (formatted.length > 0) {
        setSelectedRecordId(formatted[0].id);
      } else {
        setSelectedRecordId('');
      }
    } catch (err) {
      console.error('Error loading unjustified records:', err);
    }
  };

  // 2. Load all justifications
  const loadJustifications = async () => {
    setIsLoading(true);
    try {
      // Build query
      let query = supabase
        .from('justifications')
        .select(`
          id,
          attendance_record_id,
          reason,
          evidence_url,
          status,
          comments,
          attendance_records:attendance_record_id(
            date,
            status,
            users:student_id(first_name, last_name, email),
            schedules:schedule_id(
              subjects:subject_id(name)
            )
          )
        `);

      // If user is a student, restrict RLS or filter by student_id manually as safe guard
      if (currentUser?.role_id === 'estudiante') {
        // Query will auto-filter via RLS, but if RLS has not loaded, we still get our own.
      }

      const { data, error } = await query;

      if (error) throw error;

      let formatted: Justification[] = (data || []).map((j: any) => {
        const record = j.attendance_records || {};
        const student = record.users || {};
        const subjectName = record.schedules?.subjects?.name || 'Asignatura';

        return {
          id: j.id,
          attendance_record_id: j.attendance_record_id,
          reason: j.reason,
          evidence_url: j.evidence_url || '',
          status: j.status,
          comments: j.comments || '',
          student_name: `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Estudiante',
          student_email: student.email || '',
          subject_name: subjectName,
          date: record.date || '---',
          attendance_status: record.status || 'ausente'
        };
      });

      // Supply rich mock data if empty
      if (formatted.length === 0) {
        const storedMocks = localStorage.getItem('asistapp_mock_justifications');
        if (storedMocks) {
          formatted = JSON.parse(storedMocks);
        } else {
          formatted = [
            {
              id: 'just-1',
              attendance_record_id: 'att-5',
              reason: 'Consulta médica de emergencia. Presento certificado firmado por el pediatra de la clínica.',
              evidence_url: 'https://example.com/certificado-medico-demo.pdf',
              status: 'pendiente',
              comments: '',
              student_name: 'Camila Benítez',
              student_email: 'camila@universidad.edu',
              subject_name: 'Cálculo Multivariable',
              date: new Date().toISOString().substring(0, 10),
              attendance_status: 'ausente'
            },
            {
              id: 'just-2',
              attendance_record_id: 'att-2',
              reason: 'Problemas de transporte público por paro de buses en el sector norte de la ciudad.',
              evidence_url: 'https://example.com/noticia-paro-buses-demo',
              status: 'aprobada',
              comments: 'Justificación plenamente aprobada. Se valida la tardanza académica.',
              student_name: 'Mateo Quispe',
              student_email: 'mateo@universidad.edu',
              subject_name: 'Estructuras de Datos',
              date: new Date().toISOString().substring(0, 10),
              attendance_status: 'tarde'
            }
          ];
          localStorage.setItem('asistapp_mock_justifications', JSON.stringify(formatted));
        }
      }

      // If current user is student, filter lists to just their records as a redundant safety layer
      if (currentUser?.role_id === 'estudiante') {
        formatted = formatted.filter(f => f.student_email === currentUser.email);
      }

      setJustifications(formatted);
      setFilteredJustifications(formatted);
    } catch (err: any) {
      console.error('Error loading justifications:', err);
      addToast({
        title: 'Error de Red',
        message: err.message || 'No se pudieron recuperar las solicitudes de justificación.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadJustifications();
    loadMyUnjustifiedRecords();
  }, [currentUser]);

  // Filter effect
  useEffect(() => {
    let result = justifications;

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter(j => 
        j.student_name.toLowerCase().includes(term) || 
        j.reason.toLowerCase().includes(term) ||
        j.subject_name.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(j => j.status === statusFilter);
    }

    setFilteredJustifications(result);
  }, [searchTerm, statusFilter, justifications]);

  // Student justification submission
  const handleCreateJustification = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRecordId || !formReason) {
      addToast({
        title: 'Datos Requeridos',
        message: 'Por favor seleccione la clase no justificada e ingrese su motivo.',
        type: 'error'
      });
      return;
    }

    setIsCreateSubmitting(true);
    try {
      // Fetch tenant_id
      const { data: authUserProfile } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', currentUser?.id)
        .single();
      
      const tenantId = authUserProfile?.tenant_id;
      const isMockRecord = selectedRecordId.startsWith('att-');
      let saveToDb = !isMockRecord && tenantId;

      if (saveToDb) {
        const statusToInsert = autoApprovalEnabled ? 'aprobada' : 'pendiente';
        const commentsToInsert = autoApprovalEnabled ? 'Aprobada automáticamente por regla del sistema.' : '';

        const { error } = await supabase
          .from('justifications')
          .insert({
            attendance_record_id: selectedRecordId,
            reason: formReason,
            evidence_url: formEvidenceUrl,
            status: statusToInsert,
            comments: commentsToInsert,
            tenant_id: tenantId
          });

        if (error) {
          console.error('Database insert failed, falling back to LocalStorage:', error);
          saveToDb = false;
        } else if (autoApprovalEnabled) {
          // If auto approved, also update the linked attendance record
          const { error: attError } = await supabase
            .from('attendance_records')
            .update({ status: 'justificado' })
            .eq('id', selectedRecordId);

          if (attError) {
            console.error('Error auto-updating attendance record:', attError);
          }
        }
      }

      if (!saveToDb) {
        const record = myUnjustifiedRecords.find(r => r.id === selectedRecordId);
        const statusToInsert: 'pendiente' | 'aprobada' | 'rechazada' = autoApprovalEnabled ? 'aprobada' : 'pendiente';
        const commentsToInsert = autoApprovalEnabled ? 'Aprobada automáticamente por regla del sistema.' : '';

        const newMockJust: Justification = {
          id: `just-new-${Date.now()}`,
          attendance_record_id: selectedRecordId,
          reason: formReason,
          evidence_url: formEvidenceUrl,
          status: statusToInsert,
          comments: commentsToInsert,
          student_name: `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim() || 'Estudiante',
          student_email: currentUser?.email || 'estudiante@universidad.edu',
          subject_name: record ? record.subject_name : 'Asignatura',
          date: record ? record.date : new Date().toISOString().substring(0, 10),
          attendance_status: record ? record.status : 'ausente'
        };

        const updatedMocks = [newMockJust, ...justifications];
        setJustifications(updatedMocks);
        localStorage.setItem('asistapp_mock_justifications', JSON.stringify(updatedMocks));

        // If auto approved, also update mock attendance list in localStorage
        if (autoApprovalEnabled) {
          const storedAttMocks = localStorage.getItem('asistapp_mock_attendance');
          if (storedAttMocks) {
            const attMocks = JSON.parse(storedAttMocks);
            const updatedAtt = attMocks.map((r: any) => 
              r.id === selectedRecordId ? { ...r, status: 'justificado' } : r
            );
            localStorage.setItem('asistapp_mock_attendance', JSON.stringify(updatedAtt));
          }
        }
      } else {
        await loadJustifications();
      }

      addToast({
        title: autoApprovalEnabled ? 'Justificación Auto-aprobada' : 'Solicitud Enviada',
        message: autoApprovalEnabled 
          ? 'Su justificación ha sido aprobada de forma automática por las reglas del sistema.' 
          : 'Su justificación médica/académica ha sido enviada al supervisor.',
        type: 'success'
      });

      setIsCreateModalOpen(false);
      setFormReason('');
      setFormEvidenceUrl('');
      await loadMyUnjustifiedRecords();
    } catch (err: any) {
      console.error(err);
      addToast({
        title: 'Error de Creación',
        message: err.message || 'No se pudo guardar la solicitud de justificación.',
        type: 'error'
      });
    } finally {
      setIsCreateSubmitting(false);
    }
  };

  // Supervisor Review Justification (Approve or Reject)
  const handleReviewJustification = async (approved: boolean) => {
    if (!selectedJustification) return;

    const MOCK_PREFIXES = ['just-', 'att-'];
    const isMockData = MOCK_PREFIXES.some(prefix => selectedJustification.id.startsWith(prefix));

    setIsReviewSubmitting(true);
    try {
      if (isMockData) {
        // Handle mock/demo data locally — no DB call needed
        setJustifications(prev => {
          const updated = prev.map(j =>
            j.id === selectedJustification.id
              ? { ...j, status: (approved ? 'aprobada' : 'rechazada') as 'aprobada' | 'rechazada', comments: reviewComments }
              : j
          );
          localStorage.setItem('asistapp_mock_justifications', JSON.stringify(updated));
          return updated;
        });

        // Also update local attendance mock status
        if (approved) {
          const storedAttMocks = localStorage.getItem('asistapp_mock_attendance');
          if (storedAttMocks) {
            const attMocks = JSON.parse(storedAttMocks);
            const updatedAtt = attMocks.map((r: any) => 
              r.id === selectedJustification.attendance_record_id ? { ...r, status: 'justificado' } : r
            );
            localStorage.setItem('asistapp_mock_attendance', JSON.stringify(updatedAtt));
          }
        }
      } else {
        // 1. Update justification status — only columns that exist in the schema
        const updatePayload: Record<string, unknown> = {
          status: approved ? 'aprobada' : 'rechazada',
          comments: reviewComments
        };

        const { error: justError } = await supabase
          .from('justifications')
          .update(updatePayload)
          .eq('id', selectedJustification.id);

        if (justError) {
          console.error('justifications update error:', JSON.stringify(justError));
          throw new Error(justError.message || justError.details || 'Error al actualizar la justificación.');
        }

        // 2. If approved, mark the linked attendance record as 'justificado'
        if (approved) {
          const { error: attError } = await supabase
            .from('attendance_records')
            .update({ status: 'justificado' })
            .eq('id', selectedJustification.attendance_record_id);

          if (attError) {
            console.error('attendance_records update error:', JSON.stringify(attError));
            throw new Error(attError.message || attError.details || 'Error al actualizar la asistencia.');
          }
        }

        await loadJustifications();
      }

      addToast({
        title: approved ? 'Solicitud Aprobada' : 'Solicitud Rechazada',
        message: 'Se ha procesado y guardado la justificación académica.',
        type: 'success'
      });

      setIsReviewModalOpen(false);
      setSelectedJustification(null);
      setReviewComments('');
    } catch (err: any) {
      const message = err?.message || err?.details || JSON.stringify(err) || 'No se pudo guardar la revisión académica.';
      console.error('handleReviewJustification error:', message, err);
      addToast({
        title: 'Error de Transacción',
        message,
        type: 'error'
      });
    } finally {
      setIsReviewSubmitting(false);
    }
  };

  // Save justification rules configuration (Idea B)
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      setDaysLimitToJustify(localDaysLimit);
      setAutoApprovalEnabled(localAutoApproval);
      setApprovalWorkflow(localWorkflow);

      if (currentUser?.id) {
        await savePreferences(supabase, currentUser.id);
      }

      addToast({
        title: 'Ajustes Guardados',
        message: 'Las reglas y políticas de justificación se han actualizado correctamente.',
        type: 'success'
      });

      setIsSettingsOpen(false);
      await loadMyUnjustifiedRecords();
    } catch (err: any) {
      console.error(err);
      addToast({
        title: 'Error de Guardado',
        message: err.message || 'No se pudieron guardar los ajustes de políticas.',
        type: 'error'
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Export filtered justifications list to CSV (Idea C)
  const exportToCsv = () => {
    if (filteredJustifications.length === 0) {
      addToast({
        title: 'Sin Datos',
        message: 'No existen solicitudes para exportar con los filtros actuales.',
        type: 'error'
      });
      return;
    }

    const headers = ['Estudiante', 'Email', 'Asignatura', 'Fecha Falta', 'Falta Original', 'Motivo Solicitud', 'Estado Solicitud', 'Comentarios Auditoria'];
    const rows = filteredJustifications.map(j => [
      `"${j.student_name.replace(/"/g, '""')}"`,
      `"${j.student_email.replace(/"/g, '""')}"`,
      `"${j.subject_name.replace(/"/g, '""')}"`,
      `"${j.date}"`,
      `"${j.attendance_status.toUpperCase()}"`,
      `"${j.reason.replace(/"/g, '""')}"`,
      `"${j.status.toUpperCase()}"`,
      `"${j.comments.replace(/"/g, '""')}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `justificaciones_asistapp_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast({
      title: 'Exportación Exitosa',
      message: `Se han exportado ${filteredJustifications.length} solicitudes a formato CSV.`,
      type: 'success'
    });
  };

  const columns = [
    {
      header: 'Estudiante',
      accessor: (item: Justification) => (
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-50">{item.student_name}</div>
          <div className="text-xs text-muted-foreground">{item.student_email}</div>
        </div>
      )
    },
    {
      header: 'Asignatura / Fecha',
      accessor: (item: Justification) => (
        <div>
          <div className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">{item.subject_name}</div>
          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">Clase del {item.date}</div>
        </div>
      )
    },
    {
      header: 'Falta Original',
      accessor: (item: Justification) => {
        const isAbsent = item.attendance_status === 'ausente';
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
            isAbsent 
              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40' 
              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40'
          }`}>
            {item.attendance_status}
          </span>
        );
      }
    },
    {
      header: 'Motivo de Solicitud',
      accessor: (item: Justification) => (
        <span className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-1 max-w-[200px]" title={item.reason}>
          {item.reason}
        </span>
      )
    },
    {
      header: 'Estado',
      accessor: (item: Justification) => {
        const badges = {
          pendiente: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50',
          aprobada: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/50',
          rechazada: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/50'
        };

        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${badges[item.status]}`}>
            {item.status === 'pendiente' && <Clock className="w-3.5 h-3.5" />}
            {item.status === 'aprobada' && <CheckCircle2 className="w-3.5 h-3.5" />}
            {item.status === 'rechazada' && <XCircle className="w-3.5 h-3.5" />}
            {item.status}
          </span>
        );
      }
    },
    {
      header: 'Acción',
      accessor: (item: Justification) => (
        <div className="flex items-center gap-2">
          {['admin', 'supervisor'].includes(currentUser?.role_id || '') && item.status === 'pendiente' ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setSelectedJustification(item);
                setIsReviewModalOpen(true);
              }}
            >
              Auditar
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FileText className="w-3 h-3" />}
              onClick={() => {
                setSelectedJustification(item);
                setIsReviewModalOpen(true);
              }}
            >
              Detalles
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 select-none pb-4 border-b border-border print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl flex items-center gap-2">
            <Clock className="w-8 h-8 text-violet-500 flex-shrink-0 animate-pulse" />
            Justificaciones Académicas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión y auditoría de inasistencias por salud u otros motivos institucionales justificados.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {['admin', 'supervisor'].includes(currentUser?.role_id || '') && (
            <Button 
              variant="outline" 
              leftIcon={<Settings className="w-4 h-4" />}
              onClick={() => {
                setLocalDaysLimit(daysLimitToJustify);
                setLocalAutoApproval(autoApprovalEnabled);
                setLocalWorkflow(approvalWorkflow);
                setIsSettingsOpen(true);
              }}
              className="text-xs"
            >
              Ajustes de Reglas
            </Button>
          )}
          {currentUser?.role_id === 'estudiante' && (
            <Button 
              variant="default" 
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                loadMyUnjustifiedRecords();
                setIsCreateModalOpen(true);
              }}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              Crear Solicitud
            </Button>
          )}
        </div>
      </div>

      {/* Filters Area */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between select-none print:hidden">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por alumno o motivo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5" />
            <span>Estado Solicitud:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex h-9 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Todas las Solicitudes</option>
              <option value="pendiente">Solo Pendientes</option>
              <option value="aprobada">Solo Aprobadas</option>
              <option value="rechazada">Solo Rechazadas</option>
            </select>
          </div>

          {filteredJustifications.length > 0 && (
            <Button 
              variant="outline" 
              leftIcon={<Download className="w-4 h-4" />}
              onClick={exportToCsv}
              className="text-xs h-9"
            >
              Exportar CSV
            </Button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="space-y-4">
        <DataTable
          columns={columns}
          data={filteredJustifications}
          isLoading={isLoading}
          emptyTitle="Sin Justificaciones"
          emptyMessage="No se han cargado solicitudes de justificaciones de asistencia."
        />
      </div>

      {/* Modal AUDITAR / MOSTRAR DETALLES Justificación */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setSelectedJustification(null);
          setReviewComments('');
        }}
        title={selectedJustification?.status === 'pendiente' && ['admin', 'supervisor'].includes(currentUser?.role_id || '') ? "Auditoría de Inasistencia" : "Detalles de Solicitud"}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsReviewModalOpen(false)}>
              Cerrar
            </Button>
            {selectedJustification && (
              <Button 
                variant="outline" 
                leftIcon={<Printer className="w-4 h-4" />}
                onClick={() => window.print()}
                className="text-xs"
              >
                Imprimir Acta
              </Button>
            )}
            {['admin', 'supervisor'].includes(currentUser?.role_id || '') && selectedJustification?.status === 'pendiente' && (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => handleReviewJustification(false)} 
                  isLoading={isReviewSubmitting}
                  className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs"
                >
                  Rechazar
                </Button>
                <Button 
                  variant="default" 
                  onClick={() => handleReviewJustification(true)} 
                  isLoading={isReviewSubmitting}
                  className="text-xs"
                >
                  Aprobar Justificación
                </Button>
              </>
            )}
          </>
        }
      >
        {selectedJustification && (
          <div className="space-y-4 text-left text-sm select-none">
            <div className="grid grid-cols-2 gap-4 border-b border-border pb-3 text-xs">
              <div>
                <span className="text-muted-foreground block">Estudiante</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">{selectedJustification.student_name}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Curso</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">{selectedJustification.subject_name}</span>
              </div>
              <div className="mt-2">
                <span className="text-muted-foreground block">Fecha Falta</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-50 font-mono">{selectedJustification.date}</span>
              </div>
              <div className="mt-2">
                <span className="text-muted-foreground block">Estado Original</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-50 uppercase">{selectedJustification.attendance_status}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400 block">Motivo Explicado</span>
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-border rounded-lg text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 select-text">
                {selectedJustification.reason}
              </div>
            </div>

            {selectedJustification.evidence_url && (
              <div className="flex items-center justify-between p-2.5 bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40 rounded-lg text-xs">
                <span className="font-medium text-violet-700 dark:text-violet-400 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  Archivo de Certificación / Evidencia
                </span>
                <a 
                  href={selectedJustification.evidence_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-violet-600 hover:text-violet-700 font-bold flex items-center gap-1 underline"
                >
                  Ver Evidencia
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {/* Comments block */}
            {selectedJustification.status === 'pendiente' && ['admin', 'supervisor'].includes(currentUser?.role_id || '') ? (
              <div className="flex flex-col space-y-1.5">
                <label className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400">
                  Comentarios del Revisor / Auditor
                </label>
                <textarea
                  placeholder="Ingrese anotaciones académicas o de salud..."
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  className="flex min-h-[80px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>
            ) : (
              selectedJustification.comments && (
                <div className="space-y-1.5 p-3 border border-border bg-card rounded-lg text-xs">
                  <span className="font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-violet-500" />
                    Anotación de Auditoría
                  </span>
                  <p className="text-muted-foreground mt-1 italic select-text">{selectedJustification.comments}</p>
                </div>
              )
            )}
          </div>
        )}
      </Modal>

      {/* Modal CREAR Solicitud Justificación (Students) */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Nueva Solicitud de Justificación"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="default" 
              onClick={handleCreateJustification} 
              isLoading={isCreateSubmitting}
              disabled={myUnjustifiedRecords.length === 0}
            >
              Enviar Solicitud
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateJustification} className="space-y-4">
          {myUnjustifiedRecords.length === 0 ? (
            <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-border text-xs flex gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <p className="font-bold text-foreground">Expediente al Día</p>
                <p className="mt-0.5 text-muted-foreground">Felicidades, no tiene inasistencias o tardanzas pendientes por justificar en este ciclo académico.</p>
                <p className="mt-2 text-[10px] text-muted-foreground italic font-semibold border-t border-border/50 pt-1.5">
                  * Nota: De acuerdo a la política establecida, solo se muestran inasistencias de los últimos {daysLimitToJustify} días.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-border rounded-lg text-xs text-muted-foreground flex gap-2">
              <ShieldAlert className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Reglamento Académico</p>
                <p className="mt-0.5">Toda solicitud médica o académica requiere un adjunto firmado y validado por la clínica del campus.</p>
              </div>
            </div>
          )}

          {/* Record Selector */}
          {myUnjustifiedRecords.length > 0 && (
            <div className="flex flex-col space-y-1.5 text-left">
              <label className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400">
                Seleccione la Falta a Justificar
              </label>
              <select
                value={selectedRecordId}
                onChange={(e) => setSelectedRecordId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              >
                {myUnjustifiedRecords.map(r => (
                  <option key={r.id} value={r.id}>
                    [{r.status.toUpperCase()}] {r.subject_name} - {r.date}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-muted-foreground mt-1 font-mono">
                * Solo se muestran faltas de los últimos {daysLimitToJustify} días permitidos para justificar.
              </span>
            </div>
          )}

          <div className="flex flex-col space-y-1.5 text-left">
            <label className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400">
              Motivo e Informe Médico / Académico
            </label>
            <textarea
              placeholder="Ej. Estuve internado en la clínica médica nacional por cuadro gripal..."
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
              required
              className="flex min-h-[100px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>

          <FormInput
            label="Enlace a Evidencia (PDF / Imagen Certificado)"
            placeholder="https://enlace-al-certificado.pdf"
            value={formEvidenceUrl}
            onChange={(e) => setFormEvidenceUrl(e.target.value)}
          />
        </form>
      </Modal>

      {/* Modal Ajustes de Justificación (Idea B) */}
      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Configuración de Reglas de Justificaciones"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="default" 
              onClick={handleSaveSettings} 
              isLoading={isSavingSettings}
            >
              Guardar Configuración
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-left">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-border rounded-lg text-xs text-muted-foreground flex gap-2">
            <Settings className="w-5 h-5 text-violet-500 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">Reglas y Políticas de Aprobación</p>
              <p className="mt-0.5">Establezca los plazos máximos para solicitudes de alumnos y defina flujos de aprobación automáticos.</p>
            </div>
          </div>

          {/* Days Limit Slider */}
          <div className="flex flex-col space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-zinc-700 dark:text-zinc-300 font-medium">Plazo Límite de Envío</span>
              <span className="text-violet-600 dark:text-violet-400 font-bold">{localDaysLimit} días hábiles</span>
            </div>
            <input
              type="range"
              min="1"
              max="30"
              value={localDaysLimit}
              onChange={(e) => setLocalDaysLimit(parseInt(e.target.value))}
              className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
            />
            <span className="text-[10px] text-muted-foreground">
              Los estudiantes no podrán justificar inasistencias que tengan más de {localDaysLimit} días de antigüedad.
            </span>
          </div>

          {/* Auto Approval Toggle */}
          <div className="flex items-center justify-between border-t border-border pt-3">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-50">Auto-aprobación Inteligente</span>
              <span className="text-[10px] text-muted-foreground">Aprobar solicitudes de forma automática al ser creadas por el alumno.</span>
            </div>
            <input
              type="checkbox"
              checked={localAutoApproval}
              onChange={(e) => setLocalAutoApproval(e.target.checked)}
              className="w-8 h-4 bg-zinc-200 dark:bg-zinc-850 rounded-full appearance-none checked:bg-violet-500 relative before:content-[''] before:absolute before:h-3 before:w-3 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform cursor-pointer border border-zinc-300 dark:border-zinc-700"
            />
          </div>

          {/* Approval Routing Workflow */}
          <div className="flex flex-col space-y-1.5 border-t border-border pt-3">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Ruta del Flujo de Aprobación
            </label>
            <select
              value={localWorkflow}
              onChange={(e) => setLocalWorkflow(e.target.value as any)}
              className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-all focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="supervisor">Solo Supervisor (Directo)</option>
              <option value="docente">Solo Docente de Asignatura</option>
              <option value="cascading">Cascada (1° Docente, 2° Supervisor)</option>
            </select>
            <span className="text-[10px] text-muted-foreground">
              Define los roles que deben auditar las inasistencias antes de consolidar el cambio de estado.
            </span>
          </div>
        </div>
      </Modal>

      {/* Hidden Print Section for Justification Acta (Idea C) */}
      {selectedJustification && (
        <div id="print-section" className="hidden print:block p-8 bg-white text-zinc-950 min-h-screen select-none">
          <div className="flex justify-between items-start border-b-2 border-zinc-900 pb-4 mb-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 uppercase">
                Universidad Tecnológica Nacional
              </h1>
              <p className="text-xs text-zinc-600 mt-1">
                Acta Oficial de Justificación de Inasistencia Académica
              </p>
            </div>
            <div className="text-right text-xs text-zinc-600 font-mono">
              <div>Código Acta: {selectedJustification.id}</div>
              <div>Fecha Emisión: {new Date().toLocaleDateString()}</div>
            </div>
          </div>

          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl mb-6 text-xs space-y-3">
            <h3 className="font-bold text-zinc-900 text-sm border-b border-zinc-200 pb-1.5">
              Datos del Expediente Estudiantil
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-zinc-500 block">Estudiante Completo:</span>
                <span className="font-semibold text-zinc-900">{selectedJustification.student_name}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Correo Institucional:</span>
                <span className="font-semibold text-zinc-900 font-mono">{selectedJustification.student_email}</span>
              </div>
              <div className="mt-2">
                <span className="text-zinc-500 block">Asignatura / Curso:</span>
                <span className="font-semibold text-zinc-900">{selectedJustification.subject_name}</span>
              </div>
              <div className="mt-2">
                <span className="text-zinc-500 block">Fecha de Inasistencia:</span>
                <span className="font-semibold text-zinc-900 font-mono">{selectedJustification.date}</span>
              </div>
            </div>
          </div>

          <div className="p-4 border border-zinc-200 rounded-xl mb-6 text-xs space-y-3">
            <h3 className="font-bold text-zinc-900 text-sm border-b border-zinc-200 pb-1.5">
              Declaración de la Solicitud
            </h3>
            <div>
              <span className="text-zinc-500 block mb-1">Motivo / Justificante Presentado:</span>
              <p className="text-zinc-800 leading-relaxed italic bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                "{selectedJustification.reason}"
              </p>
            </div>
            {selectedJustification.evidence_url && (
              <div className="mt-2 text-[10px] text-zinc-600">
                <strong>Enlace a Documentación Adjunta:</strong> {selectedJustification.evidence_url}
              </div>
            )}
          </div>

          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl mb-8 text-xs space-y-3">
            <h3 className="font-bold text-zinc-900 text-sm border-b border-zinc-200 pb-1.5">
              Auditoría y Resolución Académica
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-zinc-500 block">Estado de la Resolución:</span>
                <span className="font-bold text-zinc-900 uppercase">{selectedJustification.status}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Falta Original Cambiada a:</span>
                <span className="font-bold text-zinc-900 uppercase font-mono">
                  {selectedJustification.status === 'aprobada' ? 'JUSTIFICADO' : selectedJustification.attendance_status}
                </span>
              </div>
            </div>
            {selectedJustification.comments && (
              <div className="mt-2">
                <span className="text-zinc-500 block">Anotaciones del Supervisor / Revisor:</span>
                <p className="text-zinc-800 mt-0.5 leading-relaxed font-mono">
                  {selectedJustification.comments}
                </p>
              </div>
            )}
          </div>

          <div className="text-[10px] text-zinc-500 text-center leading-relaxed max-w-xl mx-auto border-t border-zinc-200 pt-4 mb-16">
            Este documento certifica que la inasistencia académica del estudiante ha sido evaluada y resuelta por la Dirección de Asuntos Estudiantiles y Supervisión de Control de Asistencias en conformidad con los reglamentos de la universidad.
          </div>

          {/* Footer Signature Blocks */}
          <div className="grid grid-cols-2 gap-12 text-center text-xs">
            <div>
              <div className="border-b border-zinc-400 mx-auto w-48 mb-2" />
              <p className="font-semibold text-zinc-900">Estudiante Solicitante</p>
              <p className="text-zinc-500 mt-0.5">Firma de Conformidad</p>
            </div>
            <div>
              <div className="border-b border-zinc-400 mx-auto w-48 mb-2" />
              <p className="font-semibold text-zinc-900">Sello de Aprobación Académica</p>
              <p className="text-zinc-500 mt-0.5">Supervisor de Control de Asistencias</p>
            </div>
          </div>
        </div>
      )}

      {/* Print Style Injector */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Hide normal view elements */
          body > :not(#print-section),
          header, nav, sidebar, footer, button, select, input,
          div[class*="DashboardLayout"],
          .print\\:hidden {
            display: none !important;
          }
          #print-section, #print-section * {
            visibility: visible !important;
          }
          #print-section {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
            padding: 24px !important;
          }
        }
      `}} />
    </DashboardLayout>
  );
}
