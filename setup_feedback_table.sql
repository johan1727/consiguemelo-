-- SQL Script para habilitar feedback de Usuarios en Supabase
-- Ejecuta esto directamente en la pestaña "SQL Editor" de tu proyecto en Supabase.

-- 1. Crear la tabla de retroalimentación (si no existe)
CREATE TABLE IF NOT EXISTS public.feedback (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    query text NOT NULL,
    response text NOT NULL,
    vote integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- 3. Política: usuarios solo ven su propio feedback
CREATE POLICY "Users can view their own feedback" ON public.feedback
    FOR SELECT USING (auth.uid() = user_id);

-- 4. Política: usuarios solo insertan su propio feedback
CREATE POLICY "Users can insert their own feedback" ON public.feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id, created_at DESC);

-- 3. Crear política para que cualquier usuario pueda insertar feedback
CREATE POLICY "Enable insert for all users" ON public.feedback
    FOR INSERT WITH CHECK (true);

-- 4. Crear política para que usuarios solo puedan leer su propio feedback (opcional)
CREATE POLICY "Enable read access for users based on user_id" ON public.feedback
    FOR SELECT USING (auth.uid() = user_id);
