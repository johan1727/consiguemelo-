const axios = require('axios');
const cheerio = require('cheerio');

// Pool de User-Agents reales para rotación — reduce bloqueos en producción
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.105 Mobile Safari/537.36',
];

const getRandomUA = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

const getAxiosConfig = () => ({
    headers: {
        'User-Agent': getRandomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
    },
    timeout: 7000,
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const scrapeWithRetry = async (url, maxRetries = 2) => {
    let lastError;
    for (let i = 0; i <= maxRetries; i++) {
        try {
            const config = getAxiosConfig();
            return await axios.get(url, config);
        } catch (error) {
            lastError = error;
            const isRetryable = error.code === 'ECONNABORTED' || (error.response && [503, 429, 403].includes(error.response.status));

            if (i < maxRetries && isRetryable) {
                const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
                console.warn(`[Scraper Retry] Intento ${i + 1} fallido (${error.message}). Reintentando en ${Math.round(delay)}ms...`);
                await sleep(delay);
                continue;
            }
            break;
        }
    }
    throw lastError;
};

exports.scrapeMercadoLibreDirect = async (query) => {
    try {
        console.log(`[Direct Scraper] Iniciando búsqueda ultra-rápida en MercadoLibre para: ${query} (Con Retry)`);
        const url = `https://listado.mercadolibre.com.mx/${encodeURIComponent(query)}`;
        const response = await scrapeWithRetry(url);
        const $ = cheerio.load(response.data);

        const results = [];
        $('.ui-search-result__wrapper, .poly-card').slice(0, 5).each((index, element) => {
            const title = $(element).find('h2.ui-search-item__title, a.poly-component__title').text().trim();
            const urlNode = $(element).find('a.ui-search-link, a.poly-component__title').attr('href');
            let priceText = $(element).find('.andes-money-amount__fraction').first().text().replace(/,/g, '');
            const imageNode = $(element).find('img.ui-search-result-image__image, img.poly-component__picture').attr('data-src') || $(element).find('img.ui-search-result-image__image, img.poly-component__picture').attr('src');

            if (title && priceText && urlNode) {
                results.push({
                    title: title,
                    price: parseFloat(priceText),
                    url: urlNode,
                    source: 'Mercado Libre MX',
                    image: imageNode || ''
                });
            }
        });

        console.log(`[Direct Scraper] MercadoLibre encontró: ${results.length} resultados.`);
        return results;

    } catch (error) {
        console.error('[Direct Scraper] Error crítico en MercadoLibre tras reintentos:', error.message);
        return [];
    }
};

exports.scrapeAmazonDirect = async (query) => {
    try {
        console.log(`[Direct Scraper] Iniciando búsqueda ultra-rápida en Amazon MX para: ${query} (Con Retry)`);
        const url = `https://www.amazon.com.mx/s?k=${encodeURIComponent(query)}&i=popular`;
        const response = await scrapeWithRetry(url);
        const $ = cheerio.load(response.data);

        // Detect CAPTCHA/block
        const bodyText = $('body').text().toLowerCase();
        if (bodyText.includes('robot') || bodyText.includes('captcha') || bodyText.includes('sorry')) {
            console.warn('[Direct Scraper] Amazon MX parece bloqueado (CAPTCHA detectado).');
            return [];
        }

        const results = [];
        $('.s-result-item[data-component-type="s-search-result"]').slice(0, 8).each((index, element) => {
            const title = $(element).find('h2 span').text().trim();
            const urlPath = $(element).find('h2').parent('a').attr('href') || $(element).find('h2 a').attr('href');
            const priceWhole = $(element).find('.a-price-whole').first().text().replace(/,/g, '');
            const imageNode = $(element).find('img.s-image').attr('src');
            // Also try to get rating info
            const ratingText = $(element).find('.a-icon-alt').first().text().trim();

            if (title && priceWhole && urlPath) {
                results.push({
                    title: title,
                    price: parseFloat(priceWhole),
                    url: urlPath.startsWith('http') ? urlPath : `https://www.amazon.com.mx${urlPath}`,
                    source: 'Amazon MX',
                    image: imageNode || '',
                    rating: ratingText || null
                });
            }
        });

        console.log(`[Direct Scraper] Amazon MX encontró: ${results.length} resultados.`);
        return results;
    } catch (error) {
        console.error('[Direct Scraper] Error crítico en Amazon MX tras reintentos:', error.message);
        return [];
    }
};

/**
 * Scraper para Walmart México
 */
exports.scrapeWalmartMX = async (query) => {
    try {
        console.log(`[Direct Scraper] Buscando en Walmart MX: ${query}`);
        const url = `https://www.walmart.com.mx/productos?Ntt=${encodeURIComponent(query)}`;
        const response = await scrapeWithRetry(url);
        const $ = cheerio.load(response.data);

        const results = [];
        $('[data-testid="product-card"], .product-card, [class*="ProductCard"]').slice(0, 5).each((i, el) => {
            const title = $(el).find('[class*="title"], h3, h4, [data-testid="product-title"]').first().text().trim();
            const link = $(el).find('a[href*="/ip/"], a[href*="/productos/"]').first().attr('href');
            const priceText = $(el).find('[class*="price"], [data-testid="product-price"]').first().text().replace(/[^0-9.]/g, '');
            const img = $(el).find('img').first().attr('src') || $(el).find('img').first().attr('data-src');

            if (title && priceText && link) {
                results.push({
                    title,
                    price: parseFloat(priceText),
                    url: link.startsWith('http') ? link : `https://www.walmart.com.mx${link}`,
                    source: 'Walmart MX',
                    image: img || ''
                });
            }
        });

        console.log(`[Direct Scraper] Walmart MX encontró: ${results.length} resultados.`);
        return results;
    } catch (error) {
        console.error('[Direct Scraper] Error en Walmart MX:', error.message);
        return [];
    }
};

/**
 * Scraper para Liverpool México
 */
exports.scrapeLiverpoolMX = async (query) => {
    try {
        console.log(`[Direct Scraper] Buscando en Liverpool MX: ${query}`);
        const url = `https://www.liverpool.com.mx/tienda?s=${encodeURIComponent(query)}`;
        const response = await scrapeWithRetry(url);
        const $ = cheerio.load(response.data);

        const results = [];
        // Liverpool uses JSON-LD structured data and product cards
        $('script[type="application/ld+json"]').each((i, el) => {
            try {
                const json = JSON.parse($(el).html());
                if (json['@type'] === 'ItemList' && json.itemListElement) {
                    json.itemListElement.slice(0, 5).forEach(item => {
                        const product = item.item || item;
                        if (product.name && product.offers) {
                            const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
                            results.push({
                                title: product.name,
                                price: parseFloat(offer.price) || null,
                                url: product.url || product['@id'] || '',
                                source: 'Liverpool',
                                image: product.image || ''
                            });
                        }
                    });
                }
            } catch (e) { /* skip invalid JSON-LD */ }
        });

        // Fallback: parse HTML product cards
        if (results.length === 0) {
            $('[class*="product-card"], [class*="plp-card"], .card-product, a[class*="product"]').slice(0, 5).each((i, el) => {
                const title = $(el).find('[class*="title"], [class*="name"], h3, h4').first().text().trim();
                const link = $(el).is('a') ? $(el).attr('href') : $(el).find('a').first().attr('href');
                const priceText = $(el).find('[class*="price"], [class*="Price"]').first().text().replace(/[^0-9.]/g, '');
                const img = $(el).find('img').first().attr('src') || $(el).find('img').first().attr('data-src');

                if (title && title.length > 3 && link) {
                    results.push({
                        title,
                        price: priceText ? parseFloat(priceText) : null,
                        url: link.startsWith('http') ? link : `https://www.liverpool.com.mx${link}`,
                        source: 'Liverpool',
                        image: img || ''
                    });
                }
            });
        }

        console.log(`[Direct Scraper] Liverpool MX encontró: ${results.length} resultados.`);
        return results;
    } catch (error) {
        console.error('[Direct Scraper] Error en Liverpool MX:', error.message);
        return [];
    }
};

/**
 * Scraper para Coppel México
 */
exports.scrapeCoppelMX = async (query) => {
    try {
        console.log(`[Direct Scraper] Buscando en Coppel MX: ${query}`);
        const url = `https://www.coppel.com/search?searchTerms=${encodeURIComponent(query)}`;
        const response = await scrapeWithRetry(url);
        const $ = cheerio.load(response.data);

        const results = [];
        // Coppel product cards
        $('[class*="product-card"], .productCard, [class*="ProductCard"], [data-product]').slice(0, 5).each((i, el) => {
            const title = $(el).find('[class*="title"], [class*="name"], [class*="Title"], h3, h4').first().text().trim();
            const link = $(el).find('a[href*="/producto/"], a[href*="/p/"]').first().attr('href') || $(el).find('a').first().attr('href');
            const priceText = $(el).find('[class*="price"], [class*="Price"], [class*="precio"]').first().text().replace(/[^0-9.]/g, '');
            const img = $(el).find('img').first().attr('src') || $(el).find('img').first().attr('data-src');

            if (title && title.length > 3 && link) {
                results.push({
                    title,
                    price: priceText ? parseFloat(priceText) : null,
                    url: link.startsWith('http') ? link : `https://www.coppel.com${link}`,
                    source: 'Coppel',
                    image: img || ''
                });
            }
        });

        // Fallback: JSON-LD structured data
        if (results.length === 0) {
            $('script[type="application/ld+json"]').each((i, el) => {
                try {
                    const json = JSON.parse($(el).html());
                    const items = json['@type'] === 'ItemList' ? (json.itemListElement || []) : (json['@type'] === 'Product' ? [json] : []);
                    items.slice(0, 5).forEach(item => {
                        const product = item.item || item;
                        if (product.name && product.offers) {
                            const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
                            results.push({
                                title: product.name,
                                price: parseFloat(offer?.price) || null,
                                url: product.url || '',
                                source: 'Coppel',
                                image: typeof product.image === 'string' ? product.image : (product.image?.[0] || '')
                            });
                        }
                    });
                } catch (e) { /* skip */ }
            });
        }

        console.log(`[Direct Scraper] Coppel MX encontró: ${results.length} resultados.`);
        return results;
    } catch (error) {
        console.error('[Direct Scraper] Error en Coppel MX:', error.message);
        return [];
    }
};

/**
 * Scraper para AliExpress (productos internacionales baratos)
 */
exports.scrapeAliExpress = async (query) => {
    try {
        console.log(`[Direct Scraper] Buscando en AliExpress: ${query}`);
        // Use wholesale.aliexpress or the search page with ship-from MX/US filter
        const url = `https://www.aliexpress.com/w/wholesale-${encodeURIComponent(query).replace(/%20/g, '-')}.html?g=y&SearchText=${encodeURIComponent(query)}&shipCountry=MX`;
        const config = getAxiosConfig();
        config.headers['Accept-Language'] = 'es-MX,es;q=0.9';
        config.timeout = 8000;
        
        const response = await axios.get(url, config);
        const $ = cheerio.load(response.data);

        const results = [];

        // AliExpress renders product cards with various class patterns
        $('[class*="search-item-card"], [class*="SearchItem"], [class*="product-card"], .list--gallery--C2f2tvm a').slice(0, 5).each((i, el) => {
            const title = $(el).find('[class*="title"], h3, h1').first().text().trim();
            const link = $(el).is('a') ? $(el).attr('href') : $(el).find('a').first().attr('href');
            const priceText = $(el).find('[class*="price"], [class*="Price"]').first().text().replace(/[^0-9.]/g, '');
            const img = $(el).find('img').first().attr('src') || $(el).find('img').first().attr('data-src');

            if (title && title.length > 3 && link) {
                const fullUrl = link.startsWith('http') ? link : `https://www.aliexpress.com${link}`;
                results.push({
                    title: title.slice(0, 200),
                    price: priceText ? parseFloat(priceText) : null,
                    url: fullUrl.split('?')[0], // Clean tracking params
                    source: 'AliExpress',
                    image: img ? (img.startsWith('//') ? `https:${img}` : img) : ''
                });
            }
        });

        // Fallback: Try to extract from __NEXT_DATA__ or window.runParams JSON
        if (results.length === 0) {
            const scriptContent = $('script').toArray()
                .map(s => $(s).html())
                .find(s => s && (s.includes('itemList') || s.includes('productId')));
            
            if (scriptContent) {
                const priceMatches = [...scriptContent.matchAll(/"(?:min|original)?[Pp]rice"\s*:\s*"?([\d.]+)"?/g)];
                const titleMatches = [...scriptContent.matchAll(/"(?:title|subject|productTitle)"\s*:\s*"([^"]{5,200})"/g)];
                const urlMatches = [...scriptContent.matchAll(/"(?:productDetailUrl|itemUrl)"\s*:\s*"([^"]+)"/g)];

                for (let i = 0; i < Math.min(titleMatches.length, 5); i++) {
                    results.push({
                        title: titleMatches[i]?.[1] || 'Producto AliExpress',
                        price: priceMatches[i] ? parseFloat(priceMatches[i][1]) : null,
                        url: urlMatches[i] ? urlMatches[i][1] : `https://www.aliexpress.com/w/wholesale-${encodeURIComponent(query)}.html`,
                        source: 'AliExpress',
                        image: ''
                    });
                }
            }
        }

        console.log(`[Direct Scraper] AliExpress encontró: ${results.length} resultados.`);
        return results;
    } catch (error) {
        console.error('[Direct Scraper] Error en AliExpress:', error.message);
        return [];
    }
};

/**
 * Scraper para Elektra México (gratis, sin Serper)
 */
exports.scrapeElektraMX = async (query) => {
    try {
        console.log(`[Direct Scraper] Buscando en Elektra MX: ${query}`);
        const url = `https://www.elektra.com.mx/busqueda?q=${encodeURIComponent(query)}`;
        const response = await scrapeWithRetry(url);
        const $ = cheerio.load(response.data);

        const results = [];

        // Try JSON-LD structured data first (most reliable)
        $('script[type="application/ld+json"]').each((i, el) => {
            try {
                const json = JSON.parse($(el).html());
                const items = json['@type'] === 'ItemList' ? (json.itemListElement || [])
                    : json['@type'] === 'Product' ? [json] : [];
                items.slice(0, 5).forEach(item => {
                    const product = item.item || item;
                    if (product.name && product.offers) {
                        const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
                        results.push({
                            title: product.name,
                            price: parseFloat(offer?.price) || null,
                            url: product.url || product['@id'] || url,
                            source: 'Elektra',
                            image: typeof product.image === 'string' ? product.image : (product.image?.[0] || '')
                        });
                    }
                });
            } catch (e) { /* skip */ }
        });

        // Fallback: HTML product cards
        if (results.length === 0) {
            $('[class*="product-card"], [class*="ProductCard"], [data-product], .vtex-search-result-3-x-galleryItem').slice(0, 5).each((i, el) => {
                const title = $(el).find('[class*="productName"], [class*="title"], [class*="name"], h3, h2').first().text().trim();
                const link = $(el).find('a[href*="/producto/"], a[href*="/p"]').first().attr('href') || $(el).find('a').first().attr('href');
                const priceText = $(el).find('[class*="sellingPrice"], [class*="price"], [class*="Price"]').first().text().replace(/[^0-9.]/g, '');
                const img = $(el).find('img').first().attr('src') || $(el).find('img').first().attr('data-src');

                if (title && title.length > 3 && link) {
                    results.push({
                        title,
                        price: priceText ? parseFloat(priceText) : null,
                        url: link.startsWith('http') ? link : `https://www.elektra.com.mx${link}`,
                        source: 'Elektra',
                        image: img || ''
                    });
                }
            });
        }

        console.log(`[Direct Scraper] Elektra MX encontró: ${results.length} resultados.`);
        return results;
    } catch (error) {
        console.error('[Direct Scraper] Error en Elektra MX:', error.message);
        return [];
    }
};

/**
 * Scraper para Best Buy México (gratis, sin Serper)
 */
exports.scrapeBestBuyMX = async (query) => {
    try {
        console.log(`[Direct Scraper] Buscando en Best Buy MX: ${query}`);
        const url = `https://www.bestbuy.com.mx/c/search?text=${encodeURIComponent(query)}`;
        const response = await scrapeWithRetry(url);
        const $ = cheerio.load(response.data);

        const results = [];

        // JSON-LD structured data
        $('script[type="application/ld+json"]').each((i, el) => {
            try {
                const json = JSON.parse($(el).html());
                const items = json['@type'] === 'ItemList' ? (json.itemListElement || [])
                    : json['@type'] === 'Product' ? [json] : [];
                items.slice(0, 5).forEach(item => {
                    const product = item.item || item;
                    if (product.name && product.offers) {
                        const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
                        results.push({
                            title: product.name,
                            price: parseFloat(offer?.price) || null,
                            url: product.url || url,
                            source: 'Best Buy MX',
                            image: typeof product.image === 'string' ? product.image : (product.image?.[0] || '')
                        });
                    }
                });
            } catch (e) { /* skip */ }
        });

        // Fallback: HTML product cards
        if (results.length === 0) {
            $('[class*="product-card"], [class*="ProductCard"], .sku-item, [class*="list-item"]').slice(0, 5).each((i, el) => {
                const title = $(el).find('[class*="title"], [class*="name"], h4, h3, .sku-title a').first().text().trim();
                const link = $(el).find('a[href*="/p/"]').first().attr('href') || $(el).find('a').first().attr('href');
                const priceText = $(el).find('[class*="price"], [class*="Price"], .priceView-customer-price span').first().text().replace(/[^0-9.]/g, '');
                const img = $(el).find('img').first().attr('src') || $(el).find('img').first().attr('data-src');

                if (title && title.length > 3 && link) {
                    results.push({
                        title,
                        price: priceText ? parseFloat(priceText) : null,
                        url: link.startsWith('http') ? link : `https://www.bestbuy.com.mx${link}`,
                        source: 'Best Buy MX',
                        image: img || ''
                    });
                }
            });
        }

        console.log(`[Direct Scraper] Best Buy MX encontró: ${results.length} resultados.`);
        return results;
    } catch (error) {
        console.error('[Direct Scraper] Error en Best Buy MX:', error.message);
        return [];
    }
};

/**
 * Scraper para Costco México (gratis, sin Serper)
 */
exports.scrapeCostcoMX = async (query) => {
    try {
        console.log(`[Direct Scraper] Buscando en Costco MX: ${query}`);
        const url = `https://www.costco.com.mx/search?text=${encodeURIComponent(query)}`;
        const response = await scrapeWithRetry(url);
        const $ = cheerio.load(response.data);

        const results = [];

        // Costco uses product-list items
        $('[class*="product"], .product-tile, [class*="ProductCard"]').slice(0, 5).each((i, el) => {
            const title = $(el).find('[class*="description"], [class*="title"], [class*="name"], h3, h2, a[class*="product"]').first().text().trim();
            const link = $(el).find('a[href*="/p/"], a[href*=".product."]').first().attr('href') || $(el).find('a').first().attr('href');
            const priceText = $(el).find('[class*="price"], [class*="Price"]').first().text().replace(/[^0-9.]/g, '');
            const img = $(el).find('img').first().attr('src') || $(el).find('img').first().attr('data-src');

            if (title && title.length > 3 && link) {
                results.push({
                    title,
                    price: priceText ? parseFloat(priceText) : null,
                    url: link.startsWith('http') ? link : `https://www.costco.com.mx${link}`,
                    source: 'Costco MX',
                    image: img || ''
                });
            }
        });

        // Fallback: JSON-LD
        if (results.length === 0) {
            $('script[type="application/ld+json"]').each((i, el) => {
                try {
                    const json = JSON.parse($(el).html());
                    if (json['@type'] === 'ItemList' && json.itemListElement) {
                        json.itemListElement.slice(0, 5).forEach(item => {
                            const product = item.item || item;
                            if (product.name && product.offers) {
                                const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
                                results.push({
                                    title: product.name,
                                    price: parseFloat(offer?.price) || null,
                                    url: product.url || url,
                                    source: 'Costco MX',
                                    image: typeof product.image === 'string' ? product.image : ''
                                });
                            }
                        });
                    }
                } catch (e) { /* skip */ }
            });
        }

        console.log(`[Direct Scraper] Costco MX encontró: ${results.length} resultados.`);
        return results;
    } catch (error) {
        console.error('[Direct Scraper] Error en Costco MX:', error.message);
        return [];
    }
};

/**
 * Scraper para Sam's Club México (gratis, sin Serper)
 */
exports.scrapeSamsClubMX = async (query) => {
    try {
        console.log(`[Direct Scraper] Buscando en Sam's Club MX: ${query}`);
        const url = `https://www.sams.com.mx/buscar?q=${encodeURIComponent(query)}`;
        const response = await scrapeWithRetry(url);
        const $ = cheerio.load(response.data);

        const results = [];

        // Sam's uses VTEX-style product cards
        $('[class*="product-card"], [class*="ProductCard"], [class*="vtex-search"], [data-testid*="product"]').slice(0, 5).each((i, el) => {
            const title = $(el).find('[class*="productName"], [class*="title"], [class*="name"], h3, h2').first().text().trim();
            const link = $(el).find('a[href*="/producto/"], a[href*="/p"]').first().attr('href') || $(el).find('a').first().attr('href');
            const priceText = $(el).find('[class*="sellingPrice"], [class*="price"], [class*="Price"]').first().text().replace(/[^0-9.]/g, '');
            const img = $(el).find('img').first().attr('src') || $(el).find('img').first().attr('data-src');

            if (title && title.length > 3 && link) {
                results.push({
                    title,
                    price: priceText ? parseFloat(priceText) : null,
                    url: link.startsWith('http') ? link : `https://www.sams.com.mx${link}`,
                    source: "Sam's Club MX",
                    image: img || ''
                });
            }
        });

        // Fallback: JSON-LD
        if (results.length === 0) {
            $('script[type="application/ld+json"]').each((i, el) => {
                try {
                    const json = JSON.parse($(el).html());
                    const items = json['@type'] === 'ItemList' ? (json.itemListElement || [])
                        : json['@type'] === 'Product' ? [json] : [];
                    items.slice(0, 5).forEach(item => {
                        const product = item.item || item;
                        if (product.name && product.offers) {
                            const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
                            results.push({
                                title: product.name,
                                price: parseFloat(offer?.price) || null,
                                url: product.url || url,
                                source: "Sam's Club MX",
                                image: typeof product.image === 'string' ? product.image : ''
                            });
                        }
                    });
                } catch (e) { /* skip */ }
            });
        }

        console.log(`[Direct Scraper] Sam's Club MX encontró: ${results.length} resultados.`);
        return results;
    } catch (error) {
        console.error('[Direct Scraper] Error en Sam\'s Club MX:', error.message);
        return [];
    }
};

/**
 * Scraper para Home Depot México (gratis, sin Serper)
 */
exports.scrapeHomeDepotMX = async (query) => {
    try {
        console.log(`[Direct Scraper] Buscando en Home Depot MX: ${query}`);
        const url = `https://www.homedepot.com.mx/busqueda/${encodeURIComponent(query)}`;
        const response = await scrapeWithRetry(url);
        const $ = cheerio.load(response.data);

        const results = [];

        $('[class*="product"], .product-card, [class*="ProductCard"]').slice(0, 5).each((i, el) => {
            const title = $(el).find('[class*="title"], [class*="name"], h3, h2').first().text().trim();
            const link = $(el).find('a[href*="/producto/"], a[href*="/p/"]').first().attr('href') || $(el).find('a').first().attr('href');
            const priceText = $(el).find('[class*="price"], [class*="Price"]').first().text().replace(/[^0-9.]/g, '');
            const img = $(el).find('img').first().attr('src') || $(el).find('img').first().attr('data-src');

            if (title && title.length > 3 && link) {
                results.push({
                    title,
                    price: priceText ? parseFloat(priceText) : null,
                    url: link.startsWith('http') ? link : `https://www.homedepot.com.mx${link}`,
                    source: 'Home Depot MX',
                    image: img || ''
                });
            }
        });

        console.log(`[Direct Scraper] Home Depot MX encontró: ${results.length} resultados.`);
        return results;
    } catch (error) {
        console.error('[Direct Scraper] Error en Home Depot MX:', error.message);
        return [];
    }
};

/**
 * Scraper para Office Depot México (gratis, sin Serper)
 */
exports.scrapeOfficeDepotMX = async (query) => {
    try {
        console.log(`[Direct Scraper] Buscando en Office Depot MX: ${query}`);
        const url = `https://www.officedepot.com.mx/officedepot/en/search/?text=${encodeURIComponent(query)}`;
        const response = await scrapeWithRetry(url);
        const $ = cheerio.load(response.data);

        const results = [];

        $('[class*="product"], .product-item, [class*="ProductCard"]').slice(0, 5).each((i, el) => {
            const title = $(el).find('[class*="title"], [class*="name"], h3, h2, .product-name').first().text().trim();
            const link = $(el).find('a[href*="/p/"], a[href*="/producto"]').first().attr('href') || $(el).find('a').first().attr('href');
            const priceText = $(el).find('[class*="price"], [class*="Price"]').first().text().replace(/[^0-9.]/g, '');
            const img = $(el).find('img').first().attr('src') || $(el).find('img').first().attr('data-src');

            if (title && title.length > 3 && link) {
                results.push({
                    title,
                    price: priceText ? parseFloat(priceText) : null,
                    url: link.startsWith('http') ? link : `https://www.officedepot.com.mx${link}`,
                    source: 'Office Depot MX',
                    image: img || ''
                });
            }
        });

        console.log(`[Direct Scraper] Office Depot MX encontró: ${results.length} resultados.`);
        return results;
    } catch (error) {
        console.error('[Direct Scraper] Error en Office Depot MX:', error.message);
        return [];
    }
};
