-- Agregar columnas para planes corporativos de médicos
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS licenses_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS plan_tier text NULL;

-- Comentarios para documentación
COMMENT ON COLUMN public.profiles.licenses_count IS 'Número de licencias disponibles para invitar pacientes (planes médicos)';
COMMENT ON COLUMN public.profiles.plan_tier IS 'Tipo de plan: individual, doctor_basic, doctor_pro';