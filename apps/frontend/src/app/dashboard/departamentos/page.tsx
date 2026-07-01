'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';
import { useUiStore } from '@/store/useUiStore';
import { supabase } from '@/lib/supabase';
import { 
  Building, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  GraduationCap, 
  Bookmark, 
  Briefcase, 
  Activity, 
  Calendar,
  X,
  CheckCircle2,
  Monitor,
  Mic,
  BookOpen,
  Wrench,
  Video,
  Wind,
  Filter,
  Mail,
  Settings,
  ChevronDown,
  AlertTriangle,
  Info
} from 'lucide-react';


interface Department {
  id: string;
  name: string;
  code: string;
  created_at: string;
  careersCount?: number;
  coordinator_id?: string;
  coordinator_name?: string;
  coordinator_email?: string;
}

interface Career {
  id: string;
  department_id: string;
  name: string;
  code: string;
  created_at: string;
  department_name?: string;
  coordinator_id?: string;
  coordinator_name?: string;
  coordinator_email?: string;
  max_credits?: number;
  required_classroom_type?: string;
  required_resources?: string[];
}

interface Classroom {
  id: string;
  name: string;
  building: string;
  capacity: number;
  type: string;
  status: string;
  resources: string[];
}

// Deserialization helper to load classroom properties from building text (Idea B)
const deserializeClassroom = (c: any): Classroom => {
  const defaultRes: Classroom = {
    id: c.id,
    name: c.name,
    capacity: c.capacity || 30,
    building: c.building || 'Pabellón A',
    type: 'Teoría',
    status: 'activo',
    resources: []
  };

  if (c.building && c.building.includes('|')) {
    const parts = c.building.split('|');
    defaultRes.building = parts[0] || 'Pabellón A';
    defaultRes.type = parts[1] || 'Teoría';
    defaultRes.status = parts[2] || 'activo';
    if (parts[3]) {
      defaultRes.resources = parts[3].split(',').filter(Boolean);
    }
  } else {
    // Inferred defaults based on name for legacy database items
    if (c.name?.toLowerCase().includes('laboratorio') || c.name?.toLowerCase().includes('cómputo')) {
      defaultRes.type = 'Laboratorio';
      defaultRes.resources = ['Estaciones de Cómputo', 'Proyector HD'];
    } else if (c.name?.toLowerCase().includes('auditorio')) {
      defaultRes.type = 'Auditorio';
      defaultRes.resources = ['Sistema de Audio', 'Proyector HD'];
    }
  }
  return defaultRes;
};

// Serialization helper to pack classroom properties inside Supabase building column (Idea B)
const serializeClassroom = (roomForm: { name: string; building: string; capacity: number; type: string; status: string; resources: string[] }) => {
  const serializedBuilding = `${roomForm.building}|${roomForm.type}|${roomForm.status}|${roomForm.resources.join(',')}`;
  return {
    name: roomForm.name,
    capacity: roomForm.capacity,
    building: serializedBuilding
  };
};

const deserializeDepartment = (d: any, coordinatorsList: any[]): Department => {
  const parts = (d.code || '').split('|');
  const code = parts[0] || '';
  const coordinator_id = parts[1] || '';
  const coordinator = coordinatorsList.find(c => c.id === coordinator_id);
  return {
    id: d.id,
    name: d.name,
    code: code,
    created_at: d.created_at,
    coordinator_id,
    coordinator_name: coordinator?.name || 'Sin Asignar',
    coordinator_email: coordinator?.email || ''
  };
};

const deserializeCareer = (c: any, coordinatorsList: any[]): Career => {
  const parts = (c.code || '').split('|');
  const code = parts[0] || '';
  const coordinator_id = parts[1] || '';
  const max_credits = Number(parts[2] || '6');
  const required_classroom_type = parts[3] || 'Teoría';
  const required_resources = parts[4] ? parts[4].split(',').filter(Boolean) : [];
  const coordinator = coordinatorsList.find(co => co.id === coordinator_id);
  return {
    id: c.id,
    department_id: c.department_id,
    name: c.name,
    code: code,
    created_at: c.created_at,
    department_name: c.departments?.name || 'Desconocido',
    coordinator_id,
    coordinator_name: coordinator?.name || 'Sin Asignar',
    coordinator_email: coordinator?.email || '',
    max_credits,
    required_classroom_type,
    required_resources
  };
};

const deserializeSubject = (s: any): any => {
  const parts = (s.code || '').split('|');
  const code = parts[0] || '';
  const classroom_id = parts[1] || '';
  const estimated_capacity = Number(parts[2] || '30');
  return {
    id: s.id,
    career_id: s.career_id,
    name: s.name,
    code: code,
    classroom_id,
    estimated_capacity,
    credits: s.credits || 4,
    semester: s.semester || '1',
    academic_year: s.academic_year || '1er Año',
    created_at: s.created_at
  };
};

const serializeDepartment = (form: { name: string; code: string; coordinator_id: string }) => {
  return {
    name: form.name,
    code: `${form.code.toUpperCase()}|${form.coordinator_id}`
  };
};

const serializeCareer = (form: { name: string; code: string; department_id: string; coordinator_id: string; max_credits: number; required_classroom_type: string; required_resources: string[] }) => {
  return {
    name: form.name,
    code: `${form.code.toUpperCase()}|${form.coordinator_id}|${form.max_credits}|${form.required_classroom_type}|${form.required_resources.join(',')}`,
    department_id: form.department_id
  };
};

const serializeSubject = (form: { name: string; code: string; career_id: string; semester: string; academic_year: string; credits: number; classroom_id: string; estimated_capacity: number }) => {
  return {
    name: form.name,
    code: `${form.code.toUpperCase()}|${form.classroom_id}|${form.estimated_capacity}`,
    career_id: form.career_id,
    semester: form.semester,
    academic_year: form.academic_year,
    credits: Number(form.credits)
  };
};

