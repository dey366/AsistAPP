import { create } from 'zustand'

export interface WidgetConfig {
  id: string;
  visible: boolean;
  size: 'small' | 'medium' | 'large';
  order: number;
  customConfig?: any;
}

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  
  // Theme & Style Preferences
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  
  density: 'comfortable' | 'compact';
  setDensity: (density: 'comfortable' | 'compact') => void;
  
  // Dashboard Widget Configurations
  widgets: WidgetConfig[];
  setWidgets: (widgets: WidgetConfig[]) => void;
  toggleWidgetVisibility: (id: string) => void;
  updateWidgetOrder: (id: string, newOrder: number) => void;
  updateWidgetSize: (id: string, size: 'small' | 'medium' | 'large') => void;
  updateWidgetCustomConfig: (id: string, config: any) => void;
  
  // Users Table Customization (Idea A)
  usersTableColumns: string[];
  setUsersTableColumns: (columns: string[]) => void;
  
  // Departments Section Table Customizations (Idea A)
  departmentsTableColumns: string[];
  setDepartmentsTableColumns: (columns: string[]) => void;
  careersTableColumns: string[];
  setCareersTableColumns: (columns: string[]) => void;
  subjectsTableColumns: string[];
  setSubjectsTableColumns: (columns: string[]) => void;
  classroomsTableColumns: string[];
  setClassroomsTableColumns: (columns: string[]) => void;

  
  // Schedules Table Customization (Idea A)
  schedulesStartHour: number;
  schedulesEndHour: number;
  schedulesResolution: number;
  setSchedulesStartHour: (hour: number) => void;
  setSchedulesEndHour: (hour: number) => void;
  setSchedulesResolution: (minutes: number) => void;
  
  // Attendance Table Customization (Idea A)
  defaultAttendanceMethod: 'checklist' | 'pin' | 'qr';
  setDefaultAttendanceMethod: (method: 'checklist' | 'pin' | 'qr') => void;

  // Justifications Customization (Idea B)
  daysLimitToJustify: number;
  autoApprovalEnabled: boolean;
  approvalWorkflow: 'supervisor' | 'docente' | 'cascading';
  setDaysLimitToJustify: (days: number) => void;
  setAutoApprovalEnabled: (enabled: boolean) => void;
  setApprovalWorkflow: (workflow: 'supervisor' | 'docente' | 'cascading') => void;
  
  // Reports Customization (Ideas A and B)
  alertThreshold: number;
  failureThreshold: number;
  selectedPeriod: string;
  setAlertThreshold: (threshold: number) => void;
  setFailureThreshold: (threshold: number) => void;
  setSelectedPeriod: (period: string) => void;
  
  // Accent color (Idea A)
  accentColor: 'violet' | 'emerald' | 'blue' | 'indigo' | 'amber' | 'rose';
  setAccentColor: (color: 'violet' | 'emerald' | 'blue' | 'indigo' | 'amber' | 'rose') => void;

  // Notification Preferences (Idea B)
  emailAlertsEnabled: boolean;
  inAppAlertsEnabled: boolean;
  weeklySummaryEnabled: boolean;
  setEmailAlertsEnabled: (enabled: boolean) => void;
  setInAppAlertsEnabled: (enabled: boolean) => void;
  setWeeklySummaryEnabled: (enabled: boolean) => void;

  // Attendance flow customizations (Idea C)
  customStatuses: Array<{ status: string, label: string, color: string }>;
  setCustomStatuses: (statuses: Array<{ status: string, label: string, color: string }>) => void;
  justificationsRequireEvidence: boolean;
  setJustificationsRequireEvidence: (require: boolean) => void;
  weekStartDay: 'monday' | 'sunday';
  setWeekStartDay: (day: 'monday' | 'sunday') => void;

  // Ideas B, C, D properties
  stickyNotes: Array<{ id: string; text: string; color: string }>;
  todoTasks: Array<{ id: string; text: string; completed: boolean }>;
  studentAttendanceTarget: number;
  announcements: Array<{
    id: string;
    title: string;
    content: string;
    type: 'info' | 'warning' | 'danger';
    targetRole: string;
    created_at: string;
    readBy: string[];
  }>;

  setStickyNotes: (notes: Array<{ id: string; text: string; color: string }>) => void;
  setTodoTasks: (tasks: Array<{ id: string; text: string; completed: boolean }>) => void;
  setStudentAttendanceTarget: (target: number) => void;
  setAnnouncements: (announcements: any[]) => void;
  addStickyNote: (text: string, color: string) => void;
  deleteStickyNote: (id: string) => void;
  updateStickyNoteText: (id: string, text: string) => void;
  addTodoTask: (text: string) => void;
  toggleTodoTask: (id: string) => void;
  deleteTodoTask: (id: string) => void;
  addAnnouncement: (title: string, content: string, type: 'info' | 'warning' | 'danger', targetRole: string) => void;
  dismissAnnouncement: (id: string, userId: string) => void;

  // Sync Preferences to database
  loadPreferences: (profile: any) => void;
  savePreferences: (supabase: any, userId: string) => Promise<void>;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'asistencia-diaria', visible: true, size: 'medium', order: 1 },
  { id: 'tardanzas', visible: true, size: 'small', order: 2 },
  { id: 'carreras', visible: true, size: 'small', order: 3 },
  { id: 'ausentes', visible: true, size: 'medium', order: 4 },
  { id: 'quick-links', visible: true, size: 'small', order: 5, customConfig: { links: [{ label: 'Horarios', url: '/dashboard/horarios' }, { label: 'Justificaciones', url: '/dashboard/justificaciones' }] } },
  { id: 'aulas-ocupadas', visible: true, size: 'medium', order: 6 },
  { id: 'actividad-reciente', visible: true, size: 'large', order: 7 }
];

