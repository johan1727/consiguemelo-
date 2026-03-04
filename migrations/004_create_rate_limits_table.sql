-- Migración: Crear tabla rate_limits para Rate Limiter Serverless-safe
-- Compatible con Vercel (no depende de RAM del proceso)

CREATE TABLE IF NOT EXISTS rate_limits (
    id BIGSERIAL PRIMARY KEY,
    ip TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para búsquedas rápidas por IP y tiempo
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_time ON rate_limits(ip, created_at DESC);

-- Row Level Security: solo el service_role puede insertar/leer
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Política: solo el service role puede acceder (backend privado)
CREATE POLICY "Service role only" ON rate_limits
    FOR ALL USING (false);

-- Auto-limpieza: función para borrar registros > 1 hora
CREATE OR REPLACE FUNCTION clean_old_rate_limits()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM rate_limits WHERE created_at < NOW() - INTERVAL '1 hour';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: limpiar al insertar nuevo registro (una de cada 100 veces)
-- Para no hacer limpieza en cada petición
CREATE OR REPLACE TRIGGER trigger_clean_rate_limits
AFTER INSERT ON rate_limits
FOR EACH ROW
EXECUTE PROCEDURE clean_old_rate_limits();
