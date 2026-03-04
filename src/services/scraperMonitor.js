/**
 * scraperMonitor.js
 * Sistema de monitoreo de salud de los scrapers.
 * Detecta cuando un scraper está siendo bloqueado (banneado).
 */

const stats = {
    amazon: { success: 0, fail: 0, lastBlock: null },
    coppel: { success: 0, fail: 0, lastBlock: null },
    walmart: { success: 0, fail: 0, lastBlock: null },
    google: { success: 0, fail: 0, lastBlock: null },
    mercadolibre: { success: 0, fail: 0, lastBlock: null }
};

const BLOCK_KEYWORDS = [
    'robot', 'captcha', 'unusual traffic', 'access denied', 'blocked',
    'security check', 'automated queries', 'prueba que no eres un robot',
    'unusual activity', 'please verify', 'human verification'
];

/**
 * Analiza el HTML de una página para ver si hay señales de bloqueo
 */
exports.detectBlock = (html, scraperName) => {
    if (!html) {
        recordFail(scraperName);
        return true;
    }
    const lower = html.toLowerCase();
    const isBlocked = BLOCK_KEYWORDS.some(kw => lower.includes(kw));
    if (isBlocked) {
        recordFail(scraperName);
        const blockRate = getBlockRate(scraperName);
        console.warn(`🚨 [BANNED?] ${scraperName.toUpperCase()} parece estar bloqueado. Tasa de fallo: ${blockRate}%`);
        if (blockRate > 50) {
            console.error(`🔴 [ALERTA CRÍTICA] ${scraperName} tiene más del 50% de bloqueos. ¡Considera rotar proxies!`);
        }
    } else {
        recordSuccess(scraperName);
    }
    return isBlocked;
};

/**
 * Envuelve una función de scraper con monitoreo automático
 */
exports.wrap = async (scraperFn, scraperName, ...args) => {
    try {
        const results = await scraperFn(...args);
        if (results.length === 0) {
            recordFail(scraperName);
            console.warn(`⚠️ [MONITOR] ${scraperName} devolvió 0 resultados. Posible bloqueo.`);
        } else {
            recordSuccess(scraperName);
        }
        return results;
    } catch (err) {
        recordFail(scraperName);
        console.error(`❌ [MONITOR] ${scraperName} lanzó una excepción: ${err.message}`);
        return [];
    }
};

function ensureStat(name) {
    if (!stats[name]) stats[name] = { success: 0, fail: 0, lastBlock: null };
}

function recordSuccess(scraperName) {
    ensureStat(scraperName);
    stats[scraperName].success++;
}

function recordFail(scraperName) {
    ensureStat(scraperName);
    stats[scraperName].fail++;
    stats[scraperName].lastBlock = new Date().toISOString();
}

function getBlockRate(scraperName) {
    const s = stats[scraperName];
    if (!s) return 0;
    const total = s.success + s.fail;
    if (total === 0) return 0;
    return Math.round((s.fail / total) * 100);
}

/**
 * Devuelve el estado actual de todos los scrapers
 */
exports.getHealthReport = () => {
    const report = {};
    for (const [name, s] of Object.entries(stats)) {
        const blockRate = getBlockRate(name);
        report[name] = {
            success: s.success,
            fail: s.fail,
            blockRate: `${blockRate}%`,
            status: blockRate > 50 ? '🔴 CRÍTICO' : blockRate > 20 ? '🟡 PRECAUCIÓN' : '🟢 OK',
            lastBlock: s.lastBlock || 'Nunca'
        };
    }
    return report;
};
