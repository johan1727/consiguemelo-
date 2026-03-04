-- Migración: Agregar columna 'plan' a la tabla 'profiles'
-- Fase H: Plan B2B Reseller

-- 1. Agregar la columna si no existe
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';

-- 2. Actualizar perfiles existentes que ya son premium
UPDATE profiles SET plan = 'personal_vip' WHERE is_premium = true AND plan = 'free';

-- 3. Crear índice para búsquedas rápidas por plan
CREATE INDEX IF NOT EXISTS idx_profiles_plan ON profiles(plan);
