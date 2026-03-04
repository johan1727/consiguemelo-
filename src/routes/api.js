const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { validateBody } = require('../middleware/validateRequest');
const authMiddleware = require('../middleware/authMiddleware');
const { requireAuth } = require('../middleware/authMiddleware');
const { searchProductSchema, bulkSearchSchema, visionSchema, memorySchema, feedbackSchema, trackEventSchema } = require('../schemas/searchSchemas');

const memoryController = require('../controllers/memoryController');
const feedbackController = require('../controllers/feedbackController');
const priceAlertController = require('../controllers/priceAlertController');
const dropshipController = require('../controllers/dropshipController');
const analyticsController = require('../controllers/analyticsController');
const priceHistoryController = require('../controllers/priceHistoryController');
const supplierChecker = require('../services/supplierChecker');

// POST /api/track — Conversion analytics (public, lightweight, validated)
router.post('/track', authMiddleware, validateBody(trackEventSchema), analyticsController.trackEvent);

// GET /api/price-history — Public price trends (cached)
router.get('/price-history', priceHistoryController.getPriceHistory);

// POST /api/buscar — authMiddleware verifies JWT and sets req.userId
router.post('/buscar', authMiddleware, validateBody(searchProductSchema), searchController.searchProduct);

// POST /api/vision (IA identifica producto de una imagen)
router.post('/vision', validateBody(visionSchema), searchController.analyzeImage);

// POST /api/bulk-search (B2B Plan Revendedor)
router.post('/bulk-search', authMiddleware, requireAuth, validateBody(bulkSearchSchema), searchController.bulkSearch);

// POST /api/memory (requires auth to prevent RAG poisoning)
router.post('/memory', authMiddleware, requireAuth, validateBody(memorySchema), memoryController.saveMemory);

// POST /api/feedback (requires auth)
router.post('/feedback', authMiddleware, requireAuth, validateBody(feedbackSchema), feedbackController.submitFeedback);

// Price Alerts (requires auth)
router.get('/price-alerts', authMiddleware, requireAuth, priceAlertController.listAlerts);
router.post('/price-alerts', authMiddleware, requireAuth, priceAlertController.createAlert);
router.delete('/price-alerts/:id', authMiddleware, requireAuth, priceAlertController.deleteAlert);

// Push notification subscription (requires auth)
router.post('/push-subscribe', authMiddleware, requireAuth, priceAlertController.savePushSubscription);

// GET /api/config
router.get('/config', (req, res) => {
    // Protección reforzada: solo frontend permitido por origen/host
    const origin = req.headers.origin || '';
    const referer = req.headers.referer || '';
    const host = req.get('host');
    const allowedOrigins = req.app?.locals?.allowedOrigins || [];

    // SECURITY FIX: Use strict URL comparison instead of includes() to prevent bypass
    // e.g., https://evil.com/lumu.dev would bypass includes() but not URL parsing
    let originHost = '';
    try { originHost = new URL(origin).hostname; } catch {}
    let refererHost = '';
    try { refererHost = new URL(referer).hostname; } catch {}
    const allowedHosts = allowedOrigins.map(o => { try { return new URL(o).hostname; } catch { return ''; } }).filter(Boolean);
    const sameHostByOrigin = originHost && allowedHosts.includes(originHost);
    const sameHostByReferer = refererHost && allowedHosts.includes(refererHost);
    const explicitOriginAllowed = origin && allowedOrigins.includes(origin);
    const noAllowListConfigured = allowedOrigins.length === 0;
    const allowRequest = explicitOriginAllowed || sameHostByOrigin || sameHostByReferer || noAllowListConfigured;

    if (process.env.NODE_ENV === 'production' && !allowRequest) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }

    // Only expose public-safe keys (never SERVICE_ROLE_KEY)
    res.json({
        supabaseUrl: process.env.SUPABASE_URL || '',
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
        stripePaymentLink: process.env.STRIPE_PAYMENT_LINK || '',
        stripeB2bPaymentLink: process.env.STRIPE_B2B_PAYMENT_LINK || '',
        vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
        rewardedAdTagUrl: process.env.REWARDED_AD_TAG_URL || ''
    });
});