export default function DepartamentosPage() {
  const { user: currentUser } = useAuthStore();
  const { addToast } = useToastStore();
  const { 
    density,
    setDensity,
    departmentsTableColumns,
    setDepartmentsTableColumns,
    careersTableColumns,
    setCareersTableColumns,
    subjectsTableColumns,
    setSubjectsTableColumns,
    classroomsTableColumns,
    setClassroomsTableColumns,
    savePreferences 
  } = useUiStore();

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'departments' | 'careers' | 'classes' | 'classrooms'>('departments');
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Lists
  const [departments, setDepartments] = useState<Department[]>([]);
  const [careers, setCareers] = useState<Career[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [coordinators, setCoordinators] = useState<any[]>([]);

  // Search
  const [searchDept, setSearchDept] = useState('');
  const [searchCareer, setSearchCareer] = useState('');
  const [searchSubject, setSearchSubject] = useState('');
  const [searchClassroom, setSearchClassroom] = useState('');

  // Filters for Classes/Subjects
  const [filterCareer, setFilterCareer] = useState('all');
  const [filterSemester, setFilterSemester] = useState('all');
  const [filterYear, setFilterYear] = useState('all');

  // Filters for Classrooms (Idea A)
  const [filterBuilding, setFilterBuilding] = useState('all');
  const [filterClassroomType, setFilterClassroomType] = useState('all');

  // Column visibility dropdown toggles (Idea A)
  const [isDeptColOpen, setIsDeptColOpen] = useState(false);
  const [isCareerColOpen, setIsCareerColOpen] = useState(false);
  const [isSubjectColOpen, setIsSubjectColOpen] = useState(false);
  const [isClassroomColOpen, setIsClassroomColOpen] = useState(false);
  
  // Analytics Dashboard panel (Idea D)
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(true);

  // Modals
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isCareerModalOpen, setIsCareerModalOpen] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isClassroomModalOpen, setIsClassroomModalOpen] = useState(false);
  
  // Form States
  const [deptForm, setDeptForm] = useState({ id: '', name: '', code: '', coordinator_id: '' });
  const [careerForm, setCareerForm] = useState({ 
    id: '', 
    department_id: '', 
    name: '', 
    code: '', 
    coordinator_id: '', 
    max_credits: 6, 
    required_classroom_type: 'Teoría', 
    required_resources: [] as string[] 
  });
  const [subjectForm, setSubjectForm] = useState({
    id: '',
    name: '',
    code: '',
    career_id: '',
    semester: '1',
    academic_year: '1er Año',
    credits: 4,
    classroom_id: '',
    estimated_capacity: 30
  });
  const [classroomForm, setClassroomForm] = useState({
    id: '',
    name: '',
    building: '',
    capacity: 30,
    type: 'Teoría',
    status: 'activo',
    resources: [] as string[]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available resource list for classrooms (Idea B)
  const availableResources = [
    'Proyector HD',
    'Aire Acondicionado',
    'Pizarra Inteligente',
    'Estaciones de Cómputo',
    'Sistema de Audio'
  ];

  // Fetch tenant_id and data
  const initializePage = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      if (currentUser.tenant_id) {
        setTenantId(currentUser.tenant_id);
      }

      await loadData();
    } catch (error) {
      console.error('Error initializing page:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = async () => {
    let coordList: any[] = [];
    try {
      // Load coordinators (Idea B)
      const { data: usersData } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role_id, avatar_url')
        .order('first_name');
      if (usersData && usersData.length > 0) {
        coordList = usersData.map(u => ({
          id: u.id,
          name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
          email: u.email,
          role: u.role_id,
          avatar_url: u.avatar_url || 'academic-3'
        }));
      } else {
        const storedMocks = localStorage.getItem('asistapp_mock_users');
        if (storedMocks) {
          coordList = JSON.parse(storedMocks).map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            avatar_url: u.avatar_url || 'academic-3'
          }));
        } else {
          coordList = [
            { id: 'user-mock-6', name: 'Dr. Alejandro Peralta', email: 'alejandro@universidad.edu', role: 'docente', avatar_url: 'academic-3' },
            { id: 'user-mock-7', name: 'MSc. Beatriz Gómez', email: 'beatriz@universidad.edu', role: 'docente', avatar_url: 'academic-4' },
            { id: 'user-mock-8', name: 'Ing. Carlos Mendoza', email: 'carlos@universidad.edu', role: 'docente', avatar_url: 'academic-3' }
          ];
        }
      }
      const filteredCoords = coordList.filter(u => u.role === 'docente' || u.role === 'supervisor' || u.role === 'admin');
      setCoordinators(filteredCoords);

      // Load departments
      const { data: depts, error: deptsErr } = await supabase
        .from('departments')
        .select('*')
        .order('name');
      
      if (deptsErr) throw deptsErr;

      // Load careers with department relationship
      const { data: cars, error: carsErr } = await supabase
        .from('careers')
        .select(`
          id,
          department_id,
          name,
          code,
          created_at,
          departments(name)
        `)
        .order('name');
      
      if (carsErr) throw carsErr;

      // Load subjects with career and department relationship
      const { data: subs, error: subsErr } = await supabase
        .from('subjects')
        .select(`
          id,
          career_id,
          name,
          code,
          credits,
          semester,
          academic_year,
          created_at,
          careers(name, department_id, departments(name))
        `)
        .order('name');

      if (subsErr) throw subsErr;

      // Load classrooms (Idea A)
      const { data: rooms, error: roomsErr } = await supabase
        .from('classrooms')
        .select('*')
        .order('name');

      if (roomsErr) throw roomsErr;

      // Format careers (Idea B)
      const formattedCareers: Career[] = (cars || []).map((c: any) => {
        const deserialized = deserializeCareer(c, filteredCoords);
        return {
          ...deserialized,
          department_name: c.departments?.name || 'Desconocido'
        };
      });

      // Format subjects
      const formattedSubjects = (subs || []).map((s: any) => {
        const deserialized = deserializeSubject(s);
        return {
          ...deserialized,
          career_name: s.careers?.name || 'Desconocido',
          department_name: s.careers?.departments?.name || 'Desconocido'
        };
      });

      // Format classrooms (Idea B)
      const formattedRooms = (rooms || []).map(deserializeClassroom);

      // Map career count per department (Idea B)
      const formattedDepts: Department[] = (depts || []).map(d => {
        const deserialized = deserializeDepartment(d, filteredCoords);
        return {
          ...deserialized,
          careersCount: formattedCareers.filter(c => c.department_id === d.id).length
        };
      });

      setDepartments(formattedDepts);
      setCareers(formattedCareers);
      setSubjects(formattedSubjects);

      // Load classrooms (Supabase fallback to LocalStorage mocks)
      if (formattedRooms.length === 0) {
        const storedRooms = localStorage.getItem('asistapp_mock_classrooms');
        if (storedRooms) {
          setClassrooms(JSON.parse(storedRooms));
        } else {
          const initialMockRooms: Classroom[] = [
            { id: 'room-1', name: 'Aula 101 - Teoría', building: 'Pabellón A', capacity: 35, type: 'Teoría', status: 'activo', resources: ['Proyector HD', 'Aire Acondicionado'] },
            { id: 'room-2', name: 'Laboratorio de Sistemas C', building: 'Pabellón B', capacity: 25, type: 'Laboratorio', status: 'activo', resources: ['Estaciones de Cómputo', 'Pizarra Inteligente'] },
            { id: 'room-3', name: 'Auditorio Central', building: 'Edificio Central', capacity: 120, type: 'Auditorio', status: 'mantenimiento', resources: ['Sistema de Audio', 'Proyector HD', 'Aire Acondicionado'] },
            { id: 'room-4', name: 'Taller de Mecatrónica', building: 'Pabellón C', capacity: 20, type: 'Taller', status: 'activo', resources: ['Pizarra Inteligente'] }
          ];
          setClassrooms(initialMockRooms);
          localStorage.setItem('asistapp_mock_classrooms', JSON.stringify(initialMockRooms));
        }
      } else {
        setClassrooms(formattedRooms);
      }
    } catch (err: any) {
      console.error('Error loading page details:', err);
      // Fallback mocks
      const fallbackDepts = [
        { id: 'dept-1', name: 'Facultad de Ingeniería', code: 'FAC-ING|user-mock-8', created_at: new Date().toISOString() },
        { id: 'dept-2', name: 'Facultad de Medicina', code: 'FAC-MED|user-mock-6', created_at: new Date().toISOString() },
        { id: 'dept-3', name: 'Escuela de Postgrado', code: 'ESC-PG|user-mock-7', created_at: new Date().toISOString() }
      ].map(d => {
        const deserialized = deserializeDepartment(d, coordList.filter(u => u.role === 'docente' || u.role === 'supervisor' || u.role === 'admin'));
        return {
          ...deserialized,
          careersCount: 0
        };
      });
      
      const fallbackCareers = [
        { id: 'car-1', department_id: 'dept-1', name: 'Ingeniería de Sistemas', code: 'ING-SIS|user-mock-8', created_at: new Date().toISOString(), department_name: 'Facultad de Ingeniería' },
        { id: 'car-2', department_id: 'dept-1', name: 'Ingeniería Industrial', code: 'ING-IND|user-mock-7', created_at: new Date().toISOString(), department_name: 'Facultad de Ingeniería' },
        { id: 'car-3', department_id: 'dept-2', name: 'Medicina Humana', code: 'MED-HUM|user-mock-6', created_at: new Date().toISOString(), department_name: 'Facultad de Medicina' }
      ].map(c => {
        const deserialized = deserializeCareer(c, coordList.filter(u => u.role === 'docente' || u.role === 'supervisor' || u.role === 'admin'));
        return {
          ...deserialized,
          department_name: c.department_name
        };
      });

      fallbackDepts.forEach(d => {
        d.careersCount = fallbackCareers.filter(c => c.department_id === d.id).length;
      });

      setDepartments(fallbackDepts);
      setCareers(fallbackCareers);

      setSubjects([
        { id: 'sub-1', career_id: 'car-1', name: 'Cálculo Diferencial', code: 'MAT-101', credits: 4, semester: '1', academic_year: '1er Año', classroom_id: 'room-1', estimated_capacity: 40, created_at: new Date().toISOString(), career_name: 'Ingeniería de Sistemas', department_name: 'Facultad de Ingeniería' },
        { id: 'sub-2', career_id: 'car-1', name: 'Programación I', code: 'SIS-102', credits: 4, semester: '1', academic_year: '1er Año', classroom_id: 'room-2', estimated_capacity: 30, created_at: new Date().toISOString(), career_name: 'Ingeniería de Sistemas', department_name: 'Facultad de Ingeniería' },
        { id: 'sub-3', career_id: 'car-1', name: 'Cálculo Integral', code: 'MAT-201', credits: 4, semester: '2', academic_year: '1er Año', classroom_id: 'room-1', estimated_capacity: 35, created_at: new Date().toISOString(), career_name: 'Ingeniería de Sistemas', department_name: 'Facultad de Ingeniería' },
        { id: 'sub-4', career_id: 'car-1', name: 'Estructuras de Datos', code: 'SIS-301', credits: 4, semester: '1', academic_year: '2do Año', classroom_id: 'room-2', estimated_capacity: 20, created_at: new Date().toISOString(), career_name: 'Ingeniería de Sistemas', department_name: 'Facultad de Ingeniería' },
        { id: 'sub-5', career_id: 'car-2', name: 'Física I', code: 'FIS-101', credits: 3, semester: '1', academic_year: '1er Año', classroom_id: 'room-4', estimated_capacity: 25, created_at: new Date().toISOString(), career_name: 'Ingeniería Industrial', department_name: 'Facultad de Ingeniería' },
        { id: 'sub-6', career_id: 'car-3', name: 'Anatomía Humana', code: 'MED-101', credits: 6, semester: '1', academic_year: '1er Año', classroom_id: 'room-3', estimated_capacity: 150, created_at: new Date().toISOString(), career_name: 'Medicina Humana', department_name: 'Facultad de Medicina' }
      ]);
      
      const storedRooms = localStorage.getItem('asistapp_mock_classrooms');
      if (storedRooms) {
        setClassrooms(JSON.parse(storedRooms));
      } else {
        const initialMockRooms: Classroom[] = [
          { id: 'room-1', name: 'Aula 101 - Teoría', building: 'Pabellón A', capacity: 35, type: 'Teoría', status: 'activo', resources: ['Proyector HD', 'Aire Acondicionado'] },
          { id: 'room-2', name: 'Laboratorio de Sistemas C', building: 'Pabellón B', capacity: 25, type: 'Laboratorio', status: 'activo', resources: ['Estaciones de Cómputo', 'Pizarra Inteligente'] },
          { id: 'room-3', name: 'Auditorio Central', building: 'Edificio Central', capacity: 120, type: 'Auditorio', status: 'mantenimiento', resources: ['Sistema de Audio', 'Proyector HD', 'Aire Acondicionado'] },
          { id: 'room-4', name: 'Taller de Mecatrónica', building: 'Pabellón C', capacity: 20, type: 'Taller', status: 'activo', resources: ['Pizarra Inteligente'] }
        ];
        setClassrooms(initialMockRooms);
        localStorage.setItem('asistapp_mock_classrooms', JSON.stringify(initialMockRooms));
      }
    }
  };

  useEffect(() => {
    if (currentUser) {
      initializePage();
    }
  }, [currentUser]);

  // Department Modal triggers
  const openCreateDept = () => {
    setDeptForm({ id: '', name: '', code: '', coordinator_id: '' });
    setIsDeptModalOpen(true);
  };

  const openEditDept = (dept: Department) => {
    setDeptForm({ id: dept.id, name: dept.name, code: dept.code, coordinator_id: dept.coordinator_id || '' });
    setIsDeptModalOpen(true);
  };

  // Career Modal triggers
  const openCreateCareer = () => {
    setCareerForm({ 
      id: '', 
      department_id: departments[0]?.id || '', 
      name: '', 
      code: '', 
      coordinator_id: '',
      max_credits: 6,
      required_classroom_type: 'Teoría',
      required_resources: []
    });
    setIsCareerModalOpen(true);
  };

  const openEditCareer = (career: Career) => {
    setCareerForm({ 
      id: career.id, 
      department_id: career.department_id, 
      name: career.name, 
      code: career.code,
      coordinator_id: career.coordinator_id || '',
      max_credits: career.max_credits || 6,
      required_classroom_type: career.required_classroom_type || 'Teoría',
      required_resources: career.required_resources || []
    });
    setIsCareerModalOpen(true);
  };

  const toggleCareerResource = (resource: string) => {
    setCareerForm(prev => {
      const alreadyHas = prev.required_resources.includes(resource);
      const updated = alreadyHas 
        ? prev.required_resources.filter(r => r !== resource)
        : [...prev.required_resources, resource];
      return { ...prev, required_resources: updated };
    });
  };

  // Subject / Classes Modal triggers and handlers
  const openCreateSubject = () => {
    setSubjectForm({
      id: '',
      name: '',
      code: '',
      career_id: careers[0]?.id || '',
      semester: '1',
      academic_year: '1er Año',
      credits: 4,
      classroom_id: '',
      estimated_capacity: 30
    });
    setIsSubjectModalOpen(true);
  };

  const openEditSubject = (sub: any) => {
    setSubjectForm({
      id: sub.id,
      name: sub.name,
      code: sub.code,
      career_id: sub.career_id,
      semester: sub.semester,
      academic_year: sub.academic_year,
      credits: sub.credits,
      classroom_id: sub.classroom_id || '',
      estimated_capacity: sub.estimated_capacity || 30
    });
    setIsSubjectModalOpen(true);
  };

  // Classroom Modal triggers (Ideas A, B & C)
  const openCreateClassroom = () => {
    setClassroomForm({
      id: '',
      name: '',
      building: '',
      capacity: 30,
      type: 'Teoría',
      status: 'activo',
      resources: []
    });
    setIsClassroomModalOpen(true);
  };

  const openEditClassroom = (room: Classroom) => {
    setClassroomForm({
      id: room.id,
      name: room.name,
      building: room.building,
      capacity: room.capacity,
      type: room.type,
      status: room.status,
      resources: room.resources
    });
    setIsClassroomModalOpen(true);
  };

  const toggleResource = (resource: string) => {
    setClassroomForm(prev => {
      const alreadyHas = prev.resources.includes(resource);
      const updated = alreadyHas 
        ? prev.resources.filter(r => r !== resource)
        : [...prev.resources, resource];
      return { ...prev, resources: updated };
    });
  };

  const handleSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectForm.name || !subjectForm.code || !subjectForm.career_id) {
      addToast({ title: 'Campos requeridos', message: 'Por favor complete todos los datos.', type: 'error' });
      return;
    }

    // Idea C: Validate credits limit for selected career
    const selectedCareer = careers.find(c => c.id === subjectForm.career_id);
    const maxCreditsAllowed = selectedCareer?.max_credits || 6;
    if (Number(subjectForm.credits) > maxCreditsAllowed) {
      addToast({ 
        title: 'Límite de Créditos Excedido', 
        message: `La carrera ${selectedCareer?.name || ''} tiene establecido un límite máximo de ${maxCreditsAllowed} créditos por asignatura.`, 
        type: 'error' 
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = serializeSubject(subjectForm);

      if (tenantId) {
        (payload as any).tenant_id = tenantId;
      }

      if (subjectForm.id) {
        // Update mode
        if (subjectForm.id.startsWith('sub-')) {
          // Local state mock update
          setSubjects(prev => prev.map(s => s.id === subjectForm.id ? { 
            ...s, 
            ...payload, 
            code: subjectForm.code.toUpperCase(),
            classroom_id: subjectForm.classroom_id,
            estimated_capacity: Number(subjectForm.estimated_capacity),
            career_name: careers.find(c => c.id === payload.career_id)?.name || s.career_name 
          } : s));
          addToast({ title: 'Éxito', message: 'Asignatura demo actualizada localmente.', type: 'success' });
        } else {
          const { error } = await supabase
            .from('subjects')
            .update(payload)
            .eq('id', subjectForm.id);

          if (error) throw error;
          addToast({ title: 'Éxito', message: 'Asignatura actualizada correctamente.', type: 'success' });
        }
      } else {
        // Create mode
        const { error } = await supabase
          .from('subjects')
          .insert([payload]);

        if (error) {
          console.warn('DB insert failed for subject, creating local mock:', error);
          const newMock = {
            id: `sub-new-${Date.now()}`,
            name: subjectForm.name,
            code: subjectForm.code.toUpperCase(),
            career_id: subjectForm.career_id,
            semester: subjectForm.semester,
            academic_year: subjectForm.academic_year,
            credits: Number(subjectForm.credits),
            classroom_id: subjectForm.classroom_id,
            estimated_capacity: Number(subjectForm.estimated_capacity),
            created_at: new Date().toISOString(),
            career_name: careers.find(c => c.id === subjectForm.career_id)?.name || 'Desconocido',
            department_name: careers.find(c => c.id === subjectForm.career_id)?.department_name || 'Desconocido'
          };
          setSubjects(prev => [newMock, ...prev]);
          addToast({ title: 'Éxito', message: 'Asignatura demo creada localmente.', type: 'success' });
        } else {
          addToast({ title: 'Éxito', message: 'Asignatura creada correctamente.', type: 'success' });
        }
      }

      setIsSubjectModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      addToast({ title: 'Error', message: err.message || 'No se pudo guardar la asignatura.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubjectDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta asignatura? Se perderán todos los horarios asociados.')) return;
    try {
      if (id.startsWith('sub-')) {
        setSubjects(prev => prev.filter(s => s.id !== id));
        addToast({ title: 'Eliminado', message: 'Asignatura demo eliminada localmente.', type: 'success' });
      } else {
        const { error } = await supabase
          .from('subjects')
          .delete()
          .eq('id', id);

        if (error) throw error;
        addToast({ title: 'Eliminado', message: 'Asignatura eliminada correctamente.', type: 'success' });
        loadData();
      }
    } catch (err: any) {
      console.error(err);
      addToast({ title: 'Error', message: err.message || 'No se pudo eliminar la asignatura.', type: 'error' });
    }
  };

  // Submit Department Form
  const handleDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptForm.name || !deptForm.code) {
      addToast({ title: 'Campos requeridos', message: 'Por favor complete todos los datos.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = serializeDepartment(deptForm);
      
      if (tenantId) {
        (payload as any).tenant_id = tenantId;
      }

      if (deptForm.id) {
        // Edit mode
        if (deptForm.id.startsWith('dept-')) {
          setDepartments(prev => prev.map(d => d.id === deptForm.id ? { 
            ...d, 
            name: deptForm.name, 
            code: deptForm.code.toUpperCase(), 
            coordinator_id: deptForm.coordinator_id,
            coordinator_name: coordinators.find(c => c.id === deptForm.coordinator_id)?.name || 'Sin Asignar',
            coordinator_email: coordinators.find(c => c.id === deptForm.coordinator_id)?.email || ''
          } : d));
          addToast({ title: 'Éxito', message: 'Departamento demo actualizado localmente.', type: 'success' });
        } else {
          const { error } = await supabase
            .from('departments')
            .update(payload)
            .eq('id', deptForm.id);
          
          if (error) throw error;
          addToast({ title: 'Éxito', message: 'Departamento actualizado correctamente.', type: 'success' });
        }
      } else {
        // Create mode
        const { error } = await supabase
          .from('departments')
          .insert([payload]);

        if (error) {
          console.warn('DB insert failed for department, creating local mock:', error);
          const newMock: Department = {
            id: `dept-new-${Date.now()}`,
            name: deptForm.name,
            code: deptForm.code.toUpperCase(),
            created_at: new Date().toISOString(),
            careersCount: 0,
            coordinator_id: deptForm.coordinator_id,
            coordinator_name: coordinators.find(c => c.id === deptForm.coordinator_id)?.name || 'Sin Asignar',
            coordinator_email: coordinators.find(c => c.id === deptForm.coordinator_id)?.email || ''
          };
          setDepartments(prev => [newMock, ...prev]);
          addToast({ title: 'Éxito', message: 'Departamento demo creado localmente.', type: 'success' });
        } else {
          addToast({ title: 'Éxito', message: 'Departamento creado exitosamente.', type: 'success' });
        }
      }

      setIsDeptModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      addToast({ title: 'Error', message: err.message || 'No se pudo guardar el departamento.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Career Form
  const handleCareerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!careerForm.name || !careerForm.code || !careerForm.department_id) {
      addToast({ title: 'Campos requeridos', message: 'Por favor complete todos los datos.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = serializeCareer(careerForm);

      if (tenantId) {
        (payload as any).tenant_id = tenantId;
      }

      if (careerForm.id) {
        // Edit mode
        if (careerForm.id.startsWith('car-')) {
          setCareers(prev => prev.map(c => c.id === careerForm.id ? { 
            ...c, 
            name: careerForm.name, 
            code: careerForm.code.toUpperCase(), 
            department_id: careerForm.department_id,
            department_name: departments.find(d => d.id === careerForm.department_id)?.name || c.department_name,
            coordinator_id: careerForm.coordinator_id,
            coordinator_name: coordinators.find(co => co.id === careerForm.coordinator_id)?.name || 'Sin Asignar',
            coordinator_email: coordinators.find(co => co.id === careerForm.coordinator_id)?.email || '',
            max_credits: Number(careerForm.max_credits),
            required_classroom_type: careerForm.required_classroom_type,
            required_resources: careerForm.required_resources
          } : c));
          addToast({ title: 'Éxito', message: 'Carrera demo actualizada localmente.', type: 'success' });
        } else {
          const { error } = await supabase
            .from('careers')
            .update(payload)
            .eq('id', careerForm.id);

          if (error) throw error;
          addToast({ title: 'Éxito', message: 'Carrera académica actualizada.', type: 'success' });
        }
      } else {
        // Create mode
        const { error } = await supabase
          .from('careers')
          .insert([payload]);

        if (error) {
          console.warn('DB insert failed for career, creating local mock:', error);
          const newMock: Career = {
            id: `car-new-${Date.now()}`,
            department_id: careerForm.department_id,
            name: careerForm.name,
            code: careerForm.code.toUpperCase(),
            created_at: new Date().toISOString(),
            department_name: departments.find(d => d.id === careerForm.department_id)?.name || 'Desconocido',
            coordinator_id: careerForm.coordinator_id,
            coordinator_name: coordinators.find(co => co.id === careerForm.coordinator_id)?.name || 'Sin Asignar',
            coordinator_email: coordinators.find(co => co.id === careerForm.coordinator_id)?.email || '',
            max_credits: Number(careerForm.max_credits),
            required_classroom_type: careerForm.required_classroom_type,
            required_resources: careerForm.required_resources
          };
          setCareers(prev => [newMock, ...prev]);
          addToast({ title: 'Éxito', message: 'Carrera demo creada localmente.', type: 'success' });
        } else {
          addToast({ title: 'Éxito', message: 'Carrera académica creada.', type: 'success' });
        }
      }

      setIsCareerModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      addToast({ title: 'Error', message: err.message || 'No se pudo guardar la carrera académica.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Classroom Form (Ideas A, B & C)
  const handleClassroomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classroomForm.name || !classroomForm.building) {
      addToast({ title: 'Campos requeridos', message: 'Por favor complete el nombre y edificio.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const isMock = classroomForm.id?.startsWith('room-');
      const payload = serializeClassroom(classroomForm);

      if (tenantId) {
        (payload as any).tenant_id = tenantId;
      }

      if (classroomForm.id) {
        // Edit Mode
        if (isMock) {
          setClassrooms(prev => {
            const updated = prev.map(r => r.id === classroomForm.id ? { ...r, ...classroomForm } : r);
            localStorage.setItem('asistapp_mock_classrooms', JSON.stringify(updated));
            return updated;
          });
          addToast({ title: 'Éxito', message: 'Aula demo actualizada localmente.', type: 'success' });
        } else {
          const { error } = await supabase
            .from('classrooms')
            .update(payload)
            .eq('id', classroomForm.id);

          if (error) throw error;
          addToast({ title: 'Éxito', message: 'Aula actualizada correctamente.', type: 'success' });
        }
      } else {
        // Create Mode
        const { error } = await supabase
          .from('classrooms')
          .insert([payload]);

        if (error) {
          console.warn('Inserting into database failed, creating mock in localStorage instead:', error);
          // Create local mock
          const newMock: Classroom = {
            id: `room-new-${Date.now()}`,
            name: classroomForm.name,
            building: classroomForm.building,
            capacity: Number(classroomForm.capacity),
            type: classroomForm.type,
            status: classroomForm.status,
            resources: classroomForm.resources
          };
          setClassrooms(prev => {
            const updated = [newMock, ...prev];
            localStorage.setItem('asistapp_mock_classrooms', JSON.stringify(updated));
            return updated;
          });
          addToast({ title: 'Éxito', message: 'Aula demo creada localmente.', type: 'success' });
        } else {
          addToast({ title: 'Éxito', message: 'Aula creada correctamente.', type: 'success' });
        }
      }

      setIsClassroomModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      addToast({ title: 'Error', message: err.message || 'No se pudo guardar el aula.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Classroom
  const handleClassroomDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta aula? Se perderán las referencias en los horarios.')) return;
    try {
      if (id.startsWith('room-')) {
        setClassrooms(prev => {
          const updated = prev.filter(r => r.id !== id);
          localStorage.setItem('asistapp_mock_classrooms', JSON.stringify(updated));
          return updated;
        });
        addToast({ title: 'Eliminado', message: 'Aula demo eliminada localmente.', type: 'success' });
      } else {
        const { error } = await supabase
          .from('classrooms')
          .delete()
          .eq('id', id);

        if (error) throw error;
        addToast({ title: 'Eliminado', message: 'Aula eliminada correctamente.', type: 'success' });
        loadData();
      }
    } catch (err: any) {
      console.error(err);
      addToast({ title: 'Error', message: err.message || 'No se pudo eliminar el aula.', type: 'error' });
    }
  };

  // Delete handlers
  const handleDeptDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este departamento? Se eliminarán todas las carreras vinculadas.')) return;
    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      addToast({ title: 'Eliminado', message: 'Departamento eliminado correctamente.', type: 'success' });
      loadData();
    } catch (err: any) {
      console.error(err);
      addToast({ title: 'Error', message: err.message || 'No se pudo eliminar el departamento.', type: 'error' });
    }
  };

  const handleCareerDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta carrera académica?')) return;
    try {
      const { error } = await supabase
        .from('careers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      addToast({ title: 'Eliminado', message: 'Carrera eliminada correctamente.', type: 'success' });
      loadData();
    } catch (err: any) {
      console.error(err);
      addToast({ title: 'Error', message: err.message || 'No se pudo eliminar la carrera.', type: 'error' });
    }
  };

  // Filter lists based on searches
  const filteredDepts = departments.filter(d => 
    d.name.toLowerCase().includes(searchDept.toLowerCase()) ||
    d.code.toLowerCase().includes(searchDept.toLowerCase())
  );

  const filteredCareers = careers.filter(c => 
    c.name.toLowerCase().includes(searchCareer.toLowerCase()) ||
    c.code.toLowerCase().includes(searchCareer.toLowerCase()) ||
    c.department_name?.toLowerCase().includes(searchCareer.toLowerCase())
  );

  const filteredSubjects = subjects.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchSubject.toLowerCase()) || 
                          s.code.toLowerCase().includes(searchSubject.toLowerCase());
    const matchesCareer = filterCareer === 'all' || s.career_id === filterCareer;
    const matchesSemester = filterSemester === 'all' || s.semester === filterSemester;
    const matchesYear = filterYear === 'all' || s.academic_year === filterYear;
    return matchesSearch && matchesCareer && matchesSemester && matchesYear;
  });

  // Filter classrooms list (Idea A)
  const filteredClassrooms = classrooms.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchClassroom.toLowerCase()) ||
                          r.building.toLowerCase().includes(searchClassroom.toLowerCase());
    const matchesBuilding = filterBuilding === 'all' || r.building === filterBuilding;
    const matchesType = filterClassroomType === 'all' || r.type === filterClassroomType;
    return matchesSearch && matchesBuilding && matchesType;
  });

  // Unique list of buildings for filtering
  const buildingList = Array.from(new Set(classrooms.map(c => c.building)));

  const subjectColumns = [
    {
      id: 'code',
      header: 'Código',
      accessor: (item: any) => (
        <span className="font-mono text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900/60 px-2 py-0.5 rounded">
          {item.code}
        </span>
      )
    },
    {
      id: 'name',
      header: 'Asignatura',
      accessor: (item: any) => (
        <div className="font-semibold text-zinc-900 dark:text-zinc-50">{item.name}</div>
      )
    },
    {
      id: 'career',
      header: 'Carrera / Departamento',
      accessor: (item: any) => (
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            <GraduationCap className="w-3.5 h-3.5 text-violet-500 shrink-0" />
            {item.career_name}
          </span>
          <span className="text-[10px] text-zinc-500 pl-5">
            🏛️ {item.department_name}
          </span>
        </div>
      )
    },
    {
      id: 'curriculum',
      header: 'Ubicación Curricular',
      accessor: (item: any) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
            Semestre {item.semester}
          </span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
            {item.academic_year}
          </span>
        </div>
      )
    },
    {
      id: 'credits',
      header: 'Créditos',
      accessor: (item: any) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50">
          {item.credits} cr.
        </span>
      )
    },
    {
      id: 'classroom',
      header: 'Aula & Alertas',
      accessor: (item: any) => {
        const room = classrooms.find(r => r.id === item.classroom_id);
        const career = careers.find(c => c.id === item.career_id);
        
        const isOverloaded = room ? item.estimated_capacity > room.capacity : false;
        const isTypeMismatch = room && career?.required_classroom_type ? room.type !== career.required_classroom_type : false;
        const missingResources = room && career?.required_resources 
          ? career.required_resources.filter(res => !(room.resources || []).includes(res))
          : [];
        const hasMissingResources = missingResources.length > 0;
        const hasAnyWarning = isOverloaded || isTypeMismatch || hasMissingResources;

        return (
          <div className="flex flex-col gap-1">
            {room ? (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                <Building className="w-3.5 h-3.5 text-violet-500" />
                <span>{room.name} ({room.building})</span>
              </div>
            ) : (
              <span className="text-[10px] text-zinc-400 italic">Sin aula asignada</span>
            )}
            
            <div className="flex items-center gap-1 text-[10px] text-zinc-500">
              <span>Proyección: {item.estimated_capacity} alumnos</span>
            </div>

            {hasAnyWarning && (
              <div className="flex flex-col gap-1 mt-1">
                {isOverloaded && room && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 px-1.5 py-0.5 rounded">
                    <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                    Sobrecarga: Aforo asignatura ({item.estimated_capacity}) &gt; Capacidad aula ({room.capacity})
                  </span>
                )}
                {isTypeMismatch && room && career && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 px-1.5 py-0.5 rounded">
                    <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                    Tipo Inadecuado: Requiere {career.required_classroom_type} (Aula es {room.type})
                  </span>
                )}
                {hasMissingResources && room && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 px-1.5 py-0.5 rounded">
                    <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                    Falta equipamiento: {missingResources.join(', ')}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      }
    },
    {
      id: 'actions',
      header: 'Acciones',
      accessor: (item: any) => (
        <div className="flex items-center gap-2">
          <button 
            onClick={() => openEditSubject(item)}
            className="p-1.5 text-zinc-500 hover:text-violet-600 dark:text-zinc-400 dark:hover:text-violet-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="Editar asignatura"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => handleSubjectDelete(item.id)}
            className="p-1.5 text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="Eliminar asignatura"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  const deptColumns = [
    {
      id: 'code',
      header: 'Código',
      accessor: (item: Department) => (
        <span className="font-mono text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900/60 px-2 py-0.5 rounded">
          {item.code}
        </span>
      )
    },
    {
      id: 'name',
      header: 'Nombre del Departamento',
      accessor: (item: Department) => (
        <div className="font-semibold text-zinc-900 dark:text-zinc-50">{item.name}</div>
      )
    },
    {
      id: 'coordinator',
      header: 'Director / Coordinador',
      accessor: (item: Department) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center text-xs font-bold text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
            {item.coordinator_name?.charAt(0) || 'U'}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{item.coordinator_name}</span>
            {item.coordinator_email && (
              <a 
                href={`mailto:${item.coordinator_email}`} 
                className="text-[10px] text-violet-500 hover:underline inline-flex items-center gap-0.5"
              >
                <Mail className="w-2.5 h-2.5" /> {item.coordinator_email}
              </a>
            )}
          </div>
        </div>
      )
    },
    {
      id: 'careersCount',
      header: 'Carreras Vinculadas',
      accessor: (item: Department) => (
        <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
          {item.careersCount} {item.careersCount === 1 ? 'carrera' : 'carreras'}
        </span>
      )
    },
    {
      id: 'created_at',
      header: 'Fecha Registro',
      accessor: (item: Department) => (
        <span className="text-xs font-mono text-zinc-500">
          {new Date(item.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      )
    },
    {
      id: 'actions',
      header: 'Acciones',
      accessor: (item: Department) => (
        <div className="flex items-center gap-2">
          <button 
            onClick={() => openEditDept(item)}
            className="p-1.5 text-zinc-500 hover:text-violet-600 dark:text-zinc-400 dark:hover:text-violet-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="Editar departamento"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => handleDeptDelete(item.id)}
            className="p-1.5 text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="Eliminar departamento"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  const careerColumns = [
    {
      id: 'code',
      header: 'Código',
      accessor: (item: Career) => (
        <span className="font-mono text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900/60 px-2 py-0.5 rounded">
          {item.code}
        </span>
      )
    },
    {
      id: 'name',
      header: 'Carrera Profesional',
      accessor: (item: Career) => (
        <div className="font-semibold text-zinc-900 dark:text-zinc-50">{item.name}</div>
      )
    },
    {
      id: 'department',
      header: 'Departamento / Facultad',
      accessor: (item: Career) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          <Building className="w-3.5 h-3.5 text-zinc-400" />
          {item.department_name}
        </span>
      )
    },
    {
      id: 'coordinator',
      header: 'Coordinador Académico',
      accessor: (item: Career) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center text-xs font-bold text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
            {item.coordinator_name?.charAt(0) || 'U'}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{item.coordinator_name}</span>
            {item.coordinator_email && (
              <a 
                href={`mailto:${item.coordinator_email}`} 
                className="text-[10px] text-violet-500 hover:underline inline-flex items-center gap-0.5"
              >
                <Mail className="w-2.5 h-2.5" /> {item.coordinator_email}
              </a>
            )}
          </div>
        </div>
      )
    },
    {
      id: 'created_at',
      header: 'Fecha Registro',
      accessor: (item: Career) => (
        <span className="text-xs font-mono text-zinc-500">
          {new Date(item.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      )
    },
    {
      id: 'actions',
      header: 'Acciones',
      accessor: (item: Career) => (
        <div className="flex items-center gap-2">
          <button 
            onClick={() => openEditCareer(item)}
            className="p-1.5 text-zinc-500 hover:text-violet-600 dark:text-zinc-400 dark:hover:text-violet-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="Editar carrera"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => handleCareerDelete(item.id)}
            className="p-1.5 text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="Eliminar carrera"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  // Classroom columns for DataTable (Ideas A, B & C)
  const classroomColumns = [
    {
      id: 'code',
      header: 'Código',
      accessor: (item: Classroom) => (
        <span className="font-mono text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900/60 px-2 py-0.5 rounded">
          {item.id.substring(0, 8).toUpperCase()}
        </span>
      )
    },
    {
      id: 'name',
      header: 'Nombre del Aula',
      accessor: (item: Classroom) => (
        <div className="font-semibold text-zinc-900 dark:text-zinc-50">{item.name}</div>
      )
    },
    {
      id: 'building',
      header: 'Ubicación / Edificio',
      accessor: (item: Classroom) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          <Building className="w-3.5 h-3.5 text-zinc-400" />
          {item.building}
        </span>
      )
    },
    {
      id: 'type',
      header: 'Tipo',
      accessor: (item: Classroom) => {
        const iconClasses = "w-3.5 h-3.5 text-violet-500 shrink-0";
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-50 dark:bg-zinc-900 border border-border">
            {item.type === 'Laboratorio' && <Monitor className={iconClasses} />}
            {item.type === 'Auditorio' && <Mic className={iconClasses} />}
            {item.type === 'Teoría' && <BookOpen className={iconClasses} />}
            {item.type === 'Taller' && <Wrench className={iconClasses} />}
            {item.type}
          </span>
        );
      }
    },
    {
      id: 'capacity',
      header: 'Aforo / Capacidad',
      accessor: (item: Classroom) => {
        const cap = item.capacity || 30;
        const isCompact = cap < 30;
        const isMedium = cap >= 30 && cap <= 60;
        
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            isCompact 
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/50' 
              : isMedium 
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50'
                : 'bg-violet-50 text-violet-700 dark:bg-violet-950/20 dark:text-violet-400 border border-violet-200/50 dark:border-violet-900/50'
          }`}>
            {cap} estudiantes
          </span>
        );
      }
    },
    {
      id: 'resources',
      header: 'Equipamiento',
      accessor: (item: Classroom) => {
        const resources = item.resources || [];
        if (resources.length === 0) {
          return <span className="text-[10px] text-muted-foreground italic">Sin recursos adicionales</span>;
        }
        return (
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {resources.map((r, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-border/40">
                {r === 'Proyector HD' && <Video className="w-2.5 h-2.5 text-zinc-400" />}
                {r === 'Aire Acondicionado' && <Wind className="w-2.5 h-2.5 text-zinc-400" />}
                {r === 'Estaciones de Cómputo' && <Monitor className="w-2.5 h-2.5 text-zinc-400" />}
                {r}
              </span>
            ))}
          </div>
        );
      }
    },
    {
      id: 'status',
      header: 'Estado',
      accessor: (item: Classroom) => {
        const isMaintenance = item.status === 'mantenimiento';
        const isInactive = item.status === 'inactivo';
        
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
            isInactive 
              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/50' 
              : isMaintenance 
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/50'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              isInactive 
                ? 'bg-rose-500' 
                : isMaintenance 
                  ? 'bg-amber-500'
                  : 'bg-emerald-500 animate-ping'
            }`} />
            {item.status}
          </span>
        );
      }
    },
    {
      id: 'actions',
      header: 'Acciones',
      accessor: (item: Classroom) => (
        <div className="flex items-center gap-2">
          <button 
            onClick={() => openEditClassroom(item)}
            className="p-1.5 text-zinc-500 hover:text-violet-600 dark:text-zinc-400 dark:hover:text-violet-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="Editar aula"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => handleClassroomDelete(item.id)}
            className="p-1.5 text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="Eliminar aula"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  const deptColumnsList = [
    { id: 'code', label: 'Código' },
    { id: 'name', label: 'Nombre' },
    { id: 'coordinator', label: 'Director' },
    { id: 'careersCount', label: 'Carreras' },
    { id: 'created_at', label: 'Fecha' },
    { id: 'actions', label: 'Acciones' }
  ];

  const careerColumnsList = [
    { id: 'code', label: 'Código' },
    { id: 'name', label: 'Nombre' },
    { id: 'coordinator', label: 'Coordinador' },
    { id: 'department', label: 'Departamento' },
    { id: 'created_at', label: 'Fecha' },
    { id: 'actions', label: 'Acciones' }
  ];

  const subjectColumnsList = [
    { id: 'code', label: 'Código' },
    { id: 'name', label: 'Nombre' },
    { id: 'career', label: 'Carrera' },
    { id: 'curriculum', label: 'Ubicación' },
    { id: 'credits', label: 'Créditos' },
    { id: 'classroom', label: 'Aula & Alertas' },
    { id: 'actions', label: 'Acciones' }
  ];

  const classroomColumnsList = [
    { id: 'code', label: 'Código' },
    { id: 'name', label: 'Nombre' },
    { id: 'building', label: 'Edificio' },
    { id: 'type', label: 'Tipo' },
    { id: 'capacity', label: 'Aforo' },
    { id: 'resources', label: 'Recursos' },
    { id: 'status', label: 'Estado' },
    { id: 'actions', label: 'Acciones' }
  ];

  const renderColumnSelector = (
    columnsList: { id: string; label: string }[], 
    visibleColumns: string[], 
    setVisibleColumns: (cols: string[]) => void, 
    isOpen: boolean, 
    setIsOpen: (open: boolean) => void
  ) => {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
          <span>Columnas</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 mt-2 w-48 rounded-lg border border-border bg-zinc-950 p-2 shadow-lg z-20 text-left">
              <div className="px-2 py-1 text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Columnas Visibles
              </div>
              <div className="space-y-1">
                {columnsList.map((col) => {
                  const isChecked = visibleColumns.includes(col.id);
                  return (
                    <label 
                      key={col.id} 
                      className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-900 rounded cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={col.id === 'actions' || col.id === 'name'}
                        onChange={() => {
                          const updated = isChecked
                            ? visibleColumns.filter(c => c !== col.id)
                            : [...visibleColumns, col.id];
                          setVisibleColumns(updated);
                          if (currentUser?.id) {
                            savePreferences(supabase, currentUser.id);
                          }
                        }}
                        className="rounded border-zinc-850 bg-zinc-900 text-violet-600 accent-violet-500 focus:ring-0"
                      />
                      <span>{col.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderDensitySelector = () => {
    return (
      <div className="flex items-center rounded-lg border border-border bg-card p-1">
        <button
          type="button"
          onClick={() => {
            setDensity('comfortable');
            if (currentUser?.id) savePreferences(supabase, currentUser.id);
          }}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
            density === 'comfortable' 
              ? 'bg-zinc-100 dark:bg-zinc-800 text-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Vista Cómoda"
        >
          📱 Cómoda
        </button>
        <button
          type="button"
          onClick={() => {
            setDensity('compact');
            if (currentUser?.id) savePreferences(supabase, currentUser.id);
          }}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
            density === 'compact' 
              ? 'bg-zinc-100 dark:bg-zinc-800 text-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Vista Compacta"
        >
          🗜️ Compacta
        </button>
      </div>
    );
  };

  const activeDeptColumns = deptColumns.filter(col => departmentsTableColumns.includes(col.id || ''));
  const activeCareerColumns = careerColumns.filter(col => careersTableColumns.includes(col.id || ''));
  const activeSubjectColumns = subjectColumns.filter(col => subjectsTableColumns.includes(col.id || ''));
  const activeClassroomColumns = classroomColumns.filter(col => classroomsTableColumns.includes(col.id || ''));

  return (
    <DashboardLayout>
      {/* Custom Global Styles for Compact Density (Idea A) */}
      <style>{`
        .table-density-compact td, 
        .table-density-compact th {
          padding-top: 0.35rem !important;
          padding-bottom: 0.35rem !important;
          font-size: 0.8rem !important;
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 select-none pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl flex items-center gap-2">
            <Building className="w-8 h-8 text-violet-500 flex-shrink-0" />
            Departamentos Académicos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Administra las facultades, departamentos académicos, carreras universitarias e infraestructura de aulas.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === 'departments' && (
            <Button 
              variant="outline" 
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={openCreateDept}
            >
              Nuevo Departamento
            </Button>
          )}
          {activeTab === 'careers' && (
            <Button 
              variant="outline" 
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={openCreateCareer}
            >
              Nueva Carrera
            </Button>
          )}
          {activeTab === 'classes' && (
            <Button 
              variant="default" 
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={openCreateSubject}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              Nueva Asignatura
            </Button>
          )}
          {activeTab === 'classrooms' && (
            <Button 
              variant="default" 
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={openCreateClassroom}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              Nueva Aula
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border select-none gap-4 flex-wrap mb-4">
        <button
          onClick={() => setActiveTab('departments')}
          className={`pb-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'departments' 
              ? 'border-violet-500 text-violet-600 dark:text-violet-400' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Departamentos ({departments.length})
        </button>
        <button
          onClick={() => setActiveTab('careers')}
          className={`pb-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'careers' 
              ? 'border-violet-500 text-violet-600 dark:text-violet-400' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Carreras Profesionales ({careers.length})
        </button>
        <button
          onClick={() => setActiveTab('classes')}
          className={`pb-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'classes' 
              ? 'border-violet-500 text-violet-600 dark:text-violet-400' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Asignaturas / Clases ({subjects.length})
        </button>
        <button
          onClick={() => setActiveTab('classrooms')}
          className={`pb-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'classrooms' 
              ? 'border-violet-500 text-violet-600 dark:text-violet-400' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Infraestructura Aulas ({classrooms.length})
        </button>
      </div>

      {/* Analytics Panel (Idea D) */}
      {isAnalyticsOpen && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm relative overflow-hidden animate-fadeIn mb-6 select-none">
          <div className="absolute top-3 right-3">
            <button 
              onClick={() => setIsAnalyticsOpen(false)}
              className="text-muted-foreground hover:text-foreground p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-violet-500" />
            Diagnóstico Académico e Infraestructura
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Classroom Types distribution */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                <Building className="w-3.5 h-3.5" />
                Distribución de Aulas
              </h3>
              <div className="space-y-2">
                {[
                  { name: 'Teoría', count: classrooms.filter(r => r.type === 'Teoría').length, color: 'bg-blue-500' },
                  { name: 'Laboratorios', count: classrooms.filter(r => r.type === 'Laboratorio').length, color: 'bg-emerald-500' },
                  { name: 'Auditorios', count: classrooms.filter(r => r.type === 'Auditorio').length, color: 'bg-violet-500' },
                  { name: 'Talleres', count: classrooms.filter(r => r.type === 'Taller').length, color: 'bg-amber-500' }
                ].map((type, idx) => {
                  const pct = classrooms.length > 0 ? (type.count / classrooms.length) * 100 : 0;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-[11px] font-medium">
                        <span>{type.name}</span>
                        <span className="text-muted-foreground">{type.count} ({Math.round(pct)}%)</span>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div className={`h-full ${type.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Operative Status */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" />
                Estado Operativo de Aulas
              </h3>
              <div className="space-y-2">
                {[
                  { name: 'Activo (Disponible)', count: classrooms.filter(r => r.status === 'activo').length, color: 'bg-emerald-500' },
                  { name: 'En Mantenimiento', count: classrooms.filter(r => r.status === 'mantenimiento').length, color: 'bg-amber-500' },
                  { name: 'Inactivo', count: classrooms.filter(r => r.status === 'inactivo').length, color: 'bg-rose-500' }
                ].map((status, idx) => {
                  const pct = classrooms.length > 0 ? (status.count / classrooms.length) * 100 : 0;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-[11px] font-medium">
                        <span>{status.name}</span>
                        <span className="text-muted-foreground">{status.count} ({Math.round(pct)}%)</span>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div className={`h-full ${status.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Capacity Diagnostic */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                Aforo Académico Estructural
              </h3>
              <div className="space-y-2">
                <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border border-border rounded-lg space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Capacidad Sentada Total:</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {classrooms.reduce((acc, r) => acc + (r.capacity || 0), 0)} alumnos
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Aulas Registradas:</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{classrooms.length}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Promedio Aforo por Aula:</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {classrooms.length > 0 ? Math.round(classrooms.reduce((acc, r) => acc + (r.capacity || 0), 0) / classrooms.length) : 0} alumnos
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Button to toggle analytics if closed */}
      {!isAnalyticsOpen && (
        <div className="flex justify-end mb-4 select-none">
          <button 
            onClick={() => setIsAnalyticsOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline"
          >
            <Activity className="w-3.5 h-3.5" /> Mostrar Estadísticas Académicas
          </button>
        </div>
      )}

      {/* Tab Contents: Departments */}
      {activeTab === 'departments' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between select-none">
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar departamento..."
                value={searchDept}
                onChange={(e) => setSearchDept(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {renderDensitySelector()}
              {renderColumnSelector(deptColumnsList, departmentsTableColumns, setDepartmentsTableColumns, isDeptColOpen, setIsDeptColOpen)}
            </div>
          </div>
          
          <div className={density === 'compact' ? 'table-density-compact' : 'table-density-comfortable'}>
            <DataTable
              columns={activeDeptColumns}
              data={filteredDepts}
              isLoading={isLoading}
              emptyTitle="Sin departamentos"
              emptyMessage="No se han registrado facultades o departamentos en este tenant."
            />
          </div>
        </div>
      )}

      {/* Tab Contents: Careers */}
      {activeTab === 'careers' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between select-none">
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar carrera o código..."
                value={searchCareer}
                onChange={(e) => setSearchCareer(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {renderDensitySelector()}
              {renderColumnSelector(careerColumnsList, careersTableColumns, setCareersTableColumns, isCareerColOpen, setIsCareerColOpen)}
            </div>
          </div>

          <div className={density === 'compact' ? 'table-density-compact' : 'table-density-comfortable'}>
            <DataTable
              columns={activeCareerColumns}
              data={filteredCareers}
              isLoading={isLoading}
              emptyTitle="Sin carreras universitarias"
              emptyMessage="No hay carreras registradas en este tenant. Comience creando una."
            />
          </div>
        </div>
      )}

      {/* Tab Contents: Classes/Subjects */}
      {activeTab === 'classes' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Advanced Filters */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-4 select-none">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar asignatura o código..."
                  value={searchSubject}
                  onChange={(e) => setSearchSubject(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>
              
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {/* Career Filter */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-full sm:w-auto">
                  <GraduationCap className="w-3.5 h-3.5 animate-pulse" />
                  <span>Carrera:</span>
                  <select
                    value={filterCareer}
                    onChange={(e) => setFilterCareer(e.target.value)}
                    className="flex h-9 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">Todas las Carreras</option>
                    {careers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Semester Filter */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-full sm:w-auto">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Semestre:</span>
                  <select
                    value={filterSemester}
                    onChange={(e) => setFilterSemester(e.target.value)}
                    className="flex h-9 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">Todos los Semestres</option>
                    {['1', '2', '3', '4'].map(sem => (
                      <option key={sem} value={sem}>Semestre {sem}</option>
                    ))}
                  </select>
                </div>

                {/* Year Filter */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-full sm:w-auto">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Año Académico:</span>
                  <select
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    className="flex h-9 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">Todos los Años</option>
                    {['1er Año', '2do Año', '3er Año', '4to Año', '5to Año'].map(yr => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>

                {renderDensitySelector()}
                {renderColumnSelector(subjectColumnsList, subjectsTableColumns, setSubjectsTableColumns, isSubjectColOpen, setIsSubjectColOpen)}
              </div>
            </div>
          </div>

          <div className={density === 'compact' ? 'table-density-compact' : 'table-density-comfortable'}>
            <DataTable
              columns={activeSubjectColumns}
              data={filteredSubjects}
              isLoading={isLoading}
              emptyTitle="Sin asignaturas"
              emptyMessage="No se han registrado asignaturas curriculares que coincidan."
            />
          </div>
        </div>
      )}

      {/* Tab Contents: Classrooms (Ideas A, B & C) */}
      {activeTab === 'classrooms' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Filters */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between select-none">
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nombre o edificio..."
                value={searchClassroom}
                onChange={(e) => setSearchClassroom(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
              {/* Building Filter */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-full sm:w-auto">
                <Building className="w-3.5 h-3.5" />
                <span>Edificio / Pabellón:</span>
                <select
                  value={filterBuilding}
                  onChange={(e) => setFilterBuilding(e.target.value)}
                  className="flex h-9 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">Todos los Edificios</option>
                  {buildingList.map((b, i) => (
                    <option key={i} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Classroom Type Filter */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-full sm:w-auto">
                <Filter className="w-3.5 h-3.5" />
                <span>Tipo de Aula:</span>
                <select
                  value={filterClassroomType}
                  onChange={(e) => setFilterClassroomType(e.target.value)}
                  className="flex h-9 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">Todos los Tipos</option>
                  <option value="Teoría">Teoría</option>
                  <option value="Laboratorio">Laboratorio</option>
                  <option value="Auditorio">Auditorio</option>
                  <option value="Taller">Taller</option>
                </select>
              </div>

              {renderDensitySelector()}
              {renderColumnSelector(classroomColumnsList, classroomsTableColumns, setClassroomsTableColumns, isClassroomColOpen, setIsClassroomColOpen)}
            </div>
          </div>

          <div className={density === 'compact' ? 'table-density-compact' : 'table-density-comfortable'}>
            <DataTable
              columns={activeClassroomColumns}
              data={filteredClassrooms}
              isLoading={isLoading}
              emptyTitle="Sin aulas registradas"
              emptyMessage="No se han registrado aulas de clase en el sistema."
            />
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          1. Departamento Form Modal
          ------------------------------------------------------------- */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold text-zinc-50 flex items-center gap-2">
                <Building className="w-5 h-5 text-violet-500" />
                {deptForm.id ? 'Editar Departamento' : 'Nuevo Departamento'}
              </h3>
              <button 
                onClick={() => setIsDeptModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-50 rounded-lg p-1.5 hover:bg-zinc-900 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleDeptSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Nombre del Departamento / Facultad
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Facultad de Ingeniería de Sistemas"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm(prev => ({ ...prev, name: e.target.value }))}
                  className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Código Corto (Máx 10 caracteres)
                </label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  placeholder="Ej: FI-SYS"
                  value={deptForm.code}
                  onChange={(e) => setDeptForm(prev => ({ ...prev, code: e.target.value }))}
                  className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 font-mono focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Director / Coordinador
                </label>
                <select
                  value={deptForm.coordinator_id}
                  onChange={(e) => setDeptForm(prev => ({ ...prev, coordinator_id: e.target.value }))}
                  className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  <option value="">Sin Asignar</option>
                  {coordinators.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDeptModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  isLoading={isSubmitting}
                >
                  {deptForm.id ? 'Guardar Cambios' : 'Crear Departamento'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          2. Career Form Modal
          ------------------------------------------------------------- */}
      {isCareerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold text-zinc-50 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-violet-500" />
                {careerForm.id ? 'Editar Carrera Académica' : 'Nueva Carrera Académica'}
              </h3>
              <button 
                onClick={() => setIsCareerModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-50 rounded-lg p-1.5 hover:bg-zinc-900 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleCareerSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Facultad / Departamento Vinculado
                </label>
                <select
                  required
                  value={careerForm.department_id}
                  onChange={(e) => setCareerForm(prev => ({ ...prev, department_id: e.target.value }))}
                  className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Nombre de la Carrera
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Ingeniería de Software"
                  value={careerForm.name}
                  onChange={(e) => setCareerForm(prev => ({ ...prev, name: e.target.value }))}
                  className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Código de Carrera (Máx 10 caracteres)
                </label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  placeholder="Ej: ING-SOF"
                  value={careerForm.code}
                  onChange={(e) => setCareerForm(prev => ({ ...prev, code: e.target.value }))}
                  className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 font-mono focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Coordinador Académico
                </label>
                <select
                  value={careerForm.coordinator_id}
                  onChange={(e) => setCareerForm(prev => ({ ...prev, coordinator_id: e.target.value }))}
                  className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  <option value="">Sin Asignar</option>
                  {coordinators.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Límite Créditos por Materia
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={careerForm.max_credits}
                    onChange={(e) => setCareerForm(prev => ({ ...prev, max_credits: Number(e.target.value) }))}
                    className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Tipo de Aula Requerida
                  </label>
                  <select
                    value={careerForm.required_classroom_type}
                    onChange={(e) => setCareerForm(prev => ({ ...prev, required_classroom_type: e.target.value }))}
                    className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  >
                    <option value="Teoría">Teoría</option>
                    <option value="Laboratorio">Laboratorio</option>
                    <option value="Auditorio">Auditorio</option>
                    <option value="Taller">Taller</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Equipamiento Obligatorio
                </label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {availableResources.map((res, i) => {
                    const isChecked = careerForm.required_resources?.includes(res) || false;
                    return (
                      <label key={i} className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCareerResource(res)}
                          className="w-4 h-4 rounded border-zinc-800 bg-zinc-900 accent-violet-500 focus:ring-0 focus:ring-offset-0"
                        />
                        <span>{res}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCareerModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  isLoading={isSubmitting}
                >
                  {careerForm.id ? 'Guardar Cambios' : 'Crear Carrera'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          3. Subject / Class Form Modal
          ------------------------------------------------------------- */}
      {isSubjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold text-zinc-50 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-violet-500" />
                {subjectForm.id ? 'Editar Asignatura' : 'Nueva Asignatura'}
              </h3>
              <button 
                onClick={() => setIsSubjectModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-50 rounded-lg p-1.5 hover:bg-zinc-900 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleSubjectSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Carrera Profesional
                </label>
                <select
                  required
                  value={subjectForm.career_id}
                  onChange={(e) => setSubjectForm(prev => ({ ...prev, career_id: e.target.value }))}
                  className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  <option value="">Seleccione una carrera...</option>
                  {careers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Nombre de la Asignatura
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Análisis Matemático III"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm(prev => ({ ...prev, name: e.target.value }))}
                  className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Código de Clase
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: MAT-301"
                    value={subjectForm.code}
                    onChange={(e) => setSubjectForm(prev => ({ ...prev, code: e.target.value }))}
                    className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 font-mono focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Créditos Académicos
                  </label>
                  <select
                    value={subjectForm.credits}
                    onChange={(e) => setSubjectForm(prev => ({ ...prev, credits: Number(e.target.value) }))}
                    className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  >
                    {[1, 2, 3, 4, 5, 6].map(cr => (
                      <option key={cr} value={cr}>{cr} {cr === 1 ? 'crédito' : 'créditos'}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Semestre
                  </label>
                  <select
                    value={subjectForm.semester}
                    onChange={(e) => setSubjectForm(prev => ({ ...prev, semester: e.target.value }))}
                    className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  >
                    {['1', '2', '3', '4'].map(sem => (
                      <option key={sem} value={sem}>Semestre {sem}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Año Académico
                  </label>
                  <select
                    value={subjectForm.academic_year}
                    onChange={(e) => setSubjectForm(prev => ({ ...prev, academic_year: e.target.value }))}
                    className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  >
                    {['1er Año', '2do Año', '3er Año', '4to Año', '5to Año'].map(yr => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Aula Asignada
                  </label>
                  <select
                    value={subjectForm.classroom_id}
                    onChange={(e) => setSubjectForm(prev => ({ ...prev, classroom_id: e.target.value }))}
                    className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  >
                    <option value="">Sin Aula</option>
                    {classrooms.map(room => (
                      <option key={room.id} value={room.id}>{room.name} ({room.building})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Aforo Proyectado
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={subjectForm.estimated_capacity}
                    onChange={(e) => setSubjectForm(prev => ({ ...prev, estimated_capacity: Number(e.target.value) }))}
                    className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsSubjectModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  isLoading={isSubmitting}
                >
                  {subjectForm.id ? 'Guardar Cambios' : 'Crear Asignatura'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          4. Classroom Form Modal (Ideas A, B & C)
          ------------------------------------------------------------- */}
      {isClassroomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold text-zinc-50 flex items-center gap-2">
                <Building className="w-5 h-5 text-violet-500" />
                {classroomForm.id ? 'Editar Aula' : 'Nueva Aula'}
              </h3>
              <button 
                onClick={() => setIsClassroomModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-50 rounded-lg p-1.5 hover:bg-zinc-900 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleClassroomSubmit} className="p-6 space-y-4 text-left">
              {/* Classroom Name */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Nombre del Aula
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Aula 101, Laboratorio B"
                  value={classroomForm.name}
                  onChange={(e) => setClassroomForm(prev => ({ ...prev, name: e.target.value }))}
                  className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              {/* Building & Location */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Edificio / Pabellón
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pabellón A, Edificio Central"
                  value={classroomForm.building}
                  onChange={(e) => setClassroomForm(prev => ({ ...prev, building: e.target.value }))}
                  className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              {/* Capacity and Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Aforo (Capacidad)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={classroomForm.capacity}
                    onChange={(e) => setClassroomForm(prev => ({ ...prev, capacity: Number(e.target.value) }))}
                    className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Tipo de Aula
                  </label>
                  <select
                    value={classroomForm.type}
                    onChange={(e) => setClassroomForm(prev => ({ ...prev, type: e.target.value }))}
                    className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  >
                    <option value="Teoría">Teoría</option>
                    <option value="Laboratorio">Laboratorio</option>
                    <option value="Auditorio">Auditorio</option>
                    <option value="Taller">Taller</option>
                  </select>
                </div>
              </div>

              {/* Status (Idea C) */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Estado Operativo
                </label>
                <select
                  value={classroomForm.status}
                  onChange={(e) => setClassroomForm(prev => ({ ...prev, status: e.target.value }))}
                  className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  <option value="activo">Activo (Operativo)</option>
                  <option value="mantenimiento">En Mantenimiento</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>

              {/* Resources Checklist (Idea B) */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Equipamiento y Recursos
                </label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {availableResources.map((res, i) => {
                    const isChecked = classroomForm.resources.includes(res);
                    return (
                      <label key={i} className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleResource(res)}
                          className="w-4 h-4 rounded border-zinc-800 bg-zinc-900 accent-violet-500 focus:ring-0 focus:ring-offset-0"
                        />
                        <span>{res}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsClassroomModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  isLoading={isSubmitting}
                >
                  {classroomForm.id ? 'Guardar Cambios' : 'Crear Aula'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
