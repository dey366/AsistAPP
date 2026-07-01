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
  Calendar as CalendarIcon, 
  Plus, 
  Search,
  Filter,
  BookOpen,
  User,
  MapPin,
  Clock,
  LayoutGrid,
  List,
  AlertCircle,
  FileWarning,
  Copy,
  Trash2,
  Edit,
  Settings
} from 'lucide-react';

interface Schedule {
  id: string;
  day_of_week: number; // 1: Lunes, 7: Domingo
  start_time: string;
  end_time: string;
  tolerance_minutes: number;
  subject_name: string;
  subject_code: string;
  teacher_name: string;
  classroom_name: string;
  building: string;
  career_name?: string;
  subject_id?: string;
  teacher_id?: string;
  classroom_id?: string;
  academic_period_id?: string;
  career_id?: string;
  semester?: number;
  academic_year?: number;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' }
];

const PREMIUM_PALETTES = [
  // Violet / Indigo
  {
    bg: 'bg-violet-50/90 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-900/50',
    border: 'border-violet-200 dark:border-violet-900/50',
    text: 'text-violet-700 dark:text-violet-300',
    accent: 'violet-500',
    hover: 'hover:border-violet-400 dark:hover:border-violet-800'
  },
  // Emerald / Teal
  {
    bg: 'bg-emerald-50/90 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/50',
    border: 'border-emerald-200 dark:border-emerald-900/50',
    text: 'text-emerald-700 dark:text-emerald-300',
    accent: 'emerald-500',
    hover: 'hover:border-emerald-400 dark:hover:border-emerald-800'
  },
  // Rose / Coral
  {
    bg: 'bg-rose-50/90 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/50',
    border: 'border-rose-200 dark:border-rose-900/50',
    text: 'text-rose-700 dark:text-rose-300',
    accent: 'rose-500',
    hover: 'hover:border-rose-400 dark:hover:border-rose-800'
  },
  // Amber / Golden
  {
    bg: 'bg-amber-50/90 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/50',
    border: 'border-amber-200 dark:border-amber-900/50',
    text: 'text-amber-700 dark:text-amber-300',
    accent: 'amber-500',
    hover: 'hover:border-amber-400 dark:hover:border-amber-800'
  },
  // Blue / Sky
  {
    bg: 'bg-blue-50/90 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/50',
    border: 'border-blue-200 dark:border-blue-900/50',
    text: 'text-blue-700 dark:text-blue-300',
    accent: 'blue-500',
    hover: 'hover:border-blue-400 dark:hover:border-blue-800'
  },
  // Cyan / Teal
  {
    bg: 'bg-cyan-50/90 dark:bg-cyan-950/20 border-cyan-200/60 dark:border-cyan-900/50',
    border: 'border-cyan-200 dark:border-cyan-900/50',
    text: 'text-cyan-700 dark:text-cyan-300',
    accent: 'cyan-500',
    hover: 'hover:border-cyan-400 dark:hover:border-cyan-800'
  },
  // Fuchia / Pink
  {
    bg: 'bg-fuchsia-50/90 dark:bg-fuchsia-950/20 border-fuchsia-200/60 dark:border-fuchsia-900/50',
    border: 'border-fuchsia-200 dark:border-fuchsia-900/50',
    text: 'text-fuchsia-700 dark:text-fuchsia-300',
    accent: 'fuchsia-500',
    hover: 'hover:border-fuchsia-400 dark:hover:border-fuchsia-800'
  },
  // Indigo / Purple
  {
    bg: 'bg-indigo-50/90 dark:bg-indigo-950/20 border-indigo-200/60 dark:border-indigo-900/50',
    border: 'border-indigo-200 dark:border-indigo-900/50',
    text: 'text-indigo-700 dark:text-indigo-300',
    accent: 'indigo-500',
    hover: 'hover:border-indigo-400 dark:hover:border-indigo-800'
  }
];

