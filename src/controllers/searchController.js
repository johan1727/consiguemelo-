const llmService = require('../services/llmService');
const shoppingService = require('../services/shoppingService');
const affiliateManager = require('../utils/affiliateManager');
const cacheService = require('../services/cacheService');
const supabase = require('../config/supabase');
const visionService = require('../services/visionService');

exports.analyzeImage = async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) {
            return res.status(400).json({ error: 'No se proporcionó ninguna imagen.' });
        }

        // Validate base64 payload size (max ~5MB decoded = ~6.7MB base64)
        const MAX_BASE64_LENGTH = 7 * 1024 * 1024; // 7MB in base64 chars
        if (image.length > MAX_BASE64_LENGTH) {
            return res.status(413).json({ error: 'La imagen es demasiado grande. Máximo 5MB.' });
        }

        // Limpiar prefijo base64 si existe
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

        const result = await visionService.identifyProduct(base64Data);
        res.json(result);
    } catch (error) {
        console.error('Error en analyzeImage:', error);
        res.status(500).json({ error: 'Error al procesar la imagen con IA.' });
    }
};

exports.searchProduct = async (req, res) => {
    try {
        const { chatHistory = [], radius, lat, lng, skipLLM } = req.body;

        // Use verified userId from auth middleware (JWT), ignore body.userId
        const userId = req.userId || null;

        // Sanitize: strip HTML tags, trim whitespace, limit to 200 chars
        const query = (typeof req.body.query === 'string')
            ? req.body.query.replace(/<[^>]*>/g, '').trim().slice(0, 200)
            : null;

        if (!query) {
            return res.status(400).json({ error: 'Falta el texto de búsqueda (query) en el body.' });
        }

        let usageWarning = null;

        // PAYWALL Enforcement: Rate limit anonymous users by IP (Supabase-based for serverless safety)
        if (!userId) {
            // x-vercel-forwarded-for is authoritative on Vercel (can't be spoofed by client)
            const ip = req.headers['x-vercel-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || req.headers['x-forwarded-for']?.split(',').pop()?.trim() || req.ip || 'unknown';
            const ANON_DAILY_LIMIT = 5;

            if (supabase) {
                try {
                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);
                    const { count, error } = await supabase
                        .from('rate_limits')
                        .select('*', { count: 'exact', head: true })
                        .eq('ip', ip)
                        .gte('created_at', todayStart.toISOString());

                    if (!error && count >= ANON_DAILY_LIMIT) {
                        return res.status(402).json({
                            error: `Límite diario de ${ANON_DAILY_LIMIT} búsquedas gratuitas alcanzado. Inicia sesión o hazte VIP para más búsquedas.`,
                            paywall: true
                        });
                    }
                    // Log this anonymous search (fire & forget)
                    supabase.from('rate_limits').insert({ ip, created_at: new Date().toISOString() }).then(() => { }).catch(() => { });
                } catch (e) {
                    console.warn('[Anon Paywall] Supabase error, allowing request:', e.message);
                }
            } else {
                // RAM fallback (unreliable in serverless but better than nothing)
                if (!global._anonSearchLog) global._anonSearchLog = {};
                const todayKey = new Date().toISOString().slice(0, 10);
                const ipKey = `${ip}:${todayKey}`;
                global._anonSearchLog[ipKey] = (global._anonSearchLog[ipKey] || 0) + 1;
                if (global._anonSearchLog[ipKey] > ANON_DAILY_LIMIT) {
                    return res.status(402).json({
                        error: `Límite diario de ${ANON_DAILY_LIMIT} búsquedas gratuitas alcanzado. Inicia sesión o hazte VIP para más búsquedas.`,
                        paywall: true
                    });
                }
            }
        }

        // PAYWALL Enforcement: Verificar límites por plan en backend (authenticated users)
        if (userId && supabase) {
            const { data: profile } = await supabase.from('profiles').select('plan, is_premium').eq('id', userId).single();
            if (profile) {
                let reqLimit = 5;
                let isDaily = true;
                let planName = 'Gratis';

                if (profile.plan === 'b2b') {
                    reqLimit = 5000;
                    isDaily = false;
                    planName = 'Revendedor B2B';
                } else if (profile.is_premium || profile.plan === 'personal_vip') {
                    reqLimit = 500;
                    isDaily = false;
                    planName = 'VIP';
                }

                let queryDate = new Date();
                if (isDaily) {
                    queryDate.setHours(0, 0, 0, 0);
                } else {
                    queryDate.setDate(1); // Inicio de mes
                    queryDate.setHours(0, 0, 0, 0);
                }

                const { count, error } = await supabase.from('searches')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId)
                    .gte('created_at', queryDate.toISOString());

                if (!error) {
                    if (count >= reqLimit) {
                        const errorMsg = isDaily
                            ? 'Límite diario de búsquedas gratuitas alcanzado. Mejora a VIP para búsquedas sin límites.'
                            : `Límite mensual de búsquedas alcanzado (${reqLimit} para el plan ${planName}). Por favor espera a tu siguiente ciclo o contacta a soporte.`;
                        return res.status(402).json({ error: errorMsg, paywall: !profile.is_premium, upgrade_required: profile.is_premium });
                    }

                    // Generar Warning si está cerca del límite
                    if (!isDaily && count >= reqLimit * 0.9) {
                        usageWarning = `⚠️ Te estás acercando a tu límite mensual (${count}/${reqLimit} búsquedas).`;
                    } else if (isDaily && count === reqLimit - 1) {
                        usageWarning = `⚠️ Te queda 1 búsqueda gratuita hoy.`;
                    }
                }
            }
        }

        let llmAnalysis;
        if (skipLLM) {
            console.log(`[Direct Search] Saltando LLM para: ${query}`);
            llmAnalysis = {
                action: 'search',
                searchQuery: query,
                condition: 'new',
                reason: 'Direct category search'
            };
        } else {
            // 1. Evaluar el mensaje del usuario con la IA Conversacional (incluyendo historial)
            llmAnalysis = await llmService.analyzeMessage(query, chatHistory);
            console.log('Análisis LLM:', llmAnalysis);
        }

        // 2. Si faltan datos, devolver la pregunta de seguimiento al frontend
        if (llmAnalysis.action === 'ask') {
            return res.json({
                tipo_respuesta: 'conversacion',
                pregunta_ia: llmAnalysis.question,
                sugerencias: llmAnalysis.sugerencias || [],
                advertencia_uso: usageWarning
            });
        }

        // 3. Si la acción es 'search', ejecutamos Google Shopping
        const searchQuery = llmAnalysis.searchQuery;
        const isNew = llmAnalysis.condition === 'new';

        // NUEVO: Verificamos en Caché
        const cachedResults = await cacheService.getCachedResults(searchQuery, radius, lat, lng);
        if (cachedResults) {
            return res.json({
                tipo_respuesta: 'resultados',
                intencion_detectada: {
                    busqueda: searchQuery,
                    condicion: llmAnalysis.condition,
                    desde_cache: true
                },
                top_5_baratos: cachedResults,
                advertencia_uso: usageWarning
            });
        }

        console.log(`[Search Pipeline] Buscando: "${searchQuery}" | radius=${radius} | lat=${lat} | lng=${lng} | intent=${llmAnalysis.intent_type}`);
        const shoppingResults = await shoppingService.searchGoogleShopping(searchQuery, radius, lat, lng, llmAnalysis.intent_type);
        console.log(`[Search Pipeline] Resultados de shoppingService: ${shoppingResults.length}`);

        // NUEVO: Multi-Query Background Scraper para Variantes (No gasta créditos Serper)
        // Strip Google-only negative keywords for direct scrapers
        const cleanSearchQuery = searchQuery.replace(/\s+-\w+/g, '').trim();
        const altQueries = llmAnalysis.alternativeQueries || [];
        if (altQueries.length > 0) {
            console.log(`Ejecutando Multi-Query alternativas: ${altQueries.join(', ')}`);
            const directScraper = require('../services/directScraper');
            const altPromises = [];
            for (const altQ of altQueries.slice(0, 2)) {
                // Strip site: operators — they don't work on direct scraper searches
                const cleanAltQ = altQ.replace(/\bsite:\S+/gi, '').trim();
                if (!cleanAltQ) continue;
                altPromises.push(directScraper.scrapeMercadoLibreDirect(cleanAltQ));
                altPromises.push(directScraper.scrapeAmazonDirect(cleanAltQ));
                altPromises.push(directScraper.scrapeLiverpoolMX(cleanAltQ));
                altPromises.push(directScraper.scrapeCoppelMX(cleanAltQ));
            }
            const altResultsRaw = await Promise.allSettled(altPromises);
            altResultsRaw.forEach(altResult => {
                if (altResult.status === 'fulfilled' && altResult.value) {
                    shoppingResults.push(...altResult.value);
                }
            });
        }

        console.log(`[Search Pipeline] Total resultados (con alt queries): ${shoppingResults.length}`);

        if (shoppingResults.length === 0) {
            console.warn(`[Search Pipeline] ⚠️ CERO resultados para "${searchQuery}". Serper key: ${process.env.SERPER_API_KEY ? 'SET' : 'MISSING'}`);
            return res.json({
                tipo_respuesta: 'resultados',
                intencion_detectada: {
                    busqueda: searchQuery,
                    condicion: llmAnalysis.condition,
                    desde_cache: false
                },
                top_5_baratos: [],
                sugerencias: llmAnalysis.alternativeQueries || [searchQuery + ' ofertas', searchQuery + ' amazon', searchQuery + ' mercado libre'],
                advertencia_uso: usageWarning
            });
        }

        // 4. Filtrar y Procesar resultados (Simular filtro Condition + Deduplicar)
        // --- PRE-FILTER: Remove garbage results ---
        const cleanedResults = shoppingResults.filter(item => {
            // Keep local store results even without price
            if (item.isLocalStore) return true;
            // Remove items with no title or garbage titles (navigation pages, category pages)
            const title = (item.title || '').trim();
            if (title.length < 5) return false;
            if (/^(compra|ver|buscar|encuentra|tienda|catálogo|categoría|página|p\.\-?\d)/i.test(title)) return false;
            // Robust price parsing: handle "$1,299.00", "MXN 1299", "1,299", numbers, etc.
            let price = null;
            if (item.price != null) {
                const priceStr = String(item.price).replace(/[^0-9.,]/g, '').replace(/,/g, '');
                price = parseFloat(priceStr);
                // Fix: update item.price to numeric so downstream code works
                if (Number.isFinite(price) && price > 0) {
                    item.price = price;
                }
            }
            if (price === null || !Number.isFinite(price) || price <= 0) return false;
            // Remove suspiciously cheap items (likely price-per-unit or errors) — lowered from 10 to 5
            if (price < 5) return false;
            return true;
        });
        console.log(`[Search Pipeline] Después de pre-filter: ${cleanedResults.length} de ${shoppingResults.length}`);

        // Deduplicación: por URL exacta + Jaccard similarity en títulos
        const seen = new Set();
        const uniqueResults = [];
        for (const item of cleanedResults) {
            // Dedup by exact URL first
            const urlKey = (item.url || '').split('?')[0].toLowerCase();
            if (urlKey && seen.has(urlKey)) continue;
            if (urlKey) seen.add(urlKey);

            // Jaccard similarity on title tokens
            const tokensI = new Set(item.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 2));
            const isDuplicate = uniqueResults.some(u => {
                const tokensU = new Set(u.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 2));
                const intersection = [...tokensI].filter(t => tokensU.has(t)).length;
                const union = new Set([...tokensI, ...tokensU]).size;
                return union > 0 && (intersection / union) > 0.70;
            });
            if (!isDuplicate) {
                uniqueResults.push(item);
            }
        }

        // --- FILTRO ANTI-ACCESORIOS: Detectar si la búsqueda es un producto principal caro ---
        const mainProductKeywords = /consola|laptop|iphone|samsung|galaxy|macbook|ipad|playstation|xbox|nintendo|switch|televisor|tv |pantalla|refrigerador|lavadora|aire acondicionado|pc gamer|computadora|airpods|watch|pixel|fold|flip/i;
        const accessoryKeywords = /funda|case|protector|mica|cristal|templado|cable|cargador|soporte|base|skin|sticker|grip|joystick|thumb|screen protector|película|pelicula|correa|strap|bolsa|estuche|adaptador|hub|dock(?!ing)|batería|battery|replacement|reemplazo|vidrio|silicona|silicone|tpu|rubber|cover|carcasa|cubierta|holder|mount|stand|sleeve|pouch|cleaning|limpieza|ear.?tip|ear.?bud|ear.?pad|ear.?cushion|hook/i;
        const isMainProductSearch = mainProductKeywords.test(searchQuery);

        // Marcar cada item como accesorio o no
        if (isMainProductSearch) {
            for (const item of uniqueResults) {
                const titleLower = (item.title || '').toLowerCase();
                const price = item.price != null ? parseFloat(item.price) : null;
                item._isAccessory = accessoryKeywords.test(titleLower);
            }
            console.log(`[Anti-Accesorio] ${uniqueResults.filter(i => !i._isAccessory).length} productos principales, ${uniqueResults.filter(i => i._isAccessory).length} accesorios marcados`);
        }

        // Ordenamos: productos principales por precio, luego accesorios por precio
        const hasLocation = Boolean(lat && lng && radius !== 'global');
        const sortedResults = uniqueResults.sort((a, b) => {
            // Tier sort: main products first, accessories last
            if (isMainProductSearch) {
                if (a._isAccessory && !b._isAccessory) return 1;
                if (!a._isAccessory && b._isAccessory) return -1;
            }

            const aPrice = a.price == null ? Infinity : parseFloat(a.price);
            const bPrice = b.price == null ? Infinity : parseFloat(b.price);

            if (hasLocation) {
                const aBoost = a.isLocalStore ? Math.min(aPrice * 0.10, 150) : 0;
                const bBoost = b.isLocalStore ? Math.min(bPrice * 0.10, 150) : 0;
                return (aPrice - aBoost) - (bPrice - bBoost);
            } else {
                return aPrice - bPrice;
            }
        });

        // --- DIVERSIDAD: Round-robin por tienda (máx 3 por tienda) ---
        const MAX_PER_STORE = 3;
        const MAX_RESULTS = 10;
        const storeCount = {};
        const top10 = [];
        for (const item of sortedResults) {
            if (top10.length >= MAX_RESULTS) break;
            const storeKey = (item.source || 'Desconocida').toLowerCase().replace(/[^a-záéíóúñ0-9]/g, '');
            storeCount[storeKey] = (storeCount[storeKey] || 0) + 1;
            if (storeCount[storeKey] <= MAX_PER_STORE) {
                top10.push(item);
            }
        }
        // Si no llenamos 10, completar con los restantes sin importar tienda
        if (top10.length < MAX_RESULTS) {
            for (const item of sortedResults) {
                if (top10.length >= MAX_RESULTS) break;
                if (!top10.includes(item)) top10.push(item);
            }
        }

        // 5. Inyectar links de afiliados (o dejarlos como Loss Leaders)
        const finalProducts = top10.map(product => {
            return {
                titulo: product.title,
                precio: product.price,            // null for local stores
                tienda: product.source,
                imagen: product.image,
                urlOriginal: product.url,
                urlMonetizada: affiliateManager.generateAffiliateLink(product.url, product.source),
                isLocalStore: product.isLocalStore || false,
                localDetails: product.localDetails || null,
                cupon: llmAnalysis.cupon || null
            };
        });

        // Historial de precios: comparar con snapshots previos por URL
        const priceHistoryMap = await cacheService.getPriceHistoryMap(searchQuery, radius, lat, lng, finalProducts);
        const productsWithTrend = finalProducts.map((product) => {
            const normalizedUrl = cacheService.normalizeProductUrl(product.urlMonetizada || product.urlOriginal);
            const productHistory = priceHistoryMap[normalizedUrl] || [];
            const previous = productHistory[0];

            const currentPrice = typeof product.precio === 'number'
                ? product.precio
                : parseFloat(String(product.precio || '').replace(/[^0-9.]/g, ''));

            if (!previous || !Number.isFinite(currentPrice) || currentPrice <= 0) {
                return product;
            }

            const previousPrice = Number(previous.price);
            const delta = Number((currentPrice - previousPrice).toFixed(2));
            const absDelta = Math.abs(delta);
            const direction = absDelta < 1 ? 'same' : (delta < 0 ? 'down' : 'up');
            const percent = previousPrice > 0 ? Number(((absDelta / previousPrice) * 100).toFixed(1)) : 0;

            return {
                ...product,
                priceTrend: {
                    direction,
                    delta: absDelta,
                    percent,
                    previousPrice,
                    comparedAt: previous.created_at
                }
            };
        });

        // NUEVO: Guardar en Caché
        await cacheService.saveToCache(searchQuery, radius, lat, lng, productsWithTrend);
        await cacheService.savePriceSnapshot(searchQuery, radius, lat, lng, productsWithTrend);

        // FIX #1: Registrar búsqueda para usuarios autenticados (Rate Limiting)
        if (userId && supabase) {
            supabase.from('searches').insert({
                user_id: userId,
                query: searchQuery,
                created_at: new Date().toISOString()
            }).then(() => { }).catch(e => console.error('[Search Logging] Error:', e.message));
        }

        // 6. Devolver respuesta estandarizada al frontend
        return res.json({
            tipo_respuesta: 'resultados',
            intencion_detectada: {
                busqueda: searchQuery,
                condicion: llmAnalysis.condition
            },
            top_5_baratos: productsWithTrend,
            advertencia_uso: usageWarning
        });

    } catch (error) {
        console.error('Error en el endpoint /buscar:', error);
        res.status(500).json({ error: 'Error interno del servidor al procesar la búsqueda. Nuestro equipo técnico ha sido notificado automáticamente.' });
    }
};

