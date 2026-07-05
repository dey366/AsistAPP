-- Migration: 20260520000006_ui_preferences_and_seeds.sql
-- Autor: Senior Full Stack Engineer & Software Architect

-- 1. Agregar columna ui_preferences a la tabla de usuarios con un valor por defecto consistente
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ui_preferences JSONB DEFAULT '{
  "theme": "light",
  "density": "comfortable",
  "dashboardLayout": {
    "widgets": [
      {"id": "asistencia-diaria", "visible": true, "size": "medium", "order": 1},
      {"id": "tardanzas", "visible": true, "size": "small", "order": 2},
      {"id": "carreras", "visible": true, "size": "small", "order": 3},
      {"id": "ausentes", "visible": true, "size": "medium", "order": 4},
      {"id": "aulas-ocupadas", "visible": true, "size": "medium", "order": 5},
      {"id": "actividad-reciente", "visible": true, "size": "large", "order": 6}
    ]
  }
}'::jsonb;

-- 2. Insertar un tenant de prueba institucional
INSERT INTO public.tenants (id, name, subdomain, is_active)
VALUES ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a51', 'Universidad de Deymos', 'deymos', true)
ON CONFLICT (name) DO UPDATE SET is_active = true;

-- 3. Asegurar que los catálogos tengan asignado el tenant_id de prueba para evitar que aparezcan vacíos
UPDATE public.academic_periods SET tenant_id = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a51' WHERE tenant_id IS NULL;
UPDATE public.departments SET tenant_id = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a51' WHERE tenant_id IS NULL;
UPDATE public.careers SET tenant_id = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a51' WHERE tenant_id IS NULL;
UPDATE public.classrooms SET tenant_id = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a51' WHERE tenant_id IS NULL;