export const useUiStore = create<UiState>((set, get) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  
  theme: 'light',
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
      localStorage.setItem('asistapp-theme', theme);
    }
    set({ theme });
  },
  toggleTheme: () => set((state) => {
    const nextTheme = state.theme === 'light' ? 'dark' : 'light';
    if (typeof window !== 'undefined') {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(nextTheme);
      localStorage.setItem('asistapp-theme', nextTheme);
    }
    return { theme: nextTheme };
  }),
  
  density: 'comfortable',
  setDensity: (density) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('asistapp-density', density);
    }
    set({ density });
  },
  
  widgets: DEFAULT_WIDGETS,
  setWidgets: (widgets) => set({ widgets: [...widgets].sort((a, b) => a.order - b.order) }),
  
  toggleWidgetVisibility: (id) => set((state) => {
    const updated = state.widgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
    return { widgets: updated };
  }),
  
  updateWidgetOrder: (id, newOrder) => set((state) => {
    const target = state.widgets.find(w => w.id === id);
    if (!target) return {};
    
    const otherWidgets = state.widgets.filter(w => w.id !== id);
    // Shift others
    const reordered = [
      ...otherWidgets.map(w => {
        if (w.order >= newOrder && w.order < target.order) {
          return { ...w, order: w.order + 1 };
        }
        if (w.order <= newOrder && w.order > target.order) {
          return { ...w, order: w.order - 1 };
        }
        return w;
      }),
      { ...target, order: newOrder }
    ].sort((a, b) => a.order - b.order);
    
    return { widgets: reordered };
  }),
  
  updateWidgetSize: (id, size) => set((state) => {
    const updated = state.widgets.map(w => w.id === id ? { ...w, size } : w);
    return { widgets: updated };
  }),
  
  updateWidgetCustomConfig: (id, config) => set((state) => {
    const updated = state.widgets.map(w => w.id === id ? { ...w, customConfig: { ...(w.customConfig || {}), ...config } } : w);
    return { widgets: updated };
  }),
  
  usersTableColumns: ['name', 'email', 'role', 'status', 'actions'],
  setUsersTableColumns: (columns) => set({ usersTableColumns: columns }),
  
  departmentsTableColumns: ['code', 'name', 'coordinator', 'careersCount', 'created_at', 'actions'],
  setDepartmentsTableColumns: (columns) => set({ departmentsTableColumns: columns }),
  careersTableColumns: ['code', 'name', 'coordinator', 'department', 'created_at', 'actions'],
  setCareersTableColumns: (columns) => set({ careersTableColumns: columns }),
  subjectsTableColumns: ['code', 'name', 'career', 'curriculum', 'credits', 'classroom', 'actions'],
  setSubjectsTableColumns: (columns) => set({ subjectsTableColumns: columns }),
  classroomsTableColumns: ['code', 'name', 'building', 'type', 'capacity', 'resources', 'status', 'actions'],
  setClassroomsTableColumns: (columns) => set({ classroomsTableColumns: columns }),

  
  schedulesStartHour: 7,
  schedulesEndHour: 22,
  schedulesResolution: 60,
  setSchedulesStartHour: (hour) => set({ schedulesStartHour: hour }),
  setSchedulesEndHour: (hour) => set({ schedulesEndHour: hour }),
  setSchedulesResolution: (minutes) => set({ schedulesResolution: minutes }),
  
  defaultAttendanceMethod: 'checklist',
  setDefaultAttendanceMethod: (method) => set({ defaultAttendanceMethod: method }),

  daysLimitToJustify: 5,
  autoApprovalEnabled: false,
  approvalWorkflow: 'supervisor',
  setDaysLimitToJustify: (days) => set({ daysLimitToJustify: days }),
  setAutoApprovalEnabled: (enabled) => set({ autoApprovalEnabled: enabled }),
  setApprovalWorkflow: (workflow) => set({ approvalWorkflow: workflow }),
  
  alertThreshold: 85,
  failureThreshold: 75,
  selectedPeriod: 'Ciclo Académico 2026-I',
  setAlertThreshold: (threshold) => set({ alertThreshold: threshold }),
  setFailureThreshold: (threshold) => set({ failureThreshold: threshold }),
  setSelectedPeriod: (period) => set({ selectedPeriod: period }),
  
  accentColor: 'violet',
  setAccentColor: (color) => {
    if (typeof window !== 'undefined') {
      const root = window.document.documentElement;
      root.classList.remove('accent-violet', 'accent-emerald', 'accent-blue', 'accent-indigo', 'accent-amber', 'accent-rose');
      root.classList.add(`accent-${color}`);
      localStorage.setItem('asistapp-accent', color);
    }
    set({ accentColor: color });
  },

  emailAlertsEnabled: true,
  inAppAlertsEnabled: true,
  weeklySummaryEnabled: true,
  setEmailAlertsEnabled: (enabled) => set({ emailAlertsEnabled: enabled }),
  setInAppAlertsEnabled: (enabled) => set({ inAppAlertsEnabled: enabled }),
  setWeeklySummaryEnabled: (enabled) => set({ weeklySummaryEnabled: enabled }),

  customStatuses: [
    { status: 'presente', label: 'Presente', color: 'emerald' },
    { status: 'tarde', label: 'Tarde', color: 'amber' },
    { status: 'ausente', label: 'Ausente', color: 'rose' },
    { status: 'justificado', label: 'Justificado', color: 'blue' }
  ],
  setCustomStatuses: (statuses) => set({ customStatuses: statuses }),
  justificationsRequireEvidence: true,
  setJustificationsRequireEvidence: (require) => set({ justificationsRequireEvidence: require }),
  weekStartDay: 'monday',
  setWeekStartDay: (day) => set({ weekStartDay: day }),

  stickyNotes: [],
  todoTasks: [],
  studentAttendanceTarget: 90,
  announcements: [],

  setStickyNotes: (notes) => set({ stickyNotes: notes }),
  setTodoTasks: (tasks) => set({ todoTasks: tasks }),
  setStudentAttendanceTarget: (target) => set({ studentAttendanceTarget: target }),
  setAnnouncements: (announcements) => set({ announcements }),

  addStickyNote: (text, color) => set((state) => ({
    stickyNotes: [...state.stickyNotes, { id: Math.random().toString(36).substring(2, 9), text, color }]
  })),
  deleteStickyNote: (id) => set((state) => ({
    stickyNotes: state.stickyNotes.filter(n => n.id !== id)
  })),
  updateStickyNoteText: (id, text) => set((state) => ({
    stickyNotes: state.stickyNotes.map(n => n.id === id ? { ...n, text } : n)
  })),

  addTodoTask: (text) => set((state) => ({
    todoTasks: [...state.todoTasks, { id: Math.random().toString(36).substring(2, 9), text, completed: false }]
  })),
  toggleTodoTask: (id) => set((state) => ({
    todoTasks: state.todoTasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
  })),
  deleteTodoTask: (id) => set((state) => ({
    todoTasks: state.todoTasks.filter(t => t.id !== id)
  })),

  addAnnouncement: (title, content, type, targetRole) => set((state) => ({
    announcements: [
      {
        id: Math.random().toString(36).substring(2, 9),
        title,
        content,
        type,
        targetRole,
        created_at: new Date().toISOString(),
        readBy: []
      },
      ...state.announcements
    ]
  })),
  dismissAnnouncement: (id, userId) => set((state) => ({
    announcements: state.announcements.map(a => 
      a.id === id ? { ...a, readBy: [...(a.readBy || []), userId] } : a
    )
  })),
  
  loadPreferences: (profile) => {
    if (!profile) return;
    
    const prefs = profile.ui_preferences || {};
    const localTheme = prefs.theme || (typeof window !== 'undefined' ? localStorage.getItem('asistapp-theme') : null) || 'light';
    const localDensity = prefs.density || (typeof window !== 'undefined' ? localStorage.getItem('asistapp-density') : null) || 'comfortable';
    const localWidgets = prefs.dashboardLayout?.widgets || DEFAULT_WIDGETS;
    const localUsersTableColumns = prefs.usersTableLayout?.visibleColumns || ['name', 'email', 'role', 'status', 'actions'];
    const localDepartmentsTableColumns = prefs.departmentsTableLayout?.visibleColumns || ['code', 'name', 'coordinator', 'careersCount', 'created_at', 'actions'];
    const localCareersTableColumns = prefs.careersTableLayout?.visibleColumns || ['code', 'name', 'coordinator', 'department', 'created_at', 'actions'];
    const localSubjectsTableColumns = prefs.subjectsTableLayout?.visibleColumns || ['code', 'name', 'career', 'curriculum', 'credits', 'classroom', 'actions'];
    const localClassroomsTableColumns = prefs.classroomsTableLayout?.visibleColumns || ['code', 'name', 'building', 'type', 'capacity', 'resources', 'status', 'actions'];

    const localSchedulesStartHour = prefs.schedulesLayout?.time_range?.start_hour ?? 7;
    const localSchedulesEndHour = prefs.schedulesLayout?.time_range?.end_hour ?? 22;
    const localSchedulesResolution = prefs.schedulesLayout?.time_range?.resolution ?? 60;
    const localDefaultAttendanceMethod = prefs.attendanceLayout?.default_method || 'checklist';
    const localDaysLimitToJustify = prefs.justificationsLayout?.days_limit ?? 5;
    const localAutoApprovalEnabled = prefs.justificationsLayout?.auto_approval ?? false;
    const localApprovalWorkflow = prefs.justificationsLayout?.approval_workflow ?? 'supervisor';
    const localAlertThreshold = prefs.reportsLayout?.alert_threshold ?? 85;
    const localFailureThreshold = prefs.reportsLayout?.failure_threshold ?? 75;
    const localSelectedPeriod = prefs.reportsLayout?.selected_period ?? 'Ciclo Académico 2026-I';
    
    const localAccent = prefs.themeLayout?.accent_color || (typeof window !== 'undefined' ? localStorage.getItem('asistapp-accent') : null) || 'violet';
    const localEmailAlerts = prefs.notificationPreferences?.email_alerts ?? true;
    const localInAppAlerts = prefs.notificationPreferences?.in_app_alerts ?? true;
    const localWeeklySummary = prefs.notificationPreferences?.weekly_summary ?? true;
    const localCustomStatuses = prefs.attendanceLayout?.custom_statuses || [
      { status: 'presente', label: 'Presente', color: 'emerald' },
      { status: 'tarde', label: 'Tarde', color: 'amber' },
      { status: 'ausente', label: 'Ausente', color: 'rose' },
      { status: 'justificado', label: 'Justificado', color: 'blue' }
    ];
    const localJustificationsRequireEvidence = prefs.justificationsLayout?.require_evidence ?? true;
    const localWeekStartDay = prefs.schedulesLayout?.week_start_day || 'monday';

    const localStickyNotes = prefs.dashboardLayout?.stickyNotes || [];
    const localTodoTasks = prefs.dashboardLayout?.todoTasks || [];
    const localStudentAttendanceTarget = prefs.dashboardLayout?.studentAttendanceTarget ?? 90;
    const localAnnouncements = prefs.dashboardLayout?.announcements || [];

    if (typeof window !== 'undefined') {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(localTheme);

      root.classList.remove('accent-violet', 'accent-emerald', 'accent-blue', 'accent-indigo', 'accent-amber', 'accent-rose');
      root.classList.add(`accent-${localAccent}`);
    }
    
    set({
      theme: localTheme,
      density: localDensity,
      widgets: [...localWidgets].sort((a, b) => a.order - b.order),
      usersTableColumns: localUsersTableColumns,
      departmentsTableColumns: localDepartmentsTableColumns,
      careersTableColumns: localCareersTableColumns,
      subjectsTableColumns: localSubjectsTableColumns,
      classroomsTableColumns: localClassroomsTableColumns,

      schedulesStartHour: localSchedulesStartHour,
      schedulesEndHour: localSchedulesEndHour,
      schedulesResolution: localSchedulesResolution,
      defaultAttendanceMethod: localDefaultAttendanceMethod,
      daysLimitToJustify: localDaysLimitToJustify,
      autoApprovalEnabled: localAutoApprovalEnabled,
      approvalWorkflow: localApprovalWorkflow,
      alertThreshold: localAlertThreshold,
      failureThreshold: localFailureThreshold,
      selectedPeriod: localSelectedPeriod,

      accentColor: localAccent as any,
      emailAlertsEnabled: localEmailAlerts,
      inAppAlertsEnabled: localInAppAlerts,
      weeklySummaryEnabled: localWeeklySummary,
      customStatuses: localCustomStatuses,
      justificationsRequireEvidence: localJustificationsRequireEvidence,
      weekStartDay: localWeekStartDay as any,
      stickyNotes: localStickyNotes,
      todoTasks: localTodoTasks,
      studentAttendanceTarget: localStudentAttendanceTarget,
      announcements: localAnnouncements
    });
  },
  
  savePreferences: async (supabase, userId) => {
    const { 
      theme, 
      density, 
      widgets, 
      usersTableColumns,
      departmentsTableColumns,
      careersTableColumns,
      subjectsTableColumns,
      classroomsTableColumns,
      schedulesStartHour,
      schedulesEndHour,
      schedulesResolution,
      defaultAttendanceMethod,
      daysLimitToJustify,
      autoApprovalEnabled,
      approvalWorkflow,
      alertThreshold,
      failureThreshold,
      selectedPeriod,

      accentColor,
      emailAlertsEnabled,
      inAppAlertsEnabled,
      weeklySummaryEnabled,
      customStatuses,
      justificationsRequireEvidence,
      weekStartDay,
      stickyNotes,
      todoTasks,
      studentAttendanceTarget,
      announcements
    } = get();
    
    const prefs = {
      theme,
      density,
      dashboardLayout: { 
        widgets,
        stickyNotes,
        todoTasks,
        studentAttendanceTarget,
        announcements
      },
      usersTableLayout: { visibleColumns: usersTableColumns },
      departmentsTableLayout: { visibleColumns: departmentsTableColumns },
      careersTableLayout: { visibleColumns: careersTableColumns },
      subjectsTableLayout: { visibleColumns: subjectsTableColumns },
      classroomsTableLayout: { visibleColumns: classroomsTableColumns },
      themeLayout: {
        accent_color: accentColor
      },
      notificationPreferences: {
        email_alerts: emailAlertsEnabled,
        in_app_alerts: inAppAlertsEnabled,
        weekly_summary: weeklySummaryEnabled
      },
      attendanceLayout: {
        default_method: defaultAttendanceMethod,
        custom_statuses: customStatuses
      },
      schedulesLayout: {
        time_range: {
          start_hour: schedulesStartHour,
          end_hour: schedulesEndHour,
          resolution: schedulesResolution
        },
        week_start_day: weekStartDay
      },
      justificationsLayout: {
        days_limit: daysLimitToJustify,
        auto_approval: autoApprovalEnabled,
        approval_workflow: approvalWorkflow,
        require_evidence: justificationsRequireEvidence
      },
      reportsLayout: {
        alert_threshold: alertThreshold,
        failure_threshold: failureThreshold,
        selected_period: selectedPeriod
      }
    };
    
    try {
      const { error } = await supabase
        .from('users')
        .update({ ui_preferences: prefs })
        .eq('id', userId);
        
      if (error) throw error;
      console.log('UI Preferences successfully persisted to Supabase.');
    } catch (err) {
      console.error('Failed to persist UI preferences:', err);
    }
  }
}));
