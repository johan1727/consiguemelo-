const supabase = require('../config/supabase');

const MAX_ALERTS_FREE = 3;
const MAX_ALERTS_VIP = 50;

/**
 * GET /api/price-alerts — List user's active alerts
 */
exports.listAlerts = async (req, res) => {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Inicia sesión para usar alertas de precio.' });
    if (!supabase) return res.status(503).json({ error: 'Base de datos no disponible.' });

    try {
        const { data, error } = await supabase
            .from('price_alerts')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ alerts: data || [] });
    } catch (err) {
        console.error('[PriceAlerts] Error listing:', err.message);
        res.status(500).json({ error: 'Error al obtener alertas.' });
    }
};

/**
 * POST /api/price-alerts — Create a new price alert
 * Body: { product_name, target_price, product_url?, store_name? }
 */
exports.createAlert = async (req, res) => {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Inicia sesión para crear alertas de precio.' });
    if (!supabase) return res.status(503).json({ error: 'Base de datos no disponible.' });

    const { product_name, target_price, product_url, store_name } = req.body;

    if (!product_name || typeof product_name !== 'string' || product_name.trim().length < 2) {
        return res.status(400).json({ error: 'Nombre de producto inválido.' });
    }
    if (!target_price || isNaN(target_price) || target_price <= 0) {
        return res.status(400).json({ error: 'Precio meta debe ser mayor a 0.' });
    }

    try {
        // Check plan limits
        const { data: profile } = await supabase.from('profiles').select('plan, is_premium').eq('id', userId).single();
        const isVIP = profile?.is_premium || profile?.plan === 'personal_vip' || profile?.plan === 'b2b';
        const maxAlerts = isVIP ? MAX_ALERTS_VIP : MAX_ALERTS_FREE;

        const { count, error: countErr } = await supabase
            .from('price_alerts')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('triggered', false);

        if (!countErr && count >= maxAlerts) {
            return res.status(402).json({
                error: `Límite de ${maxAlerts} alertas activas alcanzado. ${!isVIP ? 'Hazte VIP para hasta 50 alertas.' : ''}`,
                paywall: !isVIP
            });
        }

        const { data, error } = await supabase
            .from('price_alerts')
            .insert({
                user_id: userId,
                product_name: product_name.trim().slice(0, 200),
                target_price: parseFloat(target_price),
                product_url: product_url ? String(product_url).slice(0, 2000) : null,
                store_name: store_name ? String(store_name).slice(0, 100) : null
            })
            .select()
            .single();

        if (error) throw error;
        res.json({ alert: data, message: '¡Alerta creada! Te avisaremos cuando baje el precio.' });
    } catch (err) {
        console.error('[PriceAlerts] Error creating:', err.message);
        res.status(500).json({ error: 'Error al crear la alerta.' });
    }
};

/**
 * DELETE /api/price-alerts/:id — Delete a price alert
 */
exports.deleteAlert = async (req, res) => {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Inicia sesión para eliminar alertas.' });
    if (!supabase) return res.status(503).json({ error: 'Base de datos no disponible.' });

    const alertId = req.params.id;
    if (!alertId) return res.status(400).json({ error: 'ID de alerta requerido.' });

    try {
        const { error } = await supabase
            .from('price_alerts')
            .delete()
            .eq('id', alertId)
            .eq('user_id', userId);

        if (error) throw error;
        res.json({ message: 'Alerta eliminada.' });
    } catch (err) {
        console.error('[PriceAlerts] Error deleting:', err.message);
        res.status(500).json({ error: 'Error al eliminar la alerta.' });
    }
};

/**
 * POST /api/push-subscribe — Save push subscription
 * Body: { subscription: { endpoint, keys: { p256dh, auth } } }
 */
exports.savePushSubscription = async (req, res) => {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Inicia sesión para activar notificaciones.' });
    if (!supabase) return res.status(503).json({ error: 'Base de datos no disponible.' });

    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return res.status(400).json({ error: 'Suscripción push inválida.' });
    }

    try {
        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({
                user_id: userId,
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth_key: subscription.keys.auth
            }, { onConflict: 'user_id,endpoint' });

        if (error) throw error;
        res.json({ message: 'Notificaciones push activadas.' });
    } catch (err) {
        console.error('[PushSub] Error saving:', err.message);
        res.status(500).json({ error: 'Error al guardar suscripción push.' });
    }
};
