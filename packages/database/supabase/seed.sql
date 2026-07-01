-- 1. Insertar Roles del Sistema
INSERT INTO roles (id, name, description) VALUES
('admin', 'Administrador / Director', 'Gestión global del sistema, usuarios y configuraciones institucionales.'),
('supervisor', 'Supervisor Académico', 'Monitoreo de asistencia de docentes y estudiantes, y validación de justificaciones.'),
('docente', 'Docente Asignado', 'Registro manual de asistencia de estudiantes en sus asignaturas asignadas.'),
('estudiante', 'Estudiante Académico', 'Consulta personal de asistencia y envío de solicitudes de justificación.');

-- 2. Insertar Permisos Clave
INSERT INTO permissions (id, name, description) VALUES
('users:create', 'Crear Usuarios', 'Permite registrar nuevos usuarios en el sistema.'),
('users:read', 'Ver Usuarios', 'Permite listar y ver perfiles de usuarios.'),
('users:update', 'Actualizar Usuarios', 'Permite actualizar datos de usuarios.'),
('users:delete', 'Eliminar Usuarios', 'Permite desactivar o eliminar usuarios.'),
('attendance:take', 'Registrar Asistencia', 'Permite a los docentes registrar asistencia diaria.'),
('attendance:view_all', 'Ver Toda la Asistencia', 'Permite ver registros de asistencia a nivel institucional.'),
('attendance:view_own', 'Ver Asistencia Propia', 'Permite a estudiantes ver sus propios registros.'),
('justifications:submit', 'Solicitar Justificación', 'Permite a estudiantes justificar tardanzas o ausencias.'),
('justifications:review', 'Revisar Justificaciones', 'Permite a supervisores y admins aprobar/rechazar solicitudes.');

-- 3. Mapear Permisos a Roles
-- Admin tiene todos los permisos
INSERT INTO role_permissions (role_id, permission_id) VALUES
('admin', 'users:create'),
('admin', 'users:read'),
('admin', 'users:update'),
('admin', 'users:delete'),
('admin', 'attendance:take'),
('admin', 'attendance:view_all'),
('admin', 'attendance:view_own'),
('admin', 'justifications:submit'),
('admin', 'justifications:review'),
-- Supervisor
('supervisor', 'users:read'),
('supervisor', 'attendance:view_all'),
('supervisor', 'justifications:review'),
-- Docente
('docente', 'users:read'),
('docente', 'attendance:take'),
('docente', 'attendance:view_own'),
('docente', 'justifications:review'),
-- Estudiante
('estudiante', 'attendance:view_own'),
('estudiante', 'justifications:submit');

-- 4. Insertar Departamentos Iniciales
INSERT INTO departments (id, name, code) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Departamento de Ingeniería y Tecnología', 'DIT'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Departamento de Ciencias de la Salud', 'DCS');

-- 5. Insertar Carreras Académicas
INSERT INTO careers (id, department_id, name, code) VALUES
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Ingeniería de Sistemas', 'IS'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Ingeniería Industrial', 'II'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a23', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Medicina Humana', 'MH');

-- 6. Aulas Físicas
INSERT INTO classrooms (id, name, building, capacity) VALUES
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31', 'Laboratorio de Software 302', 'Pabellón B', 40),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a32', 'Aula de Conferencias 101', 'Pabellón A', 60),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'Laboratorio de Anatomía', 'Pabellón C', 30);

-- 7. Períodos Académicos Iniciales
INSERT INTO academic_periods (id, name, start_date, end_date, is_active) VALUES
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a41', 'Ciclo Académico 2026-I', '2026-03-01', '2026-07-15', true),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a42', 'Ciclo Académico 2026-II', '2026-08-01', '2026-12-15', false);
