const supabase = require('../config/supabase');

function checkDb(res) {
    if (!supabase) { res.status(503).json({ error: 'Base de datos no disponible' }); return false; }
    return true;
}

// ============================================================
// Dropship Products CRUD
// ============================================================

async function listProducts(req, res) {
    if (!checkDb(res)) return;
    try {
        const { active, category, search } = req.query;
        let query = supabase.from('dropship_products').select('*').order('created_at', { ascending: false });

        if (active !== undefined) query = query.eq('is_active', active === 'true');
        if (category && category !== 'all') query = query.eq('category', category);
        if (search) query = query.ilike('title', `%${search}%`);

        const { data, error } = await query;
        if (error) throw error;
        res.json({ products: data || [] });
    } catch (err) {
        console.error('[Dropship] listProducts error:', err);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
}

async function createProduct(req, res) {
    if (!checkDb(res)) return;
    try {
        const { title, source_url, source_store, cost_price, sell_price, category, image_url, sku, notes } = req.body;
        if (!title || cost_price == null || sell_price == null) {
            return res.status(400).json({ error: 'title, cost_price y sell_price son requeridos' });
        }
        const { data, error } = await supabase.from('dropship_products').insert({
            title, source_url, source_store: source_store || 'AliExpress',
            cost_price: parseFloat(cost_price), sell_price: parseFloat(sell_price),
            category: category || 'General', image_url, sku, notes
        }).select().single();
        if (error) throw error;
        res.status(201).json({ product: data });
    } catch (err) {
        console.error('[Dropship] createProduct error:', err);
        res.status(500).json({ error: 'Error al crear producto' });
    }
}

async function updateProduct(req, res) {
    if (!checkDb(res)) return;
    try {
        const { id } = req.params;
        const updates = {};
        const allowed = ['title', 'source_url', 'source_store', 'cost_price', 'sell_price', 'category', 'image_url', 'sku', 'stock_status', 'notes', 'is_active'];
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                updates[key] = ['cost_price', 'sell_price'].includes(key) ? parseFloat(req.body[key]) : req.body[key];
            }
        }
        if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No hay campos para actualizar' });

        const { data, error } = await supabase.from('dropship_products').update(updates).eq('id', id).select().single();
        if (error) throw error;
        res.json({ product: data });
    } catch (err) {
        console.error('[Dropship] updateProduct error:', err);
        res.status(500).json({ error: 'Error al actualizar producto' });
    }
}

async function deleteProduct(req, res) {
    if (!checkDb(res)) return;
    try {
        const { id } = req.params;
        const { error } = await supabase.from('dropship_products').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('[Dropship] deleteProduct error:', err);
        res.status(500).json({ error: 'Error al eliminar producto' });
    }
}

// ============================================================
// Dropship Orders CRUD
// ============================================================

async function listOrders(req, res) {
    if (!checkDb(res)) return;
    try {
        const { status, limit } = req.query;
        let query = supabase.from('dropship_orders').select('*').order('created_at', { ascending: false });
        if (status && status !== 'all') query = query.eq('status', status);
        const parsedLimit = parseInt(limit);
        if (!isNaN(parsedLimit) && parsedLimit > 0) query = query.limit(parsedLimit);

        const { data, error } = await query;
        if (error) throw error;
        res.json({ orders: data || [] });
    } catch (err) {
        console.error('[Dropship] listOrders error:', err);
        res.status(500).json({ error: 'Error al obtener pedidos' });
    }
}

async function createOrder(req, res) {
    if (!checkDb(res)) return;
    try {
        const { product_id, product_title, quantity, cost_total, sell_total, customer_name, customer_contact, platform, notes } = req.body;
        if (!product_title || cost_total == null || sell_total == null) {
            return res.status(400).json({ error: 'product_title, cost_total y sell_total son requeridos' });
        }
        const { data, error } = await supabase.from('dropship_orders').insert({
            product_id, product_title,
            quantity: parseInt(quantity) || 1,
            cost_total: parseFloat(cost_total),
            sell_total: parseFloat(sell_total),
            customer_name, customer_contact,
            platform: platform || 'Marketplace', notes
        }).select().single();
        if (error) throw error;
        res.status(201).json({ order: data });
    } catch (err) {
        console.error('[Dropship] createOrder error:', err);
        res.status(500).json({ error: 'Error al crear pedido' });
    }
}

