-- Migration: 20260520000008_customizable_users.sql
-- Autor: Senior Full Stack Engineer & Software Architect
-- Objetivo: Actualizar el trigger handle_new_user para sincronizar automáticamente career_id, avatar_url, ui_preferences y tenant_id.

-- 1. Actualizar la función handle_new_user con los campos adicionales de personalización
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (
    id, 
    email, 
    first_name, 
    last_name, 
    role_id, 
    career_id, 
    avatar_url, 
    ui_preferences, 
    is_active,
    tenant_id
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'first_name', 'Nuevo'),
    COALESCE(new.raw_user_meta_data->>'last_name', 'Usuario'),
    COALESCE(new.raw_user_meta_data->>'role_id', 'estudiante'),
    (new.raw_user_meta_data->>'career_id')::uuid,
    new.raw_user_meta_data->>'avatar_url',
    COALESCE((new.raw_user_meta_data->'ui_preferences'), '{}'::jsonb),
    true,
    (new.raw_user_meta_data->>'tenant_id')::uuid
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Asegurarse de que el trigger esté re-creado de forma íntegra
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
