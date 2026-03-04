-- 007_price_history.sql
-- Historial de precios por producto para mostrar tendencia en resultados

CREATE TABLE IF NOT EXISTS public.price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_key text NOT NULL,
  normalized_url text NOT NULL,
  product_title text,
  store_name text,
  price numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_price_history_query_url_date
  ON public.price_history(query_key, normalized_url, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_history_created
  ON public.price_history(created_at DESC);

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'price_history'
      AND policyname = 'price_history_service_role_all'
  ) THEN
    CREATE POLICY price_history_service_role_all
      ON public.price_history
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- Limpieza de datos viejos (90 días)
CREATE OR REPLACE FUNCTION cleanup_price_history()
RETURNS void AS $$
BEGIN
  DELETE FROM public.price_history
  WHERE created_at < now() - interval '90 days';
END;
$$ LANGUAGE plpgsql;
