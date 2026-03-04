require('dotenv').config();

// Validate critical environment variables on startup
['SERPER_API_KEY', 'GEMINI_API_KEY'].forEach(v => {
    if (!process.env[v]) console.error(`\u26A0\uFE0F CRITICAL: ${v} is not set! Searches will fail.`);
});
['SUPABASE_URL', 'SUPABASE_ANON_KEY'].forEach(v => {
    if (!process.env[v]) console.warn(`\u26A0\uFE0F WARNING: ${v} is not set. Auth, caching, and rate limiting will use fallbacks.`);
});

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

const searchRoutes = require('../src/routes/api');

const allowedOrigins = (process.env.FRONTEND_ORIGINS || 'https://lumu.dev,https://www.lumu.dev')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

app.locals.allowedOrigins = allowedOrigins;
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            // SECURITY FIX #6: Removed 'unsafe-eval'. 'unsafe-inline' kept for AdSense/inline styles.
            scriptSrc: ["'self'", "'unsafe-inline'", "https://pagead2.googlesyndication.com", "https://cdn.jsdelivr.net", "https://js.stripe.com", "https://imasdk.googleapis.com", "https://accounts.google.com", "https://apis.google.com", "https://*.supabase.co", "https://www.googletagmanager.com", "https://ep1.adtrafficquality.google"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "https://accounts.google.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "https://*.supabase.co", "https://generativelanguage.googleapis.com", "https://google.serper.dev", "https://api.stripe.com", "https://pagead2.googlesyndication.com", "https://imasdk.googleapis.com", "https://ep1.adtrafficquality.google", "https://*.googlesyndication.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
            frameSrc: ["https://js.stripe.com", "https://accounts.google.com", "https://pagead2.googlesyndication.com", "https://imasdk.googleapis.com", "https://www.google.com", "https://ep1.adtrafficquality.google", "https://googleads.g.doubleclick.net", "https://tpc.googlesyndication.com"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: []
        }
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        // In development, allow localhost
        if (process.env.NODE_ENV !== 'production' && origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
            return callback(null, true);
        }
        if (process.env.NODE_ENV === 'production') {
            console.warn(`[CORS] Rejected origin: ${origin}. Allowed: ${allowedOrigins.join(', ')}`);
        }
        return callback(new Error('CORS origin no permitido'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: false
}));

// Webhook de Stripe (Debe ir ANTES del express.json para que sea raw)
const stripeController = require('../src/controllers/stripeController');
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeController.handleWebhook);

// Middleware para parsear JSON
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Servir archivos estáticos del frontend
const path = require('path');
app.use(express.static(path.join(__dirname, '../public')));

// ============================================
// SEO Dynamic Category Pages — /buscar/:slug
// ============================================
const seoController = require('../src/controllers/seoController');
app.get('/buscar', seoController.serveCategoryIndex);
app.get('/buscar/:slug', seoController.serveCategoryPage);

// ============================================
// PROTECCIÓN PARA ESCALA: Rate Limiter propio
// Sin dependencias extra. Limita peticiones por IP.
// ============================================
// ============================================
// RATE LIMITER — Supabase-based (Serverless safe)
// Falls back to RAM if Supabase is not available
// ============================================
const supabaseRateLimit = require('../src/config/supabase');
const REQUEST_LIMIT = 10;  // max requests per minute per IP
const RATE_WINDOW_MS = 60 * 1000;
const MAX_RAM_RATE_LIMIT_IPS = 10000;

// RAM fallback (only used if Supabase is unavailable)
const requestLog = {};

const rateLimiter = async (req, res, next) => {
    const ip = (req.headers['x-vercel-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || req.headers['x-forwarded-for']?.split(',').pop()?.trim() || req.ip || 'unknown').trim();
    const now = Date.now();
    const windowStart = new Date(now - RATE_WINDOW_MS).toISOString();

    // Try Supabase-based rate limiting first
    if (supabaseRateLimit) {
        try {
            // Count recent requests from this IP in last 60s
            const { count, error } = await supabaseRateLimit
                .from('rate_limits')
                .select('*', { count: 'exact', head: true })
                .eq('ip', ip)
                .gte('created_at', windowStart);

            if (!error) {
                if (count >= REQUEST_LIMIT) {
                    return res.status(429).json({
                        error: `Demasiadas solicitudes. Espera 60 segundos antes de buscar de nuevo.`,
                        retry_after: 60
                    });
                }
                // Log this request (fire & forget)
                supabaseRateLimit.from('rate_limits').insert({ ip, created_at: new Date().toISOString() })
                    .then(() => {
                        // Clean old entries asynchronously
                        const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
                        supabaseRateLimit.from('rate_limits').delete().lt('created_at', oneHourAgo).then(() => { }).catch(() => { });
                    })
                    .catch(() => { });
                return next();
            }
        } catch (e) {
            console.warn('[Rate Limiter] Supabase no disponible, usando RAM fallback:', e.message);
        }
    }

    // RAM fallback
    if (!requestLog[ip]) {
        if (Object.keys(requestLog).length >= MAX_RAM_RATE_LIMIT_IPS) {
            Object.keys(requestLog).forEach(key => delete requestLog[key]);
        }
        requestLog[ip] = [];
    }
    // Probabilistic cleanup (serverless-safe, replaces setInterval)
    if (Math.random() < 0.05) {
        Object.keys(requestLog).forEach(key => {
            requestLog[key] = (requestLog[key] || []).filter(t => now - t < RATE_WINDOW_MS);
            if (requestLog[key].length === 0) delete requestLog[key];
        });
    }
    requestLog[ip] = requestLog[ip].filter(t => now - t < RATE_WINDOW_MS);
    if (requestLog[ip].length >= REQUEST_LIMIT) {
        const retryAfter = Math.ceil((requestLog[ip][0] + RATE_WINDOW_MS - now) / 1000);
        return res.status(429).json({
            error: `Demasiadas solicitudes. Espera ${retryAfter} segundos antes de buscar de nuevo.`,
            retry_after: retryAfter
        });
    }
    requestLog[ip].push(now);
    next();
};

// Clean RAM cache on each request via probabilistic cleanup (serverless-safe, no setInterval)\n// Cleanup happens inline with 1% probability per request

// Rutas de la API
// Note: /api/buscar has its own per-user rate limiting in searchController
// Only apply global rate limiter to non-search endpoints to avoid double-counting
app.use('/api/bulk-search', rateLimiter);
app.use('/api/vision', rateLimiter);
app.use('/api/feedback', rateLimiter);
app.use('/api/memory', rateLimiter);
app.use('/api/price-alerts', rateLimiter);
app.use('/api/push-subscribe', rateLimiter);
app.use('/api/track', rateLimiter);
app.use('/api', searchRoutes);

// Manejo de rutas inexistentes
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejo global de errores
app.use((err, req, res, next) => {
    console.error('Error no manejado:', err.stack);
    res.status(500).json({ error: 'Error interno del servidor.' });
});

if (require.main === module) {
    const server = app.listen(PORT, () => {
        console.log(`Lumu API corriendo en http://localhost:${PORT}`);
    });

    server.on('error', (error) => {
        if (error && error.code === 'EADDRINUSE') {
            console.error(`Puerto ${PORT} en uso. Ya hay otra instancia activa de la API.`);
            console.error('Detén el proceso anterior o cambia PORT en tu .env (ej: PORT=3001).');
            process.exit(1);
            return;
        }
        console.error('Error al iniciar servidor:', error);
        process.exit(1);
    });
}

module.exports = app;
