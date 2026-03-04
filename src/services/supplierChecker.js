// ============================================================
// Supplier Auto-Check Service
// Monitors AliExpress/supplier URLs for price/stock changes
// ============================================================

const axios = require('axios');
const cheerio = require('cheerio');
const supabase = require('../config/supabase');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Scrape an AliExpress product page for price and availability
 * @param {string} url - Product URL
 * @returns {Object} { price, currency, inStock, title, error }
 */
async function checkAliExpressProduct(url) {
    try {
        const resp = await axios.get(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8'
            },
            timeout: 15000,
            maxRedirects: 5
        });

        const html = resp.data;
        const $ = cheerio.load(html);

        // Try to extract price from various selectors
        let price = null;
        let currency = 'USD';

        // AliExpress renders price in JSON data or meta tags
        const priceMatch = html.match(/"formattedActivityPrice":"([^"]+)"/);
        if (priceMatch) {
            price = parseFloat(priceMatch[1].replace(/[^0-9.]/g, ''));
        }

        // Fallback: meta tag price
        if (!price) {
            const metaPrice = $('meta[property="product:price:amount"]').attr('content');
            if (metaPrice) price = parseFloat(metaPrice);
            const metaCurrency = $('meta[property="product:price:currency"]').attr('content');
            if (metaCurrency) currency = metaCurrency;
        }

        // Fallback: search for price patterns in page
        if (!price) {
            const pricePatterns = html.match(/US\s*\$\s*([\d,.]+)/);
            if (pricePatterns) price = parseFloat(pricePatterns[1].replace(',', ''));
        }

        // Check stock availability
        let inStock = true;
        const unavailableTexts = ['no longer available', 'out of stock', 'sold out', 'no disponible', 'agotado'];
        const pageText = html.toLowerCase();
        for (const text of unavailableTexts) {
            if (pageText.includes(text)) {
                inStock = false;
                break;
            }
        }

        // Try to get title
        let title = $('title').text().trim() || $('h1').first().text().trim() || null;
        if (title) title = title.replace(/\s*[-|].*$/, '').trim().slice(0, 200);

        return { price, currency, inStock, title, error: null };
    } catch (err) {
        return { price: null, currency: null, inStock: null, title: null, error: err.message };
    }
}

/**
 * Generic supplier check (non-AliExpress)
 */
async function checkGenericProduct(url) {
    try {
        const resp = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 15000,
            maxRedirects: 5
        });
        const html = resp.data;
        const $ = cheerio.load(html);

        // Check if page loads (not 404)
        const is404 = html.toLowerCase().includes('page not found') || html.toLowerCase().includes('404');
        const inStock = !is404;

        // Try meta price
        let price = null;
        const metaPrice = $('meta[property="product:price:amount"]').attr('content') ||
            $('meta[property="og:price:amount"]').attr('content');
        if (metaPrice) price = parseFloat(metaPrice);

        return { price, currency: 'MXN', inStock, title: null, error: null };
    } catch (err) {
        return { price: null, currency: null, inStock: false, title: null, error: err.message };
    }
}

/**
 * Check a supplier URL and return status
 */
async function checkSupplierUrl(url) {
    if (!url) return { price: null, currency: null, inStock: null, title: null, error: 'No URL provided' };

    const isAliExpress = url.includes('aliexpress.com') || url.includes('aliexpress.us');
    return isAliExpress ? checkAliExpressProduct(url) : checkGenericProduct(url);
}

/**
 * Run auto-check on ALL active dropship products with source_url
 * Returns array of results with product info and changes detected
 */
async function runFullCheck() {
    if (!supabase) return { error: 'Database not available', results: [] };

    const { data: products, error } = await supabase
        .from('dropship_products')
        .select('*')
        .eq('is_active', true)
        .not('source_url', 'is', null)
        .not('source_url', 'eq', '');

    if (error) return { error: error.message, results: [] };
    if (!products || products.length === 0) return { error: null, results: [], message: 'No products with source URLs to check' };

    const results = [];

    // Process sequentially to avoid rate limiting
    for (const product of products) {
        const check = await checkSupplierUrl(product.source_url);
        const changes = [];

        // Detect price change
        if (check.price !== null && product.cost_price) {
            const priceDiff = check.price - product.cost_price;
            const pctChange = ((priceDiff / product.cost_price) * 100).toFixed(1);
            if (Math.abs(priceDiff) > 0.01) {
                changes.push({
                    type: 'price_change',
                    old: product.cost_price,
                    new: check.price,
                    pct: pctChange,
                    direction: priceDiff > 0 ? 'up' : 'down'
                });
            }
        }

        // Detect stock change
        if (check.inStock === false && product.stock_status !== 'out_of_stock') {
            changes.push({ type: 'out_of_stock' });
        } else if (check.inStock === true && product.stock_status === 'out_of_stock') {
            changes.push({ type: 'back_in_stock' });
        }

        // Auto-update product if changes detected
        if (changes.length > 0) {
            const updates = {};
            const priceChange = changes.find(c => c.type === 'price_change');
            const stockChange = changes.find(c => c.type === 'out_of_stock' || c.type === 'back_in_stock');

            if (priceChange) updates.cost_price = check.price;
            if (stockChange?.type === 'out_of_stock') updates.stock_status = 'out_of_stock';
            if (stockChange?.type === 'back_in_stock') updates.stock_status = 'in_stock';

            // Update in DB
            await supabase.from('dropship_products').update(updates).eq('id', product.id);
        }

        results.push({
            id: product.id,
            title: product.title,
            source_url: product.source_url,
            source_store: product.source_store,
            current_cost: product.cost_price,
            supplier_price: check.price,
            supplier_in_stock: check.inStock,
            changes,
            error: check.error,
            checked_at: new Date().toISOString()
        });

        // Small delay between requests to avoid rate limiting
        await new Promise(r => setTimeout(r, 2000));
    }

    return {
        error: null,
        results,
        summary: {
            total: results.length,
            priceChanges: results.filter(r => r.changes.some(c => c.type === 'price_change')).length,
            outOfStock: results.filter(r => r.changes.some(c => c.type === 'out_of_stock')).length,
            backInStock: results.filter(r => r.changes.some(c => c.type === 'back_in_stock')).length,
            errors: results.filter(r => r.error).length,
            checkedAt: new Date().toISOString()
        }
    };
}

/**
 * Check a single product by ID
 */
async function checkSingleProduct(productId) {
    if (!supabase) return { error: 'Database not available' };

    const { data: product, error } = await supabase
        .from('dropship_products')
        .select('*')
        .eq('id', productId)
        .single();

    if (error || !product) return { error: 'Product not found' };
    if (!product.source_url) return { error: 'Product has no source URL' };

    const check = await checkSupplierUrl(product.source_url);
    return {
        product: { id: product.id, title: product.title },
        supplier: check,
        current_cost: product.cost_price,
        current_stock: product.stock_status
    };
}

module.exports = { checkSupplierUrl, runFullCheck, checkSingleProduct };
