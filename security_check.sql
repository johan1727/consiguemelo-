-- SCRIPT DE AUDITORÍA Y SEGURIDAD (Supabase RLS)
-- Este script asegura que los datos personales de los usuarios estén blindados.

-- 1. Activar RLS en todas las tablas sensibles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas inseguras públicas previas (si existen)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

-- 3. Crear Políticas Estrictas: Los usuarios SOLO pueden leer/escribir SUS PROPIOS datos

-- Para PROFILES
CREATE POLICY "Usuarios pueden ver su propio perfil" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Usuarios pueden actualizar su propio perfil" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Para SEARCHES (Historial)
CREATE POLICY "Nadie lee el historial de otros" ON public.searches
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden insertar sus búsquedas" ON public.searches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Para FAVORITES
CREATE POLICY "Nadie lee los favoritos de otros" ON public.favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios manejan sus propios favoritos" ON public.favorites
  FOR ALL USING (auth.uid() = user_id);

-- Para FEEDBACK (RAG)
-- Insertar feedback es público para todos (incluso sin login por la versión Freemium)
CREATE POLICY "Inyección de Feedback RAG Público" ON public.feedback
  FOR INSERT WITH CHECK (true); 

-- Pero la lectura es exclusiva para el Servidor/Admin (no crear política SELECT para public)
