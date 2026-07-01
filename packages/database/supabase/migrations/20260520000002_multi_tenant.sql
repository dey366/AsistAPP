-- 1. Tabla de Tenants
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL UNIQUE,
    subdomain VARCHAR(100) UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- 2. Modificaciones de tablas existentes para incluir tenant_id
ALTER TABLE users ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE academic_periods ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE departments ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE careers ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE subjects ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE classrooms ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE schedules ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE attendance_records ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE justifications ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE audit_logs ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

-- 3. Actualizar la función trigger handle_new_user para capturar tenant_id de auth.users metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, first_name, last_name, role_id, is_active, tenant_id)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'first_name', 'Nuevo'),
    COALESCE(new.raw_user_meta_data->>'last_name', 'Usuario'),
    COALESCE(new.raw_user_meta_data->>'role_id', 'estudiante'),
    true,
    (new.raw_user_meta_data->>'tenant_id')::uuid
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Definición de Políticas RLS para Aislamiento de Tenants
-- Politicas RLS para la tabla tenants
CREATE POLICY tenant_read_own ON tenants
    FOR SELECT USING (
        id = (SELECT tenant_id FROM users WHERE users.id = auth.uid())
    );

-- Políticas RLS para users
DROP POLICY IF EXISTS user_read_own ON users;
DROP POLICY IF EXISTS user_update_own ON users;
DROP POLICY IF EXISTS admin_manage_users ON users;

CREATE POLICY tenant_isolation_users ON users
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

-- Políticas RLS para academic_periods
ALTER TABLE academic_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_academic_periods ON academic_periods
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

-- Políticas RLS para departments
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_departments ON departments
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

-- Políticas RLS para careers
ALTER TABLE careers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_careers ON careers
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

-- Políticas RLS para subjects
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_subjects ON subjects
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

-- Políticas RLS para classrooms
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_classrooms ON classrooms
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

-- Políticas RLS para schedules
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_schedules ON schedules
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

-- Políticas RLS para attendance_records
DROP POLICY IF EXISTS student_view_own_attendance ON attendance_records;
DROP POLICY IF EXISTS teacher_manage_attendance ON attendance_records;
DROP POLICY IF EXISTS supervisor_view_attendance ON attendance_records;
DROP POLICY IF EXISTS admin_manage_attendance ON attendance_records;

CREATE POLICY tenant_isolation_attendance_records ON attendance_records
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

-- Políticas RLS para justifications
DROP POLICY IF EXISTS read_own_justifications ON justifications;
DROP POLICY IF EXISTS update_own_justifications ON justifications;

CREATE POLICY tenant_isolation_justifications ON justifications
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

-- Políticas RLS para notifications
DROP POLICY IF EXISTS read_own_notifications ON notifications;
DROP POLICY IF EXISTS update_own_notifications ON notifications;

CREATE POLICY tenant_isolation_notifications ON notifications
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

-- Políticas RLS para audit_logs
DROP POLICY IF EXISTS audit_logs_read_own ON audit_logs;

CREATE POLICY tenant_isolation_audit_logs ON audit_logs
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );
