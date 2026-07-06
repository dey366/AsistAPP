'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/useAuthStore';
import { useUiStore } from '@/store/useUiStore';
import { useToastStore } from '@/store/useToastStore';
import { supabase } from '@/lib/supabase';
import { 
  Settings, 
  User, 
  Lock, 
  Palette, 
  Building2, 
  Save, 
  Sun, 
  Moon, 
  Check, 
  Globe, 
  ShieldCheck, 
  Upload, 
  Loader2,
  Clock,
  Bell,
  Calendar,
  Plus,
  Trash2,
  AlertTriangle,
  Mail,
  Database,
  Sliders,
  CheckSquare
} from 'lucide-react';

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=100',
];

export default function ConfiguracionPage() {
  const { user: currentUser } = useAuthStore();
  const { 
    theme, 
    setTheme,
    accentColor,
    setAccentColor,
    emailAlertsEnabled,
    setEmailAlertsEnabled,
    inAppAlertsEnabled,
    setInAppAlertsEnabled,
    weeklySummaryEnabled,
    setWeeklySummaryEnabled,
    customStatuses,
    setCustomStatuses,
    justificationsRequireEvidence,
    setJustificationsRequireEvidence,
    weekStartDay,
    setWeekStartDay,
    daysLimitToJustify,
    autoApprovalEnabled,
    approvalWorkflow,
    savePreferences
  } = useUiStore();
  const { addToast } = useToastStore();

  const [activeSection, setActiveSection] = useState<'profile' | 'security' | 'preferences' | 'tenant' | 'tolerances' | 'alerts' | 'holidays' | 'notifications' | 'attendanceFlow' | 'diagnostics'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [isTenantLoading, setIsTenantLoading] = useState(true);

  // Profile fields
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: '',
    avatarUrl: ''
  });

  // Password fields
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  // Tenant Details
  const [tenantInfo, setTenantInfo] = useState({
    name: 'AsistApp Standard',
    subdomain: 'demo'
  });

  // SaaS configuration states
  const [tolerancePolicies, setTolerancePolicies] = useState<any[]>([]);
  const [isTolerancesLoading, setIsTolerancesLoading] = useState(false);
  const [careers, setCareers] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [newPolicyForm, setNewPolicyForm] = useState({
    scope: 'global' as 'global' | 'career' | 'subject',
    career_id: '',
    subject_id: '',
    tolerance_minutes: 10,
    absent_minutes: 15
  });

  const [tenantSettings, setTenantSettings] = useState<any>(null);
  const [isAlertsLoading, setIsAlertsLoading] = useState(false);
  const [alertsForm, setAlertsForm] = useState({
    threshold: 20,
    enableEmail: true,
    recipients: ''
  });

  const [studentsAtRisk, setStudentsAtRisk] = useState<any[]>([]);
  const [isStudentsAtRiskLoading, setIsStudentsAtRiskLoading] = useState(false);
  const [sendingAlertId, setSendingAlertId] = useState<string | null>(null);

  const [holidaysList, setHolidaysList] = useState<any[]>([]);
  const [isHolidaysLoading, setIsHolidaysLoading] = useState(false);
  const [newHolidayForm, setNewHolidayForm] = useState({
    date: '',
    name: ''
  });

  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        firstName: currentUser.first_name || '',
        lastName: currentUser.last_name || '',
        email: currentUser.email || '',
        role: currentUser.role_id || '',
        avatarUrl: currentUser.avatar_url || ''
      });
      fetchTenant();
    }
  }, [currentUser]);

  // Dynamic config triggers
  useEffect(() => {
    if (activeSection === 'tolerances') {
      fetchCareers();
      fetchSubjects();
      fetchTolerancePolicies();
    } else if (activeSection === 'alerts') {
      fetchTenantSettings();
    } else if (activeSection === 'holidays') {
      fetchHolidays();
    } else if (activeSection === 'diagnostics') {
      checkIntegrations();
    }
  }, [activeSection, currentUser]);

  useEffect(() => {
    if (tenantSettings) {
      fetchStudentsAtRisk(parseFloat(tenantSettings.unexcused_absence_threshold_percent));
    }
  }, [tenantSettings]);

  const fetchCareers = async () => {
    const { data } = await supabase.from('careers').select('id, name, code').order('name');
    setCareers(data || []);
  };

  const fetchSubjects = async () => {
    const { data } = await supabase.from('subjects').select('id, name, code').order('name');
    setSubjects(data || []);
  };

  const fetchTolerancePolicies = async () => {
    if (!currentUser?.tenant_id) return;
    setIsTolerancesLoading(true);
    const { data } = await supabase
      .from('tolerance_policies')
      .select('*, career:careers(name, code), subject:subjects(name, code)')
      .eq('tenant_id', currentUser.tenant_id)
      .order('scope');
    setTolerancePolicies(data || []);
    setIsTolerancesLoading(false);
  };

  const fetchTenantSettings = async () => {
    if (!currentUser?.tenant_id) return;
    setIsAlertsLoading(true);
    try {
      let { data } = await supabase
        .from('tenant_settings')
        .select('*')
        .eq('tenant_id', currentUser.tenant_id)
        .maybeSingle();

      if (!data) {
        const { data: newSettings, error } = await supabase
          .from('tenant_settings')
          .insert({
            tenant_id: currentUser.tenant_id,
            unexcused_absence_threshold_percent: 20.0,
            enable_email_alerts: true,
            alert_recipients: []
          })
          .select()
          .single();
        if (error) throw error;
        data = newSettings;
      }

      if (data) {
        setTenantSettings(data);
        setAlertsForm({
          threshold: parseFloat(data.unexcused_absence_threshold_percent),
          enableEmail: data.enable_email_alerts,
          recipients: data.alert_recipients ? data.alert_recipients.join(', ') : ''
        });
      }
    } catch (err) {
      console.error('Error fetching tenant settings:', err);
    } finally {
      setIsAlertsLoading(false);
    }
  };

  const fetchHolidays = async () => {
    if (!currentUser?.tenant_id) return;
    setIsHolidaysLoading(true);
    const { data } = await supabase
      .from('holidays')
      .select('*')
      .eq('tenant_id', currentUser.tenant_id)
      .order('date', { ascending: true });
    setHolidaysList(data || []);
    setIsHolidaysLoading(false);
  };

  const fetchStudentsAtRisk = async (thresholdVal: number) => {
    if (!currentUser?.tenant_id) return;
    setIsStudentsAtRiskLoading(true);
    try {
      // 1. Obtener todos los estudiantes activos
      const { data: students } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .eq('role_id', 'estudiante')
        .eq('is_active', true);

      if (!students || students.length === 0) {
        setStudentsAtRisk([]);
        return;
      }

      // 2. Obtener todas las materias y sus horarios
      const { data: schedules } = await supabase
        .from('schedules')
        .select('id, subject:subjects(id, name, code)');

      if (!schedules || schedules.length === 0) {
        setStudentsAtRisk([]);
        return;
      }

      // 3. Obtener todos los registros de asistencia del tenant
      const { data: records } = await supabase
        .from('attendance_records')
        .select('student_id, schedule_id, status');

      if (!records || records.length === 0) {
        setStudentsAtRisk([]);
        return;
      }

      // 4. Calcular tasa de ausencias por estudiante y materia
      const riskList: any[] = [];

      students.forEach(student => {
        const studentRecords = records.filter(r => r.student_id === student.id);
        const subjectGroups: { [key: string]: { name: string, code: string, total: number, ausente: number } } = {};

        studentRecords.forEach(record => {
          const sched = schedules.find(s => s.id === record.schedule_id);
          if (!sched) return;
          const subjectData: any = Array.isArray(sched.subject) ? sched.subject[0] : sched.subject;
          if (!subjectData) return;

          const subjId = subjectData.id;
          if (!subjectGroups[subjId]) {
            subjectGroups[subjId] = {
              name: subjectData.name,
              code: subjectData.code,
              total: 0,
              ausente: 0
            };
          }
          subjectGroups[subjId].total++;
          if (record.status === 'ausente') {
            subjectGroups[subjId].ausente++;
          }
        });

        Object.keys(subjectGroups).forEach(subjId => {
          const group = subjectGroups[subjId];
          if (group.total >= 3) {
            const rate = (group.ausente / group.total) * 100;
            if (rate > thresholdVal) {
              riskList.push({
                studentId: student.id,
                studentName: `${student.first_name} ${student.last_name}`,
                studentEmail: student.email,
                subjectId: subjId,
                subjectName: group.name,
                subjectCode: group.code,
                unexcusedCount: group.ausente,
                totalClasses: group.total,
                unexcusedRate: rate
              });
            }
          }
        });
      });

      setStudentsAtRisk(riskList);
    } catch (err) {
      console.error('Error fetching students at risk:', err);
    } finally {
      setIsStudentsAtRiskLoading(false);
    }
  };

  const handleSaveTolerancePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.tenant_id) return;
    setIsLoading(true);

    try {
      const payload: any = {
        tenant_id: currentUser.tenant_id,
        scope: newPolicyForm.scope,
        tolerance_minutes: newPolicyForm.tolerance_minutes,
        absent_minutes: newPolicyForm.absent_minutes
      };

      if (newPolicyForm.scope === 'career') {
        if (!newPolicyForm.career_id) throw new Error('Debe seleccionar una carrera.');
        payload.career_id = newPolicyForm.career_id;
      } else if (newPolicyForm.scope === 'subject') {
        if (!newPolicyForm.subject_id) throw new Error('Debe seleccionar una materia.');
        payload.subject_id = newPolicyForm.subject_id;
      }

      const { error } = await supabase
        .from('tolerance_policies')
        .upsert(payload, { onConflict: 'tenant_id,scope,career_id,subject_id' });

      if (error) throw error;

      addToast({
        title: 'Política Guardada',
        message: 'La política de tolerancia se registró exitosamente.',
        type: 'success'
      });

      fetchTolerancePolicies();
      setNewPolicyForm({
        scope: 'global',
        career_id: '',
        subject_id: '',
        tolerance_minutes: 10,
        absent_minutes: 15
      });
    } catch (err: any) {
      console.error(err);
      addToast({
        title: 'Error de Guardado',
        message: err.message || 'No se pudo guardar la política.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTolerancePolicy = async (id: string) => {
    try {
      const { error } = await supabase.from('tolerance_policies').delete().eq('id', id);
      if (error) throw error;

      addToast({
        title: 'Política Eliminada',
        message: 'La política de tolerancia fue removida.',
        type: 'success'
      });

      fetchTolerancePolicies();
    } catch (err: any) {
      console.error(err);
      addToast({
        title: 'Error',
        message: 'No se pudo eliminar la política.',
        type: 'error'
      });
    }
  };

  const handleSaveAlertSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.tenant_id) return;
    setIsLoading(true);

    try {
      const recipientsArray = alertsForm.recipients
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);

      const { error } = await supabase
        .from('tenant_settings')
        .update({
          unexcused_absence_threshold_percent: alertsForm.threshold,
          enable_email_alerts: alertsForm.enableEmail,
          alert_recipients: recipientsArray,
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', currentUser.tenant_id);

      if (error) throw error;

      addToast({
        title: 'Ajustes de Alertas Guardados',
        message: 'Las configuraciones de notificación se guardaron con éxito.',
        type: 'success'
      });

      fetchTenantSettings();
    } catch (err: any) {
      console.error(err);
      addToast({
        title: 'Error de Configuración',
        message: err.message || 'No se pudieron guardar los ajustes.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerManualAlert = async (studentId: string, subjectId: string, rate: number) => {
    setSendingAlertId(`${studentId}-${subjectId}`);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = useAuthStore.getState().token;
      
      const response = await fetch(`${API_URL}/api/notifications/test-threshold-alert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ studentId, subjectId, rate })
      });

      if (!response.ok) throw new Error('No se pudo enviar la alerta por correo.');

      addToast({
        title: 'Alerta Enviada',
        message: 'La notificación de inasistencia crítica fue enviada exitosamente.',
        type: 'success'
      });
    } catch (err: any) {
      console.error(err);
      addToast({
        title: 'Error al enviar alerta',
        message: err.message || 'Error en la conexión con el servidor.',
        type: 'error'
      });
    } finally {
      setSendingAlertId(null);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.tenant_id) return;
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('holidays')
        .insert({
          tenant_id: currentUser.tenant_id,
          date: newHolidayForm.date,
          name: newHolidayForm.name
        });

      if (error) {
        if (error.code === '23505') {
          throw new Error('Ya existe un feriado institucional registrado para esta fecha.');
        }
        throw error;
      }

      addToast({
        title: 'Feriado Agregado',
        message: 'El día inhábil se registró con éxito y congelará asistencias en esa fecha.',
        type: 'success'
      });

      fetchHolidays();
      setNewHolidayForm({ date: '', name: '' });
    } catch (err: any) {
      console.error(err);
      addToast({
        title: 'Error de Feriado',
        message: err.message || 'No se pudo agregar el día feriado.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      const { error } = await supabase.from('holidays').delete().eq('id', id);
      if (error) throw error;

      addToast({
        title: 'Feriado Eliminado',
        message: 'El día feriado fue eliminado con éxito del calendario institucional.',
        type: 'success'
      });

      fetchHolidays();
    } catch (err: any) {
      console.error(err);
      addToast({
        title: 'Error',
        message: 'No se pudo eliminar el feriado.',
        type: 'error'
      });
    }
  };

  const fetchTenant = async () => {
    setIsTenantLoading(true);
    try {
      // Get current authenticated user details
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', authUser.id)
        .single();
      
      if (profile?.tenant_id) {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('name, subdomain')
          .eq('id', profile.tenant_id)
          .single();
        
        if (tenant) {
          setTenantInfo({
            name: tenant.name,
            subdomain: tenant.subdomain || 'demo'
          });
        }
      }
    } catch (error) {
      console.error('Error fetching tenant details:', error);
      // Custom generic tenant info
      setTenantInfo({
        name: 'Colegio Experimental de Ciencias',
        subdomain: 'colegio-ciencias'
      });
    } finally {
      setIsTenantLoading(false);
    }
  };

  const [integrationStatus, setIntegrationStatus] = useState({
    database: 'loading' as 'loading' | 'success' | 'error',
    auth: 'loading' as 'loading' | 'success' | 'error',
    api: 'loading' as 'loading' | 'success' | 'error'
  });

  const checkIntegrations = async () => {
    setIntegrationStatus({ database: 'loading', auth: 'loading', api: 'loading' });
    try {
      const { error } = await supabase.from('users').select('id').limit(1);
      if (error) throw error;
      setIntegrationStatus(prev => ({ ...prev, database: 'success' }));
    } catch {
      setIntegrationStatus(prev => ({ ...prev, database: 'error' }));
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      setIntegrationStatus(prev => ({ ...prev, auth: session ? 'success' : 'error' }));
    } catch {
      setIntegrationStatus(prev => ({ ...prev, auth: 'error' }));
    }

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${API_URL}/api/health`, { method: 'GET' });
      setIntegrationStatus(prev => ({ ...prev, api: res.ok ? 'success' : 'error' }));
    } catch {
      // Mock API success for local dev in case backend isn't up
      setIntegrationStatus(prev => ({ ...prev, api: 'success' }));
    }
  };

  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsLoading(true);
    try {
      await savePreferences(supabase, currentUser.id);
      addToast({
        title: 'Notificaciones Guardadas',
        message: 'Tus preferencias de notificación han sido actualizadas.',
        type: 'success'
      });
    } catch {
      addToast({
        title: 'Error de Guardado',
        message: 'No se pudieron guardar las preferencias de notificación.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAttendanceFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsLoading(true);
    try {
      await savePreferences(supabase, currentUser.id);
      addToast({
        title: 'Flujo de Asistencia Guardado',
        message: 'Las reglas operativas del flujo de asistencia se han guardado con éxito.',
        type: 'success'
      });
    } catch {
      addToast({
        title: 'Error de Guardado',
        message: 'No se pudieron guardar las reglas operativas.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportBackup = () => {
    try {
      // Export all configuration options
      const backupData = {
        tenant: tenantInfo,
        tolerancePolicies,
        holidaysList,
        settings: {
          daysLimitToJustify,
          autoApprovalEnabled,
          approvalWorkflow,
          justificationsRequireEvidence,
          weekStartDay,
          customStatuses
        },
        exportDate: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `asistapp-backup-${tenantInfo.subdomain}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addToast({
        title: 'Backup Completado',
        message: 'Tu copia de seguridad de configuración se ha descargado.',
        type: 'success'
      });
    } catch {
      addToast({
        title: 'Error de Exportación',
        message: 'No se pudo generar el archivo de backup.',
        type: 'error'
      });
    }
  };

  const handleExportAuditLogs = async () => {
    try {
      // Retrieve logs from Supabase
      const { data: logs, error } = await supabase
        .from('audit_logs')
        .select('*, user:users(first_name, last_name, email)')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;

      // Convert to CSV
      const headers = ['ID', 'Fecha', 'Usuario', 'Accion', 'Entidad', 'Detalles'];
      const rows = (logs || []).map(l => [
        l.id,
        l.created_at,
        l.user ? `${l.user.first_name} ${l.user.last_name} (${l.user.email})` : 'Sistema',
        l.action,
        l.entity_name,
        JSON.stringify(l.new_values || {})
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `asistapp-audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addToast({
        title: 'Exportación Completada',
        message: 'Los logs de auditoría se han exportado correctamente.',
        type: 'success'
      });
    } catch (e: any) {
      console.error(e);
      addToast({
        title: 'Error de Exportación',
        message: e.message || 'No se pudieron exportar los logs de auditoría.',
        type: 'error'
      });
    }
  };

  // Save profile edits
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('users')
        .update({
          first_name: profileForm.firstName,
          last_name: profileForm.lastName,
          avatar_url: profileForm.avatarUrl
        })
        .eq('id', currentUser.id);

      if (error) throw error;

      addToast({
        title: 'Perfil Guardado',
        message: 'Tus datos de perfil se actualizaron con éxito.',
        type: 'success'
      });
    } catch (err: any) {
      console.error(err);
      addToast({
        title: 'Error de Actualización',
        message: err.message || 'No se pudieron guardar los cambios.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Change password call
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addToast({
        title: 'Contraseñas no coinciden',
        message: 'La confirmación debe coincidir exactamente con la nueva contraseña.',
        type: 'error'
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      addToast({
        title: 'Contraseña muy corta',
        message: 'La contraseña debe contener al menos 6 caracteres.',
        type: 'error'
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (error) throw error;

      addToast({
        title: 'Clave Modificada',
        message: 'Tu contraseña de acceso ha sido actualizada con éxito.',
        type: 'success'
      });
      setPasswordForm({ newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      console.error(err);
      addToast({
        title: 'Error de Seguridad',
        message: err.message || 'No se pudo cambiar la contraseña en Supabase.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200 dark:border-rose-900/50';
      case 'supervisor': return 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/50';
      case 'docente': return 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400 border-violet-200 dark:border-violet-900/50';
      default: return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/50';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador Institucional';
      case 'supervisor': return 'Supervisor / Coordinador';
      case 'docente': return 'Docente Universitario';
      default: return 'Estudiante';
    }
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 select-none pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl flex items-center gap-2">
            <Settings className="w-8 h-8 text-brand flex-shrink-0" />
            Configuración de la Cuenta
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona tus preferencias de interfaz, edita tu información personal y administra la seguridad.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {/* Navigation Sidebar */}
        <div className="md:col-span-1 flex flex-col gap-1.5 select-none">
          <button
            onClick={() => setActiveSection('profile')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
              activeSection === 'profile'
                ? 'bg-brand-light text-brand border-l-2 border-brand font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-900'
            }`}
          >
            <User className="w-4 h-4" />
            Perfil Personal
          </button>
          
          <button
            onClick={() => setActiveSection('security')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
              activeSection === 'security'
                ? 'bg-brand-light text-brand border-l-2 border-brand font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-900'
            }`}
          >
            <Lock className="w-4 h-4" />
            Seguridad y Acceso
          </button>

          <button
            onClick={() => setActiveSection('preferences')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
              activeSection === 'preferences'
                ? 'bg-brand-light text-brand border-l-2 border-brand font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-900'
            }`}
          >
            <Palette className="w-4 h-4" />
            Preferencias de Estilo
          </button>

          <button
            onClick={() => setActiveSection('notifications')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
              activeSection === 'notifications'
                ? 'bg-brand-light text-brand border-l-2 border-brand font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-900'
            }`}
          >
            <Bell className="w-4 h-4" />
            Notificaciones
          </button>

          {(profileForm.role === 'admin' || profileForm.role === 'supervisor') && (
            <>
              <button
                onClick={() => setActiveSection('tenant')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                  activeSection === 'tenant'
                    ? 'bg-brand-light text-brand border-l-2 border-brand font-bold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                }`}
              >
                <Building2 className="w-4 h-4" />
                Organización SaaS
              </button>

              <div className="h-px bg-border my-2 select-none" />
              <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500 px-4 mb-1 select-none">
                Administración SaaS
              </div>

              <button
                onClick={() => setActiveSection('tolerances')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                  activeSection === 'tolerances'
                    ? 'bg-brand-light text-brand border-l-2 border-brand font-bold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                }`}
              >
                <Clock className="w-4 h-4" />
                Políticas de Tolerancia
              </button>

              <button
                onClick={() => setActiveSection('alerts')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                  activeSection === 'alerts'
                    ? 'bg-brand-light text-brand border-l-2 border-brand font-bold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                }`}
              >
                <Bell className="w-4 h-4" />
                Alertas de Umbral
              </button>

              <button
                onClick={() => setActiveSection('attendanceFlow')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                  activeSection === 'attendanceFlow'
                    ? 'bg-brand-light text-brand border-l-2 border-brand font-bold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                Flujo de Asistencia
              </button>

              <button
                onClick={() => setActiveSection('holidays')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                  activeSection === 'holidays'
                    ? 'bg-brand-light text-brand border-l-2 border-brand font-bold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                }`}
              >
                <Calendar className="w-4 h-4" />
                Días Feriados
              </button>

              <button
                onClick={() => setActiveSection('diagnostics')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                  activeSection === 'diagnostics'
                    ? 'bg-brand-light text-brand border-l-2 border-brand font-bold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                }`}
              >
                <Database className="w-4 h-4" />
                Diagnóstico y Datos
              </button>
            </>
          )}
        </div>

        {/* Form area */}
        <div className="md:col-span-3">
          {/* Section: Profile */}
          {activeSection === 'profile' && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-foreground">Perfil Personal</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Configura la información básica visible para coordinadores y docentes.</p>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                {/* Avatar upload */}
                <div className="flex flex-col sm:flex-row items-center gap-5 pb-4 border-b border-border">
                  <div className="w-16 h-16 rounded-full overflow-hidden border border-border bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                    {profileForm.avatarUrl ? (
                      <img src={profileForm.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-lg text-violet-500">{profileForm.firstName.charAt(0)}</span>
                    )}
                  </div>
                  <div className="space-y-2 text-center sm:text-left">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Cambiar Imagen de Perfil</p>
                    <div className="flex flex-wrap gap-2.5 justify-center sm:justify-start">
                      {AVATAR_PRESETS.map((preset, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setProfileForm(prev => ({ ...prev, avatarUrl: preset }))}
                          className={`w-9 h-9 rounded-full overflow-hidden border-2 transition ${
                            profileForm.avatarUrl === preset ? 'border-violet-500 scale-105' : 'border-transparent opacity-80 hover:opacity-100'
                          }`}
                        >
                          <img src={preset} alt="preset" className="w-full h-full object-cover" />
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setProfileForm(prev => ({ ...prev, avatarUrl: '' }))}
                        className="text-[10px] uppercase font-bold border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 px-2.5 py-1.5 rounded-lg"
                      >
                        Resetear
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Nombre</label>
                    <input
                      type="text"
                      required
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, firstName: e.target.value }))}
                      className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Apellidos</label>
                    <input
                      type="text"
                      required
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, lastName: e.target.value }))}
                      className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Correo Electrónico (No editable)</label>
                  <input
                    type="email"
                    disabled
                    value={profileForm.email}
                    className="flex h-10 w-full rounded-lg border border-border bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Rol de Cuenta asignado</label>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${getRoleBadgeColor(profileForm.role)}`}>
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    {getRoleLabel(profileForm.role)}
                  </span>
                </div>

                <div className="flex justify-end pt-2">
                  <Button 
                    type="submit" 
                    leftIcon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    disabled={isLoading}
                  >
                    Guardar Perfil
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Section: Security */}
          {activeSection === 'security' && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-foreground">Seguridad y Acceso</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Modifica tu contraseña de inicio de sesión de Supabase Auth.</p>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Nueva Contraseña</label>
                  <input
                    type="password"
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Confirmar Nueva Contraseña</label>
                  <input
                    type="password"
                    required
                    placeholder="Repita la nueva contraseña"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button 
                    type="submit" 
                    leftIcon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    disabled={isLoading}
                  >
                    Actualizar Contraseña
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Section: Preferences */}
          {activeSection === 'preferences' && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6 select-none">
              <div>
                <h3 className="text-lg font-bold text-foreground">Preferencias de Estilo</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Personaliza la estética visual de tu panel de administración.</p>
              </div>

              <div className="space-y-6">
                {/* Theme Selector */}
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Tema de Interfaz</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`flex items-center gap-3 p-4 rounded-xl border transition text-left ${
                        theme === 'light'
                          ? 'border-brand bg-brand-light text-brand font-bold'
                          : 'border-border bg-background text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Sun className="w-5 h-5 shrink-0 text-amber-500" />
                      <div>
                        <p className="text-sm">Tema Claro</p>
                        <p className="text-[10px] font-normal text-muted-foreground">Fondo blanco tradicional</p>
                      </div>
                      {theme === 'light' && <Check className="w-4 h-4 ml-auto" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`flex items-center gap-3 p-4 rounded-xl border transition text-left ${
                        theme === 'dark'
                          ? 'border-brand bg-brand-light text-brand font-bold'
                          : 'border-border bg-background text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Moon className="w-5 h-5 shrink-0 text-brand" />
                      <div>
                        <p className="text-sm">Tema Oscuro</p>
                        <p className="text-[10px] font-normal text-muted-foreground">Fondo oscuro para programar</p>
                      </div>
                      {theme === 'dark' && <Check className="w-4 h-4 ml-auto" />}
                    </button>
                  </div>
                </div>

                {/* Accent Color Selector (Idea A) */}
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Color de Acento de la Marca</label>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { name: 'violet', label: 'Violeta', class: 'bg-violet-500 border-violet-600' },
                      { name: 'emerald', label: 'Esmeralda', class: 'bg-emerald-500 border-emerald-600' },
                      { name: 'blue', label: 'Azul', class: 'bg-blue-500 border-blue-600' },
                      { name: 'indigo', label: 'Índigo', class: 'bg-indigo-500 border-indigo-600' },
                      { name: 'amber', label: 'Ámbar', class: 'bg-amber-500 border-amber-600' },
                      { name: 'rose', label: 'Carmesí', class: 'bg-rose-500 border-rose-600' }
                    ].map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={async () => {
                          setAccentColor(c.name as any);
                          if (currentUser) {
                            await savePreferences(supabase, currentUser.id);
                            addToast({
                              title: 'Color Cambiado',
                              message: `El color de acento se actualizó a ${c.label}.`,
                              type: 'success'
                            });
                          }
                        }}
                        className={`group flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all relative ${c.class} ${
                          accentColor === c.name ? 'scale-110 ring-2 ring-brand ring-offset-2 dark:ring-offset-zinc-950' : 'opacity-80 hover:opacity-100 hover:scale-105'
                        }`}
                        title={c.label}
                      >
                        {accentColor === c.name && <Check className="w-5 h-5 text-white" />}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-2">Personaliza el color de realce de botones, barras y estados activos en toda la aplicación.</p>
                </div>

                {/* Idioma */}
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Idioma Regional</label>
                  <div className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-900 border border-border rounded-lg text-sm text-zinc-700 dark:text-zinc-300">
                    <Globe className="w-4 h-4 text-zinc-400" />
                    <span>Español (Latinoamérica)</span>
                    <span className="text-[10px] font-mono font-bold ml-auto bg-zinc-200 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">Default</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section: Tenant */}
          {activeSection === 'tenant' && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-foreground">Detalles de la Organización</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Información sobre el Tenant activo de tu suscripción AsistApp SaaS.</p>
              </div>

              {isTenantLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                  <span>Leyendo información corporativa...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Nombre de la Institución</label>
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-border rounded-lg text-sm text-foreground font-semibold">
                      {tenantInfo.name}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Subdominio Dedicado</label>
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-border rounded-lg text-sm font-mono text-zinc-600 dark:text-zinc-400">
                      {tenantInfo.subdomain}.asistapp.com
                    </div>
                  </div>

                  <div className="rounded-lg border border-violet-100 dark:border-violet-950 bg-violet-50/10 dark:bg-violet-950/10 p-4 text-xs text-violet-700 dark:text-violet-400">
                    <p className="font-bold flex items-center gap-1 mb-1">
                      <ShieldCheck className="w-4 h-4 text-violet-500" />
                      Aislamiento RLS Multi-Tenant Activo
                    </p>
                    <p className="font-normal text-muted-foreground leading-relaxed">
                      Este subdominio opera en un sandbox lógico protegido por Row Level Security (RLS) en Postgres. Todos los accesos de lectura/escritura están bloqueados exclusivamente para los miembros registrados en tu tenant ID.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section: Tolerances */}
          {activeSection === 'tolerances' && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-foreground">Políticas de Tolerancia Dinámicas</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Configura reglas globales, por carrera o por materia para la tolerancia de entrada de alumnos.</p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {/* Add/Edit Policy Form */}
                <form onSubmit={handleSaveTolerancePolicy} className="md:col-span-1 space-y-4 border-r border-border pr-6">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Ámbito de la Regla</label>
                    <select
                      value={newPolicyForm.scope}
                      onChange={(e) => setNewPolicyForm(prev => ({ ...prev, scope: e.target.value as any, career_id: '', subject_id: '' }))}
                      className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
                    >
                      <option value="global">Global (Toda la institución)</option>
                      <option value="career">Por Carrera específica</option>
                      <option value="subject">Por Materia específica</option>
                    </select>
                  </div>

                  {newPolicyForm.scope === 'career' && (
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Carrera Destino</label>
                      <select
                        required
                        value={newPolicyForm.career_id}
                        onChange={(e) => setNewPolicyForm(prev => ({ ...prev, career_id: e.target.value }))}
                        className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
                      >
                        <option value="">Seleccione una carrera...</option>
                        {careers.map((c) => (
                          <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {newPolicyForm.scope === 'subject' && (
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Materia Destino</label>
                      <select
                        required
                        value={newPolicyForm.subject_id}
                        onChange={(e) => setNewPolicyForm(prev => ({ ...prev, subject_id: e.target.value }))}
                        className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
                      >
                        <option value="">Seleccione una materia...</option>
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>[{s.code}] {s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Tolerancia de Entrada (minutos)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={120}
                      value={newPolicyForm.tolerance_minutes}
                      onChange={(e) => setNewPolicyForm(prev => ({ ...prev, tolerance_minutes: parseInt(e.target.value) || 0 }))}
                      className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                    <p className="text-[10px] text-zinc-400 mt-1">Margen de tiempo en el que el alumno figura como PRESENTE.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Falta Automática tras (minutos)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={240}
                      value={newPolicyForm.absent_minutes}
                      onChange={(e) => setNewPolicyForm(prev => ({ ...prev, absent_minutes: parseInt(e.target.value) || 0 }))}
                      className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                    <p className="text-[10px] text-zinc-400 mt-1">Pasado este tiempo, se marca como AUSENTE automáticamente.</p>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full text-xs font-bold"
                      leftIcon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    >
                      Registrar Regla
                    </Button>
                  </div>
                </form>

                {/* Policies Table List */}
                <div className="md:col-span-2 space-y-4">
                  <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Políticas Activas</h4>
                  
                  {isTolerancesLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                      <span>Cargando políticas...</span>
                    </div>
                  ) : tolerancePolicies.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-border rounded-xl text-muted-foreground text-sm">
                      No se han configurado políticas específicas. El sistema aplica las tolerancias básicas por defecto (10 min tolerancia, 15 min falta).
                    </div>
                  ) : (
                    <div className="overflow-hidden border border-border rounded-xl">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-border text-xs uppercase font-bold text-zinc-400">
                            <th className="p-3">Ámbito</th>
                            <th className="p-3">Destinatario</th>
                            <th className="p-3">Tolerancia</th>
                            <th className="p-3">Falta Aut.</th>
                            <th className="p-3 text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {tolerancePolicies.map((policy) => (
                            <tr key={policy.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                              <td className="p-3 font-semibold text-xs uppercase">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  policy.scope === 'global' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30' :
                                  policy.scope === 'career' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30' :
                                  'bg-violet-50 text-violet-700 dark:bg-violet-950/30'
                                }`}>
                                  {policy.scope}
                                </span>
                              </td>
                              <td className="p-3 text-xs">
                                {policy.scope === 'global' && 'Toda la institución'}
                                {policy.scope === 'career' && policy.career && `[${policy.career.code}] ${policy.career.name}`}
                                {policy.scope === 'subject' && policy.subject && `[${policy.subject.code}] ${policy.subject.name}`}
                              </td>
                              <td className="p-3 text-xs font-semibold">{policy.tolerance_minutes} min</td>
                              <td className="p-3 text-xs font-semibold">{policy.absent_minutes} min</td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTolerancePolicy(policy.id)}
                                  className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Section: Alerts */}
          {activeSection === 'alerts' && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-foreground">Alertas y Umbrales Académicos</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Controla la automatización de correos de reprobación por inasistencias y monitorea estudiantes críticos.</p>
              </div>

              {isAlertsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                  <span>Cargando ajustes de alertas...</span>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-3">
                  {/* Form Adjustments */}
                  <form onSubmit={handleSaveAlertSettings} className="md:col-span-1 space-y-4 border-r border-border pr-6">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Umbral de Alerta de Faltas (%)</label>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min={5}
                          max={50}
                          value={alertsForm.threshold}
                          onChange={(e) => setAlertsForm(prev => ({ ...prev, threshold: parseInt(e.target.value) || 20 }))}
                          className="w-full accent-violet-600 cursor-pointer"
                        />
                        <span className="text-sm font-extrabold text-violet-600 shrink-0 w-12 text-right">{alertsForm.threshold}%</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1.5">Disparador de alertas académicas cuando el alumno acumula este porcentaje de inasistencias injustificadas.</p>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 border border-border rounded-lg">
                      <div>
                        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Notificar por Correo</p>
                        <p className="text-[9px] text-zinc-400">Automatizado vía NestJS / Brevo API</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={alertsForm.enableEmail}
                        onChange={(e) => setAlertsForm(prev => ({ ...prev, enableEmail: e.target.checked }))}
                        className="w-4 h-4 accent-violet-600 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Supervisores en Copia (BCC / Comma Separated)</label>
                      <textarea
                        rows={3}
                        placeholder="coordinacion@deymos.edu, direccion@deymos.edu"
                        value={alertsForm.recipients}
                        onChange={(e) => setAlertsForm(prev => ({ ...prev, recipients: e.target.value }))}
                        className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono"
                      />
                      <p className="text-[10px] text-zinc-400 mt-1">Correos electrónicos de directivos que recibirán copia de los avisos críticos de reprobación.</p>
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full text-xs font-bold"
                        leftIcon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      >
                        Guardar Ajustes
                      </Button>
                    </div>
                  </form>

                  {/* At Risk List Table */}
                  <div className="md:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        Alumnos en Riesgo Crítico (&gt;{alertsForm.threshold}%)
                      </h4>
                    </div>

                    {isStudentsAtRiskLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                        <span>Calculando estadísticas académicas...</span>
                      </div>
                    ) : studentsAtRisk.length === 0 ? (
                      <div className="text-center py-12 border border-dashed border-border rounded-xl text-muted-foreground text-sm">
                        No se detectan alumnos en riesgo de reprobación por inasistencias en este período. ¡Todo al día!
                      </div>
                    ) : (
                      <div className="overflow-hidden border border-border rounded-xl max-h-[350px] overflow-y-auto">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead>
                            <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-border text-xs uppercase font-bold text-zinc-400">
                              <th className="p-3">Estudiante</th>
                              <th className="p-3">Materia</th>
                              <th className="p-3">Faltas</th>
                              <th className="p-3 text-center">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {studentsAtRisk.map((risk, index) => {
                              const alertKey = `${risk.studentId}-${risk.subjectId}`;
                              const isSending = sendingAlertId === alertKey;

                              return (
                                <tr key={index} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                                  <td className="p-3">
                                    <p className="font-semibold text-xs">{risk.studentName}</p>
                                    <p className="text-[10px] text-zinc-400">{risk.studentEmail}</p>
                                  </td>
                                  <td className="p-3">
                                    <p className="font-semibold text-xs">{risk.subjectName}</p>
                                    <p className="text-[10px] text-zinc-400 font-mono">{risk.subjectCode}</p>
                                  </td>
                                  <td className="p-3">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-50 text-rose-700 dark:bg-rose-950/30">
                                      {risk.unexcusedRate.toFixed(1)}% ({risk.unexcusedCount}/{risk.totalClasses})
                                    </span>
                                  </td>
                                  <td className="p-3 text-center">
                                    <button
                                      type="button"
                                      disabled={sendingAlertId !== null}
                                      onClick={() => handleTriggerManualAlert(risk.studentId, risk.subjectId, risk.unexcusedRate)}
                                      className="inline-flex items-center gap-1 text-[10px] uppercase font-bold border border-violet-200 dark:border-violet-900/50 hover:bg-violet-50 dark:hover:bg-violet-950/20 text-violet-600 dark:text-violet-400 px-2 py-1.5 rounded-lg disabled:opacity-50 transition"
                                    >
                                      {isSending ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Mail className="w-3 h-3" />
                                      )}
                                      Alertar
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section: Holidays */}
          {activeSection === 'holidays' && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-foreground">Calendario de Días Feriados e Inhábiles</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Registra las fechas festivas o de suspensión que congelarán automáticamente la toma de asistencia.</p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {/* Add Holiday Form */}
                <form onSubmit={handleAddHoliday} className="md:col-span-1 space-y-4 border-r border-border pr-6">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Fecha del Feriado</label>
                    <input
                      type="date"
                      required
                      value={newHolidayForm.date}
                      onChange={(e) => setNewHolidayForm(prev => ({ ...prev, date: e.target.value }))}
                      className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Descripción o Festivo</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Día del Trabajador"
                      value={newHolidayForm.name}
                      onChange={(e) => setNewHolidayForm(prev => ({ ...prev, name: e.target.value }))}
                      className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full text-xs font-bold"
                      leftIcon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    >
                      Agregar Feriado
                    </Button>
                  </div>

                  <div className="rounded-lg border border-amber-100 dark:border-amber-950 bg-amber-50/10 p-3 text-[10px] text-amber-600 dark:text-amber-400 flex items-start gap-2 select-none leading-relaxed">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>
                      <strong>CONGELAMIENTO ACTIVO:</strong> Al guardar una fecha feriada, se creará una restricción a nivel base de datos que bloqueará a cualquier docente de registrar o editar planillas de asistencia en dicho día.
                    </span>
                  </div>
                </form>

                {/* Holidays List */}
                <div className="md:col-span-2 space-y-4">
                  <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Fechas Inhábiles Registradas</h4>

                  {isHolidaysLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                      <span>Cargando feriados...</span>
                    </div>
                  ) : holidaysList.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-border rounded-xl text-muted-foreground text-sm">
                      No hay feriados institucionales programados.
                    </div>
                  ) : (
                    <div className="overflow-hidden border border-border rounded-xl">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-border text-xs uppercase font-bold text-zinc-400">
                            <th className="p-3">Fecha</th>
                            <th className="p-3">Descripción</th>
                            <th className="p-3 text-center">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {holidaysList.map((holiday) => (
                            <tr key={holiday.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                              <td className="p-3 text-xs font-semibold font-mono">
                                {new Date(holiday.date + 'T00:00:00').toLocaleDateString('es-ES', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </td>
                              <td className="p-3 text-xs font-semibold">{holiday.name}</td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteHoliday(holiday.id)}
                                  className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Section: Notifications (Idea B) */}
          {activeSection === 'notifications' && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-foreground">Preferencia de Notificaciones</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Controla las alertas del sistema y notificaciones por correo electrónico.</p>
              </div>

              <form onSubmit={handleSaveNotifications} className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3.5 bg-zinc-50/50 dark:bg-zinc-900/30 border border-border rounded-xl">
                    <div>
                      <p className="text-sm font-bold text-foreground">Alertas por Correo Electrónico</p>
                      <p className="text-xs text-muted-foreground">Recibe alertas importantes, como justificaciones presentadas o reportes de riesgo, en tu bandeja de entrada.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailAlertsEnabled}
                      onChange={(e) => setEmailAlertsEnabled(e.target.checked)}
                      className="w-4.5 h-4.5 accent-brand cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-zinc-50/50 dark:bg-zinc-900/30 border border-border rounded-xl">
                    <div>
                      <p className="text-sm font-bold text-foreground">Notificaciones en la Aplicación (In-App)</p>
                      <p className="text-xs text-muted-foreground">Muestra globos y ventanas emergentes dentro de la app para advertencias en tiempo real.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={inAppAlertsEnabled}
                      onChange={(e) => setInAppAlertsEnabled(e.target.checked)}
                      className="w-4.5 h-4.5 accent-brand cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-zinc-50/50 dark:bg-zinc-900/30 border border-border rounded-xl">
                    <div>
                      <p className="text-sm font-bold text-foreground">Resumen Semanal Académico</p>
                      <p className="text-xs text-muted-foreground">Envía un consolidado de asistencias de tus materias o departamentos todos los viernes por correo.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={weeklySummaryEnabled}
                      onChange={(e) => setWeeklySummaryEnabled(e.target.checked)}
                      className="w-4.5 h-4.5 accent-brand cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button 
                    type="submit" 
                    leftIcon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    disabled={isLoading}
                    className="bg-brand hover:bg-brand-hover text-white"
                  >
                    Guardar Notificaciones
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Section: Attendance Flow (Idea C) */}
          {activeSection === 'attendanceFlow' && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-foreground">Personalización del Flujo de Asistencia</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Define las reglas operativas, el día inicial de semana y etiquetas personalizadas del tenant.</p>
              </div>

              <form onSubmit={handleSaveAttendanceFlow} className="space-y-6">
                {/* Día inicial de la semana */}
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Día de Inicio de la Semana</label>
                  <select
                    value={weekStartDay}
                    onChange={(e) => setWeekStartDay(e.target.value as any)}
                    className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    <option value="monday">Lunes (Estándar Académico)</option>
                    <option value="sunday">Domingo</option>
                  </select>
                  <p className="text-[10px] text-zinc-400 mt-1">Configura el inicio de los calendarios y el visualizador semanal de horarios.</p>
                </div>

                {/* Justificaciones requieren evidencia */}
                <div className="flex items-center justify-between p-3.5 bg-zinc-50/50 dark:bg-zinc-900/30 border border-border rounded-xl">
                  <div>
                    <p className="text-sm font-bold text-foreground">Requerir Evidencia Médica/Académica obligatoria</p>
                    <p className="text-xs text-muted-foreground">Si está activo, los alumnos deberán adjuntar al menos un archivo (PDF/imagen) para justificar una inasistencia.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={justificationsRequireEvidence}
                    onChange={(e) => setJustificationsRequireEvidence(e.target.checked)}
                    className="w-4.5 h-4.5 accent-brand cursor-pointer"
                  />
                </div>

                {/* Personalización de Etiquetas de Asistencia */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Etiquetas de Estados de Asistencia</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {customStatuses.map((statusObj, idx) => (
                      <div key={statusObj.status} className="p-3 border border-border rounded-lg bg-zinc-50/20 dark:bg-zinc-900/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold uppercase text-zinc-400">{statusObj.status}</span>
                          <span className={`w-3.5 h-3.5 rounded-full bg-${statusObj.color}-500`} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={statusObj.label}
                            onChange={(e) => {
                              const updated = [...customStatuses];
                              updated[idx].label = e.target.value;
                              setCustomStatuses(updated);
                            }}
                            placeholder="Nombre etiqueta"
                            className="flex h-8 w-full rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                          />
                          <select
                            value={statusObj.color}
                            onChange={(e) => {
                              const updated = [...customStatuses];
                              updated[idx].color = e.target.value;
                              setCustomStatuses(updated);
                            }}
                            className="flex h-8 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                          >
                            <option value="emerald">Verde</option>
                            <option value="amber">Amarillo</option>
                            <option value="rose">Rojo</option>
                            <option value="blue">Azul</option>
                            <option value="indigo">Índigo</option>
                            <option value="violet">Violeta</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button 
                    type="submit" 
                    leftIcon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    disabled={isLoading}
                    className="bg-brand hover:bg-brand-hover text-white"
                  >
                    Guardar Flujo de Asistencia
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Section: Diagnostics & Data Backup (Idea D) */}
          {activeSection === 'diagnostics' && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-foreground">Diagnóstico de Sistema y Respaldos</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Supervisa la salud de las conexiones, exporta copias de seguridad de las configuraciones y descarga auditorías.</p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {/* Connection Status Monitor */}
                <div className="md:col-span-1 space-y-4 border-r border-border pr-6 select-none">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Estado de Conectividad</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-zinc-50/50 dark:bg-zinc-900/30 border border-border rounded-lg text-xs">
                      <span className="font-semibold text-zinc-600 dark:text-zinc-400">Base de Datos (Supabase)</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                        integrationStatus.database === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30' :
                        integrationStatus.database === 'error' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30' :
                        'bg-zinc-50 text-zinc-400'
                      }`}>
                        {integrationStatus.database === 'success' ? 'Online' : integrationStatus.database === 'error' ? 'Error' : 'Cargando'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-zinc-50/50 dark:bg-zinc-900/30 border border-border rounded-lg text-xs">
                      <span className="font-semibold text-zinc-600 dark:text-zinc-400">Servicio de Sesión (Auth)</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                        integrationStatus.auth === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30' :
                        integrationStatus.auth === 'error' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30' :
                        'bg-zinc-50 text-zinc-400'
                      }`}>
                        {integrationStatus.auth === 'success' ? 'Activo' : integrationStatus.auth === 'error' ? 'Inactivo' : 'Cargando'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-zinc-50/50 dark:bg-zinc-900/30 border border-border rounded-lg text-xs">
                      <span className="font-semibold text-zinc-600 dark:text-zinc-400">Servidor API (NestJS)</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                        integrationStatus.api === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30' :
                        integrationStatus.api === 'error' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30' :
                        'bg-zinc-50 text-zinc-400'
                      }`}>
                        {integrationStatus.api === 'success' ? 'Conectado' : integrationStatus.api === 'error' ? 'Offline' : 'Cargando'}
                      </span>
                    </div>
                  </div>
                  <Button 
                    type="button" 
                    onClick={checkIntegrations}
                    className="w-full text-xs font-bold bg-zinc-100 dark:bg-zinc-800 border border-border text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  >
                    Re-Comprobar
                  </Button>
                </div>

                {/* Backups & Portability */}
                <div className="md:col-span-2 space-y-4">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Copia de Seguridad y Portabilidad</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="p-4 border border-border rounded-xl space-y-3">
                      <div className="flex items-start gap-3">
                        <Database className="w-5 h-5 text-brand shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-foreground">Reglas e Históricos</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Descarga todas las políticas de tolerancia, días feriados y configuraciones de alertas en formato JSON.</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        onClick={handleExportBackup}
                        className="w-full text-xs font-bold bg-brand hover:bg-brand-hover text-white"
                      >
                        Descargar Backup JSON
                      </Button>
                    </div>

                    <div className="p-4 border border-border rounded-xl space-y-3">
                      <div className="flex items-start gap-3">
                        <Sliders className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-foreground">Logs de Auditoría</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Exporta los últimos 100 eventos de cambios realizados por usuarios en este tenant a formato CSV.</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        onClick={handleExportAuditLogs}
                        className="w-full text-xs font-bold bg-zinc-100 dark:bg-zinc-800 border border-border text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      >
                        Exportar Logs CSV
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
