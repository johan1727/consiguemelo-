-- 006: Webhook Idempotency Table
-- Evita procesar el mismo evento de Stripe más de una vez

CREATE TABLE IF NOT EXISTS webhook_events (
    event_id TEXT PRIMARY KEY,              -- Stripe event ID (evt_xxx)
    event_type TEXT NOT NULL,               -- e.g. checkout.session.completed
    processed_at TIMESTAMPTZ DEFAULT NOW(), -- Cuándo se procesó
    payload JSONB                           -- Payload resumido (opcional, para debug)
);

-- Index para limpieza automática (borrar eventos > 30 días)
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at ON webhook_events (processed_at);

-- RLS: solo el service_role puede insertar/leer (backend únicamente)
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- No policies = solo service_role key puede acceder (lo cual es correcto para webhooks)
