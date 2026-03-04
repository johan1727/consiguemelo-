const ML_AFFILIATE_CAMPAIGN = process.env.ML_AFFILIATE_CAMPAIGN || '';
const ALIEXPRESS_AFFILIATE_KEY = process.env.ALIEXPRESS_AFFILIATE_KEY || '';
const AMAZON_AFFILIATE_TAG = process.env.AMAZON_AFFILIATE_TAG || '';

const missingAffiliateConfigs = [];
if (!ML_AFFILIATE_CAMPAIGN) missingAffiliateConfigs.push('ML_AFFILIATE_CAMPAIGN');
if (!ALIEXPRESS_AFFILIATE_KEY) missingAffiliateConfigs.push('ALIEXPRESS_AFFILIATE_KEY');
if (missingAffiliateConfigs.length > 0) {
    console.warn(`[Affiliate] Variables faltantes: ${missingAffiliateConfigs.join(', ')}. Se usarán enlaces sin afiliado en esas tiendas.`);
}

const normalizeStoreUrl = (urlObj) => {
    const host = (urlObj.hostname || '').toLowerCase();
    const path = (urlObj.pathname || '').toLowerCase();

    if (host.includes('google.') && path === '/url') {
        const redirectTarget = urlObj.searchParams.get('url') || urlObj.searchParams.get('q');
        if (redirectTarget) {
            try {
                return new URL(redirectTarget);
            } catch (e) {
                return urlObj;
            }
        }
    }

    return urlObj;
};

exports.generateAffiliateLink = (originalUrl, source) => {
    try {
        const raw = (originalUrl || '').trim();

        // SECURITY FIX #18: Block javascript: and data: URI injection
        if (/^(javascript|data|vbscript):/i.test(raw)) {
            console.warn('[Affiliate] Blocked dangerous URI:', raw.slice(0, 50));
            return '';
        }

        const original = new URL(raw);

        // Only allow http/https protocols
        if (original.protocol !== 'http:' && original.protocol !== 'https:') {
            console.warn('[Affiliate] Blocked non-HTTP protocol:', original.protocol);
            return '';
        }

        const urlObj = normalizeStoreUrl(original);
        const sourceLower = source.toLowerCase();

        // 1. Amazon con afiliado
        if (sourceLower.includes('amazon')) {
            if (AMAZON_AFFILIATE_TAG) {
                urlObj.searchParams.set('tag', AMAZON_AFFILIATE_TAG);
            }
            return urlObj.toString();
        }

        // 2. Inyectar afiliado de Mercado Libre
        if (sourceLower.includes('mercadolibre') || sourceLower.includes('mercado libre')) {
            if (ML_AFFILIATE_CAMPAIGN) {
                urlObj.searchParams.set('re_id', ML_AFFILIATE_CAMPAIGN);
            }
            return urlObj.toString();
        }

        // 3. Inyectar afiliado de AliExpress
        if (sourceLower.includes('aliexpress')) {
            if (ALIEXPRESS_AFFILIATE_KEY) {
                urlObj.searchParams.set('aff_short_key', ALIEXPRESS_AFFILIATE_KEY);
            }
            return urlObj.toString();
        }

        // 4. Loss Leader: Dejar intacto para otras tiendas (Liverpool, Walmart, Coppel, etc.)
        return originalUrl;

    } catch (error) {
        // Si la URL no es válida o hay un error, devolvemos la original
        return originalUrl;
    }
};
