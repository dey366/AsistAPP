-- 1. Crear función SECURITY DEFINER para obtener el tenant_id del usuario actual sin causar recursión RLS
CREATE OR REPLACE FUNCTION public.get_auth_user_tenant()
RETURNS UUID AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- 2. Eliminar las políticas multi-tenant antiguas que generaban recursión infinita
DROP POLICY IF EXISTS tenant_read_own ON tenants;
DROP POLICY IF EXISTS tenant_isolation_users ON users;
DROP POLICY IF EXISTS tenant_isolation_academic_periods ON academic_periods;
DROP POLICY IF EXISTS tenant_isolation_departments ON departments;
DROP POLICY IF EXISTS tenant_isolation_careers ON careers;
DROP POLICY IF EXISTS tenant_isolation_subjects ON subjects;
DROP POLICY IF EXISTS tenant_isolation_classrooms ON classrooms;
DROP POLICY IF EXISTS tenant_isolation_schedules ON schedules;
DROP POLICY IF EXISTS tenant_isolation_attendance_records ON attendance_records;
DROP POLICY IF EXISTS tenant_isolation_justifications ON justifications;
DROP POLICY IF EXISTS tenant_isolation_notifications ON notifications;
DROP POLICY IF EXISTS tenant_isolation_audit_logs ON audit_logs;

-- 3. Crear las nuevas políticas optimizadas que utilizan la función get_auth_user_tenant()

-- tenants
CREATE POLICY tenant_read_own ON tenants
    FOR SELECT USING (
        id = public.get_auth_user_tenant()
    );

-- users
CREATE POLICY tenant_isolation_users ON users
    FOR ALL USING (
        tenant_id = public.get_auth_user_tenant()
    );

-- academic_periods
CREATE POLICY tenant_isolation_academic_periods ON academic_periods
    FOR ALL USING (
        tenant_id = public.get_auth_user_tenant()
    );

-- departments
CREATE POLICY tenant_isolation_departments ON departments
    FOR ALL USING (
        tenant_id = public.get_auth_user_tenant()
    );

-- careers
CREATE POLICY tenant_isolation_careers ON careers
    FOR ALL USING (
        tenant_id = public.get_auth_user_tenant()
    );

-- subjects
CREATE POLICY tenant_isolation_subjects ON subjects
    FOR ALL USING (
        tenant_id = public.get_auth_user_tenant()
    );

-- classrooms
CREATE POLICY tenant_isolation_classrooms ON classrooms
    FOR ALL USING (
        tenant_id = public.get_auth_user_tenant()
    );

-- schedules
CREATE POLICY tenant_isolation_schedules ON schedules
    FOR ALL USING (
        tenant_id = public.get_auth_user_tenant()
    );

-- attendance_records
CREATE POLICY tenant_isolation_attendance_records ON attendance_records
    FOR ALL USING (
        tenant_id = public.get_auth_user_tenant()
    );

-- justifications
CREATE POLICY tenant_isolation_justifications ON justifications
    FOR ALL USING (
        tenant_id = public.get_auth_user_tenant()
    );

-- notifications
CREATE POLICY tenant_isolation_notifications ON notifications
    FOR ALL USING (
        tenant_id = public.get_auth_user_tenant()
    );

-- audit_logs
CREATE POLICY tenant_isolation_audit_logs ON audit_logs
    FOR ALL USING (
        tenant_id = public.get_auth_user_tenant()
    );
