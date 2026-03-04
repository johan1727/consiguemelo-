const supabase = require('../config/supabase');

/**
 * Middleware that extracts and verifies the Supabase JWT from the Authorization header.
 * Sets req.userId to the verified user ID, or null if not authenticated.
 * Does NOT block unauthenticated requests (allows anonymous searches).
 */
async function authMiddleware(req, res, next) {
    req.userId = null;

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }

    const token = authHeader.slice(7);
    if (!token || !supabase) {
        return next();
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) {
            req.userId = user.id;
        }
    } catch (err) {
        console.warn('[Auth] Token verification failed:', err.message);
    }

    next();
}

/**
 * Strict auth middleware — returns 401 if not authenticated.
 * Use for endpoints that MUST have a logged-in user.
 */
function requireAuth(req, res, next) {
    if (!req.userId) {
        return res.status(401).json({ error: 'Debes iniciar sesión para acceder a esta función.' });
    }
    next();
}

module.exports = authMiddleware;
module.exports.requireAuth = requireAuth;
