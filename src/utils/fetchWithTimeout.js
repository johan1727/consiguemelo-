/**
 * Fetch wrapper con timeout configurable para prevenir requests colgados
 * @param {string} url - URL del endpoint
 * @param {object} options - Opciones de fetch (method, headers, body, etc)
 * @param {number} timeout - Timeout en milisegundos (default: 15000)
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeout = 15000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeout}ms: ${url}`);
        }
        throw error;
    }
}

module.exports = fetchWithTimeout;
