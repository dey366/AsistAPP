'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormInput } from '@/components/ui/FormInput';
import { useAuthStore } from '@/store/useAuthStore';
import { useUiStore, WidgetConfig } from '@/store/useUiStore';
import { supabase } from '@/lib/supabase';
import { useToastStore } from '@/store/useToastStore';
import { Reorder } from 'framer-motion';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  FileWarning, 
  Plus, 
  ExternalLink,
  Search,
  UserCheck,
  MapPin,
  Calendar,
  Settings,
  Eye,
  EyeOff,
  Award,
  TrendingUp,
  BookOpen,
  ArrowRight,
  Link,
  Trash2,
  Edit2,
  Megaphone,
  CheckSquare,
  FileText,
  X,
  AlertTriangle,
  Heart,
  Smile
} from 'lucide-react';

interface MockAttendance {
  id: string;
  studentName: string;
  subject: string;
  time: string;
  status: 'presente' | 'tarde' | 'ausente' | 'justificado';
}

const mockData: MockAttendance[] = [
  { id: '1', studentName: 'Sofía Valenzuela', subject: 'Cálculo Multivariable', time: '08:05 AM', status: 'presente' },
  { id: '2', studentName: 'Mateo Quispe', subject: 'Estructuras de Datos', time: '08:18 AM', status: 'tarde' },
  { id: '3', studentName: 'Valentina Rojas', subject: 'Arquitectura de Software', time: '---', status: 'ausente' },
  { id: '4', studentName: 'Sebastián Mendoza', subject: 'Física Universitaria II', time: '09:02 AM', status: 'presente' },
  { id: '5', studentName: 'Camila Benítez', subject: 'Cálculo Multivariable', time: '---', status: 'justificado' }
];