// GET /api/scraper-health — Ver si algún scraper está siendo bloqueado
const scraperMonitor = require('../services/scraperMonitor');
router.get('/scraper-health', (req, res) => {
    // Protección: requiere API key o mismo host en producción
    if (process.env.NODE_ENV === 'production') {
        const crypto = require('crypto');
        const authKey = req.headers['x-admin-key'] || req.query.key;
        const adminKey = process.env.ADMIN_API_KEY;
        if (!adminKey || !authKey) {
            return res.status(403).json({ error: 'Acceso denegado. Se requiere x-admin-key.' });
        }
        // SECURITY FIX: Hash both keys to prevent length leak via timing
        const authHash = crypto.createHmac('sha256', 'lumu-admin').update(String(authKey)).digest();
        const adminHash = crypto.createHmac('sha256', 'lumu-admin').update(String(adminKey)).digest();
        if (!crypto.timingSafeEqual(authHash, adminHash)) {
            return res.status(403).json({ error: 'Acceso denegado. Se requiere x-admin-key.' });
        }
    }
    // Si el cliente es un navegador (Accept: text/html), redirigir al dashboard UI
    const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
    if (acceptsHtml) {
        return res.redirect('/scraper-dashboard.html');
    }
    const report = scraperMonitor.getHealthReport();
    res.json({
        timestamp: new Date().toISOString(),
        scrapers: report,
        recommendation: Object.values(report).some(s => parseInt(s.blockRate) > 50)
            ? '🔴 ACCIÓN REQUERIDA: Uno o más scrapers están siendo bloqueados. Considera activar proxies o esperar 1 hora.'
            : '🟢 Todos los scrapers parecen funcionar correctamente.'
    });
});

// ============================================================
// Admin Routes (private — requires ADMIN_API_KEY + allowed email)
// ============================================================
const ADMIN_EMAILS = ['jhonatanvillagomez38@gmail.com', 'gastrolbg@gmail.com'];

function requireAdmin(req, res, next) {
    const crypto = require('crypto');
    const authKey = req.headers['x-admin-key'] || req.query.key;
    const adminKey = process.env.ADMIN_API_KEY;
    if (!adminKey || !authKey) {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere x-admin-key.' });
    }
    // SECURITY FIX: Hash both keys before comparison to prevent length leak
    const authHash = crypto.createHmac('sha256', 'lumu-admin').update(String(authKey)).digest();
    const adminHash = crypto.createHmac('sha256', 'lumu-admin').update(String(adminKey)).digest();
    if (!crypto.timingSafeEqual(authHash, adminHash)) {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere x-admin-key.' });
    }
    next();
}

// Products
router.get('/admin/dropship/products', requireAdmin, dropshipController.listProducts);
router.post('/admin/dropship/products', requireAdmin, dropshipController.createProduct);
router.put('/admin/dropship/products/:id', requireAdmin, dropshipController.updateProduct);
router.delete('/admin/dropship/products/:id', requireAdmin, dropshipController.deleteProduct);

// Orders
router.get('/admin/dropship/orders', requireAdmin, dropshipController.listOrders);
router.post('/admin/dropship/orders', requireAdmin, dropshipController.createOrder);
router.put('/admin/dropship/orders/:id', requireAdmin, dropshipController.updateOrder);

// Dashboard Stats
router.get('/admin/dropship/stats', requireAdmin, dropshipController.getStats);

// Conversion Analytics (admin only)
router.get('/admin/analytics', requireAdmin, analyticsController.getAnalytics);

// Supplier Auto-Check (admin only)
router.post('/admin/supplier-check', requireAdmin, async (req, res) => {
    try {
        const result = await supplierChecker.runFullCheck();
        res.json(result);
    } catch (err) {
        console.error('[SupplierCheck] Error:', err);
        res.status(500).json({ error: 'Error running supplier check' });
    }
});
router.post('/admin/supplier-check/:id', requireAdmin, async (req, res) => {
    try {
        const result = await supplierChecker.checkSingleProduct(req.params.id);
        res.json(result);
    } catch (err) {
        console.error('[SupplierCheck] Error:', err);
        res.status(500).json({ error: 'Error checking product' });
    }
});

module.exports = router;
