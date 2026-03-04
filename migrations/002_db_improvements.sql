-- 002_db_improvements.sql
-- Optimizaciones y constraints recomendadas para producción

-- 1. Evitar favoritos duplicados (mismo usuario guardando la misma URL)
ALTER TABLE public.favorites ADD CONSTRAINT favorites_unique_product 
  UNIQUE (user_id, product_url);

-- 2. Índice para buscar el historial de búsquedas del usuario rápidamente (para el paywall)
CREATE INDEX IF NOT EXISTS idx_searches_user_date ON public.searches(user_id, created_at DESC);

-- 3. (OPCIONAL EN ESTE SCRIPT) Eliminar columna search_count. 
-- Es mejor dejar que sea calculada dinámicamente con COUNT().
-- ALTER TABLE public.profiles DROP COLUMN search_count;
