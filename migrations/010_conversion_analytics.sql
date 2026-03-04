-- ============================================================
-- Migration 010: Conversion Analytics
-- Track affiliate clicks, ad views, and search-to-click funnels
-- ============================================================

CREATE TABLE IF NOT EXISTS click_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,                            -- NULL for anonymous users
    event_type TEXT NOT NULL DEFAULT 'click' CHECK (event_type IN ('click', 'ad_view', 'ad_skip', 'search', 'favorite', 'alert_create')),
    product_title TEXT,
    store TEXT,
    url TEXT,
    search_query TEXT,                       -- What search led to this click
    is_affiliate BOOLEAN DEFAULT false,      -- Was this an affiliate link?
    affiliate_network TEXT,                   -- 'amazon', 'mercadolibre', 'aliexpress', 'skimlinks', 'none'
    device TEXT,                              -- 'mobile', 'desktop', 'tablet'
    referrer TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_click_events_type ON click_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_click_events_store ON click_events(store, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_click_events_affiliate ON click_events(is_affiliate, affiliate_network, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_click_events_user ON click_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_click_events_date ON click_events(created_at DESC);

-- Enable RLS
ALTER TABLE click_events ENABLE ROW LEVEL SECURITY;

-- Only service_role can insert/read (backend only)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'click_events' AND policyname = 'click_events_service_all'
    ) THEN
        CREATE POLICY click_events_service_all ON public.click_events
            FOR ALL USING (auth.role() = 'service_role')
            WITH CHECK (auth.role() = 'service_role');
    END IF;
END $$;
