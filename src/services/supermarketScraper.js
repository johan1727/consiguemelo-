const axios = require('axios');
const cheerio = require('cheerio');

// Función de utilidad para extraer número de un texto de precio ($1,500.00 -> 1500)
const parsePrice = (priceStr) => {
    if (!priceStr) return null;
    const cleanStr = priceStr.replace(/[^0-9.-]+/g, "");
    const num = parseFloat(cleanStr);
    return isNaN(num) ? null : num;
};

// ==========================================
// WALMART MÉXICO SCRAPER
// ==========================================
async function scrapeWalmartMX(query) {
    try {
        console.log(`[SupermarketScraper] Buscando en Walmart MX: ${query}`);
        // Nota: Walmart MX usa mucho JS y bloqueos agresivos. Usaremos Serper enfocado a site:walmart.com.mx como fallback confiable.
        // Aquí implementamos una búsqueda vía Google Programmable Search / Serper filtrada para mayor robustez en serverless.

        const serperRes = await axios.post('https://google.serper.dev/search', {
            q: `site:walmart.com.mx/ ${query}`,
            gl: "mx",
            hl: "es"
        }, {
            headers: {
                'X-API-KEY': process.env.SERPER_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 8000
        });

        const results = serperRes.data.organic || [];
        return results.slice(0, 3).map(item => {
            let snippetPrice = null;
            const priceMatch = item.snippet && item.snippet.match(/\$[\d,]+(\.\d{2})?/);
            if (priceMatch) {
                snippetPrice = parsePrice(priceMatch[0]);
            }

            return {
                title: item.title.replace(/ \| Walmart.*/i, ''),
                price: snippetPrice,
                url: item.link,
                image: item.imageUrl || 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Walmart_logo.svg/1024px-Walmart_logo.svg.png',
                source: 'Walmart México',
                isLocalStore: true,
                localDetails: {
                    address: 'Varias sucursales / Envío local'
                }
            };
        });

    } catch (error) {
        console.error('[SupermarketScraper] Error Walmart:', error.message);
        return [];
    }
}

// ==========================================
// CHEDRAUI SCRAPER
// ==========================================
async function scrapeChedrauiMX(query) {
    try {
        console.log(`[SupermarketScraper] Buscando en Chedraui: ${query}`);

        const serperRes = await axios.post('https://google.serper.dev/search', {
            q: `site:chedraui.com.mx/ ${query}`,
            gl: "mx",
            hl: "es"
        }, {
            headers: {
                'X-API-KEY': process.env.SERPER_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 8000
        });

        const results = serperRes.data.organic || [];
        return results.slice(0, 3).map(item => {
            let snippetPrice = null;
            const priceMatch = item.snippet && item.snippet.match(/\$[\d,]+(\.\d{2})?/);
            if (priceMatch) {
                snippetPrice = parsePrice(priceMatch[0]);
            }

            return {
                title: item.title.replace(/ \| Chedraui.*/i, ''),
                price: snippetPrice,
                url: item.link,
                image: item.imageUrl || 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Chedraui_logo.svg/1200px-Chedraui_logo.svg.png',
                source: 'Chedraui / Supercito',
                isLocalStore: true,
                localDetails: {
                    address: 'Supercito local / Chedraui'
                }
            };
        });

    } catch (error) {
        console.error('[SupermarketScraper] Error Chedraui:', error.message);
        return [];
    }
}

async function searchSupermarkets(query) {
    const [walmart, chedraui] = await Promise.all([
        scrapeWalmartMX(query),
        scrapeChedrauiMX(query)
    ]);
    return [...walmart, ...chedraui];
}

module.exports = { searchSupermarkets, scrapeWalmartMX, scrapeChedrauiMX };
