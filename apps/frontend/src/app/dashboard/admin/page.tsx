'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormInput } from '@/components/ui/FormInput';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';
import { TrendAreaChart, StatusPieChart } from '@/components/dashboard/AttendanceCharts';
import { 
  Users, 
  Shield, 
  BookOpen, 
  Plus, 
  UserPlus, 
  Mail,
  User,
  TrendingUp,
  FileText,
  Activity,
  Lock,
  Settings
} from 'lucide-react';

interface SystemUser {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: 'activo' | 'inactivo';
  avatar_url?: string;
  career_name?: string;
  career_id?: string;
  ui_preferences?: any;
}

interface TrendItem {
  date: string;
  presente: number;
  tarde: number;
  ausente: number;
  justificado: number;
  total: number;
}

const AVATAR_PRESETS = [
  { id: 'academic-1', label: 'Estudiante A', color: 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400' },
  { id: 'academic-2', label: 'Estudiante B', color: 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400' },
  { id: 'academic-3', label: 'Docente A', color: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' },
  { id: 'academic-4', label: 'Docente B', color: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400' },
  { id: 'academic-5', label: 'Administrador A', color: 'bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400' },
  { id: 'academic-6', label: 'Administrador B', color: 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400' }
];

export default function AdminDashboardPage() {
  const { user, token } = useAuthStore();
  
  // Listas y Cargas
  const [usersList, setUsersList] = useState<SystemUser[]>([]);
  const [trendData, setTrendData] = useState<TrendItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingTrends, setIsLoadingTrends] = useState(true);

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState('estudiante');
  const [isEditing, setIsEditing] = useState(false);
  const [editingUserId, setEditingUserId] = useState('');

  // Customization Form states
  const [careersList, setCareersList] = useState<{ id: string; name: string }[]>([]);
  const [selectedCareerId, setSelectedCareerId] = useState('');
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState('academic-1');
  const [selectedTheme, setSelectedTheme] = useState<'light' | 'dark'>('light');
  const [selectedDensity, setSelectedDensity] = useState<'comfortable' | 'compact'>('comfortable');

  // Dynamic Metadata states
  const [studentCode, setStudentCode] = useState('');
  const [studentSemester, setStudentSemester] = useState('I');
  const [teacherSpecialty, setTeacherSpecialty] = useState('');
  const [teacherDepartment, setTeacherDepartment] = useState('');

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Cargar estadísticas agregadas
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
      showToast('Error al cargar métricas generales del sistema', 'error');
    } finally {
      setIsLoadingStats(false);
    }
  };

  // 2. Cargar tendencias analíticas
  const loadTrends = async () => {
    if (!token) return;
    setIsLoadingTrends(true);
    try {
      const response = await fetch(`${API_URL}/reports/tendencias?limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setTrendData(data);
    } catch (err) {
      console.error(err);
      showToast('Error al sincronizar tendencias temporales', 'error');
    } finally {
      setIsLoadingTrends(false);
    }
  };

  // Load careers catalog
  const loadCareers = async () => {
    try {
      const { data, error } = await supabase
        .from('careers')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) throw error;
      setCareersList(data || []);
    } catch (err: any) {
      console.error('Error loading careers catalog:', err);
    }
  };

  // 3. Cargar perfiles de Supabase reales
  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role_id, is_active, avatar_url, career_id, ui_preferences, careers(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted: SystemUser[] = (data as any[] || []).map(u => ({
        id: u.id,
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Sin Nombre',
        firstName: u.first_name || '',
        lastName: u.last_name || '',
        email: u.email,
        role: u.role_id || 'estudiante',
        status: u.is_active ? 'activo' : 'inactivo',
        avatar_url: u.avatar_url || 'academic-1',
        career_id: u.career_id || '',
        career_name: (u.careers as any)?.name || '',
        ui_preferences: u.ui_preferences || {}
      }));

      setUsersList(formatted);
    } catch (err: any) {
      console.error('Error al cargar usuarios: ' + (err?.message || err) + ' (Código: ' + (err?.code || 'sin código') + ', Detalles: ' + (err?.details || 'ninguno') + ', Hint: ' + (err?.hint || 'ninguno') + ')');
      showToast('Error al cargar la lista de usuarios institucionales', 'error');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadStats();
      loadTrends();
      loadUsers();
      loadCareers();
    }
  }, [token]);

  // Creación de usuario real/demo en Supabase
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!token) {
        showToast('Sesión no válida o expirada. Por favor inicia sesión.', 'error');
        return;
      }

      // Build ui_preferences
      const uiPreferences: any = {
        theme: selectedTheme,
        density: selectedDensity,
        dashboardLayout: {
          widgets: [
            { id: 'asistencia-diaria', visible: true, size: 'medium', order: 1 },
            { id: 'tardanzas', visible: true, size: 'small', order: 2 },
            { id: 'carreras', visible: true, size: 'small', order: 3 },
            { id: 'ausentes', visible: true, size: 'medium', order: 4 },
            { id: 'aulas-ocupadas', visible: true, size: 'medium', order: 5 },
            { id: 'actividad-reciente', visible: true, size: 'large', order: 6 }
          ]
        }
      };

      // Add role-specific academic metadata under the 'academic' key in ui_preferences
      if (formRole === 'estudiante') {
        uiPreferences.academic = {
          code: studentCode || 'N/A',
          semester: studentSemester || 'I'
        };
      } else if (formRole === 'docente') {
        uiPreferences.academic = {
          specialty: teacherSpecialty || 'N/A',
          department: teacherDepartment || 'N/A'
        };
      }

      const url = isEditing ? `${API_URL}/auth/users/${editingUserId}` : `${API_URL}/auth/users`;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: formEmail,
          first_name: formFirstName,
          last_name: formLastName,
          role_id: formRole,
          career_id: selectedCareerId || null,
          avatar_url: selectedAvatarUrl,
          ui_preferences: uiPreferences
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.message || 'Error en el servidor al registrar el usuario');
      }

      showToast(isEditing ? `Usuario ${formFirstName} actualizado con éxito` : `Usuario ${formFirstName} registrado con éxito en el directorio`, 'success');
      
      // Resetear formulario
      setIsModalOpen(false);
      setIsEditing(false);
      setEditingUserId('');
      setFormFirstName('');
      setFormLastName('');
      setFormEmail('');
      setFormRole('estudiante');
      setSelectedCareerId('');
      setSelectedAvatarUrl('academic-1');
      setSelectedTheme('light');
      setSelectedDensity('comfortable');
      setStudentCode('');
      setStudentSemester('I');
      setTeacherSpecialty('');
      setTeacherDepartment('');

      // Recargar directorio
      await loadUsers();
      await loadStats();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error al agregar el nuevo usuario', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeAndResetForm = () => {
    setIsModalOpen(false);
    setIsEditing(false);
    setEditingUserId('');
    setFormFirstName('');
    setFormLastName('');
    setFormEmail('');
    setFormRole('estudiante');
    setSelectedCareerId('');
    setSelectedAvatarUrl('academic-1');
    setSelectedTheme('light');
    setSelectedDensity('comfortable');
    setStudentCode('');
    setStudentSemester('I');
    setTeacherSpecialty('');
    setTeacherDepartment('');
  };

  const handleEdit = (item: SystemUser) => {
    setFormFirstName(item.firstName);
    setFormLastName(item.lastName);
    setFormEmail(item.email);
    setFormRole(item.role);
    setSelectedCareerId(item.career_id || '');
    setSelectedAvatarUrl(item.avatar_url || 'academic-1');
    setSelectedTheme(item.ui_preferences?.theme || 'light');
    setSelectedDensity(item.ui_preferences?.density || 'comfortable');
    
    if (item.role === 'estudiante') {
      setStudentCode(item.ui_preferences?.academic?.code || '');
      setStudentSemester(item.ui_preferences?.academic?.semester || 'I');
      setTeacherSpecialty('');
      setTeacherDepartment('');
    } else if (item.role === 'docente') {
      setTeacherSpecialty(item.ui_preferences?.academic?.specialty || '');
      setTeacherDepartment(item.ui_preferences?.academic?.department || '');
      setStudentCode('');
      setStudentSemester('I');
    } else {
      setStudentCode('');
      setStudentSemester('I');
      setTeacherSpecialty('');
      setTeacherDepartment('');
    }
    
    setIsEditing(true);
    setEditingUserId(item.id);
    setIsModalOpen(true);
  };

  const columns = [
    {
      header: 'Nombre Completo',
      accessor: (item: SystemUser) => {
        const initials = item.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'U';
        const preset = AVATAR_PRESETS.find(p => p.id === item.avatar_url);
        
        const renderAvatar = () => {
          if (item.avatar_url && item.avatar_url.startsWith('http')) {
            return (
              <img 
                src={item.avatar_url} 
                alt={item.name} 
                className="w-8 h-8 rounded-full object-cover border border-violet-200/50 dark:border-violet-900/40 select-none shadow-sm"
              />
            );
          }
          const presetColor = preset?.color || 'bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400';
          return (
            <div className={`w-8 h-8 rounded-full border border-violet-200/50 dark:border-violet-900/40 flex items-center justify-center font-bold text-xs select-none shadow-sm ${presetColor}`}>
              {initials}
            </div>
          );
        };

        return (
          <div className="flex items-center gap-2.5">
            {renderAvatar()}
            <div>
              <div className="font-semibold text-zinc-900 dark:text-zinc-50">{item.name}</div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 flex-wrap leading-none mt-0.5">
                <span>ID: {item.id.substring(0, 8)}...</span>
                {item.ui_preferences?.academic?.code && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 leading-none">
                    🔑 {item.ui_preferences.academic.code}
                  </span>
                )}
                {item.ui_preferences?.academic?.specialty && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 leading-none" title={item.ui_preferences.academic.specialty}>
                    🎓 {item.ui_preferences.academic.specialty.length > 15 
                      ? `${item.ui_preferences.academic.specialty.substring(0, 13)}...` 
                      : item.ui_preferences.academic.specialty}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      }
    },
    {
      header: 'Correo Electrónico',
      accessor: (item: SystemUser) => (
        <span className="font-mono text-xs text-muted-foreground flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5 opacity-60" />
          {item.email}
        </span>
      )
    },
    {
      header: 'Rol Académico',
      accessor: (item: SystemUser) => {
        const roleColors = {
          admin: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-200/50 dark:border-red-900/50',
          supervisor: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50',
          docente: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/50',
          estudiante: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/50'
        };
        return (
          <div className="flex flex-col gap-0.5 items-start">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize tracking-wide ${roleColors[item.role as keyof typeof roleColors] || 'bg-zinc-100 text-zinc-800'}`}>
              <Shield className="w-3 h-3" />
              {item.role}
            </span>
            {item.career_name && (
              <span className="text-[9px] font-medium text-muted-foreground tracking-wide truncate max-w-[120px] pl-1" title={item.career_name}>
                🏛️ {item.career_name}
              </span>
            )}
          </div>
        );
      }
    },
    {
      header: 'Estado',
      accessor: (item: SystemUser) => {
        const hasDarkTheme = item.ui_preferences?.theme === 'dark';
        const isCompact = item.ui_preferences?.density === 'compact';
        
        return (
          <div className="flex flex-col gap-0.5 items-start">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${item.status === 'activo' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'activo' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
              {item.status === 'activo' ? 'Activo' : 'Inactivo'}
            </span>
            <span className="text-[8px] text-muted-foreground flex items-center gap-1 opacity-75">
              <span>{hasDarkTheme ? '🌙 Oscuro' : '☀️ Claro'}</span>
              <span>•</span>
              <span>{isCompact ? '🗜️' : '📱'}</span>
            </span>
          </div>
        );
      }
    },
    {
      header: 'Acciones',
      accessor: (item: SystemUser) => {
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Settings className="w-3.5 h-3.5" />}
              onClick={() => handleEdit(item)}
              className="text-violet-600 border-violet-200 hover:bg-violet-50 dark:text-violet-400 dark:border-violet-950/80 dark:hover:bg-violet-950/20"
            >
              Editar
            </Button>
          </div>
        );
      }
    }
  ];

  // Métricas reales calculadas
  const totalStudents = stats?.widgets?.activeStudentsCount ?? 0;
  const totalTeachers = stats?.widgets?.activeTeachersCount ?? 0;
  const totalSummaryCount = stats?.summary?.totalRecords ?? 0;
  const attendanceRate = stats?.summary?.tasaAsistencia ?? 100;

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
            <Shield className="w-8 h-8 text-violet-500 flex-shrink-0" />
            Panel de Administración
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión institucional global. Bienvenido, {user?.first_name || 'Administrador'}.
          </p>
        </div>
        <div>
          <Button 
            variant="default" 
            leftIcon={<UserPlus className="w-4 h-4" />}
            onClick={() => {
              setFormFirstName('');
              setFormLastName('');
              setFormEmail('');
              setFormRole('estudiante');
              setSelectedCareerId('');
              setSelectedAvatarUrl('academic-1');
              setSelectedTheme('light');
              setSelectedDensity('comfortable');
              setStudentCode('');
              setStudentSemester('I');
              setTeacherSpecialty('');
              setTeacherDepartment('');
              setIsEditing(false);
              setEditingUserId('');
              setIsModalOpen(true);
            }}
          >
            Nuevo Usuario
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 select-none">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Estudiantes Activos</p>
            <h3 className="text-2xl font-bold tracking-tight text-foreground">
              {isLoadingStats ? '...' : totalStudents}
            </h3>
            <p className="text-xs text-emerald-600 font-semibold leading-none">Matriculados en el ciclo</p>
          </div>
          <div className="p-3 bg-violet-50 dark:bg-violet-950/30 text-violet-600 rounded-xl border border-violet-100 dark:border-violet-900 shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Docentes Activos</p>
            <h3 className="text-2xl font-bold tracking-tight text-foreground">
              {isLoadingStats ? '...' : totalTeachers}
            </h3>
            <p className="text-xs text-muted-foreground leading-none">Asignaturas coordinadas</p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-xl border border-emerald-100 dark:border-emerald-900 shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Asistencia Global</p>
            <h3 className="text-2xl font-bold tracking-tight text-foreground">
              {isLoadingStats ? '...' : `${attendanceRate}%`}
            </h3>
            <p className="text-xs text-emerald-600 font-semibold leading-none">Promedio universitario</p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-xl border border-emerald-100 dark:border-emerald-900 shrink-0">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Registros Procesados</p>
            <h3 className="text-2xl font-bold tracking-tight text-foreground">
              {isLoadingStats ? '...' : totalSummaryCount}
            </h3>
            <p className="text-xs text-emerald-600 font-semibold leading-none">Control seguro RLS</p>
          </div>
          <div className="p-3 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-300 rounded-xl border border-border shrink-0">
            <Shield className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Gráficos Analíticos */}
      {!isLoadingTrends && trendData.length > 0 && stats && (
        <div className="grid gap-6 md:grid-cols-3 select-none">
          {/* Evolución diaria */}
          <div className="md:col-span-2 rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-violet-500" />
                Historial de Asistencia Académica Universitario
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Métricas de puntualidad diaria consolidadas por el backend.</p>
            </div>
            <div className="mt-4">
              <TrendAreaChart data={trendData} />
            </div>
          </div>

          {/* Distribución Global */}
          <div className="md:col-span-1 rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-violet-500" />
                Distribución Semántica de Asistencias
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Estados consolidados del periodo académico activo.</p>
            </div>
            <div className="mt-4 flex items-center justify-center">
              <StatusPieChart data={{
                presente: stats.summary.presentes,
                tarde: stats.summary.tardes,
                ausente: stats.summary.ausentes,
                justificado: stats.summary.justificados
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Tabla de Usuarios */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground select-none">Directorio Académico Reciente</h2>
        <DataTable
          columns={columns}
          data={usersList}
          isLoading={isLoadingUsers}
          emptyTitle="Sin usuarios"
          emptyMessage="No se han registrado usuarios recientemente."
        />
      </div>

      {/* Modal Agregar Usuario */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeAndResetForm}
        title={isEditing ? "Editar Perfil de Usuario" : "Agregar Nuevo Usuario Institucional"}
        footer={
          <>
            <Button variant="outline" onClick={closeAndResetForm}>
              Cancelar
            </Button>
            <Button variant="default" onClick={handleSubmit} isLoading={isSubmitting}>
              {isEditing ? "Guardar Cambios" : "Registrar Cuenta"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-border rounded-lg text-xs text-muted-foreground flex gap-2">
            <Lock className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
            {isEditing ? (
              <div>
                <p className="font-semibold text-foreground">Actualización en Supabase Auth</p>
                <p className="mt-0.5">Los cambios de perfil se sincronizarán directamente. El correo electrónico no se puede editar.</p>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-foreground">Asegurado mediante Supabase Auth</p>
                <p className="mt-0.5">El usuario recibirá un correo con su contraseña auto-generada para activar su cuenta.</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Nombre"
              placeholder="Ej. Alejandro"
              icon={<User className="w-4 h-4" />}
              value={formFirstName}
              onChange={(e) => setFormFirstName(e.target.value)}
              required
            />
            <FormInput
              label="Apellido"
              placeholder="Ej. Silva"
              icon={<User className="w-4 h-4" />}
              value={formLastName}
              onChange={(e) => setFormLastName(e.target.value)}
              required
            />
          </div>
          
          <FormInput
            label="Correo Institucional"
            type="email"
            placeholder="correo@universidad.edu"
            icon={<Mail className="w-4 h-4" />}
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
            disabled={isEditing}
            required
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1.5 text-left">
              <label className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400">
                Rol Académico
              </label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              >
                <option value="estudiante">Estudiante</option>
                <option value="docente">Docente</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            {(formRole === 'estudiante' || formRole === 'docente') && (
              <div className="flex flex-col space-y-1.5 text-left animate-fadeIn">
                <label className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400">
                  Carrera Profesional
                </label>
                <select
                  value={selectedCareerId}
                  onChange={(e) => setSelectedCareerId(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  <option value="">Seleccione una carrera...</option>
                  {careersList.map((career) => (
                    <option key={career.id} value={career.id}>
                      {career.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Academic Role specific fields */}
          {formRole === 'estudiante' && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-blue-50/40 dark:bg-blue-950/10 border border-blue-100/60 dark:border-blue-950/40 rounded-xl animate-fadeIn">
              <FormInput
                label="Código de Matrícula"
                placeholder="Ej. SIS-2026-0045"
                icon={<Lock className="w-4 h-4 text-blue-500" />}
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                required
              />
              <div className="flex flex-col space-y-1.5 text-left">
                <label className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400">
                  Semestre Activo
                </label>
                <select
                  value={studentSemester}
                  onChange={(e) => setStudentSemester(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'].map((sem) => (
                    <option key={sem} value={sem}>
                      Semestre {sem}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {formRole === 'docente' && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-100/60 dark:border-emerald-950/40 rounded-xl animate-fadeIn">
              <FormInput
                label="Especialidad / Título"
                placeholder="Ej. IA y Machine Learning"
                icon={<Shield className="w-4 h-4 text-emerald-500" />}
                value={teacherSpecialty}
                onChange={(e) => setTeacherSpecialty(e.target.value)}
                required
              />
              <FormInput
                label="Departamento Académico"
                placeholder="Ej. Ciencias Computacionales"
                icon={<Activity className="w-4 h-4 text-emerald-500" />}
                value={teacherDepartment}
                onChange={(e) => setTeacherDepartment(e.target.value)}
                required
              />
            </div>
          )}

          {/* Interactive Pastels Vectorial Avatar Selector Grid */}
          <div className="flex flex-col space-y-2 text-left border-t border-border pt-4">
            <label className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400">
              Avatar Académico Personalizado
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {AVATAR_PRESETS.map((preset) => {
                const isSelected = selectedAvatarUrl === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedAvatarUrl(preset.id)}
                    className={`h-16 rounded-xl flex flex-col items-center justify-center gap-1.5 text-xs font-semibold transition-all relative border overflow-hidden group hover:scale-[1.02] active:scale-[0.98] ${preset.color} ${
                      isSelected 
                        ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-zinc-950 border-primary/50 shadow-md' 
                        : 'border-zinc-200/60 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700/80'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs bg-white/60 dark:bg-black/20 shadow-sm border border-black/5 dark:border-white/5">
                      {preset.label.charAt(0) + preset.label.slice(-1)}
                    </div>
                    <span className="text-[10px] opacity-90 truncate max-w-full px-1">{preset.label}</span>
                    {isSelected && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full border border-white dark:border-zinc-950 flex items-center justify-center shadow-sm" />
                    )}
                  </button>
                );
              })}
            </div>
            {/* Optional Custom URL Input */}
            <div className="mt-2">
              <input
                type="text"
                placeholder="URL de avatar personalizado (opcional)..."
                value={selectedAvatarUrl.startsWith('http') ? selectedAvatarUrl : ''}
                onChange={(e) => setSelectedAvatarUrl(e.target.value || 'academic-1')}
                className="flex h-9 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Interface visual initial preferences Theme and Density */}
          <div className="grid grid-cols-2 gap-4 text-left border-t border-border pt-4">
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400">
                Tema de Interfaz Inicial
              </label>
              <div className="flex rounded-lg border border-border p-1 bg-zinc-50 dark:bg-zinc-900/50">
                <button
                  type="button"
                  onClick={() => setSelectedTheme('light')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                    selectedTheme === 'light'
                      ? 'bg-white dark:bg-zinc-800 text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Claro
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTheme('dark')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                    selectedTheme === 'dark'
                      ? 'bg-white dark:bg-zinc-800 text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Oscuro
                </button>
              </div>
            </div>

            <div className="flex flex-col space-y-1.5">
              <label className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400">
                Densidad Visual Inicial
              </label>
              <div className="flex rounded-lg border border-border p-1 bg-zinc-50 dark:bg-zinc-900/50">
                <button
                  type="button"
                  onClick={() => setSelectedDensity('comfortable')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                    selectedDensity === 'comfortable'
                      ? 'bg-white dark:bg-zinc-800 text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Cómoda
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDensity('compact')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                    selectedDensity === 'compact'
                      ? 'bg-white dark:bg-zinc-800 text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Compacta
                </button>
              </div>
            </div>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