export default function DashboardPage() {
  const { user: currentUser } = useAuthStore();
  const { addToast } = useToastStore();
  const { 
    widgets: storeWidgets, 
    setWidgets: setStoreWidgets, 
    toggleWidgetVisibility, 
    updateWidgetSize,
    updateWidgetCustomConfig,
    savePreferences 
  } = useUiStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attendanceList, setAttendanceList] = useState<MockAttendance[]>(mockData);

  // Quick links state
  const [isQuickLinksOpen, setIsQuickLinksOpen] = useState(false);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // Ideas B, C, D states
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementType, setAnnouncementType] = useState<'info' | 'warning' | 'danger'>('info');
  const [announcementTarget, setAnnouncementTarget] = useState('all');
  
  const [widgetTab, setWidgetTab] = useState<'tasks' | 'notes'>('tasks');
  const [newTaskText, setNewTaskText] = useState('');
  const [newNoteColor, setNewNoteColor] = useState<'yellow' | 'blue' | 'green' | 'rose'>('yellow');
  
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [newTargetVal, setNewTargetVal] = useState(90);

  const router = useRouter();

  // Redirigir usuarios no-admin a su dashboard según su rol
  useEffect(() => {
    if (!currentUser) return;
    const role = currentUser.role_id;
    if (role === 'docente') {
      router.replace('/dashboard/docente');
    } else if (role === 'estudiante') {
      router.replace('/dashboard/estudiante');
    } else if (role === 'supervisor') {
      router.replace('/dashboard/supervisor');
    }
    // admin permanece en esta página
  }, [currentUser, router]);


  const openManageLinks = () => {
    setIsQuickLinksOpen(true);
  };

  const handleAddLink = async () => {
    if (!newLinkLabel || !newLinkUrl) return;
    
    // Validate url prefix
    let formattedUrl = newLinkUrl;
    if (!formattedUrl.startsWith('/') && !formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }

    const widget = storeWidgets.find(w => w.id === 'quick-links');
    const existingLinks = widget?.customConfig?.links || [];
    
    const updatedLinks = [...existingLinks, { label: newLinkLabel, url: formattedUrl }];
    
    updateWidgetCustomConfig('quick-links', { links: updatedLinks });
    
    setNewLinkLabel('');
    setNewLinkUrl('');
    
    if (currentUser) {
      setTimeout(async () => {
        await savePreferences(supabase, currentUser.id);
        addToast({ title: 'Enlace Agregado', message: 'Se ha guardado el enlace rápido en su panel.', type: 'success' });
      }, 50);
    }
  };

  const handleDeleteLink = async (indexToDelete: number) => {
    const widget = storeWidgets.find(w => w.id === 'quick-links');
    const existingLinks = widget?.customConfig?.links || [];
    
    const updatedLinks = existingLinks.filter((_: any, idx: number) => idx !== indexToDelete);
    
    updateWidgetCustomConfig('quick-links', { links: updatedLinks });
    
    if (currentUser) {
      setTimeout(async () => {
        await savePreferences(supabase, currentUser.id);
        addToast({ title: 'Enlace Eliminado', message: 'El enlace ha sido removido del panel.', type: 'success' });
      }, 50);
    }
  };

  // Form states
  const [studentName, setStudentName] = useState('');
  const [subject, setSubject] = useState('');
  const [time, setTime] = useState('');
  const [status, setStatus] = useState<'presente' | 'tarde' | 'ausente' | 'justificado'>('presente');

  // Backend real-time stats states
  const [pendingJustificationsCount, setPendingJustificationsCount] = useState<number | null>(null);
  const [activeClass, setActiveClass] = useState<any | null>(null);

  // Default widget lists by role for dynamic sync/override
  const getRoleDefaultWidgets = (role: string): WidgetConfig[] => {
    switch (role) {
      case 'docente':
        return [
          { id: 'clase-actual', visible: true, size: 'large', order: 1 },
          { id: 'asistencia-diaria', visible: true, size: 'medium', order: 2 },
          { id: 'tardanzas', visible: true, size: 'small', order: 3 },
          { id: 'quick-links', visible: true, size: 'small', order: 4, customConfig: { links: [{ label: 'Mis Clases', url: '/dashboard/asistencia' }, { label: 'Horarios', url: '/dashboard/horarios' }] } },
          { id: 'sticky-notes-todo', visible: true, size: 'medium', order: 5 },
          { id: 'actividad-reciente', visible: true, size: 'large', order: 6 }
        ];
      case 'supervisor':
        return [
          { id: 'justificaciones-pendientes', visible: true, size: 'medium', order: 1 },
          { id: 'ausentismo-tendencia', visible: true, size: 'large', order: 2 },
          { id: 'asistencia-diaria', visible: true, size: 'medium', order: 3 },
          { id: 'quick-links', visible: true, size: 'small', order: 4, customConfig: { links: [{ label: 'Justificaciones', url: '/dashboard/justificaciones' }, { label: 'Reportes', url: '/dashboard/reportes' }] } },
          { id: 'sticky-notes-todo', visible: true, size: 'medium', order: 5 },
          { id: 'actividad-reciente', visible: true, size: 'large', order: 6 }
        ];
      case 'estudiante':
        return [
          { id: 'asistencia-circular', visible: true, size: 'medium', order: 1 },
          { id: 'progreso-asignaturas', visible: true, size: 'medium', order: 2 },
          { id: 'quick-links', visible: true, size: 'small', order: 3, customConfig: { links: [{ label: 'Mis Horarios', url: '/dashboard/horarios' }] } },
          { id: 'sticky-notes-todo', visible: true, size: 'medium', order: 4 },
          { id: 'actividad-reciente', visible: true, size: 'large', order: 5 }
        ];
      default: // admin
        return [
          { id: 'asistencia-diaria', visible: true, size: 'medium', order: 1 },
          { id: 'tardanzas', visible: true, size: 'small', order: 2 },
          { id: 'carreras', visible: true, size: 'small', order: 3 },
          { id: 'ausentes', visible: true, size: 'medium', order: 4 },
          { id: 'quick-links', visible: true, size: 'small', order: 5, customConfig: { links: [{ label: 'Usuarios', url: '/dashboard/usuarios' }, { label: 'Departamentos', url: '/dashboard/departamentos' }] } },
          { id: 'sticky-notes-todo', visible: true, size: 'medium', order: 6 },
          { id: 'aulas-ocupadas', visible: true, size: 'medium', order: 7 },
          { id: 'actividad-reciente', visible: true, size: 'large', order: 8 }
        ];
    }
  };

  // 1. Sync store widgets layout with role defaults if not customized
  useEffect(() => {
    if (!currentUser) return;
    
    const currentIds = storeWidgets.map(w => w.id);
    const defaults = getRoleDefaultWidgets(currentUser.role_id);
    const defaultIds = defaults.map(w => w.id);

    // If current widgets list contains the generic admin list but the user is not admin,
    // or if the current widget configuration belongs to another role entirely:
    const isDefaultAdminList = currentIds.includes('carreras') && currentIds.includes('aulas-ocupadas') && !currentIds.includes('quick-links');
    const hasIntersection = currentIds.some(id => defaultIds.includes(id));

    if (isDefaultAdminList || (currentUser.role_id !== 'admin' && currentIds.includes('carreras')) || !hasIntersection) {
      setStoreWidgets(defaults);
      savePreferences(supabase, currentUser.id);
    }
  }, [currentUser, storeWidgets]);

  // 2. Fetch pending justifications count for supervisors
  useEffect(() => {
    if (currentUser?.role_id === 'supervisor') {
      const fetchPendingCount = async () => {
        try {
          const { count, error } = await supabase
            .from('justifications')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pendiente');
          if (!error && count !== null) {
            setPendingJustificationsCount(count);
          }
        } catch (err) {
          console.error('Error fetching pending justifications count:', err);
        }
      };
      fetchPendingCount();
    }
  }, [currentUser]);

  // 3. Fetch active classes today for teachers
  useEffect(() => {
    if (currentUser?.role_id === 'docente') {
      const fetchTeacherSchedules = async () => {
        try {
          const { data, error } = await supabase
            .from('schedules')
            .select(`
              id,
              day_of_week,
              start_time,
              end_time,
              subjects:subject_id(name, code),
              classrooms:classroom_id(name, building)
            `)
            .eq('teacher_id', currentUser.id);

          if (!error && data) {
            const now = new Date();
            const jsDay = now.getDay();
            const dbDay = jsDay === 0 ? 7 : jsDay;

            const currentHours = now.getHours();
            const currentMinutes = now.getMinutes();
            const currentTimeStr = `${currentHours.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}:00`;

            const todaySchedules = data.filter((s: any) => s.day_of_week === dbDay);

            // Check active
            const active = todaySchedules.find((s: any) => s.start_time <= currentTimeStr && currentTimeStr <= s.end_time);
            if (active) {
              setActiveClass({ ...active, status: 'active' });
              return;
            }

            // Check next
            const upcoming = todaySchedules
              .filter((s: any) => s.start_time > currentTimeStr)
              .sort((a: any, b: any) => a.start_time.localeCompare(b.start_time))[0];
            if (upcoming) {
              setActiveClass({ ...upcoming, status: 'upcoming' });
              return;
            }

            setActiveClass(null);
          }
        } catch (err) {
          console.error('Error fetching teacher active schedules:', err);
        }
      };
      fetchTeacherSchedules();
    }
  }, [currentUser]);

  // Framer Motion layout reorder callback
  const handleReorder = async (newWidgets: WidgetConfig[]) => {
    const updated = newWidgets.map((w, idx) => ({ ...w, order: idx + 1 }));
    setStoreWidgets(updated);

    if (currentUser) {
      await savePreferences(supabase, currentUser.id);
      addToast({
        title: 'Diseño Guardado',
        message: 'La disposición de su panel ha sido persistida en tiempo real.',
        type: 'success'
      });
    }
  };

  const handleWidgetToggleVisibility = async (id: string) => {
    toggleWidgetVisibility(id);
    if (currentUser) {
      await savePreferences(supabase, currentUser.id);
      addToast({
        title: 'Preferencia Actualizada',
        message: 'La visibilidad del widget ha sido guardada en Supabase.',
        type: 'success'
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      const newRecord: MockAttendance = {
        id: (attendanceList.length + 1).toString(),
        studentName: studentName || 'Estudiante Invitado',
        subject: subject || 'Asignatura Libre',
        time: status === 'ausente' ? '---' : time || '08:00 AM',
        status
      };

      setAttendanceList([newRecord, ...attendanceList]);
      setIsSubmitting(false);
      setIsModalOpen(false);
      
      setStudentName('');
      setSubject('');
      setTime('');
      setStatus('presente');
    }, 1200);
  };

  const columns = [
    {
      header: 'Estudiante',
      accessor: (item: MockAttendance) => (
        <div className="font-semibold text-zinc-900 dark:text-zinc-50">{item.studentName}</div>
      )
    },
    {
      header: 'Asignatura',
      accessor: (item: MockAttendance) => (
        <div className="text-muted-foreground">{item.subject}</div>
      )
    },
    {
      header: 'Hora de Entrada',
      accessor: (item: MockAttendance) => (
        <span className="font-mono text-xs">{item.time}</span>
      )
    },
    {
      header: 'Estado',
      accessor: (item: MockAttendance) => {
        const badges = {
          presente: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50',
          tarde: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50',
          ausente: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50',
          justificado: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50'
        };

        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize tracking-wide ${badges[item.status]}`}>
            {item.status}
          </span>
        );
      }
    }
  ];

  // Dynamic Widget Renderer
  const renderWidgetContent = (id: string) => {
    // 1. Docente: Clase Actual
    if (id === 'clase-actual') {
      return (
        <div className="flex flex-col h-full justify-between gap-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-violet-500 animate-pulse" />
              Clase Actual / Siguiente
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
              activeClass?.status === 'active' 
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50' 
                : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200/50'
            }`}>
              {activeClass?.status === 'active' ? '● En Curso' : 'Programada'}
            </span>
          </div>

          {activeClass ? (
            <div className="flex-1 flex flex-col justify-center py-1">
              <div className="text-[10px] font-mono text-violet-500 uppercase tracking-wider font-bold">
                {activeClass.subjects?.code}
              </div>
              <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mt-0.5 leading-snug">
                {activeClass.subjects?.name}
              </h3>
              <div className="grid grid-cols-2 gap-4 mt-3 text-xs text-muted-foreground border-t border-border/35 pt-3">
                <div>
                  <span className="block text-[10px] text-zinc-400">Bloque Horario</span>
                  <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-zinc-400" />
                    {activeClass.start_time.substring(0, 5)} - {activeClass.end_time.substring(0, 5)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-zinc-400">Aula Asignada</span>
                  <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-emerald-500" />
                    {activeClass.classrooms?.name || 'Aula Virtual'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center py-6 text-center text-xs text-muted-foreground border border-dashed border-border/80 rounded-xl bg-card/25">
              <Calendar className="w-6 h-6 opacity-30 mb-1 text-violet-500" />
              <p className="font-semibold text-foreground">Sin clases activas hoy</p>
              <p className="mt-0.5 opacity-80 pl-4 pr-4">Su planificación para el día de hoy se encuentra despejada.</p>
            </div>
          )}

          <div className="pt-2 border-t border-border/50">
            <Button 
              variant={activeClass?.status === 'active' ? 'default' : 'outline'} 
              className="w-full justify-center bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-none shadow-md shadow-violet-500/10"
              onClick={() => window.location.href = '/dashboard/asistencia'}
              leftIcon={<UserCheck className="w-4 h-4" />}
            >
              Registrar Asistencia
            </Button>
          </div>
        </div>
      );
    }

    // 2. Supervisor: Justificaciones Pendientes
    if (id === 'justificaciones-pendientes') {
      const count = pendingJustificationsCount !== null ? pendingJustificationsCount : 3;
      return (
        <div className="flex flex-col h-full justify-between gap-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              <FileWarning className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              Justificaciones
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200">
              Pendientes
            </span>
          </div>

          <div className="flex-1 flex items-center justify-between py-2">
            <div className="space-y-1">
              <h4 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-baseline gap-1 animate-pulse">
                {count}
                <span className="text-xs font-normal text-muted-foreground">solicitudes</span>
              </h4>
              <p className="text-xs text-muted-foreground">Requieren aprobación manual para firmas.</p>
            </div>
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-600 rounded-2xl border border-amber-200/50 shrink-0 relative">
              <div className="absolute inset-0 rounded-2xl bg-amber-500/10 animate-ping opacity-70"></div>
              <FileWarning className="w-7 h-7 relative z-10" />
            </div>
          </div>

          <div className="pt-2 border-t border-border/50">
            <Button 
              variant="default" 
              className="w-full justify-center bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-none shadow-md shadow-amber-500/20"
              onClick={() => window.location.href = '/dashboard/justificaciones'}
              leftIcon={<ExternalLink className="w-4 h-4" />}
            >
              Revisar Justificaciones
            </Button>
          </div>
        </div>
      );
    }

    // 3. Supervisor: Ausentismo Tendencia
    if (id === 'ausentismo-tendencia') {
      const widget = storeWidgets.find(w => w.id === 'ausentismo-tendencia');
      const chartType = widget?.customConfig?.chartType || 'area';
      const trendData = [
        { hour: '07:00', rate: 2 },
        { hour: '09:00', rate: 7 },
        { hour: '11:00', rate: 14 },
        { hour: '13:00', rate: 8 },
        { hour: '15:00', rate: 11 },
        { hour: '17:00', rate: 5 },
        { hour: '19:00', rate: 9 },
        { hour: '21:00', rate: 3 }
      ];
      return (
        <div className="flex flex-col h-full justify-between gap-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              Tendencia de Ausentismo (Hoy)
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={async () => {
                  const nextType = chartType === 'area' ? 'bar' : 'area';
                  updateWidgetCustomConfig('ausentismo-tendencia', { chartType: nextType });
                  if (currentUser) {
                    setTimeout(() => savePreferences(supabase, currentUser.id), 50);
                  }
                }}
                className="text-[10px] bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-300 font-semibold transition"
              >
                Gráfico: {chartType === 'area' ? 'Área' : 'Barras'}
              </button>
              <span className="text-[10px] font-mono text-rose-600 font-semibold leading-none flex items-center gap-0.5">
                Pico: 14%
              </span>
            </div>
          </div>

          <div className="flex-1 min-h-[160px] py-2 relative">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'area' ? (
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAbsence" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="hour" stroke="#888888" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={9} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px' }}
                    labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                  />
                  <Area type="monotone" dataKey="rate" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorAbsence)" />
                </AreaChart>
              ) : (
                <BarChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="hour" stroke="#888888" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={9} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px' }}
                    labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                  />
                  <Bar dataKey="rate" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="pt-2 border-t border-border/50 text-[10px] text-muted-foreground flex items-center justify-between">
            <span>Mayor congestión de inasistencia observada a las 11:00 AM.</span>
            <span className="font-semibold text-rose-500">Crítico</span>
          </div>
        </div>
      );
    }

    // 4. Estudiante: Asistencia Circular
    if (id === 'asistencia-circular') {
      const target = useUiStore.getState().studentAttendanceTarget ?? 90;
      const circularData = [
        { name: 'Asistido', value: 94.8 },
        { name: 'Faltas', value: 5.2 }
      ];
      
      const isAboveTarget = 94.8 >= target;
      const isAboveInstitutional = 94.8 >= 85;
      
      const primaryColor = isAboveTarget 
        ? '#10b981' 
        : isAboveInstitutional 
        ? '#f59e0b' 
        : '#ef4444';

      const COLORS = [primaryColor, '#e4e4e7'];
      const borderThemeColor = isAboveTarget 
        ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' 
        : isAboveInstitutional 
        ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' 
        : 'border-rose-200 dark:border-rose-900/50 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400';

      const statusLabel = isAboveTarget 
        ? 'Meta Cumplida' 
        : isAboveInstitutional 
        ? 'Bajo tu Meta' 
        : 'Riesgo Crítico';

      return (
        <div className="flex flex-col h-full justify-between gap-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-brand shrink-0" />
              Tasa de Asistencia Global
            </span>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${borderThemeColor}`}>
                {statusLabel}
              </span>
              <button 
                type="button"
                onClick={() => {
                  setIsEditingTarget(!isEditingTarget);
                  setNewTargetVal(target);
                }}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 hover:text-brand transition animate-pulse"
                title="Ajustar Meta Personal"
              >
                <Settings className="w-3 h-3" />
              </button>
            </div>
          </div>

          {isEditingTarget ? (
            <div className="flex-1 flex flex-col justify-center gap-3 py-2 px-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">Meta de Asistencia:</span>
                <span className="font-mono font-bold text-brand">{newTargetVal}%</span>
              </div>
              <input 
                type="range" 
                min="80" 
                max="100" 
                value={newTargetVal} 
                onChange={(e) => setNewTargetVal(parseInt(e.target.value))}
                className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-brand"
              />
              <div className="flex justify-end gap-2 mt-1">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setIsEditingTarget(false)}
                  className="py-1 px-2.5 text-[11px]"
                >
                  Cancelar
                </Button>
                <Button 
                  size="sm" 
                  variant="default" 
                  onClick={async () => {
                    useUiStore.getState().setStudentAttendanceTarget(newTargetVal);
                    setIsEditingTarget(false);
                    if (currentUser) {
                      await savePreferences(supabase, currentUser.id);
                      addToast({
                        title: 'Meta Guardada',
                        message: `Tu meta personal de asistencia se ha establecido en ${newTargetVal}%.`,
                        type: 'success'
                      });
                    }
                  }}
                  className="py-1 px-2.5 text-[11px] bg-brand text-white border-none"
                >
                  Guardar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 flex items-center justify-center py-2 relative min-h-[160px]">
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">94.8%</span>
                  <span className="text-[10px] text-muted-foreground font-semibold">Tasa General</span>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={circularData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      <Cell fill={COLORS[0]} />
                      <Cell fill={COLORS[1]} />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="pt-2 border-t border-border/50 text-[10px] text-muted-foreground text-center flex items-center justify-between">
                <span>Tu meta personal: <span className="font-bold text-brand">{target}%</span></span>
                <span>Mín. requerido: <span className="font-semibold text-zinc-700 dark:text-zinc-300">85%</span></span>
              </div>
            </>
          )}
        </div>
      );
    }

    // 5. Estudiante: Progreso por Asignatura
    if (id === 'progreso-asignaturas') {
      const widget = storeWidgets.find(w => w.id === 'progreso-asignaturas');
      const hidePerfect = widget?.customConfig?.hidePerfect || false;
      const courses = [
        { name: 'Cálculo Multivariable', rate: 95, code: 'MAT-201' },
        { name: 'Estructuras de Datos', rate: 88, code: 'INF-202' },
        { name: 'Arquitectura de Computadoras', rate: 100, code: 'INF-203' }
      ];
      const filteredCourses = courses.filter(c => !hidePerfect || c.rate < 100);
      return (
        <div className="flex flex-col h-full justify-between gap-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-violet-500 shrink-0" />
              Asistencias por Curso
            </span>
            <button 
              onClick={async () => {
                updateWidgetCustomConfig('progreso-asignaturas', { hidePerfect: !hidePerfect });
                if (currentUser) {
                  setTimeout(() => savePreferences(supabase, currentUser.id), 50);
                }
              }}
              className={`text-[10px] px-2 py-0.5 rounded font-semibold transition ${
                hidePerfect 
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50' 
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
            >
              {hidePerfect ? 'Ocultando 100%' : 'Mostrar Todos'}
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-center gap-3.5 py-2">
            {filteredCourses.map((course, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="truncate text-zinc-900 dark:text-zinc-50">{course.name}</span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">{course.rate}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      course.rate >= 90 
                        ? 'bg-emerald-500' 
                        : course.rate >= 80 
                        ? 'bg-amber-500' 
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${course.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-border/50 text-[10px] text-muted-foreground text-center">
            Requisito de asistencia mínima del <span className="font-bold">80% por curso</span>.
          </div>
        </div>
      );
    }

    // 6. Enlaces Rápidos (Quick Links)
    if (id === 'quick-links') {
      const widget = storeWidgets.find(w => w.id === 'quick-links');
      const links = widget?.customConfig?.links || [];
      return (
        <div className="flex flex-col h-full justify-between gap-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5 text-violet-500 shrink-0" />
              Enlaces Rápidos
            </span>
            <button 
              onClick={() => openManageLinks()}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 hover:text-violet-600 transition"
              title="Configurar Enlaces"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 flex flex-col gap-2 py-2 overflow-y-auto max-h-[160px] scrollbar-thin">
            {links.length > 0 ? (
              links.map((link: any, idx: number) => (
                <a
                  key={idx}
                  href={link.url}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-zinc-50/50 dark:bg-zinc-900/30 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-violet-300 dark:hover:border-violet-900/60 transition-all group"
                >
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                    {link.label}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all" />
                </a>
              ))
            ) : (
              <div className="flex-1 flex flex-col justify-center items-center py-4 text-center text-xs text-muted-foreground border border-dashed border-border/80 rounded-xl bg-card/25">
                <p>Sin enlaces guardados</p>
                <button 
                  onClick={() => openManageLinks()}
                  className="mt-1.5 text-xs text-violet-500 font-semibold hover:underline"
                >
                  Agregar enlace
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    // --- FALLBACKS & COMMON SYSTEM WIDGETS ---
    if (id === 'asistencia-diaria') {
      return (
        <div className="flex flex-col h-full justify-between gap-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              Tasa de Asistencia Global
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold leading-none">+1.2%</span>
          </div>
          <div className="flex-1 flex items-center justify-between py-2">
            <div className="space-y-1">
              <h3 className="text-3xl font-bold tracking-tight text-foreground">94.8%</h3>
              <p className="text-xs text-muted-foreground leading-none">Meta: 85.0%</p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-xl border border-emerald-100 dark:border-emerald-900 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
          <div className="pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
            Cálculo general del ciclo académico.
          </div>
        </div>
      );
    }

    if (id === 'tardanzas') {
      return (
        <div className="flex flex-col h-full justify-between gap-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              Tardanzas Totales
            </span>
            <span className="text-[10px] text-amber-600 font-semibold leading-none">8 recurrentes</span>
          </div>
          <div className="flex-1 flex items-center justify-between py-2">
            <div className="space-y-1">
              <h3 className="text-3xl font-bold tracking-tight text-foreground">12</h3>
              <p className="text-xs text-muted-foreground leading-none">Retardo promedio: 8 min</p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-600 rounded-xl border border-amber-100 dark:border-amber-900 shrink-0">
              <Clock className="w-6 h-6" />
            </div>
          </div>
          <div className="pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
            Acumulado total de clases del ciclo.
          </div>
        </div>
      );
    }

    if (id === 'ausentes') {
      return (
        <div className="flex flex-col h-full justify-between gap-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              <FileWarning className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              Ausencias Críticas
            </span>
            <span className="text-[10px] text-rose-600 font-semibold leading-none">-2 hoy</span>
          </div>
          <div className="flex-1 flex items-center justify-between py-2">
            <div className="space-y-1">
              <h3 className="text-3xl font-bold tracking-tight text-foreground">4</h3>
              <p className="text-xs text-muted-foreground leading-none">Estudiantes en riesgo de inasistencia</p>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 rounded-xl border border-rose-100 dark:border-rose-900 shrink-0">
              <FileWarning className="w-6 h-6" />
            </div>
          </div>
          <div className="pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
            Porcentaje de reprobación acumulado &gt; 20%.
          </div>
        </div>
      );
    }

    if (id === 'carreras') {
      return (
        <div className="flex flex-col h-full justify-between gap-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-violet-500 shrink-0" />
              Alumnos Activos
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">Consolidado</span>
          </div>
          <div className="flex-1 flex items-center justify-between py-2">
            <div className="space-y-1">
              <h3 className="text-3xl font-bold tracking-tight text-foreground">248</h3>
              <p className="text-xs text-muted-foreground leading-none">En 3 carreras profesionales</p>
            </div>
            <div className="p-3 bg-violet-50 dark:bg-violet-950/30 text-violet-600 rounded-xl border border-violet-100 dark:border-violet-900 shrink-0">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <div className="pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
            Universidad de Deymos.
          </div>
        </div>
      );
    }

    if (id === 'aulas-ocupadas') {
      return (
        <div className="flex flex-col h-full justify-between gap-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              Ocupación de Aulas
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold leading-none">85% en uso</span>
          </div>
          <div className="flex-1 flex items-center justify-between py-2">
            <div className="space-y-1">
              <h3 className="text-3xl font-bold tracking-tight text-foreground">3 / 4</h3>
              <p className="text-xs text-muted-foreground leading-none">Aulas asignadas hoy</p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-xl border border-emerald-100 dark:border-emerald-900 shrink-0">
              <MapPin className="w-6 h-6" />
            </div>
          </div>
          <div className="pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
            Bloques A e Ingeniería de Sistemas.
          </div>
        </div>
      );
    }

    if (id === 'sticky-notes-todo') {
      const { 
        stickyNotes, 
        todoTasks, 
        addStickyNote, 
        deleteStickyNote, 
        updateStickyNoteText, 
        addTodoTask, 
        toggleTodoTask, 
        deleteTodoTask 
      } = useUiStore();

      return (
        <div className="flex flex-col h-full justify-between gap-4 select-text">
          <div className="flex items-center justify-between border-b border-border/50 pb-2 select-none">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-brand shrink-0" />
              Notas y Pendientes
            </span>
            <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 text-[10px] font-semibold">
              <button 
                type="button"
                onClick={() => setWidgetTab('tasks')}
                className={`px-2.5 py-0.5 rounded-md transition ${widgetTab === 'tasks' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
              >
                Tareas
              </button>
              <button 
                type="button"
                onClick={() => setWidgetTab('notes')}
                className={`px-2.5 py-0.5 rounded-md transition ${widgetTab === 'notes' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
              >
                Notas
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-y-auto max-h-[170px] min-h-[150px] scrollbar-thin py-1">
            {widgetTab === 'tasks' ? (
              <div className="space-y-2.5 text-left flex-1 flex flex-col justify-between">
                <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
                  {todoTasks.length > 0 ? (
                    todoTasks.map(task => (
                      <div key={task.id} className="flex items-center justify-between group p-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 rounded-lg transition-colors">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium select-none text-zinc-800 dark:text-zinc-200 flex-1">
                          <input 
                            type="checkbox" 
                            checked={task.completed} 
                            onChange={async () => {
                              toggleTodoTask(task.id);
                              if (currentUser) await savePreferences(supabase, currentUser.id);
                            }}
                            className="rounded border-zinc-300 dark:border-zinc-700 text-brand focus:ring-brand w-4 h-4 cursor-pointer"
                          />
                          <span className={`transition-all duration-150 ${task.completed ? 'line-through text-zinc-400 dark:text-zinc-600' : ''}`}>
                            {task.text}
                          </span>
                        </label>
                        <button 
                          type="button"
                          onClick={async () => {
                            deleteTodoTask(task.id);
                            if (currentUser) await savePreferences(supabase, currentUser.id);
                          }}
                          className="text-zinc-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/20"
                          title="Eliminar tarea"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="flex-1 flex flex-col justify-center items-center text-center text-xs text-muted-foreground py-6 opacity-75">
                      <CheckCircle2 className="w-6 h-6 text-zinc-300 dark:text-zinc-700 mb-1" />
                      <p className="font-semibold text-zinc-600 dark:text-zinc-400">Sin tareas pendientes</p>
                      <p className="text-[10px] mt-0.5">Agrega una tarea abajo para comenzar.</p>
                    </div>
                  )}
                </div>

                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newTaskText.trim()) return;
                    addTodoTask(newTaskText.trim());
                    setNewTaskText('');
                    if (currentUser) {
                      setTimeout(() => savePreferences(supabase, currentUser.id), 50);
                    }
                  }}
                  className="flex gap-2 pt-2 border-t border-border/40 mt-2 select-none"
                >
                  <input 
                    type="text" 
                    placeholder="Nueva tarea..." 
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-brand focus:border-brand focus:outline-none"
                  />
                  <Button 
                    type="submit" 
                    disabled={!newTaskText.trim()}
                    className="px-2.5 py-1.5 text-xs bg-brand text-white border-none shrink-0 h-auto"
                  >
                    Agregar
                  </Button>
                </form>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between">
                <div className="grid grid-cols-2 gap-2 flex-1 overflow-y-auto pr-1 text-left">
                  {stickyNotes.length > 0 ? (
                    stickyNotes.map(note => {
                      const colors = {
                        yellow: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200',
                        blue: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 text-blue-900 dark:text-blue-200',
                        green: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200',
                        rose: 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-900 dark:text-rose-200',
                      };
                      const selectedColor = (colors as any)[note.color] || colors.yellow;
                      
                      return (
                        <div key={note.id} className={`flex flex-col justify-between p-2 rounded-lg border shadow-sm ${selectedColor} relative group min-h-[75px]`}>
                          <textarea
                            value={note.text}
                            onChange={async (e) => {
                              updateStickyNoteText(note.id, e.target.value);
                              if (currentUser) {
                                setTimeout(() => savePreferences(supabase, currentUser.id), 300);
                              }
                            }}
                            className="bg-transparent border-none text-[11px] font-medium resize-none focus:outline-none w-full h-full leading-tight scrollbar-none"
                            placeholder="Escribe algo..."
                          />
                          <button 
                            type="button"
                            onClick={async () => {
                              deleteStickyNote(note.id);
                              if (currentUser) await savePreferences(supabase, currentUser.id);
                            }}
                            className="absolute top-1 right-1 text-zinc-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                            title="Borrar nota"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-2 flex-1 flex flex-col justify-center items-center text-center text-xs text-muted-foreground py-6 opacity-75">
                      <FileText className="w-6 h-6 text-zinc-300 dark:text-zinc-700 mb-1" />
                      <p className="font-semibold text-zinc-600 dark:text-zinc-400">Sin notas</p>
                      <p className="text-[10px] mt-0.5">Crea una nota adhesiva abajo.</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/40 mt-2 select-none">
                  <div className="flex gap-1.5">
                    {(['yellow', 'blue', 'green', 'rose'] as const).map(c => {
                      const dots = {
                        yellow: 'bg-amber-400 ring-amber-300',
                        blue: 'bg-blue-400 ring-blue-300',
                        green: 'bg-emerald-400 ring-emerald-300',
                        rose: 'bg-rose-400 ring-rose-300'
                      };
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewNoteColor(c)}
                          className={`w-3.5 h-3.5 rounded-full ${dots[c]} transition ${newNoteColor === c ? 'ring-2 ring-offset-1 dark:ring-offset-zinc-950' : 'hover:scale-110'}`}
                        />
                      );
                    })}
                  </div>
                  <Button
                    onClick={async () => {
                      addStickyNote('', newNoteColor);
                      if (currentUser) {
                        setTimeout(() => savePreferences(supabase, currentUser.id), 50);
                      }
                    }}
                    size="sm"
                    className="py-1 px-2.5 text-[10px] bg-brand text-white border-none h-auto"
                    leftIcon={<Plus className="w-3 h-3" />}
                  >
                    Nueva Nota
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Default datatable activity fallback
    if (id === 'actividad-reciente') {
      return (
        <div className="flex flex-col h-full justify-between gap-4 select-none">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-violet-500 shrink-0 animate-pulse" />
              Últimos Registros del Día
            </h2>
            <span className="text-xs text-muted-foreground font-mono">Actualizado en tiempo real</span>
          </div>
          <div className="flex-1 mt-2">
            <DataTable
              columns={columns}
              data={attendanceList}
              emptyTitle="Sin registros de asistencia"
              emptyMessage="No se han registrado firmas en su institución hoy."
            />
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <DashboardLayout>
      {/* Header Sección */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 select-none pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl flex items-center gap-2">
            <Award className="w-8 h-8 text-brand animate-pulse" />
            Panel Operativo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Revisión general, indicadores y administración académica para el rol: <span className="font-semibold text-brand capitalize">{currentUser?.role_id || 'Administrador'}</span>.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(currentUser?.role_id === 'admin' || currentUser?.role_id === 'supervisor') && (
            <Button 
              variant="outline"
              leftIcon={<Megaphone className="w-4 h-4 text-brand" />}
              onClick={() => setIsAnnouncementModalOpen(true)}
              className="border-brand/40 text-brand hover:bg-brand/5 dark:hover:bg-brand/10"
            >
              Publicar Comunicado
            </Button>
          )}
          <Button 
            variant="outline" 
            leftIcon={<Settings className="w-4 h-4" />}
            onClick={() => setIsSettingsOpen(true)}
          >
            Ajustes de Panel
          </Button>
          <Button 
            variant="outline" 
            leftIcon={<ExternalLink className="w-4 h-4" />}
          >
            Exportar
          </Button>
          <Button 
            variant="default" 
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsModalOpen(true)}
            className="bg-brand text-white border-none"
          >
            Registrar Entrada
          </Button>
        </div>
      </div>

      {/* Banner de Comunicados e Inasistencias (Idea D) */}
      {(() => {
        const { announcements, dismissAnnouncement } = useUiStore();
        const visibleAnnouncements = (announcements || []).filter(a => {
          const isTargeted = a.targetRole === 'all' || a.targetRole === currentUser?.role_id;
          const isNotRead = !a.readBy?.includes(currentUser?.id || '');
          return isTargeted && isNotRead;
        });

        if (visibleAnnouncements.length === 0) return null;

        return (
          <div className="space-y-3 mt-4 mb-2 select-text text-left">
            {visibleAnnouncements.map(a => {
              const bgColors = {
                danger: 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200',
                warning: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200',
                info: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50 text-blue-800 dark:text-blue-200'
              };
              const icons = {
                danger: <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />,
                warning: <Clock className="w-5 h-5 text-amber-500 shrink-0" />,
                info: <Megaphone className="w-5 h-5 text-blue-500 shrink-0" />
              };
              
              const colorClass = bgColors[a.type] || bgColors.info;
              const icon = icons[a.type] || icons.info;

              return (
                <div 
                  key={a.id} 
                  className={`relative flex items-start gap-3 p-4 rounded-xl border ${colorClass} shadow-sm animate-slideUp`}
                >
                  {icon}
                  <div className="flex-1 pr-6">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-75">Comunicado Institucional</h4>
                    <h3 className="text-sm font-bold leading-tight">{a.title}</h3>
                    <p className="text-xs mt-1 opacity-90 leading-relaxed whitespace-pre-line">{a.content}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (currentUser) {
                        dismissAnnouncement(a.id, currentUser.id);
                        await savePreferences(supabase, currentUser.id);
                      }
                    }}
                    className="absolute top-3 right-3 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 opacity-60 hover:opacity-100 transition-all animate-pulse"
                    title="Descartar aviso"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Drag & Drop Reorderable Widget Container Grid */}
      <Reorder.Group 
        axis="y" 
        values={storeWidgets} 
        onReorder={handleReorder}
        className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 select-none"
      >
        {storeWidgets
          .filter(w => w.visible)
          .map(widget => (
            <Reorder.Item 
              key={widget.id} 
              value={widget}
              dragListener={true}
              className={`rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between hover:shadow-md cursor-grab active:cursor-grabbing transition-shadow duration-200 ${
                widget.size === 'large' 
                  ? 'md:col-span-2 lg:col-span-3' 
                  : widget.size === 'medium' 
                  ? 'md:col-span-2' 
                  : 'col-span-1'
              }`}
            >
              {renderWidgetContent(widget.id)}
            </Reorder.Item>
          ))
        }
      </Reorder.Group>

      {/* Modal Ajustes de Panel (Show/Hide Widgets) */}
      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Personalizar Dashboard"
        footer={
          <Button variant="default" onClick={() => setIsSettingsOpen(false)}>
            Finalizar Ajustes
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-border rounded-lg text-xs text-muted-foreground flex gap-2">
            <Settings className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">Distribución Dinámica</p>
              <p className="mt-0.5">Active o desactive los módulos del panel principal. La configuración se sincroniza automáticamente por RLS.</p>
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Widgets Disponibles</h4>
            
            {storeWidgets.map(w => (
              <div 
                key={w.id} 
                className="flex flex-col gap-2 p-3.5 rounded-xl border border-border bg-zinc-50/50 dark:bg-zinc-900/30 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-semibold capitalize text-zinc-800 dark:text-zinc-200">
                      {w.id.replace(/-/g, ' ')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleWidgetToggleVisibility(w.id)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      w.visible ? 'bg-violet-600' : 'bg-zinc-200 dark:bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        w.visible ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {w.visible && (
                  <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                    <span className="text-muted-foreground font-medium">Tamaño del Widget:</span>
                    <div className="flex items-center gap-1">
                      {(['small', 'medium', 'large'] as const).map(sz => (
                        <button
                          key={sz}
                          type="button"
                          onClick={async () => {
                            updateWidgetSize(w.id, sz);
                            if (currentUser) {
                              setTimeout(() => savePreferences(supabase, currentUser.id), 50);
                            }
                          }}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold capitalize transition ${
                            w.size === sz
                              ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400 border border-violet-200 dark:border-violet-800'
                              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                          }`}
                        >
                          {sz === 'small' ? 'Celda' : sz === 'medium' ? 'Doble' : 'Completo'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Modal Configuración de Enlaces Rápidos (Quick Links) */}
      <Modal
        isOpen={isQuickLinksOpen}
        onClose={() => setIsQuickLinksOpen(false)}
        title="Personalizar Enlaces Rápidos"
        footer={
          <Button variant="default" onClick={() => setIsQuickLinksOpen(false)}>
            Finalizar Ajustes
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl border border-border bg-zinc-50 dark:bg-zinc-900/50 space-y-3">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Nuevo Enlace</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              <FormInput
                label="Nombre del Enlace"
                placeholder="Ej. Mi Aula Virtual"
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
              />
              <FormInput
                label="URL o Ruta Interna"
                placeholder="Ej. /dashboard/justificaciones"
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
              />
            </div>
            <div className="flex justify-end pt-1">
              <Button 
                onClick={handleAddLink}
                disabled={!newLinkLabel || !newLinkUrl}
              >
                Agregar Enlace
              </Button>
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Enlaces Guardados</h4>
            {(() => {
              const widget = storeWidgets.find(w => w.id === 'quick-links');
              const links = widget?.customConfig?.links || [];
              return links.length > 0 ? (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {links.map((link: any, idx: number) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card shadow-sm"
                    >
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{link.label}</span>
                        <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">{link.url}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteLink(idx)}
                        className="p-1.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition"
                        title="Eliminar enlace"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">No has registrado ningún enlace personalizado todavía.</p>
              );
            })()}
          </div>
        </div>
      </Modal>

      {/* Modal Registro de Entrada Manual */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Registrar Entrada Manual"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="default" onClick={handleSubmit} isLoading={isSubmitting}>
              Guardar Entrada
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput
            label="Nombre Completo del Estudiante"
            placeholder="Ej. Sofía Valenzuela"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            required
          />
          <FormInput
            label="Asignatura o Curso"
            placeholder="Ej. Cálculo Multivariable"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Hora de Entrada"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={status === 'ausente'}
            />
            <div className="flex flex-col space-y-1.5 text-left">
              <label className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400">
                Estado de Asistencia
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              >
                <option value="presente">Presente</option>
                <option value="tarde">Tarde</option>
                <option value="ausente">Ausente</option>
                <option value="justificado">Justificado</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal Crear Comunicado (Admins & Supervisores) */}
      <Modal
        isOpen={isAnnouncementModalOpen}
        onClose={() => setIsAnnouncementModalOpen(false)}
        title="Publicar Comunicado Institucional"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsAnnouncementModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="default" 
              onClick={async () => {
                if (!announcementTitle.trim() || !announcementContent.trim()) return;
                useUiStore.getState().addAnnouncement(
                  announcementTitle.trim(),
                  announcementContent.trim(),
                  announcementType,
                  announcementTarget
                );
                setIsAnnouncementModalOpen(false);
                setAnnouncementTitle('');
                setAnnouncementContent('');
                setAnnouncementType('info');
                setAnnouncementTarget('all');
                
                if (currentUser) {
                  setTimeout(async () => {
                    await savePreferences(supabase, currentUser.id);
                    addToast({
                      title: 'Comunicado Publicado',
                      message: 'El comunicado se ha transmitido de forma instantánea.',
                      type: 'success'
                    });
                  }, 50);
                }
              }}
              disabled={!announcementTitle.trim() || !announcementContent.trim()}
              className="bg-brand text-white border-none"
            >
              Publicar Comunicado
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-left">
          <FormInput
            label="Título del Comunicado"
            placeholder="Ej. Suspensión de Clases por Feriado"
            value={announcementTitle}
            onChange={(e) => setAnnouncementTitle(e.target.value)}
            required
          />
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400">
              Contenido del Mensaje
            </label>
            <textarea
              placeholder="Escribe el mensaje del comunicado aquí..."
              value={announcementContent}
              onChange={(e) => setAnnouncementContent(e.target.value)}
              rows={3}
              className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400">
                Prioridad / Nivel
              </label>
              <select
                value={announcementType}
                onChange={(e) => setAnnouncementType(e.target.value as any)}
                className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              >
                <option value="info">Informativo (Azul)</option>
                <option value="warning">Advertencia (Ámbar)</option>
                <option value="danger">Crítico / Urgente (Rojo)</option>
              </select>
            </div>
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400">
                Dirigido a
              </label>
              <select
                value={announcementTarget}
                onChange={(e) => setAnnouncementTarget(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              >
                <option value="all">Toda la Institución</option>
                <option value="docente">Solo Docentes</option>
                <option value="estudiante">Solo Estudiantes</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
