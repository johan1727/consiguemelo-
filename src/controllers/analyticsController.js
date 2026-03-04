const supabase = require('../config/supabase');

/**
 * POST /api/track — Log a conversion event (click, ad_view, etc.)
 * Lightweight, fire-and-forget from frontend.
 */
async function trackEvent(req, res) {
    try {
        const { event_type, product_title, store, url, search_query, device } = req.body;

        if (!event_type) {
            return res.status(400).json({ error: 'event_type requerido' });
        }

        // Determine affiliate network from URL
        let is_affiliate = false;
        let affiliate_network = 'none';
        if (url) {
            const urlLower = url.toLowerCase();
            if (urlLower.includes('amazon') && urlLower.includes('tag=')) {
                is_affiliate = true;
                affiliate_network = 'amazon';
            } else if ((urlLower.includes('mercadolibre') || urlLower.includes('mercadoli')) && urlLower.includes('re_id=')) {
                is_affiliate = true;
                affiliate_network = 'mercadolibre';
            } else if (urlLower.includes('aliexpress') && urlLower.includes('aff_short_key=')) {
                is_affiliate = true;
                affiliate_network = 'aliexpress';
            } else if (urlLower.includes('go.skimresources') || urlLower.includes('redirect.viglink')) {
                is_affiliate = true;
                affiliate_network = 'skimlinks';
            }
        }

        const event = {
            user_id: req.userId || null,
            event_type,
            product_title: (product_title || '').slice(0, 500),
            store: (store || '').slice(0, 200),
            url: (url || '').slice(0, 2000),
            search_query: (search_query || '').slice(0, 500),
            is_affiliate,
            affiliate_network,
            device: device || 'unknown',
            referrer: (req.headers.referer || '').slice(0, 500)
        };

        if (supabase) {
            // Fire and forget — don't block response
            supabase.from('click_events').insert(event).then(({ error }) => {
                if (error) console.error('[Analytics] Insert error:', error.message);
            });
        }

        res.json({ ok: true });
    } catch (err) {
        console.error('[Analytics] trackEvent error:', err);
        res.json({ ok: true }); // Never fail the user's click flow
    }
}

/**
 * GET /api/admin/analytics — Conversion dashboard stats (admin only)
 */
async function getAnalytics(req, res) {
    try {
        if (!supabase) return res.status(503).json({ error: 'Base de datos no disponible' });

        const { period, group_by } = req.query;
        let dateFilter = null;
        const now = new Date();

        if (period === 'today') {
            dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        } else if (period === 'week') {
            dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        } else if (period === 'month') {
            dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        }

        // Fetch all events for period
        let query = supabase.from('click_events').select('*').order('created_at', { ascending: false });
        if (dateFilter) query = query.gte('created_at', dateFilter);
        query = query.limit(5000); // Cap for performance

        const { data: events, error } = await query;
        if (error) throw error;
        const all = events || [];

        // --- Totals ---
        const totalClicks = all.filter(e => e.event_type === 'click').length;
        const totalSearches = all.filter(e => e.event_type === 'search').length;
        const totalAdViews = all.filter(e => e.event_type === 'ad_view').length;
        const totalFavorites = all.filter(e => e.event_type === 'favorite').length;
        const totalAlerts = all.filter(e => e.event_type === 'alert_create').length;

        // --- Conversion Rate (searches → clicks) ---
        const conversionRate = totalSearches > 0 ? ((totalClicks / totalSearches) * 100).toFixed(1) : '0.0';

        // --- Affiliate clicks ---
        const affiliateClicks = all.filter(e => e.event_type === 'click' && e.is_affiliate);
        const totalAffiliateClicks = affiliateClicks.length;

        // --- By Network ---
        const byNetwork = {};
        affiliateClicks.forEach(e => {
            const net = e.affiliate_network || 'none';
            byNetwork[net] = (byNetwork[net] || 0) + 1;
        });

        // --- By Store ---
        const byStore = {};
        all.filter(e => e.event_type === 'click').forEach(e => {
            const store = e.store || 'Desconocida';
            byStore[store] = (byStore[store] || 0) + 1;
        });
        const topStores = Object.entries(byStore)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([store, clicks]) => ({ store, clicks }));

        // --- By Device ---
        const byDevice = { mobile: 0, desktop: 0, tablet: 0, unknown: 0 };
        all.filter(e => e.event_type === 'click').forEach(e => {
            const d = e.device || 'unknown';
            byDevice[d] = (byDevice[d] || 0) + 1;
        });

        // --- Top Products clicked ---
        const byProduct = {};
        all.filter(e => e.event_type === 'click' && e.product_title).forEach(e => {
            const key = e.product_title;
            if (!byProduct[key]) byProduct[key] = { title: key, clicks: 0, store: e.store };
            byProduct[key].clicks++;
        });
        const topProducts = Object.values(byProduct)
            .sort((a, b) => b.clicks - a.clicks)
            .slice(0, 10);

        // --- Top Searches ---
        const bySearch = {};
        all.filter(e => e.event_type === 'search' && e.search_query).forEach(e => {
            const q = e.search_query.toLowerCase().trim();
            bySearch[q] = (bySearch[q] || 0) + 1;
        });
        const topSearches = Object.entries(bySearch)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([query, count]) => ({ query, count }));

        // --- Hourly distribution (last 24h) ---
        const hourly = Array(24).fill(0);
        const twentyFourHAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        all.filter(e => e.event_type === 'click' && new Date(e.created_at) >= twentyFourHAgo).forEach(e => {
            const h = new Date(e.created_at).getHours();
            hourly[h]++;
        });

        // --- Ad funnel ---
        const adViews = all.filter(e => e.event_type === 'ad_view').length;
        const adSkips = all.filter(e => e.event_type === 'ad_skip').length;
        const adCompletionRate = adViews > 0 ? (((adViews - adSkips) / adViews) * 100).toFixed(1) : '0.0';

        // --- Daily trend (last 7 days) ---
        const dailyTrend = [];
        for (let i = 6; i >= 0; i--) {
            const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dayStr = day.toISOString().split('T')[0];
            const dayClicks = all.filter(e => e.event_type === 'click' && e.created_at.startsWith(dayStr)).length;
            const daySearches = all.filter(e => e.event_type === 'search' && e.created_at.startsWith(dayStr)).length;
            dailyTrend.push({ date: dayStr, clicks: dayClicks, searches: daySearches });
        }

        res.json({
            summary: {
                totalClicks,
                totalSearches,
                conversionRate,
                totalAffiliateClicks,
                totalAdViews,
                totalFavorites,
                totalAlerts,
                adCompletionRate
            },
            byNetwork,
            byDevice,
            topStores,
            topProducts,
            topSearches,
            hourlyDistribution: hourly,
            dailyTrend
        });
    } catch (err) {
        console.error('[Analytics] getAnalytics error:', err);
        res.status(500).json({ error: 'Error al obtener analytics' });
    }
}

module.exports = { trackEvent, getAnalytics };
