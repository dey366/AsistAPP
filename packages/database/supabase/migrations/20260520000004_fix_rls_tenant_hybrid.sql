-- 1. Eliminar políticas restrictivas anteriores de "FOR ALL" en tablas de catálogos y directorios compartidos
DROP POLICY IF EXISTS tenant_isolation_classrooms ON classrooms;
DROP POLICY IF EXISTS tenant_isolation_academic_periods ON academic_periods;
DROP POLICY IF EXISTS tenant_isolation_departments ON departments;
DROP POLICY IF EXISTS tenant_isolation_careers ON careers;
DROP POLICY IF EXISTS tenant_isolation_subjects ON subjects;

-- =========================================================================
-- 2. Políticas híbridas para CLASSROOMS
-- =========================================================================
CREATE POLICY tenant_isolation_classrooms_select ON classrooms
    FOR SELECT USING (
        tenant_id = public.get_auth_user_tenant() OR tenant_id IS NULL
    );

CREATE POLICY tenant_isolation_classrooms_insert ON classrooms
    FOR INSERT WITH CHECK (
        tenant_id = public.get_auth_user_tenant()
    );

CREATE POLICY tenant_isolation_classrooms_update ON classrooms
    FOR UPDATE USING (
        tenant_id = public.get_auth_user_tenant()
    ) WITH CHECK (
        tenant_id = public.get_auth_user_tenant()
    );

CREATE POLICY tenant_isolation_classrooms_delete ON classrooms
    FOR DELETE USING (
        tenant_id = public.get_auth_user_tenant()
    );


-- =========================================================================
-- 3. Políticas híbridas para ACADEMIC_PERIODS
-- =========================================================================
CREATE POLICY tenant_isolation_academic_periods_select ON academic_periods
    FOR SELECT USING (
        tenant_id = public.get_auth_user_tenant() OR tenant_id IS NULL
    );

CREATE POLICY tenant_isolation_academic_periods_insert ON academic_periods
    FOR INSERT WITH CHECK (
        tenant_id = public.get_auth_user_tenant()
    );

CREATE POLICY tenant_isolation_academic_periods_update ON academic_periods
    FOR UPDATE USING (
        tenant_id = public.get_auth_user_tenant()
    ) WITH CHECK (
        tenant_id = public.get_auth_user_tenant()
    );

CREATE POLICY tenant_isolation_academic_periods_delete ON academic_periods
    FOR DELETE USING (
        tenant_id = public.get_auth_user_tenant()
    );


-- =========================================================================
-- 4. Políticas híbridas para DEPARTMENTS
-- =========================================================================
CREATE POLICY tenant_isolation_departments_select ON departments
    FOR SELECT USING (
        tenant_id = public.get_auth_user_tenant() OR tenant_id IS NULL
    );

CREATE POLICY tenant_isolation_departments_insert ON departments
    FOR INSERT WITH CHECK (
        tenant_id = public.get_auth_user_tenant()
    );

CREATE POLICY tenant_isolation_departments_update ON departments
    FOR UPDATE USING (
        tenant_id = public.get_auth_user_tenant()
    ) WITH CHECK (
        tenant_id = public.get_auth_user_tenant()
    );

CREATE POLICY tenant_isolation_departments_delete ON departments
    FOR DELETE USING (
        tenant_id = public.get_auth_user_tenant()
    );


-- =========================================================================
-- 5. Políticas híbridas para CAREERS
-- =========================================================================
CREATE POLICY tenant_isolation_careers_select ON careers
    FOR SELECT USING (
        tenant_id = public.get_auth_user_tenant() OR tenant_id IS NULL
    );

CREATE POLICY tenant_isolation_careers_insert ON careers
    FOR INSERT WITH CHECK (
        tenant_id = public.get_auth_user_tenant()
    );

CREATE POLICY tenant_isolation_careers_update ON careers
    FOR UPDATE USING (
        tenant_id = public.get_auth_user_tenant()
    ) WITH CHECK (
        tenant_id = public.get_auth_user_tenant()
    );

CREATE POLICY tenant_isolation_careers_delete ON careers
    FOR DELETE USING (
        tenant_id = public.get_auth_user_tenant()
    );


-- =========================================================================
-- 6. Políticas híbridas para SUBJECTS
-- =========================================================================
CREATE POLICY tenant_isolation_subjects_select ON subjects
    FOR SELECT USING (
        tenant_id = public.get_auth_user_tenant() OR tenant_id IS NULL
    );

CREATE POLICY tenant_isolation_subjects_insert ON subjects
    FOR INSERT WITH CHECK (
        tenant_id = public.get_auth_user_tenant()
    );

CREATE POLICY tenant_isolation_subjects_update ON subjects
    FOR UPDATE USING (
        tenant_id = public.get_auth_user_tenant()
    ) WITH CHECK (
        tenant_id = public.get_auth_user_tenant()
    );

CREATE POLICY tenant_isolation_subjects_delete ON subjects
    FOR DELETE USING (
        tenant_id = public.get_auth_user_tenant()
    );