export default function HorariosPage() {
  const { token, user: currentUser } = useAuthStore();
  const { addToast } = useToastStore();
  const { 
    schedulesStartHour, 
    schedulesEndHour, 
    schedulesResolution,
    setSchedulesStartHour,
    setSchedulesEndHour,
    setSchedulesResolution,
    savePreferences 
  } = useUiStore();

  const [schedulesList, setSchedulesList] = useState<Schedule[]>([]);
  const [filteredSchedules, setFilteredSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'calendar' | 'agenda' | 'list'>('calendar');
  const [draggedSchedule, setDraggedSchedule] = useState<Schedule | null>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [hoveredHourSlot, setHoveredHourSlot] = useState<number | null>(null);
  const [colorCoding, setColorCoding] = useState<'career' | 'teacher'>('career');

  // Database dropdowns for creating schedules
  const [subjects, setSubjects] = useState<{ id: string; name: string; code: string }[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [classrooms, setClassrooms] = useState<{ id: string; name: string; building: string }[]>([]);
  const [periods, setPeriods] = useState<{ id: string; name: string }[]>([]);

  // Cascading Filters (Idea C)
  const [careersList, setCareersList] = useState<{ id: string; name: string }[]>([]);
  const [careerFilter, setCareerFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [semesterFilter, setSemesterFilter] = useState('all');

  // Conflict Diagnostics (Idea B)
  const [globalConflicts, setGlobalConflicts] = useState<{ type: 'teacher' | 'classroom'; detail: string; scheduleA: Schedule; scheduleB: Schedule }[]>([]);
  const [isConflictsPanelOpen, setIsConflictsPanelOpen] = useState(false);

  // Simulation Scenarios (Idea D)
  const [scenarios, setScenarios] = useState<{ id: string; name: string; schedules: Schedule[] }[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<string>('production');
  const [isSavingScenarioModalOpen, setIsSavingScenarioModalOpen] = useState(false);
  const [newScenarioName, setNewScenarioName] = useState('');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [dayFilter, setDayFilter] = useState('all');
  const [classroomFilter, setClassroomFilter] = useState('all');

  // View Settings state (Idea A)
  const [isViewSettingsOpen, setIsViewSettingsOpen] = useState(false);

  // Modal creation states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedClassroomId, setSelectedClassroomId] = useState('');
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [selectedDay, setSelectedDay] = useState(1);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [tolerance, setTolerance] = useState(15);

  // Apply suggested slot (Idea D)
  const applySuggestedSlot = async (schedule: Schedule, day: number, start: string, end: string) => {
    if (activeScenarioId !== 'production') {
      const updatedSchedules = schedulesList.map(s => s.id === schedule.id ? {
        ...s,
        day_of_week: day,
        start_time: start,
        end_time: end
      } : s);
      setSchedulesList(updatedSchedules);
      
      const updatedScenarios = scenarios.map(sc => sc.id === activeScenarioId ? {
        ...sc,
        schedules: updatedSchedules
      } : sc);
      saveScenariosToStorage(updatedScenarios);
      
      addToast({
        title: 'Horario Asignado (Simulación)',
        message: `Se aplicó la sugerencia de forma local en el borrador.`,
        type: 'success'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('schedules')
        .update({
          day_of_week: day,
          start_time: start + ':00',
          end_time: end + ':00'
        })
        .eq('id', schedule.id);

      if (error) throw error;
      
      addToast({
        title: 'Horario Asignado',
        message: `Se aplicó la sugerencia: ${DAYS_OF_WEEK.find(d => d.value === day)?.label} de ${start} a ${end}.`,
        type: 'success'
      });
      await loadSchedules();
    } catch (err: any) {
      addToast({ title: 'Error al aplicar', message: err.message, type: 'error' });
    }
  };

  // Helper to persist simulation scenarios (Idea D)
  const saveScenariosToStorage = (updatedScenarios: any[]) => {
    setScenarios(updatedScenarios);
    if (typeof window !== 'undefined') {
      localStorage.setItem('asistapp-horarios-escenarios', JSON.stringify(updatedScenarios));
    }
  };

  // Switch scenario (Idea D)
  const handleSwitchScenario = async (scenarioId: string) => {
    setActiveScenarioId(scenarioId);
    if (scenarioId === 'production') {
      await loadSchedules();
      addToast({
        title: 'Modo Producción',
        message: 'Se cargaron los horarios oficiales de la base de datos.',
        type: 'general'
      });
    } else {
      const scenario = scenarios.find(s => s.id === scenarioId);
      if (scenario) {
        setSchedulesList(scenario.schedules);
        addToast({
          title: 'Escenario de Simulación',
          message: `Cargado escenario: "${scenario.name}". Los cambios aquí son locales y temporales.`,
          type: 'general'
        });
      }
    }
  };

  // Create scenario (Idea D)
  const handleCreateScenario = () => {
    if (!newScenarioName.trim()) {
      addToast({ title: 'Nombre requerido', message: 'Debe ingresar un nombre para el escenario.', type: 'error' });
      return;
    }
    const newScenario = {
      id: 'scen-' + Math.random().toString(36).substring(2, 9),
      name: newScenarioName,
      schedules: [...schedulesList]
    };
    const updated = [...scenarios, newScenario];
    saveScenariosToStorage(updated);
    setActiveScenarioId(newScenario.id);
    setNewScenarioName('');
    setIsSavingScenarioModalOpen(false);
    addToast({
      title: 'Borrador Guardado',
      message: `Se creó el escenario "${newScenario.name}". Ahora estás editando este borrador.`,
      type: 'success'
    });
  };

  // Duplicate scenario (Idea D)
  const handleDuplicateActiveScenario = () => {
    const active = scenarios.find(s => s.id === activeScenarioId);
    const sourceName = active ? active.name : 'Horario Oficial';
    const newScenario = {
      id: 'scen-' + Math.random().toString(36).substring(2, 9),
      name: `${sourceName} (Copia)`,
      schedules: [...schedulesList]
    };
    const updated = [...scenarios, newScenario];
    saveScenariosToStorage(updated);
    setActiveScenarioId(newScenario.id);
    addToast({
      title: 'Escenario Duplicado',
      message: `Se creó una copia bajo el nombre "${newScenario.name}".`,
      type: 'success'
    });
  };

  // Delete scenario (Idea D)
  const handleDeleteScenario = (id: string) => {
    const confirm = window.confirm('¿Está seguro de eliminar este escenario de simulación?');
    if (!confirm) return;
    const updated = scenarios.filter(s => s.id !== id);
    saveScenariosToStorage(updated);
    if (activeScenarioId === id) {
      handleSwitchScenario('production');
    } else {
      addToast({ title: 'Escenario Eliminado', message: 'El borrador fue removido.', type: 'success' });
    }
  };

  // Publish scenario officially to database (Idea D)
  const handlePublishScenario = async () => {
    const active = scenarios.find(s => s.id === activeScenarioId);
    if (!active) return;
    
    const confirm = window.confirm(
      '⚠️ ADVERTENCIA CRÍTICA:\n\n' +
      `¿Está seguro de publicar el escenario "${active.name}" como el horario oficial de producción?\n\n` +
      'Esto reemplazará COMPLETAMENTE toda la planificación horaria oficial del campus con la simulación actual.'
    );
    if (!confirm) return;
    
    setIsSubmitting(true);
    try {
      const tenantId = currentUser?.tenant_id;
      
      // 1. Delete all current schedules from database
      const { error: deleteError } = await supabase
        .from('schedules')
        .delete()
        .eq('tenant_id', tenantId);
        
      if (deleteError) throw deleteError;
      
      // 2. Map and insert all schedules from the scenario
      const payload = active.schedules.map(s => ({
        subject_id: s.subject_id || subjects.find(sub => sub.code === s.subject_code)?.id,
        teacher_id: s.teacher_id || teachers.find(t => t.name === s.teacher_name)?.id,
        classroom_id: s.classroom_id || classrooms.find(c => c.name === s.classroom_name)?.id,
        academic_period_id: s.academic_period_id || selectedPeriodId || periods[0]?.id,
        day_of_week: s.day_of_week,
        start_time: s.start_time.includes(':') && s.start_time.split(':').length === 2 ? s.start_time + ':00' : s.start_time,
        end_time: s.end_time.includes(':') && s.end_time.split(':').length === 2 ? s.end_time + ':00' : s.end_time,
        tolerance_minutes: s.tolerance_minutes,
        tenant_id: tenantId
      })).filter(s => s.subject_id && s.teacher_id && s.classroom_id);
      
      if (payload.length > 0) {
        const { error: insertError } = await supabase
          .from('schedules')
          .insert(payload);
          
        if (insertError) throw insertError;
      }
      
      addToast({
        title: 'Horario Publicado',
        message: `El escenario "${active.name}" es ahora el horario oficial de la institución.`,
        type: 'success'
      });
      
      setActiveScenarioId('production');
      await loadSchedules();
    } catch (err: any) {
      console.error(err);
      addToast({
        title: 'Error de Publicación',
        message: err.message || 'No se pudo publicar el horario.',
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Scan for all global conflicts (Idea B)
  const scanGlobalConflicts = (list: Schedule[]) => {
    const conflicts: any[] = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.day_of_week === b.day_of_week) {
          const overlap = a.start_time < b.end_time && b.start_time < a.end_time;
          if (overlap) {
            if (a.teacher_name === b.teacher_name) {
              conflicts.push({
                type: 'teacher',
                detail: `Docente ${a.teacher_name} asignado en simultáneo a "${a.subject_name}" y "${b.subject_name}" el ${DAYS_OF_WEEK.find(d => d.value === a.day_of_week)?.label} de ${a.start_time} a ${a.end_time}`,
                scheduleA: a,
                scheduleB: b
              });
            }
            if (a.classroom_name === b.classroom_name && a.classroom_name !== 'Aula Virtual') {
              conflicts.push({
                type: 'classroom',
                detail: `Aula "${a.classroom_name}" ocupada en simultáneo por "${a.subject_name}" y "${b.subject_name}" el ${DAYS_OF_WEEK.find(d => d.value === a.day_of_week)?.label} de ${a.start_time} a ${a.end_time}`,
                scheduleA: a,
                scheduleB: b
              });
            }
          }
        }
      }
    }
    setGlobalConflicts(conflicts);
  };


  // Get suggested slots (Idea D)
  const getSuggestedSlots = (schedule: Schedule) => {
    const suggestions: { day: number; start: string; end: string; dayLabel: string }[] = [];
    const days = [1, 2, 3, 4, 5, 6];
    const typicalHours = ['08:00', '10:00', '14:00', '16:00'];
    const duration = getScheduleDuration(schedule);
    
    for (const day of days) {
      for (const start of typicalHours) {
        const [h, m] = start.split(':').map(Number);
        const endMinutes = h * 60 + m + duration;
        const end = formatMinutesToTime(endMinutes);
        
        const conflict = getConflictStatus(schedule, day, start, end);
        if (conflict === 'green') {
          const dayLabel = DAYS_OF_WEEK.find(d => d.value === day)?.label || '';
          suggestions.push({ day, start, end, dayLabel });
          if (suggestions.length >= 3) return suggestions;
        }
      }
    }
    return suggestions;
  };

  // Export to iCal (Idea C)
  const exportToICal = () => {
    try {
      let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//AsistApp//Planificacion Horaria//ES',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH'
      ];
      
      const startDateStr = '20260302';
      const endDateStr = '20260731';
      
      filteredSchedules.forEach(s => {
        const dayCodes = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
        const dayCode = dayCodes[s.day_of_week - 1] || 'MO';
        const [startH, startM] = s.start_time.split(':');
        const [endH, endM] = s.end_time.split(':');
        
        const offsetDays = s.day_of_week - 1;
        const eventStartDay = new Date(2026, 2, 2 + offsetDays);
        
        const pad = (n: number) => n.toString().padStart(2, '0');
        const year = eventStartDay.getFullYear();
        const month = pad(eventStartDay.getMonth() + 1);
        const day = pad(eventStartDay.getDate());
        
        const dtStart = `${year}${month}${day}T${startH}${startM}00`;
        const dtEnd = `${year}${month}${day}T${endH}${endM}00`;
        
        icsContent.push('BEGIN:VEVENT');
        icsContent.push(`UID:schedule-${s.id}@asistapp.com`);
        icsContent.push(`DTSTAMP:${year}${month}${day}T000000Z`);
        icsContent.push(`DTSTART;TZID=America/Bogota:${dtStart}`);
        icsContent.push(`DTEND;TZID=America/Bogota:${dtEnd}`);
        icsContent.push(`SUMMARY:${s.subject_name} (${s.subject_code})`);
        icsContent.push(`DESCRIPTION:Docente: ${s.teacher_name}\\nCarrera: ${s.career_name || 'Común'}`);
        icsContent.push(`LOCATION:${s.classroom_name} - ${s.building}`);
        icsContent.push(`RRULE:FREQ=WEEKLY;BYDAY=${dayCode};UNTIL=${endDateStr}T235959Z`);
        icsContent.push('END:VEVENT');
      });
      
      icsContent.push('END:VCALENDAR');
      
      const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `Horario_Academico_${currentUser?.first_name || 'AsistApp'}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      addToast({
        title: 'Calendario Exportado',
        message: 'Archivo iCal (.ics) descargado con éxito. Puede importarlo en Google Calendar u Outlook.',
        type: 'success'
      });
    } catch (err: any) {
      addToast({ title: 'Error de Exportación', message: err.message, type: 'error' });
    }
  };

  // 1. Fetch dropdown options (only if currentUser role is admin)
  const fetchFormMetadata = async () => {
    if (!currentUser) return;
    try {
      const tenantId = currentUser.tenant_id;

      // Fetch careers (Idea C cascading filter option source)
      const { data: careersData } = await supabase.from('careers').select('id, name');
      setCareersList(careersData || []);

      // Fetch academic periods
      let { data: periodData } = await supabase.from('academic_periods').select('id, name').eq('is_active', true);
      
      if (!periodData || periodData.length === 0) {
        // Auto-seed active academic period if empty
        const defaultPeriods = [
          { name: 'Ciclo Académico 2026-I', is_active: true, tenant_id: tenantId, start_date: '2026-03-01', end_date: '2026-07-31' },
          { name: 'Ciclo Académico 2026-II', is_active: false, tenant_id: tenantId, start_date: '2026-08-01', end_date: '2026-12-31' }
        ];
        const { data: insertedPeriods } = await supabase.from('academic_periods').insert(defaultPeriods).select('id, name, is_active');
        periodData = (insertedPeriods || []).filter(p => p.is_active === true || p.name === 'Ciclo Académico 2026-I');
      }
      setPeriods(periodData || []);
      if (periodData && periodData.length > 0) setSelectedPeriodId(periodData[0].id);

      // Fetch classrooms
      let { data: classroomData } = await supabase.from('classrooms').select('id, name, building');
      
      if (!classroomData || classroomData.length === 0) {
        // Auto-seed default classrooms if empty
        const defaultClassrooms = [
          { name: 'Aula 101', building: 'Pabellón A', tenant_id: tenantId, capacity: 40 },
          { name: 'Aula 102', building: 'Pabellón A', tenant_id: tenantId, capacity: 40 },
          { name: 'Laboratorio de Software 302', building: 'Pabellón B', tenant_id: tenantId, capacity: 30 },
          { name: 'Aula de Conferencias 101', building: 'Pabellón A', tenant_id: tenantId, capacity: 100 }
        ];
        const { data: insertedClassrooms } = await supabase.from('classrooms').insert(defaultClassrooms).select('id, name, building');
        classroomData = insertedClassrooms;
      }
      setClassrooms(classroomData || []);
      if (classroomData && classroomData.length > 0) setSelectedClassroomId(classroomData[0].id);

      // Fetch teachers (users with role 'docente')
      const { data: teacherData } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .eq('role_id', 'docente');
      
      const formattedTeachers = (teacherData || []).map(t => ({
        id: t.id,
        name: `${t.first_name || ''} ${t.last_name || ''}`.trim() || 'Docente'
      }));
      setTeachers(formattedTeachers);
      if (formattedTeachers.length > 0) setSelectedTeacherId(formattedTeachers[0].id);

      // Fetch subjects (or seed dummy if empty)
      let { data: subjectData } = await supabase.from('subjects').select('id, name, code');
      
      if (!subjectData || subjectData.length === 0) {
        // Auto-seed typical subjects if empty to allow testing
        let { data: defaultCareers } = await supabase.from('careers').select('id').limit(1);
        
        if (!defaultCareers || defaultCareers.length === 0) {
          // Create default department and career first if none exist
          const { data: newDept } = await supabase.from('departments').insert({
            name: 'Facultad de Ingeniería',
            code: 'FI',
            tenant_id: tenantId
          }).select('id').single();
          
          if (newDept) {
            const { data: newCareer } = await supabase.from('careers').insert({
              department_id: newDept.id,
              name: 'Ingeniería de Sistemas',
              code: 'IS',
              tenant_id: tenantId
            }).select('id').single();
            if (newCareer) {
              defaultCareers = [newCareer];
            }
          }
        }

        const defaultSubjects = [
          { name: 'Cálculo Multivariable', code: 'MAT-201', credits: 4, career_id: defaultCareers?.[0]?.id, tenant_id: tenantId },
          { name: 'Estructuras de Datos', code: 'INF-202', credits: 4, career_id: defaultCareers?.[0]?.id, tenant_id: tenantId },
          { name: 'Arquitectura de Computadoras', code: 'INF-203', credits: 3, career_id: defaultCareers?.[0]?.id, tenant_id: tenantId }
        ];
        const { data: insertedSubjects } = await supabase.from('subjects').insert(defaultSubjects).select('id, name, code');
        subjectData = insertedSubjects;
      }
      setSubjects(subjectData || []);
      if (subjectData && subjectData.length > 0) setSelectedSubjectId(subjectData[0].id);
    } catch (err) {
      console.error('Error fetching metadata:', err);
    }
  };

  // Helper to resolve deterministic dynamic color palettes
  const getStringColorPalette = (str: string) => {
    if (!str) return PREMIUM_PALETTES[0];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % PREMIUM_PALETTES.length;
    return PREMIUM_PALETTES[index];
  };

  // Convert time HH:MM to minutes since schedulesStartHour:00 AM
  const getMinutesFromStart = (timeStr: string) => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const startMinutes = schedulesStartHour * 60;
    return Math.max(0, totalMinutes - startMinutes);
  };

  // Convert minutes back to HH:MM format
  const formatMinutesToTime = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  // Get duration of a schedule in minutes
  const getScheduleDuration = (schedule: Schedule) => {
    return getMinutesFromStart(schedule.end_time) - getMinutesFromStart(schedule.start_time);
  };

  // Drag & Drop weekly visual schedule conflict resolver
  const getConflictStatus = (schedule: Schedule, targetDay: number, targetStartTime?: string, targetEndTime?: string) => {
    const start = targetStartTime || schedule.start_time;
    const end = targetEndTime || schedule.end_time;

    // Filter schedules on target day (excluding the dragged one itself)
    const daySchedules = schedulesList.filter(s => s.day_of_week === targetDay && s.id !== schedule.id);

    let hasRedConflict = false;
    let hasOrangeConflict = false;

    for (const s of daySchedules) {
      // Overlap: s.start_time < end AND start < s.end_time
      const overlap = s.start_time < end && start < s.end_time;
      if (overlap) {
        // Red if same teacher or same classroom
        if (s.teacher_name === schedule.teacher_name || s.classroom_name === schedule.classroom_name) {
          hasRedConflict = true;
        } else {
          hasOrangeConflict = true;
        }
      }
    }

    if (hasRedConflict) return 'red';
    if (hasOrangeConflict) return 'orange';
    return 'green';
  };

  // Drag & Drop weekly visual schedule
  const handleDragStart = (e: React.DragEvent, schedule: Schedule) => {
    e.dataTransfer.setData('text/plain', schedule.id);
    setDraggedSchedule(schedule);
  };

  const handleDragEnd = () => {
    setDraggedSchedule(null);
    setHoveredDay(null);
    setHoveredHourSlot(null);
  };

  const handleDrop = async (e: React.DragEvent, dayOfWeek: number, newStartTime?: string, newEndTime?: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;

    if (activeScenarioId !== 'production') {
      const updatedSchedules = schedulesList.map(s => {
        if (s.id === id) {
          const updated = { ...s, day_of_week: dayOfWeek };
          if (newStartTime && newEndTime) {
            updated.start_time = newStartTime;
            updated.end_time = newEndTime;
          }
          return updated;
        }
        return s;
      });
      setSchedulesList(updatedSchedules);
      
      const updatedScenarios = scenarios.map(sc => sc.id === activeScenarioId ? {
        ...sc,
        schedules: updatedSchedules
      } : sc);
      saveScenariosToStorage(updatedScenarios);
      
      addToast({
        title: 'Horario Actualizado (Simulación)',
        message: 'Clase movida localmente en el borrador.',
        type: 'success'
      });
      setDraggedSchedule(null);
      setHoveredDay(null);
      setHoveredHourSlot(null);
      return;
    }

    const updates: any = { day_of_week: dayOfWeek };
    if (newStartTime && newEndTime) {
      updates.start_time = newStartTime + ':00';
      updates.end_time = newEndTime + ':00';
    }

    try {
      const { error } = await supabase
        .from('schedules')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      addToast({
        title: 'Horario Actualizado',
        message: newStartTime 
          ? `Clase movida a las ${newStartTime} - ${newEndTime} con éxito.`
          : 'Clase movida de día correctamente de forma visual.',
        type: 'success'
      });
      await loadSchedules();
    } catch (err: any) {
      console.error(err);
      addToast({
        title: 'Conflicto Horario',
        message: err.message || 'No se pudo mover el horario.',
        type: 'error'
      });
    } finally {
      setDraggedSchedule(null);
      setHoveredDay(null);
      setHoveredHourSlot(null);
    }
  };

  // Open modal in edit mode
  const handleOpenEdit = (schedule: Schedule) => {
    const raw = schedulesList.find(s => s.id === schedule.id);
    // Find matching dropdown IDs
    const matchedSubject = subjects.find(s => s.name === schedule.subject_name)?.id || '';
    const matchedTeacher = teachers.find(t => t.name === schedule.teacher_name)?.id || '';
    const matchedClassroom = classrooms.find(c => c.name === schedule.classroom_name)?.id || '';
    
    setEditingScheduleId(schedule.id);
    setIsEditing(true);
    setSelectedSubjectId(matchedSubject);
    setSelectedTeacherId(matchedTeacher);
    setSelectedClassroomId(matchedClassroom);
    setSelectedDay(schedule.day_of_week);
    setStartTime(schedule.start_time.substring(0, 5));
    setEndTime(schedule.end_time.substring(0, 5));
    setTolerance(schedule.tolerance_minutes);
    setIsModalOpen(true);
  };

  // Duplicate a block
  const handleDuplicate = (schedule: Schedule) => {
    const matchedSubject = subjects.find(s => s.name === schedule.subject_name)?.id || '';
    const matchedTeacher = teachers.find(t => t.name === schedule.teacher_name)?.id || '';
    const matchedClassroom = classrooms.find(c => c.name === schedule.classroom_name)?.id || '';
    
    setIsEditing(false);
    setEditingScheduleId(null);
    setSelectedSubjectId(matchedSubject);
    setSelectedTeacherId(matchedTeacher);
    setSelectedClassroomId(matchedClassroom);
    setSelectedDay(schedule.day_of_week);
    setStartTime(schedule.start_time.substring(0, 5));
    setEndTime(schedule.end_time.substring(0, 5));
    setTolerance(schedule.tolerance_minutes);
    setIsModalOpen(true);
    
    addToast({
      title: 'Modo Duplicación',
      message: 'Revise y guarde el bloque duplicado.',
      type: 'success'
    });
  };

  // Deletion with warning
  const handleDelete = async (id: string) => {
    const confirm = window.confirm(
      activeScenarioId === 'production' 
        ? '⚠️ ADVERTENCIA DE IMPACTO DE DATOS:\n\n' +
          'Eliminar este horario borrará de forma permanente todas las planillas de asistencia y justificaciones vinculadas de los estudiantes inscritos en este bloque.\n\n' +
          '¿Desea proceder con la eliminación?'
        : '¿Está seguro de eliminar este bloque del escenario de simulación actual?'
    );
    if (!confirm) return;

    if (activeScenarioId !== 'production') {
      const updatedSchedules = schedulesList.filter(s => s.id !== id);
      setSchedulesList(updatedSchedules);
      const updatedScenarios = scenarios.map(sc => sc.id === activeScenarioId ? {
        ...sc,
        schedules: updatedSchedules
      } : sc);
      saveScenariosToStorage(updatedScenarios);
      addToast({
        title: 'Horario Eliminado (Simulación)',
        message: 'El bloque ha sido removido del borrador.',
        type: 'success'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', id);

      if (error) throw error;

      addToast({
        title: 'Horario Eliminado',
        message: 'El bloque académico ha sido removido del sistema.',
        type: 'success'
      });
      await loadSchedules();
    } catch (err: any) {
      const message = err?.message || err?.details || JSON.stringify(err) || 'No se pudo eliminar el bloque académico.';
      console.error('handleDelete schedules error:', message);

      const isForeignKeyViolation = err?.code === '23503' || message.includes('foreign key') || message.includes('violates');

      addToast({
        title: isForeignKeyViolation ? 'Restricción de Integridad' : 'Error de Eliminación',
        message: isForeignKeyViolation
          ? 'No se puede eliminar el horario porque existen planillas de asistencia o justificaciones asociadas a este bloque. Considere suspender el horario en su lugar.'
          : message,
        type: 'error'
      });
    }
  };

  // Handle schedule creation or update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSubjectId || !selectedTeacherId || !selectedClassroomId || !selectedPeriodId) {
      addToast({
        title: 'Formulario Incompleto',
        message: 'Por favor cree asignaturas, docentes o aulas primero para poder calendarizar.',
        type: 'error'
      });
      return;
    }

    if (activeScenarioId !== 'production') {
      const matchedSubject = subjects.find(s => s.id === selectedSubjectId);
      const matchedTeacher = teachers.find(t => t.id === selectedTeacherId);
      const matchedClassroom = classrooms.find(c => c.id === selectedClassroomId);

      const newOrUpdatedSchedule: Schedule = {
        id: isEditing && editingScheduleId ? editingScheduleId : 'sim-' + Math.random().toString(36).substring(2, 9),
        day_of_week: selectedDay,
        start_time: startTime,
        end_time: endTime,
        tolerance_minutes: tolerance,
        subject_id: selectedSubjectId,
        teacher_id: selectedTeacherId,
        classroom_id: selectedClassroomId,
        academic_period_id: selectedPeriodId,
        subject_name: matchedSubject?.name || 'Asignatura Libre',
        subject_code: matchedSubject?.code || '---',
        teacher_name: matchedTeacher?.name || 'Docente No Asignado',
        classroom_name: matchedClassroom?.name || 'Aula Virtual',
        building: matchedClassroom?.building || 'Campus',
        career_name: 'Carrera Común',
        semester: matchedSubject ? (matchedSubject as any).semester : 1,
        academic_year: matchedSubject ? (matchedSubject as any).academic_year : 1
      };

      let updatedSchedules: Schedule[];
      if (isEditing && editingScheduleId) {
        updatedSchedules = schedulesList.map(s => s.id === editingScheduleId ? newOrUpdatedSchedule : s);
      } else {
        updatedSchedules = [...schedulesList, newOrUpdatedSchedule];
      }

      setSchedulesList(updatedSchedules);
      const updatedScenarios = scenarios.map(sc => sc.id === activeScenarioId ? {
        ...sc,
        schedules: updatedSchedules
      } : sc);
      saveScenariosToStorage(updatedScenarios);

      addToast({
        title: isEditing ? 'Horario Modificado (Simulación)' : 'Horario Programado (Simulación)',
        message: 'Cambios guardados en el borrador.',
        type: 'success'
      });

      setIsModalOpen(false);
      setIsEditing(false);
      setEditingScheduleId(null);
      return;
    }

    setIsSubmitting(true);
    try {
      const tenantId = currentUser?.tenant_id;

      if (isEditing && editingScheduleId) {
        const { error } = await supabase
          .from('schedules')
          .update({
            subject_id: selectedSubjectId,
            teacher_id: selectedTeacherId,
            classroom_id: selectedClassroomId,
            academic_period_id: selectedPeriodId,
            day_of_week: selectedDay,
            start_time: startTime + ':00',
            end_time: endTime + ':00',
            tolerance_minutes: tolerance
          })
          .eq('id', editingScheduleId);

        if (error) throw error;
        
        addToast({
          title: 'Horario Modificado',
          message: 'Los cambios al bloque académico han sido persistidos.',
          type: 'success'
        });
      } else {
        const { error } = await supabase
          .from('schedules')
          .insert({
            subject_id: selectedSubjectId,
            teacher_id: selectedTeacherId,
            classroom_id: selectedClassroomId,
            academic_period_id: selectedPeriodId,
            day_of_week: selectedDay,
            start_time: startTime + ':00',
            end_time: endTime + ':00',
            tolerance_minutes: tolerance,
            tenant_id: tenantId
          });

        if (error) throw error;

        addToast({
          title: 'Horario Programado',
          message: 'El nuevo bloque horario ha sido ingresado en la base de datos.',
          type: 'success'
        });
      }

      setIsModalOpen(false);
      setIsEditing(false);
      setEditingScheduleId(null);
      await loadSchedules();
    } catch (err: any) {
      console.error('Submit Error details:', {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        error: err
      });

      let errorMsg = 'No se pudo guardar el horario académico.';
      if (err?.message) {
        errorMsg = err.message;
        if (err?.details) {
          errorMsg += ` - Detalle: ${err.details}`;
        }
      } else if (typeof err === 'string') {
        errorMsg = err;
      }

      addToast({
        title: 'Error de Transacción',
        message: errorMsg,
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Load schedules and populate
  const loadSchedules = async () => {
    setIsLoading(true);
    try {
      // Fetch with PostgREST joins including nested career
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          id,
          day_of_week,
          start_time,
          end_time,
          tolerance_minutes,
          subject_id,
          teacher_id,
          classroom_id,
          academic_period_id,
          subjects:subject_id(name, code, semester, academic_year, careers:career_id(id, name)),
          users:teacher_id(first_name, last_name),
          classrooms:classroom_id(name, building)
        `);

      if (error) throw error;

      let formatted: Schedule[] = (data || []).map((s: any) => {
        // Safe check for nested careers (handles singular object and array cases)
        const careersData = s.subjects?.careers;
        const careerName = Array.isArray(careersData) 
          ? careersData[0]?.name 
          : careersData?.name;
        const careerId = Array.isArray(careersData)
          ? careersData[0]?.id
          : careersData?.id;

        return {
          id: s.id,
          day_of_week: s.day_of_week,
          start_time: s.start_time.substring(0, 5),
          end_time: s.end_time.substring(0, 5),
          tolerance_minutes: s.tolerance_minutes,
          subject_id: s.subject_id,
          teacher_id: s.teacher_id,
          classroom_id: s.classroom_id,
          academic_period_id: s.academic_period_id,
          subject_name: s.subjects?.name || 'Asignatura Libre',
          subject_code: s.subjects?.code || '---',
          teacher_name: `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.trim() || 'Docente No Asignado',
          classroom_name: s.classrooms?.name || 'Aula Virtual',
          building: s.classrooms?.building || 'Campus',
          career_name: careerName || 'Carrera Común',
          career_id: careerId,
          semester: s.subjects?.semester,
          academic_year: s.subjects?.academic_year
        };
      });

      // If empty, supply gorgeous premium mock schedule cards to wow the user initially
      if (formatted.length === 0) {
        formatted = [
          {
            id: 'mock-1',
            day_of_week: 1, // Lunes
            start_time: '08:00',
            end_time: '10:00',
            tolerance_minutes: 15,
            subject_name: 'Cálculo Multivariable',
            subject_code: 'MAT-301',
            teacher_name: 'Dr. Alejandro Silva',
            classroom_name: 'Laboratorio de Software 302',
            building: 'Pabellón B',
            career_name: 'Ingeniería de Sistemas'
          },
          {
            id: 'mock-2',
            day_of_week: 2, // Martes
            start_time: '10:00',
            end_time: '12:00',
            tolerance_minutes: 15,
            subject_name: 'Estructuras de Datos',
            subject_code: 'INF-202',
            teacher_name: 'Dra. María Mendoza',
            classroom_name: 'Aula de Conferencias 101',
            building: 'Pabellón A',
            career_name: 'Ingeniería de Sistemas'
          },
          {
            id: 'mock-3',
            day_of_week: 3, // Miércoles
            start_time: '08:00',
            end_time: '10:00',
            tolerance_minutes: 15,
            subject_name: 'Arquitectura de Software',
            subject_code: 'INF-404',
            teacher_name: 'Ing. Alejandro Silva',
            classroom_name: 'Laboratorio de Software 302',
            building: 'Pabellón B',
            career_name: 'Ingeniería de Sistemas'
          },
          {
            id: 'mock-4',
            day_of_week: 4, // Jueves
            start_time: '10:00',
            end_time: '12:00',
            tolerance_minutes: 15,
            subject_name: 'Física Universitaria II',
            subject_code: 'FIS-102',
            teacher_name: 'Dr. Roberto Cruz',
            classroom_name: 'Aula de Conferencias 101',
            building: 'Pabellón A',
            career_name: 'Ciencias Básicas'
          },
          {
            id: 'mock-5',
            day_of_week: 5, // Viernes
            start_time: '14:00',
            end_time: '16:00',
            tolerance_minutes: 15,
            subject_name: 'Inteligencia Artificial',
            subject_code: 'INF-501',
            teacher_name: 'Dr. Alejandro Silva',
            classroom_name: 'Laboratorio de Software 302',
            building: 'Pabellón B',
            career_name: 'Ingeniería de Sistemas'
          }
        ];
      }

      setSchedulesList(formatted);
      setFilteredSchedules(formatted);
    } catch (err: any) {
      console.error('Error loading schedules:', err);
      addToast({
        title: 'Error de Lectura',
        message: err.message || 'No se pudieron cargar los horarios del servidor.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load scenarios from localStorage on mount (Idea D)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedScenarios = localStorage.getItem('asistapp-horarios-escenarios');
      if (storedScenarios) {
        try {
          setScenarios(JSON.parse(storedScenarios));
        } catch (e) {
          console.error('Error loading scenarios:', e);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadSchedules();
      fetchFormMetadata();
    }
  }, [currentUser]);

  // Scan global conflicts when schedulesList changes (Idea B)
  useEffect(() => {
    scanGlobalConflicts(schedulesList);
  }, [schedulesList]);

  // Filter effect (Idea C - Cascading filters)
  useEffect(() => {
    let result = schedulesList;

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter(s => 
        s.subject_name.toLowerCase().includes(term) || 
        s.subject_code.toLowerCase().includes(term) ||
        s.teacher_name.toLowerCase().includes(term)
      );
    }

    if (dayFilter !== 'all') {
      result = result.filter(s => s.day_of_week === parseInt(dayFilter));
    }

    if (classroomFilter !== 'all') {
      result = result.filter(s => s.classroom_name === classroomFilter);
    }

    if (careerFilter !== 'all') {
      result = result.filter(s => s.career_id === careerFilter || s.career_name === careerFilter);
    }

    if (yearFilter !== 'all') {
      result = result.filter(s => s.academic_year === parseInt(yearFilter));
    }

    if (semesterFilter !== 'all') {
      result = result.filter(s => s.semester === parseInt(semesterFilter));
    }

    setFilteredSchedules(result);
  }, [searchTerm, dayFilter, classroomFilter, careerFilter, yearFilter, semesterFilter, schedulesList]);


  const columns = [
    {
      header: 'Asignatura',
      accessor: (item: Schedule) => (
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-50">{item.subject_name}</div>
          <div className="font-mono text-xs text-muted-foreground">{item.subject_code}</div>
        </div>
      )
    },
    {
      header: 'Docente Coordinador',
      accessor: (item: Schedule) => (
        <span className="text-zinc-700 dark:text-zinc-300 font-medium flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 opacity-60 text-violet-500" />
          {item.teacher_name}
        </span>
      )
    },
    {
      header: 'Día de Clase',
      accessor: (item: Schedule) => {
        const dayLabel = DAYS_OF_WEEK.find(d => d.value === item.day_of_week)?.label || 'Desconocido';
        const colorMap = [
          'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400 border border-violet-200/50 dark:border-violet-900/50',
          'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/50',
          'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/50',
          'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50',
          'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/50',
          'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400 border border-sky-200/50 dark:border-sky-900/50',
          'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 border border-purple-200/50 dark:border-purple-900/50'
        ];
        
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorMap[(item.day_of_week - 1) % 7]}`}>
            {dayLabel}
          </span>
        );
      }
    },
    {
      header: 'Bloque Horario',
      accessor: (item: Schedule) => (
        <span className="font-mono text-xs text-muted-foreground flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 opacity-60 text-zinc-400" />
          {item.start_time} - {item.end_time}
        </span>
      )
    },
    {
      header: 'Aula / Campus',
      accessor: (item: Schedule) => (
        <div className="flex flex-col">
          <span className="font-medium text-xs text-zinc-900 dark:text-zinc-50 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
            {item.classroom_name}
          </span>
          <span className="text-[10px] text-muted-foreground pl-4">{item.building}</span>
        </div>
      )
    },
    {
      header: 'Tolerancia',
      accessor: (item: Schedule) => (
        <span className="text-xs bg-zinc-50 dark:bg-zinc-900 px-2 py-0.5 border border-border rounded font-semibold text-zinc-600 dark:text-zinc-400">
          {item.tolerance_minutes} min
        </span>
      )
    }
  ];

  // Distinct classroom names for filter dropdown
  const uniqueClassrooms = Array.from(new Set(schedulesList.map(s => s.classroom_name)));

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 select-none pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl flex items-center gap-2">
            <CalendarIcon className="w-8 h-8 text-violet-500 flex-shrink-0 animate-pulse" />
            Planificación Horaria
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión y estructuración horaria de asignaturas, distribución de docentes y control de aulas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="inline-flex rounded-lg border border-border bg-card p-1 shadow-sm shrink-0">
            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'calendar'
                  ? 'bg-secondary text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Vista Columnas (Grid)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              onClick={() => setActiveTab('agenda')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'agenda'
                  ? 'bg-secondary text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Vista Agenda Semanal (Premium)"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Agenda</span>
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'list'
                  ? 'bg-secondary text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Vista Lista"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lista</span>
            </button>
          </div>

          {/* View settings and exports (Idea A & C) */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              leftIcon={<Settings className="w-4 h-4" />}
              onClick={() => setIsViewSettingsOpen(true)}
              className="text-zinc-700 border-border bg-card dark:text-zinc-300 h-9"
            >
              Ajustes de Vista
            </Button>
            
            <Button
              variant="outline"
              leftIcon={<Copy className="w-4 h-4" />}
              onClick={exportToICal}
              className="text-zinc-700 border-border bg-card dark:text-zinc-300 h-9"
              title="Exportar archivo iCal (.ics) para Google Calendar u Outlook"
            >
              Exportar iCal
            </Button>
            
            <Button
              variant="outline"
              leftIcon={<LayoutGrid className="w-4 h-4" />}
              onClick={() => window.print()}
              className="text-zinc-700 border-border bg-card dark:text-zinc-300 h-9"
              title="Imprimir o guardar como PDF"
            >
              Imprimir / PDF
            </Button>
          </div>

          {currentUser?.role_id === 'admin' && (
            <Button 
              variant="default" 
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsModalOpen(true)}
            >
              Asignar Horario
            </Button>
          )}
        </div>
      </div>

      {/* Simulation Scenario Toolbar (Idea D) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-900/30 rounded-xl border border-border/80 p-3 select-none">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 shrink-0">
            <Settings className="w-4 h-4 text-violet-500" />
            <span>Escenario Activo:</span>
          </div>
          <select
            value={activeScenarioId}
            onChange={(e) => handleSwitchScenario(e.target.value)}
            className="flex h-9 rounded-lg border border-border bg-background px-3 py-1 text-xs text-foreground font-semibold transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-56"
          >
            <option value="production">📅 Horario Oficial (Producción)</option>
            {scenarios.map(sc => (
              <option key={sc.id} value={sc.id}>📝 {sc.name}</option>
            ))}
          </select>
          
          {activeScenarioId !== 'production' && (
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
              Simulación Activa (Borrador)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {activeScenarioId === 'production' ? (
            currentUser?.role_id === 'admin' && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setIsSavingScenarioModalOpen(true)}
                className="text-zinc-700 dark:text-zinc-300 bg-background border-border text-xs h-9"
              >
                Crear Borrador Simulación
              </Button>
            )
          ) : (
            currentUser?.role_id === 'admin' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Copy className="w-3.5 h-3.5" />}
                  onClick={handleDuplicateActiveScenario}
                  className="text-zinc-700 dark:text-zinc-300 bg-background border-border text-xs h-9"
                >
                  Duplicar Borrador
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                  onClick={() => handleDeleteScenario(activeScenarioId)}
                  className="text-rose-600 dark:text-rose-400 bg-background border-rose-200/50 dark:border-rose-900/40 text-xs h-9"
                >
                  Eliminar Borrador
                </Button>

                <Button
                  variant="default"
                  size="sm"
                  leftIcon={<CalendarIcon className="w-3.5 h-3.5" />}
                  onClick={handlePublishScenario}
                  isLoading={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 border-none shadow-sm"
                >
                  Publicar Oficialmente
                </Button>
              </>
            )
          )}
        </div>
      </div>

      {/* Filters Area */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between select-none">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar asignatura o docente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Day Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5" />
            <span>Día de Clase:</span>
            <select
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
              className="flex h-9 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Cualquier Día</option>
              {DAYS_OF_WEEK.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          {/* Classroom Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-full sm:w-auto">
            <MapPin className="w-3.5 h-3.5" />
            <span>Aula:</span>
            <select
              value={classroomFilter}
              onChange={(e) => setClassroomFilter(e.target.value)}
              className="flex h-9 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Todas las Aulas</option>
              {uniqueClassrooms.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Color Coding Selector */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-violet-500" />
            <span>Colores por:</span>
            <select
              value={colorCoding}
              onChange={(e) => setColorCoding(e.target.value as 'career' | 'teacher')}
              className="flex h-9 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="career">Carrera Profesional</option>
              <option value="teacher">Docente Coordinador</option>
            </select>
          </div>

          {/* Carrera Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-violet-500" />
            <span>Carrera:</span>
            <select
              value={careerFilter}
              onChange={(e) => setCareerFilter(e.target.value)}
              className="flex h-9 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-36"
            >
              <option value="all">Todas</option>
              {careersList.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Año Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5" />
            <span>Año:</span>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="flex h-9 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Todos</option>
              <option value="1">1er Año</option>
              <option value="2">2do Año</option>
              <option value="3">3er Año</option>
              <option value="4">4to Año</option>
              <option value="5">5to Año</option>
            </select>
          </div>

          {/* Semestre Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5" />
            <span>Semestre:</span>
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="flex h-9 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Todos</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(sem => (
                <option key={sem} value={sem}>Semestre {sem}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Color Legends (Idea A - Simplification) */}
      {(() => {
        const colorLegends = Array.from(
          new Set(filteredSchedules.map(s => colorCoding === 'career' ? (s.career_name || 'Carrera Común') : s.teacher_name))
        );
        if (colorLegends.length === 0) return null;
        return (
          <div className="rounded-xl border border-border/60 bg-zinc-50/50 dark:bg-zinc-950/20 px-4 py-3 mt-4 select-none flex flex-wrap items-center gap-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mr-1">Leyenda:</span>
            {colorLegends.map((name) => {
              const palette = getStringColorPalette(name);
              return (
                <div key={name} className="flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-lg border border-border bg-card">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: `var(--${palette.accent})` }} />
                  <span className="text-zinc-700 dark:text-zinc-300">{name}</span>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Bitácora de Conflictos Académicos (Idea B) */}
      {globalConflicts.length > 0 && (
        <div className="rounded-xl border border-rose-100 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/10 p-4 mt-6 select-none">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400 rounded-lg shrink-0">
                <FileWarning className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-rose-800 dark:text-rose-400 flex items-center gap-2">
                  Bitácora de Conflictos Académicos
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400">
                    {globalConflicts.length} {globalConflicts.length === 1 ? 'Conflicto' : 'Conflictos'}
                  </span>
                </h4>
                <p className="text-xs text-rose-700/80 dark:text-rose-400/80 mt-0.5">
                  Se detectaron cruces de horarios en la planificación del ciclo. Haga clic en Detalles para revisar.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConflictsPanelOpen(!isConflictsPanelOpen)}
              className="text-rose-700 border-rose-200/50 hover:bg-rose-100/50 dark:text-rose-400 dark:border-rose-900/40 dark:hover:bg-rose-950/20 bg-background text-xs font-bold"
            >
              {isConflictsPanelOpen ? 'Ocultar Detalles' : 'Ver Detalles'}
            </Button>
          </div>

          {isConflictsPanelOpen && (
            <div className="mt-4 border-t border-rose-200/40 dark:border-rose-900/30 pt-3 space-y-2 max-h-[200px] overflow-y-auto pr-2">
              {globalConflicts.map((conf, idx) => (
                <div key={idx} className="flex items-start justify-between gap-3 text-xs p-2.5 rounded-lg bg-background border border-rose-100 dark:border-rose-900/40 hover:shadow-sm transition-all duration-150">
                  <div className="flex gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      conf.type === 'teacher' 
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400' 
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-400'
                    }`}>
                      {conf.type === 'teacher' ? 'DOCENTE' : 'AULA'}
                    </span>
                    <p className="text-zinc-700 dark:text-zinc-300 font-medium">{conf.detail}</p>
                  </div>
                  {activeScenarioId === 'production' && currentUser?.role_id === 'admin' && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEdit(conf.scheduleA)}
                        className="px-2 py-1 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 rounded border border-border text-[10px] font-bold text-zinc-600 dark:text-zinc-400"
                      >
                        Editar A
                      </button>
                      <button
                        onClick={() => handleOpenEdit(conf.scheduleB)}
                        className="px-2 py-1 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 rounded border border-border text-[10px] font-bold text-zinc-600 dark:text-zinc-400"
                      >
                        Editar B
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mb-6" />

      {/* Intelligent Conflict & Recommendations Panel (Idea D) */}
      {draggedSchedule && (
        <div className="rounded-xl border border-violet-100 dark:border-violet-900 bg-violet-50/50 dark:bg-violet-950/10 p-4 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fadeIn select-none">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-400 rounded-lg shrink-0">
              <AlertCircle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                Asistente de Horarios Inteligente
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-400">
                  Arrastrando: {draggedSchedule.subject_name}
                </span>
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Arrastre la tarjeta sobre un casillero verde (Disponible) para programar. Evite rojo (Conflicto de Aula/Docente) y naranja (Solapamiento temporal).
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              Alternativas recomendadas (100% libres):
            </span>
            <div className="flex gap-2">
              {getSuggestedSlots(draggedSchedule).map((slot, idx) => (
                <button
                  key={idx}
                  onClick={() => applySuggestedSlot(draggedSchedule, slot.day, slot.start, slot.end)}
                  className="px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all duration-150 active:scale-95"
                >
                  {slot.dayLabel} {slot.start} - {slot.end}
                </button>
              ))}
              {getSuggestedSlots(draggedSchedule).length === 0 && (
                <span className="text-xs text-muted-foreground italic">No hay sugerencias disponibles</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === 'calendar' ? (
        /* Visual Calendar grid */
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 select-none">
          {DAYS_OF_WEEK.slice(0, 6).map(day => {
            const daySchedules = filteredSchedules.filter(s => s.day_of_week === day.value);
            
            // Dynamic conflict color class calculation for grid columns
            let columnClass = "flex flex-col gap-3 h-full min-h-[450px] rounded-xl p-2.5 border transition-all duration-200 ";
            if (draggedSchedule) {
              const conflict = getConflictStatus(draggedSchedule, day.value);
              if (conflict === 'red') {
                columnClass += "bg-rose-50/30 dark:bg-rose-950/10 border-rose-300 dark:border-rose-900/40 ring-2 ring-rose-300 dark:ring-rose-900/30";
              } else if (conflict === 'orange') {
                columnClass += "bg-amber-50/30 dark:bg-amber-950/10 border-amber-300 dark:border-amber-900/40 ring-2 ring-amber-300 dark:ring-amber-900/30";
              } else {
                columnClass += "bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-300 dark:border-emerald-900/40 ring-2 ring-emerald-300 dark:ring-emerald-900/30";
              }
            } else {
              columnClass += "bg-zinc-50/50 dark:bg-zinc-900/30 border-border/50";
            }

            return (
              <div 
                key={day.value} 
                className={columnClass}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, day.value)}
              >
                <div className="p-2 border-b border-border/60 rounded-t-lg text-center font-bold text-xs tracking-wider uppercase text-zinc-600 dark:text-zinc-400">
                  {day.label}
                </div>
                <div className="flex-1 flex flex-col gap-3 overflow-y-auto min-h-[300px]">
                  {daySchedules.length === 0 ? (
                    <div className="border border-dashed border-border/80 rounded-xl p-6 text-center text-xs text-muted-foreground flex flex-col items-center justify-center min-h-[120px] bg-card/20">
                      <AlertCircle className="w-4 h-4 opacity-40 mb-1" />
                      <span>Sin clases</span>
                    </div>
                  ) : (
                    daySchedules
                      .sort((a, b) => a.start_time.localeCompare(b.start_time))
                      .map(s => {
                        const palette = getStringColorPalette(colorCoding === 'career' ? (s.career_name || 'Carrera Común') : s.teacher_name);
                        return (
                          <div 
                            key={s.id} 
                            draggable
                            onDragStart={(e) => handleDragStart(e, s)}
                            onDragEnd={handleDragEnd}
                            className={`rounded-xl border-l-4 border-t border-r border-b ${palette.border} ${palette.bg} p-4 shadow-sm relative group hover:shadow-md cursor-grab active:cursor-grabbing transition-all duration-200 ${palette.hover}`}
                            style={{ borderLeftColor: `var(--${palette.accent})` }}
                          >
                            {/* Hover Action Menu */}
                            {currentUser?.role_id === 'admin' && (
                              <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-background/90 backdrop-blur-sm p-1 rounded-md border border-border shadow-sm z-10">
                                <button 
                                  onClick={() => handleOpenEdit(s)} 
                                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-100" 
                                  title="Editar Horario"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button 
                                  onClick={() => handleDuplicate(s)} 
                                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-100" 
                                  title="Duplicar Horario"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                                <button 
                                  onClick={() => handleDelete(s.id)} 
                                  className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400" 
                                  title="Eliminar Horario"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}

                            <div className={`text-[10px] uppercase font-bold tracking-wider ${palette.text} mb-1`}>
                              {s.subject_code}
                            </div>
                            <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-50 leading-tight mb-2 pr-6">
                              {s.subject_name}
                            </h4>
                            
                            <div className="space-y-1.5 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 shrink-0 opacity-60 text-zinc-400" />
                                <span className="font-mono">{s.start_time.substring(0, 5)} - {s.end_time.substring(0, 5)}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 shrink-0 opacity-60 text-zinc-400" />
                                <span className="truncate">{s.teacher_name}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 shrink-0 opacity-60 text-zinc-400" />
                                <span className="truncate">{s.classroom_name}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : activeTab === 'agenda' ? (
        (() => {
          const totalHours = schedulesEndHour - schedulesStartHour;
          const pixelsPerHour = 60;
          const totalHeight = totalHours * pixelsPerHour;
          const stepsPerHour = 60 / schedulesResolution;
          const totalSteps = totalHours * stepsPerHour;
          const heightPerStep = 60 / stepsPerHour;

          return (
            /* Premium Chronological Weekly Agenda View */
            <div id="print-schedule-area" className="rounded-xl border border-border bg-card p-4 overflow-x-auto shadow-sm select-none">
              <div className="min-w-[900px] flex flex-col">
                
                {/* Header: Weekdays */}
                <div className="flex border-b border-border pb-3 mb-2 font-bold text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <div className="w-20 shrink-0 text-center font-mono">Hora</div>
                  {DAYS_OF_WEEK.slice(0, 6).map(day => (
                    <div key={day.value} className="flex-1 text-center font-semibold border-l border-border/50">
                      {day.label}
                    </div>
                  ))}
                </div>

                {/* Grid Container */}
                <div className="flex relative">
                  
                  {/* Left Column: Hours */}
                  <div className="w-20 shrink-0 flex flex-col font-mono text-[10px] text-muted-foreground select-none relative pt-1" style={{ height: `${totalHeight}px` }}>
                    {Array.from({ length: totalHours + 1 }, (_, i) => i + schedulesStartHour).map(hour => (
                      <div key={hour} style={{ height: '60px' }} className="flex items-start justify-center pr-2 border-b border-dashed border-transparent">
                        {hour.toString().padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>

                  {/* Day Columns */}
                  {DAYS_OF_WEEK.slice(0, 6).map(day => {
                    const daySchedules = filteredSchedules.filter(s => s.day_of_week === day.value);
                    const isHoveredDay = hoveredDay === day.value;

                    return (
                      <div 
                        key={day.value}
                        className={`flex-1 relative border-l border-border/50 border-r border-transparent last:border-r-0 transition-colors duration-200 ${
                          isHoveredDay && draggedSchedule ? 'bg-zinc-50/20 dark:bg-zinc-900/10' : ''
                        }`}
                        style={{ height: `${totalHeight}px` }}
                      >
                        
                        {/* Horizontal hour stripes */}
                        {Array.from({ length: totalSteps }, (_, i) => i).map(stepIdx => {
                          const hourOffset = Math.floor(stepIdx / stepsPerHour);
                          const hour = schedulesStartHour + hourOffset;
                          const isHoveredSlot = isHoveredDay && hoveredHourSlot === stepIdx;
                          
                          let slotColorClass = "border-b border-dashed border-border/20 relative transition-colors duration-150 ";
                          if (isHoveredSlot && draggedSchedule) {
                            const absoluteMinutes = (schedulesStartHour * 60) + (stepIdx * schedulesResolution);
                            const startStr = formatMinutesToTime(absoluteMinutes);
                            const duration = draggedSchedule ? getScheduleDuration(draggedSchedule) : 120;
                            const endStr = formatMinutesToTime(absoluteMinutes + duration);
                            const conflict = getConflictStatus(draggedSchedule, day.value, startStr, endStr);
                            
                            if (conflict === 'red') {
                              slotColorClass += "bg-rose-500/20 dark:bg-rose-950/20 border-rose-400 ring-1 ring-rose-500/30";
                            } else if (conflict === 'orange') {
                              slotColorClass += "bg-amber-500/20 dark:bg-amber-950/20 border-amber-400 ring-1 ring-amber-500/30";
                            } else {
                              slotColorClass += "bg-emerald-500/20 dark:bg-emerald-950/20 border-emerald-400 ring-1 ring-emerald-500/30";
                            }
                          }

                          return (
                            <div
                              key={stepIdx}
                              className={slotColorClass}
                              style={{ height: `${heightPerStep}px` }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                setHoveredDay(day.value);
                                setHoveredHourSlot(stepIdx);
                              }}
                              onDragLeave={() => {
                                setHoveredDay(null);
                                setHoveredHourSlot(null);
                              }}
                              onDrop={(e) => {
                                const absoluteMinutes = (schedulesStartHour * 60) + (stepIdx * schedulesResolution);
                                const startStr = formatMinutesToTime(absoluteMinutes);
                                const duration = draggedSchedule ? getScheduleDuration(draggedSchedule) : 120;
                                const endStr = formatMinutesToTime(absoluteMinutes + duration);
                                handleDrop(e, day.value, startStr, endStr);
                              }}
                            />
                          );
                        })}

                        {/* Translucent conflict placeholder card when dragging over a specific hour */}
                        {isHoveredDay && hoveredHourSlot !== null && draggedSchedule && (
                          (() => {
                            const top = hoveredHourSlot * heightPerStep;
                            const duration = getScheduleDuration(draggedSchedule);
                            const absoluteMinutes = (schedulesStartHour * 60) + (hoveredHourSlot * schedulesResolution);
                            const startStr = formatMinutesToTime(absoluteMinutes);
                            const endStr = formatMinutesToTime(absoluteMinutes + duration);
                            const conflict = getConflictStatus(draggedSchedule, day.value, startStr, endStr);
                            
                            let placeholderStyle = "absolute left-1.5 right-1.5 rounded-xl border border-dashed flex flex-col justify-center items-center font-bold text-xs p-2 pointer-events-none select-none z-10 backdrop-blur-[1px] animate-pulse ";
                            if (conflict === 'red') {
                              placeholderStyle += "bg-rose-500/30 border-rose-500 text-rose-800 dark:text-rose-300";
                            } else if (conflict === 'orange') {
                              placeholderStyle += "bg-amber-500/30 border-amber-500 text-amber-800 dark:text-amber-300";
                            } else {
                              placeholderStyle += "bg-emerald-500/30 border-emerald-500 text-emerald-800 dark:text-emerald-300";
                            }

                            return (
                              <div
                                className={placeholderStyle}
                                style={{
                                  top: `${top}px`,
                                  height: `${duration}px`,
                                }}
                              >
                                <span>Soltar Aquí</span>
                                <span className="text-[10px] opacity-80 mt-0.5">
                                  {conflict === 'red' ? '⚠️ Conflicto' : conflict === 'orange' ? '⚠️ Solapamiento' : '✅ Disponible'}
                                </span>
                              </div>
                            );
                          })()
                        )}

                        {/* Absolute Scheduled Cards */}
                        {daySchedules.map(s => {
                          const top = getMinutesFromStart(s.start_time);
                          const height = getScheduleDuration(s);
                          const palette = getStringColorPalette(colorCoding === 'career' ? (s.career_name || 'Carrera Común') : s.teacher_name);

                          return (
                            <div
                              key={s.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, s)}
                              onDragEnd={handleDragEnd}
                              className={`absolute left-1.5 right-1.5 rounded-xl border-l-4 border-t border-r border-b ${palette.border} ${palette.bg} p-2 shadow-sm flex flex-col justify-between group hover:shadow-md cursor-grab active:cursor-grabbing transition-all duration-200 ${palette.hover} z-2`}
                              style={{
                                top: `${top}px`,
                                height: `${height}px`,
                              }}
                            >
                              {/* Action Menu overlay */}
                              {currentUser?.role_id === 'admin' && (
                                <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-background/90 backdrop-blur-sm p-1 rounded-md border border-border shadow-sm z-10">
                                  <button 
                                    onClick={() => handleOpenEdit(s)} 
                                    className="p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-100" 
                                    title="Editar Horario"
                                  >
                                    <Edit className="w-2.5 h-2.5" />
                                  </button>
                                  <button 
                                    onClick={() => handleDuplicate(s)} 
                                    className="p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-100" 
                                    title="Duplicar Horario"
                                  >
                                    <Copy className="w-2.5 h-2.5" />
                                  </button>
                                  <button 
                                    onClick={() => handleDelete(s.id)} 
                                    className="p-0.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400" 
                                    title="Eliminar Horario"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              )}

                              <div className="flex-1 flex flex-col justify-start">
                                <span className={`text-[9px] uppercase font-bold tracking-wider ${palette.text}`}>
                                  {s.subject_code}
                                </span>
                                <h5 className="font-bold text-[11px] text-zinc-900 dark:text-zinc-50 leading-tight mt-0.5 truncate pr-5">
                                  {s.subject_name}
                                </h5>
                              </div>

                              <div className="mt-1 flex flex-col gap-0.5 text-[10px] text-muted-foreground border-t border-border/30 pt-1 shrink-0">
                                <span className="flex items-center gap-1 font-mono">
                                  <Clock className="w-3 h-3 text-zinc-400 shrink-0" />
                                  {s.start_time.substring(0, 5)} - {s.end_time.substring(0, 5)}
                                </span>
                                <span className="flex items-center gap-1 truncate">
                                  <User className="w-3 h-3 text-zinc-400 shrink-0" />
                                  {s.teacher_name}
                                </span>
                                <span className="flex items-center gap-1 truncate">
                                  <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                                  {s.classroom_name}
                                </span>
                              </div>
                            </div>
                          );
                        })}

                      </div>
                    );
                  })}

                </div>
              </div>
            </div>
          );
        })()
      ) : (
        /* Tabular directory view */
        <div className="space-y-4">
          <DataTable
            columns={columns}
            data={filteredSchedules}
            isLoading={isLoading}
            emptyTitle="Sin Programaciones"
            emptyMessage="No se han cargado bloques de horarios válidos con los filtros seleccionados."
          />
        </div>
      )}

      {/* Modal Agregar Horario */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Crear Asignación Horaria"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="default" onClick={handleSubmit} isLoading={isSubmitting}>
              Guardar Bloque
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {subjects.length === 0 ? (
            <div className="p-4 rounded-lg bg-rose-50 text-rose-800 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-200 text-xs flex gap-2">
              <FileWarning className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-bold">Error de Datos</p>
                <p className="mt-0.5">Debe registrar asignaturas o perfiles de docentes en el sistema antes de poder asignar horarios.</p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-border rounded-lg text-xs text-muted-foreground flex gap-2">
              <Clock className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Distribución Multi-tenant</p>
                <p className="mt-0.5">El bloque horario se registrará bajo su Tenant institucional y se aislará por RLS.</p>
              </div>
            </div>
          )}

          {/* Subject Selector */}
          <div className="flex flex-col space-y-1.5 text-left">
            <label className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-violet-500" />
              Asignatura
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            >
              {subjects.map(s => (
                <option key={s.id} value={s.id}>[{s.code}] {s.name}</option>
              ))}
            </select>
          </div>

          {/* Teacher Selector */}
          <div className="flex flex-col space-y-1.5 text-left">
            <label className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-violet-500" />
              Docente Coordinador
            </label>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            >
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
              {teachers.length === 0 && (
                <option value="">No hay docentes con rol 'docente' registrados</option>
              )}
            </select>
          </div>

          {/* Classroom & Period selector */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1.5 text-left">
              <label className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-violet-500" />
                Aula Física
              </label>
              <select
                value={selectedClassroomId}
                onChange={(e) => setSelectedClassroomId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              >
                {classrooms.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.building})</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col space-y-1.5 text-left">
              <label className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                <CalendarIcon className="w-3.5 h-3.5 text-violet-500" />
                Ciclo Académico
              </label>
              <select
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              >
                {periods.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Day of Week & Tolerance */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1.5 text-left">
              <label className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400">
                Día de la semana
              </label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(parseInt(e.target.value))}
                className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              >
                {DAYS_OF_WEEK.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            <FormInput
              label="Tolerancia de Retardo (minutos)"
              type="number"
              value={tolerance.toString()}
              onChange={(e) => setTolerance(parseInt(e.target.value) || 15)}
              required
            />
          </div>

          {/* Hours block */}
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Hora de Inicio"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
            <FormInput
              label="Hora de Salida"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>
        </form>
      </Modal>

      {/* Modal Ajustes de Vista (Idea A) */}
      <Modal
        isOpen={isViewSettingsOpen}
        onClose={() => setIsViewSettingsOpen(false)}
        title="Personalización del Horario"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsViewSettingsOpen(false)}>
              Cerrar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Configure el rango de visualización horaria operativo y la resolución de la agenda. Estos cambios se guardarán en sus preferencias.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1.5 text-left">
              <label className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400">
                Hora de Inicio
              </label>
              <select
                value={schedulesStartHour}
                onChange={async (e) => {
                  const val = parseInt(e.target.value);
                  if (val >= schedulesEndHour) {
                    addToast({ title: 'Error de rango', message: 'La hora de inicio debe ser menor que la de fin.', type: 'error' });
                    return;
                  }
                  setSchedulesStartHour(val);
                  if (currentUser) {
                    setTimeout(() => savePreferences(supabase, currentUser.id), 50);
                  }
                }}
                className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              >
                {Array.from({ length: 12 }, (_, i) => i + 5).map(h => (
                  <option key={h} value={h}>{h.toString().padStart(2, '0')}:00 AM</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col space-y-1.5 text-left">
              <label className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400">
                Hora de Fin
              </label>
              <select
                value={schedulesEndHour}
                onChange={async (e) => {
                  const val = parseInt(e.target.value);
                  if (val <= schedulesStartHour) {
                    addToast({ title: 'Error de rango', message: 'La hora de fin debe ser mayor que la de inicio.', type: 'error' });
                    return;
                  }
                  setSchedulesEndHour(val);
                  if (currentUser) {
                    setTimeout(() => savePreferences(supabase, currentUser.id), 50);
                  }
                }}
                className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              >
                {Array.from({ length: 12 }, (_, i) => i + 13).map(h => (
                  <option key={h} value={h}>{(h - 12).toString().padStart(2, '0')}:00 PM</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex flex-col space-y-1.5 text-left">
            <label className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400">
              Resolución de Cuadrícula (minutos)
            </label>
            <select
              value={schedulesResolution}
              onChange={async (e) => {
                const val = parseInt(e.target.value);
                setSchedulesResolution(val);
                if (currentUser) {
                  setTimeout(() => savePreferences(supabase, currentUser.id), 50);
                }
              }}
              className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value={30}>30 minutos</option>
              <option value={60}>60 minutos (1 hora)</option>
              <option value={120}>120 minutos (2 horas)</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Modal Guardar Escenario (Borrador) */}
      <Modal
        isOpen={isSavingScenarioModalOpen}
        onClose={() => setIsSavingScenarioModalOpen(false)}
        title="Guardar Escenario de Simulación"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsSavingScenarioModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="default" onClick={handleCreateScenario}>
              Guardar Borrador
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-left">
          <p className="text-xs text-muted-foreground">
            Ingrese un nombre descriptivo para identificar este borrador de horarios. Se guardará una copia exacta de la cuadrícula actual.
          </p>
          <FormInput
            label="Nombre del Escenario / Borrador"
            type="text"
            placeholder="Ej: Planificación de Emergencia 2026-I"
            value={newScenarioName}
            onChange={(e) => setNewScenarioName(e.target.value)}
            required
          />
        </div>
      </Modal>
    </DashboardLayout>
  );
}