// NUEVO: Endpoint para B2B Bulk Search (Plan Revendedor)
exports.bulkSearch = async (req, res) => {
    try {
        const { queries, radius, lat, lng } = req.body;
        // Use verified userId from auth middleware (JWT)
        const userId = req.userId || null;
        if (!userId) {
            return res.status(401).json({ error: 'Debes iniciar sesión para usar el Plan Revendedor.' });
        }
        if (!supabase) {
            return res.status(503).json({ error: 'Base de datos no disponible' });
        }
        const { data: profile } = await supabase.from('profiles').select('plan, is_premium').eq('id', userId).single();
        if (!profile || (!profile.is_premium && profile.plan !== 'b2b')) {
            return res.status(402).json({ error: 'Esta función es exclusiva del Plan Revendedor VIP ($199 MXN/mes). Actualiza tu cuenta para acceder.', upgrade_required: true });
        }

        // --- Verificación de Límite Mensual B2B ---
        let reqLimit = 5000;
        let queryDate = new Date();
        queryDate.setDate(1);
        queryDate.setHours(0, 0, 0, 0);

        const { count, error } = await supabase.from('searches')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', queryDate.toISOString());

        let usageWarning = null;
        if (!error) {
            if (count >= reqLimit) {
                return res.status(402).json({ error: `Límite mensual B2B alcanzado (${reqLimit} búsquedas). Por favor espera a tu siguiente ciclo para más lotes.`, upgrade_required: false });
            }
            if (count >= reqLimit * 0.9) {
                usageWarning = `⚠️ Límite mensual al ${Math.floor((count / reqLimit) * 100)}% (${count}/${reqLimit}).`;
            }
        }

        // Hard limit: max 5 queries per request (Vercel 60s timeout)
        const queriesToProcess = queries.slice(0, 5);

        console.log(`[B2B BULK SEARCH] Procesando lote de ${queriesToProcess.length} artículos en paralelo...`);

        // Process all queries in parallel with individual timeouts
        const QUERY_TIMEOUT = 10000; // 10s per query
        const bulkPromises = queriesToProcess.map(async (q) => {
            try {
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), QUERY_TIMEOUT)
                );

                const searchPromise = (async () => {
                    const llmAnalysis = await llmService.analyzeMessage(q, []);
                    const searchQuery = llmAnalysis.searchQuery || q;

                    // Cache check first
                    const cachedResults = await cacheService.getCachedResults(searchQuery, radius, lat, lng);
                    if (cachedResults && cachedResults[0]) {
                        return { ...cachedResults[0], desde_cache: true };
                    }

                    // Real search
                    const shoppingResults = await shoppingService.searchGoogleShopping(searchQuery, radius, lat, lng);
                    if (shoppingResults.length > 0) {
                        const sortedResults = shoppingResults.sort((a, b) => {
                            if (a.price == null) return 1;
                            if (b.price == null) return -1;
                            return a.price - b.price;
                        });
                        const cheapest = sortedResults[0];
                        const topResult = {
                            titulo: cheapest.title,
                            precio: cheapest.price,
                            tienda: cheapest.source,
                            imagen: cheapest.image,
                            urlOriginal: cheapest.url,
                            urlMonetizada: affiliateManager.generateAffiliateLink(cheapest.url, cheapest.source),
                            desde_cache: false
                        };
                        // Save to cache async
                        cacheService.saveToCache(searchQuery, radius, lat, lng, [topResult]).catch(() => { });
                        return topResult;
                    }
                    return null;
                })();

                const result = await Promise.race([searchPromise, timeoutPromise]);
                return { query_original: q, encontrado: !!result, mejor_oferta: result };
            } catch (err) {
                console.error(`Error procesando item B2B "${q}":`, err.message);
                return { query_original: q, encontrado: false, error: err.message === 'Timeout' ? 'Tiempo agotado' : 'Fallo al extraer datos' };
            }
        });

        const bulkResults = await Promise.all(bulkPromises);

        // Charge usage AFTER successful processing (not before)
        const successCount = bulkResults.filter(r => r.encontrado).length;
        if (supabase && successCount > 0) {
            const inserts = bulkResults
                .filter(r => r.encontrado)
                .map(r => ({ user_id: userId, query: r.query_original }));
            supabase.from('searches').insert(inserts).then(() => { }).catch(e => console.error('Bulk insert error:', e));
        }

        return res.json({
            lote_procesado: bulkResults.length,
            resultados: bulkResults,
            ...(usageWarning ? { usageWarning } : {})
        });

    } catch (error) {
        console.error('Error en /bulk-search:', error);
        res.status(500).json({ error: 'Error del servidor en bulk search.' });
    }
};
