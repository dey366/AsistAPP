-- Migration: 20260520000005_schedule_conflicts.sql
-- Autor: Senior Full Stack Engineer & Software Architect

-- 1. Función para validar solapamientos de horarios antes de insertar o actualizar
CREATE OR REPLACE FUNCTION public.validate_schedule_conflicts()
RETURNS trigger AS $$
DECLARE
    conflict_classroom RECORD;
    conflict_teacher RECORD;
BEGIN
    -- Validar que la hora de inicio sea menor que la hora de fin
    IF NEW.start_time >= NEW.end_time THEN
        RAISE EXCEPTION 'La hora de inicio debe ser menor que la hora de fin.';
    END IF;

    -- A. Conflicto de AULA ocupada en el mismo día y rango de horas
    SELECT s.id, c.name AS classroom_name, sub.name AS subject_name
    INTO conflict_classroom
    FROM public.schedules s
    JOIN public.classrooms c ON s.classroom_id = c.id
    JOIN public.subjects sub ON s.subject_id = sub.id
    WHERE s.classroom_id = NEW.classroom_id
      AND s.day_of_week = NEW.day_of_week
      AND s.academic_period_id = NEW.academic_period_id
      AND s.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      -- Condición de Overlap: Start1 < End2 AND Start2 < End1
      AND s.start_time < NEW.end_time
      AND NEW.start_time < s.end_time
    LIMIT 1;

    IF conflict_classroom.id IS NOT NULL THEN
        RAISE EXCEPTION 'Aula ocupada en este horario. Conflicto con la clase: %', conflict_classroom.subject_name;
    END IF;

    -- B. Conflicto de DOCENTE con clases simultáneas
    SELECT s.id, u.first_name, u.last_name, sub.name AS subject_name
    INTO conflict_teacher
    FROM public.schedules s
    JOIN public.users u ON s.teacher_id = u.id
    JOIN public.subjects sub ON s.subject_id = sub.id
    WHERE s.teacher_id = NEW.teacher_id
      AND s.day_of_week = NEW.day_of_week
      AND s.academic_period_id = NEW.academic_period_id
      AND s.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND s.start_time < NEW.end_time
      AND NEW.start_time < s.end_time
    LIMIT 1;

    IF conflict_teacher.id IS NOT NULL THEN
        RAISE EXCEPTION 'El docente ya tiene una clase asignada en este horario: %', conflict_teacher.subject_name;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Crear Trigger en public.schedules
DROP TRIGGER IF EXISTS trigger_validate_schedule_conflicts ON public.schedules;
CREATE TRIGGER trigger_validate_schedule_conflicts
    BEFORE INSERT OR UPDATE ON public.schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_schedule_conflicts();
