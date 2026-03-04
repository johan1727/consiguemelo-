-- 005_production_hardening.sql
-- Production-ready: constraints, indices, RLS, maintenance and RAG function
-- Safe to run multiple times (idempotent)

-- ============================================
-- 0) TABLE BOOTSTRAP (feedback + extension)
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  query text,
  response text,
  vote integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT feedback_pkey PRIMARY KEY (id),
  CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'feedback' AND column_name = 'query'
  ) THEN
    ALTER TABLE public.feedback ADD COLUMN query text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'feedback' AND column_name = 'response'
  ) THEN
    ALTER TABLE public.feedback ADD COLUMN response text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'feedback' AND column_name = 'vote'
  ) THEN
    ALTER TABLE public.feedback ADD COLUMN vote integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'feedback' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.feedback ADD COLUMN created_at timestamp with time zone DEFAULT timezone('utc'::text, now());
  END IF;
END $$;

-- ============================================
-- 1) CONSTRAINTS
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_plan_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_plan_check
      CHECK (plan IN ('free', 'personal_vip', 'b2b'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_amount_check'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_amount_check
      CHECK (amount_paid >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_stripe_unique'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_stripe_unique
      UNIQUE (stripe_subscription_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'favorites_unique_product'
  ) THEN
    ALTER TABLE public.favorites
      ADD CONSTRAINT favorites_unique_product
      UNIQUE (user_id, product_url);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feedback_vote_check'
  ) THEN
    ALTER TABLE public.feedback
      ADD CONSTRAINT feedback_vote_check
      CHECK (vote IN (-1, 0, 1));
  END IF;
END $$;

-- ============================================
-- 2) INDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_searches_user_date
  ON public.searches(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_created
  ON public.rate_limits(ip, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_cache_created
  ON public.search_cache(created_at);

CREATE INDEX IF NOT EXISTS idx_feedback_user_created
  ON public.feedback(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_favorites_user_created
  ON public.favorites(user_id, created_at DESC);

-- NOTE: ivfflat works better when table has enough rows.
-- Keep it manual to avoid noisy failures on fresh DBs.
-- CREATE INDEX IF NOT EXISTS idx_ai_memory_embedding
--   ON public.ai_memory
--   USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);

-- ============================================
-- 3) RLS + POLICIES
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'profiles_own_select' AND tablename = 'profiles'
  ) THEN
    CREATE POLICY profiles_own_select ON public.profiles
      FOR SELECT USING (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'profiles_own_update' AND tablename = 'profiles'
  ) THEN
    CREATE POLICY profiles_own_update ON public.profiles
      FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'profiles_own_insert' AND tablename = 'profiles'
  ) THEN
    CREATE POLICY profiles_own_insert ON public.profiles
      FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'searches_own_select' AND tablename = 'searches'
  ) THEN
    CREATE POLICY searches_own_select ON public.searches
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'searches_own_insert' AND tablename = 'searches'
  ) THEN
    CREATE POLICY searches_own_insert ON public.searches
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'searches_own_delete' AND tablename = 'searches'
  ) THEN
    CREATE POLICY searches_own_delete ON public.searches
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'favorites_own_all' AND tablename = 'favorites'
  ) THEN
    CREATE POLICY favorites_own_all ON public.favorites
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'feedback_insert_auth' AND tablename = 'feedback'
  ) THEN
    CREATE POLICY feedback_insert_auth ON public.feedback
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'feedback_own_select' AND tablename = 'feedback'
  ) THEN
    CREATE POLICY feedback_own_select ON public.feedback
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'subscriptions_own_select' AND tablename = 'subscriptions'
  ) THEN
    CREATE POLICY subscriptions_own_select ON public.subscriptions
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================
-- 4) CLEANUP FUNCTIONS
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM public.rate_limits
  WHERE created_at < NOW() - INTERVAL '1 hour';
$$;

CREATE OR REPLACE FUNCTION cleanup_search_cache()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM public.search_cache
  WHERE created_at < NOW() - INTERVAL '6 hours';
$$;

-- ============================================
-- 5) RAG FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION match_ai_memory(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id bigint,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    am.id,
    am.content,
    1 - (am.embedding <=> query_embedding) AS similarity
  FROM public.ai_memory am
  WHERE 1 - (am.embedding <=> query_embedding) > match_threshold
  ORDER BY am.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================
-- 6) SCHEDULED JOBS (requires pg_cron)
-- ============================================
-- Uncomment these if pg_cron is enabled in your Supabase project:
-- SELECT cron.schedule('cleanup-rate-limits', '*/15 * * * *', 'SELECT cleanup_rate_limits()');
-- SELECT cron.schedule('cleanup-search-cache', '0 */2 * * *', 'SELECT cleanup_search_cache()');
