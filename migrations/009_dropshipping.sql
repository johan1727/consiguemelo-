-- ============================================================
-- Migration 009: Dropshipping Admin Panel Tables
-- Private admin panel for managing dropshipping business
-- ============================================================

-- Products catalog: items you source and resell
CREATE TABLE IF NOT EXISTS dropship_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    source_url TEXT,                       -- AliExpress / supplier URL
    source_store TEXT DEFAULT 'AliExpress', -- Where you buy
    cost_price NUMERIC(10, 2) NOT NULL,    -- Your purchase cost (MXN)
    sell_price NUMERIC(10, 2) NOT NULL,    -- Your selling price (MXN)
    margin_pct NUMERIC(5, 2) GENERATED ALWAYS AS (
        CASE WHEN cost_price > 0 THEN ROUND(((sell_price - cost_price) / cost_price) * 100, 2)
        ELSE 0 END
    ) STORED,
    category TEXT DEFAULT 'General',
    image_url TEXT,
    sku TEXT,
    stock_status TEXT DEFAULT 'in_stock' CHECK (stock_status IN ('in_stock', 'low_stock', 'out_of_stock')),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders tracking
CREATE TABLE IF NOT EXISTS dropship_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES dropship_products(id) ON DELETE SET NULL,
    product_title TEXT NOT NULL,            -- Denormalized for history
    quantity INTEGER DEFAULT 1,
    cost_total NUMERIC(10, 2) NOT NULL,     -- cost_price * quantity
    sell_total NUMERIC(10, 2) NOT NULL,     -- sell_price * quantity
    profit NUMERIC(10, 2) GENERATED ALWAYS AS (sell_total - cost_total) STORED,
    customer_name TEXT,
    customer_contact TEXT,                  -- Phone, email, etc.
    platform TEXT DEFAULT 'Marketplace',    -- Where the sale happened
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'shipped', 'delivered', 'cancelled', 'refunded')),
    tracking_number TEXT,
    supplier_order_id TEXT,                 -- Order ID from your supplier
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_dropship_products_active ON dropship_products(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dropship_orders_status ON dropship_orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dropship_orders_product ON dropship_orders(product_id);
CREATE INDEX IF NOT EXISTS idx_dropship_orders_created ON dropship_orders(created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_dropship_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dropship_products_updated
    BEFORE UPDATE ON dropship_products
    FOR EACH ROW EXECUTE FUNCTION update_dropship_timestamp();

CREATE TRIGGER trg_dropship_orders_updated
    BEFORE UPDATE ON dropship_orders
    FOR EACH ROW EXECUTE FUNCTION update_dropship_timestamp();
