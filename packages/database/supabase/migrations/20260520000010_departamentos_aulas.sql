-- Migración para añadir soporte a las ideas A, B y D en el esquema de base de datos.
-- Esto agrega el coordinador al departamento, y las columnas adicionales para aulas.

-- 1. Asegurar que las columnas existen en classrooms
ALTER TABLE public.classrooms 
ADD COLUMN IF NOT EXISTS floor TEXT,
ADD COLUMN IF NOT EXISTS resources TEXT[],
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Asegurar que la columna del coordinador existe en departments
-- Importante: Referencia a la tabla `users` (tu tabla de perfiles), NO `profiles`
ALTER TABLE public.departments 
ADD COLUMN IF NOT EXISTS coordinator_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
