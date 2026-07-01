-- Migration: 20260520000007_saas_configurations.sql
-- Autor: Senior Full Stack Engineer & Software Architect
-- Propósito: Implementar soporte de tolerancia dinámica, días feriados inhábiles y configuraciones de alertas de inasistencia

-- 1. Tabla de Políticas de Tolerancia Dinámicas
CREATE TABLE IF NOT EXISTS public.tolerance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('global', 'career', 'subject')),
    career_id UUID REFERENCES public.careers(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    tolerance_minutes INT NOT NULL DEFAULT 10,
    absent_minutes INT NOT NULL DEFAULT 15,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_scope_target UNIQUE (tenant_id, scope, career_id, subject_id)
);

-- Habilitar RLS en tolerance_policies
ALTER TABLE public.tolerance_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_tolerance_policies ON public.tolerance_policies;

CREATE POLICY tenant_isolation_tolerance_policies ON public.tolerance_policies
    FOR ALL USING (
        tenant_id = public.get_auth_user_tenant()
    );

-- 2. Tabla de Calendario de Días Feriados e Inhábiles
CREATE TABLE IF NOT EXISTS public.holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    name VARCHAR(150) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_tenant_holiday_date UNIQUE (tenant_id, date)
);

-- Habilitar RLS en holidays
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_holidays ON public.holidays;

CREATE POLICY tenant_isolation_holidays ON public.holidays
    FOR ALL USING (
        tenant_id = public.get_auth_user_tenant()
    );

-- 3. Tabla de Configuración de Alertas SaaS (Tenant Settings)
CREATE TABLE IF NOT EXISTS public.tenant_settings (
    tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    unexcused_absence_threshold_percent DECIMAL NOT NULL DEFAULT 20.0,
    enable_email_alerts BOOLEAN NOT NULL DEFAULT true,
    alert_recipients TEXT[] DEFAULT '{}'::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en tenant_settings
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_tenant_settings ON public.tenant_settings;

CREATE POLICY tenant_isolation_tenant_settings ON public.tenant_settings
    FOR ALL USING (
        tenant_id = public.get_auth_user_tenant()
    );

-- 4. Trigger procedimental para congelar la toma de asistencia en días feriados
CREATE OR REPLACE FUNCTION public.validate_attendance_date_holiday()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.holidays 
    WHERE holidays.tenant_id = NEW.tenant_id AND holidays.date = NEW.date
  ) THEN
    RAISE EXCEPTION 'La toma de asistencia está congelada en esta fecha por ser un día feriado o inhábil institucional.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger si ya existiera
DROP TRIGGER IF EXISTS check_holiday_before_attendance ON public.attendance_records;

CREATE TRIGGER check_holiday_before_attendance
  BEFORE INSERT OR UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.validate_attendance_date_holiday();

-- 5. Sembrar datos por defecto para las configuraciones y políticas de prueba
-- Insertar configuración inicial del tenant Universidad de Deymos
INSERT INTO public.tenant_settings (tenant_id, unexcused_absence_threshold_percent, enable_email_alerts, alert_recipients)
VALUES ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a51', 20.0, true, ARRAY['coordinacion@deymos.edu', 'supervision@deymos.edu'])
ON CONFLICT (tenant_id) DO NOTHING;

-- Insertar una política de tolerancia global por defecto (10min tolerancia, 15min falta)
INSERT INTO public.tolerance_policies (tenant_id, scope, tolerance_minutes, absent_minutes)
VALUES ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a51', 'global', 10, 15)
ON CONFLICT (tenant_id, scope, career_id, subject_id) DO NOTHING;

-- Insertar una política de tolerancia por carrera (Ing. Sistemas - DIT) con 5min tolerancia y 10min falta
INSERT INTO public.tolerance_policies (tenant_id, scope, career_id, tolerance_minutes, absent_minutes)
VALUES ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a51', 'career', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 5, 10)
ON CONFLICT (tenant_id, scope, career_id, subject_id) DO NOTHING;

-- Sembrar un día feriado mañana para demostración y congelamiento
INSERT INTO public.holidays (tenant_id, date, name)
VALUES ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a51', CURRENT_DATE + INTERVAL '1 day', 'Aniversario de la Institución')
ON CONFLICT (tenant_id, date) DO NOTHING;