async function updateOrder(req, res) {
    if (!checkDb(res)) return;
    try {
        const { id } = req.params;
        const updates = {};
        const allowed = ['status', 'tracking_number', 'supplier_order_id', 'customer_name', 'customer_contact', 'notes', 'quantity', 'cost_total', 'sell_total'];
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                updates[key] = ['quantity'].includes(key) ? parseInt(req.body[key]) :
                    ['cost_total', 'sell_total'].includes(key) ? parseFloat(req.body[key]) : req.body[key];
            }
        }
        if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No hay campos para actualizar' });

        const { data, error } = await supabase.from('dropship_orders').update(updates).eq('id', id).select().single();
        if (error) throw error;
        res.json({ order: data });
    } catch (err) {
        console.error('[Dropship] updateOrder error:', err);
        res.status(500).json({ error: 'Error al actualizar pedido' });
    }
}

// ============================================================
// Dashboard Stats
// ============================================================

async function getStats(req, res) {
    if (!checkDb(res)) return;
    try {
        const { period } = req.query; // 'week', 'month', 'all'
        let dateFilter = null;
        const now = new Date();
        if (period === 'week') {
            dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        } else if (period === 'month') {
            dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        }

        // Products summary
        const { data: products } = await supabase.from('dropship_products').select('id, is_active, stock_status');
        const totalProducts = products?.length || 0;
        const activeProducts = products?.filter(p => p.is_active).length || 0;
        const lowStock = products?.filter(p => p.stock_status === 'low_stock').length || 0;

        // Orders
        let ordersQuery = supabase.from('dropship_orders').select('*').order('created_at', { ascending: false });
        if (dateFilter) ordersQuery = ordersQuery.gte('created_at', dateFilter);
        const { data: orders } = await ordersQuery;

        const totalOrders = orders?.length || 0;
        const completedOrders = orders?.filter(o => o.status === 'delivered').length || 0;
        const pendingOrders = orders?.filter(o => ['pending', 'ordered', 'shipped'].includes(o.status)).length || 0;
        const cancelledOrders = orders?.filter(o => ['cancelled', 'refunded'].includes(o.status)).length || 0;

        const totalRevenue = orders?.reduce((sum, o) => sum + parseFloat(o.sell_total || 0), 0) || 0;
        const totalCost = orders?.reduce((sum, o) => sum + parseFloat(o.cost_total || 0), 0) || 0;
        const totalProfit = totalRevenue - totalCost;
        const avgMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;

        // Top products by revenue
        const productRevenue = {};
        (orders || []).forEach(o => {
            if (!productRevenue[o.product_title]) {
                productRevenue[o.product_title] = { title: o.product_title, revenue: 0, orders: 0, profit: 0 };
            }
            productRevenue[o.product_title].revenue += parseFloat(o.sell_total || 0);
            productRevenue[o.product_title].profit += parseFloat(o.sell_total || 0) - parseFloat(o.cost_total || 0);
            productRevenue[o.product_title].orders += 1;
        });
        const topProducts = Object.values(productRevenue).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

        // Recent orders
        const recentOrders = (orders || []).slice(0, 10);

        res.json({
            summary: {
                totalProducts, activeProducts, lowStock,
                totalOrders, completedOrders, pendingOrders, cancelledOrders,
                totalRevenue: totalRevenue.toFixed(2),
                totalCost: totalCost.toFixed(2),
                totalProfit: totalProfit.toFixed(2),
                avgMargin
            },
            topProducts,
            recentOrders
        });
    } catch (err) {
        console.error('[Dropship] getStats error:', err);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
}

module.exports = {
    listProducts, createProduct, updateProduct, deleteProduct,
    listOrders, createOrder, updateOrder,
    getStats
};
