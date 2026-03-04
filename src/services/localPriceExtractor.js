const axios = require('axios');
const fetchWithTimeout = require('../utils/fetchWithTimeout');

/**
 * Intenta extraer el precio real de una tiendita local buscando su presencia en apps de delivery o internet.
 * 
 * COSTO: 1 crédito Serper + 1 llamada Gemini por tienda (hasta 3 tiendas → 6 llamadas).
 * Controlado por env LOCAL_PRICE_EXTRACTION=true (desactivado por defecto en producción).
 * 
 * @param {string} storeName - Nombre del local comercial
 * @param {string} productQuery - Producto buscado
 * @param {string} location - Dirección o ciudad
 * @returns {number|null} - Precio extraído o null
 */
async function extractLocalStorePrice(storeName, productQuery, location) {
    // Feature flag: desactivado por defecto para ahorrar créditos API
    if (process.env.LOCAL_PRICE_EXTRACTION !== 'true') return null;
    if (!process.env.SERPER_API_KEY || !process.env.GEMINI_API_KEY) return null;

    try {
        // 1. Ejecutar "Búsqueda Fantasma" pidiendo explícitamente el precio o menú
        // Agregamos keywords de delivery apps comunes en LatAm donde las tienditas suben su menú
        const searchQuery = `${storeName} ${location} ${productQuery} precio (Rappi OR UberEats OR DidiFood OR Facebook)`;

        const serperRes = await axios.post('https://google.serper.dev/search', {
            q: searchQuery,
            gl: "mx",
            hl: "es"
        }, {
            headers: {
                'X-API-KEY': process.env.SERPER_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 5000 // Rápido, no queremos trabar la UI entera
        });

        const results = serperRes.data.organic || [];
        if (results.length === 0) return null;

        // 2. Recolectar el texto de los snippets (pequeñas descripciones de cada link)
        const textSnippets = results.slice(0, 4).map(res => `TÍTULO: ${res.title} \nSNIPPET: ${res.snippet}`).join('\n\n');

        // Si no hay números en absoluto en los snippets, ni vale la pena llamar a Gemini
        if (!/\d/.test(textSnippets)) return null;

        // 3. Extraer el precio inteligentemente con LLM
        const prompt = `
            Eres un extractor de precios de bases de datos.
            El usuario buscó el producto "${productQuery}" en el comercio físico llamado "${storeName}".
            A continuación se presentan fragmentos web encontrados al buscar este negocio local en internet (incluyendo menús, facebook o apps de delivery).
            
            Tu tarea:
            Intenta identificar el precio numérico exacto para "${productQuery}" (o su equivalente más cercano) listado en estos fragmentos del negocio "${storeName}".
            Si encuentras el precio, devuelve SOLO el número limpio (entero o decimal) sin signos de dólar ni texto adicional.
            Si el texto habla de otro producto, ignóralo.
            Si no hay un precio claro asociado al producto, devuelve explícitamente: nulo

            Fragmentos web:
            ${textSnippets}
        `;

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 20
            }
        };

        const llmResponse = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }, 15000);

        if (!llmResponse.ok) return null;

        const data = await llmResponse.json();
        const textResult = data.candidates[0]?.content?.parts[0]?.text?.trim()?.toLowerCase() || '';

        if (textResult === 'nulo' || textResult === 'null') return null;

        const extractedPrice = parseFloat(textResult.replace(/[^0-9.]/g, ''));
        if (isNaN(extractedPrice) || extractedPrice <= 0) return null;

        console.log(`[LocalPrice] Extraído precio $${extractedPrice} para ${productQuery} en ${storeName}`);
        return extractedPrice;

    } catch (error) {
        console.error(`[LocalPrice] Error buscando precio local para ${storeName}:`, error.message);
        return null; // Fallback silencioso (deja el precio en null para "Ver en tienda")
    }
}

module.exports = { extractLocalStorePrice };
