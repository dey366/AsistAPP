-- Agregar columnas semester y academic_year a la tabla subjects
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS semester VARCHAR(10);
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20);

-- Establecer valores predeterminados para asegurar la compatibilidad con registros existentes
UPDATE public.subjects SET semester = 'I' WHERE semester IS NULL;
UPDATE public.subjects SET academic_year = '1er Año' WHERE academic_year IS NULL;
