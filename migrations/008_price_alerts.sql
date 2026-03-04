-- 008_price_alerts.sql
-- Server-side price alerts: users set a target price, cron checks daily

CREATE TABLE IF NOT EXISTS public.price_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  target_price numeric(12,2) NOT NULL,
  product_url text,                 -- Optional: track a specific URL
  store_name text,                  -- Optional: specific store
  last_checked_at timestamptz,
  last_price numeric(12,2),         -- Last price found by cron
  triggered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_user
  ON public.price_alerts(user_id);

CREATE INDEX IF NOT EXISTS idx_price_alerts_active
  ON public.price_alerts(triggered, last_checked_at)
  WHERE triggered = false;

ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own alerts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'price_alerts' AND policyname = 'price_alerts_user_select'
  ) THEN
    CREATE POLICY price_alerts_user_select ON public.price_alerts
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'price_alerts' AND policyname = 'price_alerts_user_insert'
  ) THEN
    CREATE POLICY price_alerts_user_insert ON public.price_alerts
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'price_alerts' AND policyname = 'price_alerts_user_delete'
  ) THEN
    CREATE POLICY price_alerts_user_delete ON public.price_alerts
      FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- Service role can do everything (for cron jobs)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'price_alerts' AND policyname = 'price_alerts_service_all'
  ) THEN
    CREATE POLICY price_alerts_service_all ON public.price_alerts
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- Push notification subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user
  ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'push_subscriptions' AND policyname = 'push_subs_user_manage'
  ) THEN
    CREATE POLICY push_subs_user_manage ON public.push_subscriptions
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'push_subscriptions' AND policyname = 'push_subs_service_all'
  ) THEN
    CREATE POLICY push_subs_service_all ON public.push_subscriptions
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
