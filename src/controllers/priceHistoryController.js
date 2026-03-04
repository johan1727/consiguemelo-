// ============================================================
// Price History Controller — Public endpoint for price trends
// ============================================================
const supabase = require('../config/supabase');

/**
 * GET /api/price-history?query=...
 * Returns aggregated price history for a search query
 */
exports.getPriceHistory = async (req, res) => {
    try {
        const query = (req.query.query || '').trim().toLowerCase();
        if (!query || query.length < 2) {
            return res.status(400).json({ error: 'Se requiere un query de al menos 2 caracteres.' });
        }

        if (!supabase) {
            return res.status(503).json({ error: 'Base de datos no disponible.' });
        }

        // Search price_history for matching query_keys
        // Use ILIKE for flexible matching
        const queryPattern = `%${query.replace(/[%_]/g, '')}%`;

        const { data: rawHistory, error } = await supabase
            .from('price_history')
            .select('normalized_url, product_title, store_name, price, created_at')
            .ilike('query_key', queryPattern)
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: true })
            .limit(2000);

        if (error) {
            console.error('[PriceHistory] DB error:', error.message);
            return res.status(500).json({ error: 'Error consultando base de datos.' });
        }

        if (!rawHistory || rawHistory.length === 0) {
            return res.json({ products: [], summary: {}, timeline: [], byStore: [] });
        }

        // Group by normalized_url
        const productMap = {};
        for (const row of rawHistory) {
            const key = row.normalized_url;
            if (!productMap[key]) {
                productMap[key] = {
                    url: key,
                    title: row.product_title || 'Producto',
                    store: row.store_name || 'Desconocida',
                    history: []
                };
            }
            productMap[key].history.push({
                price: parseFloat(row.price),
                date: row.created_at
            });
            // Update title/store to most recent
            if (row.product_title) productMap[key].title = row.product_title;
            if (row.store_name) productMap[key].store = row.store_name;
        }

        // Build products array with stats
        const products = Object.values(productMap).map(p => {
            const prices = p.history.map(h => h.price).filter(v => Number.isFinite(v) && v > 0);
            if (prices.length === 0) return null;

            const currentPrice = prices[prices.length - 1];
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            const firstPrice = prices[0];
            const lastPrice = prices[prices.length - 1];
            const change = lastPrice - firstPrice;
            const changePercent = firstPrice > 0 ? Math.abs((change / firstPrice) * 100).toFixed(1) : '0';
            const trend = Math.abs(change) < 1 ? 'same' : (change < 0 ? 'down' : 'up');

            return {
                title: p.title,
                store: p.store,
                url: p.url,
                currentPrice,
                minPrice,
                maxPrice,
                trend,
                changePercent,
                dataPoints: prices.length
            };
        }).filter(Boolean);

        // Sort by data points (most tracked first)
        products.sort((a, b) => b.dataPoints - a.dataPoints);

        // Build timeline (group by date)
        const dateMap = {};
        for (const row of rawHistory) {
            const dateKey = row.created_at.slice(0, 10); // YYYY-MM-DD
            const price = parseFloat(row.price);
            if (!Number.isFinite(price) || price <= 0) continue;

            if (!dateMap[dateKey]) {
                dateMap[dateKey] = { prices: [], date: dateKey };
            }
            dateMap[dateKey].prices.push(price);
        }

        const timeline = Object.values(dateMap)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(d => ({
                date: d.date,
                min: Math.min(...d.prices),
                max: Math.max(...d.prices),
                avg: parseFloat((d.prices.reduce((s, p) => s + p, 0) / d.prices.length).toFixed(2)),
                count: d.prices.length
            }));

        // Build by-store comparison
        const storeMap = {};
        for (const row of rawHistory) {
            const store = row.store_name || 'Desconocida';
            const price = parseFloat(row.price);
            if (!Number.isFinite(price) || price <= 0) continue;

            if (!storeMap[store]) {
                storeMap[store] = { store, prices: [] };
            }
            storeMap[store].prices.push(price);
        }

        const byStore = Object.values(storeMap)
            .map(s => ({
                store: s.store,
                avgPrice: parseFloat((s.prices.reduce((sum, p) => sum + p, 0) / s.prices.length).toFixed(2)),
                minPrice: Math.min(...s.prices),
                maxPrice: Math.max(...s.prices),
                count: s.prices.length
            }))
            .sort((a, b) => a.avgPrice - b.avgPrice);

        // Global summary
        const allPrices = rawHistory.map(r => parseFloat(r.price)).filter(v => Number.isFinite(v) && v > 0);
        const lowest = Math.min(...allPrices);
        const highest = Math.max(...allPrices);
        const average = parseFloat((allPrices.reduce((s, p) => s + p, 0) / allPrices.length).toFixed(2));

        // Overall trend: compare first week avg vs last week avg
        const sortedDates = Object.keys(dateMap).sort();
        let trend = 'same';
        if (sortedDates.length >= 2) {
            const firstWeek = sortedDates.slice(0, Math.max(1, Math.ceil(sortedDates.length * 0.3)));
            const lastWeek = sortedDates.slice(-Math.max(1, Math.ceil(sortedDates.length * 0.3)));
            const firstAvg = firstWeek.reduce((s, d) => s + dateMap[d].prices.reduce((a, b) => a + b, 0) / dateMap[d].prices.length, 0) / firstWeek.length;
            const lastAvg = lastWeek.reduce((s, d) => s + dateMap[d].prices.reduce((a, b) => a + b, 0) / dateMap[d].prices.length, 0) / lastWeek.length;
            const diff = lastAvg - firstAvg;
            trend = Math.abs(diff) < average * 0.02 ? 'same' : (diff < 0 ? 'down' : 'up');
        }

        // Find store with lowest/highest
        const lowestProduct = products.reduce((min, p) => (!min || p.minPrice < min.minPrice) ? p : min, null);
        const highestProduct = products.reduce((max, p) => (!max || p.maxPrice > max.maxPrice) ? p : max, null);

        res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=3600');
        res.json({
            query,
            summary: {
                lowest,
                highest,
                average,
                trend,
                lowestStore: lowestProduct?.store || '',
                highestStore: highestProduct?.store || '',
                totalDataPoints: allPrices.length,
                productsTracked: products.length,
                daysOfData: sortedDates.length
            },
            products: products.slice(0, 30),
            timeline,
            byStore
        });

    } catch (err) {
        console.error('[PriceHistory] Error:', err);
        res.status(500).json({ error: 'Error del servidor.' });
    }
};
