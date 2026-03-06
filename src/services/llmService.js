const fetchWithTimeout = require('../utils/fetchWithTimeout');
const supabase = require('../config/supabase');
const { z } = require('zod');

// Zod schema to validate LLM output (SECURITY FIX #8)
const llmResponseSchema = z.object({
    action: z.enum(['ask', 'search', 'search_service']),
    intent_type: z.enum(['producto', 'servicio_local', 'mayoreo', 'mayoreo_perecedero', 'ocio', 'otro']).optional(),
    question: z.string().max(1000).nullable().optional(),
    sugerencias: z.array(z.string().max(300)).max(10).optional(),
    cupon: z.string().max(100).nullable().optional(),
    searchQuery: z.string().max(500).optional().default(''),
    alternativeQueries: z.array(z.string().max(500)).max(5).optional(),
    condition: z.enum(['new', 'used']).optional().default('new')
});

// SECURITY FIX #7: Sanitize user input to prevent prompt injection
function sanitizeUserInput(text) {
    if (typeof text !== 'string') return '';
    // Strip common injection patterns
    return text
        .replace(/```[\s\S]*?```/g, '')           // Remove code blocks
        .replace(/\{[^{}]*"role"\s*:/gi, '')       // Remove role injection attempts  
        .replace(/\bsystem\s*:/gi, 'system ')      // Defang "system:" prefix
        .replace(/\bignore\s+(previous|above|all)\s+(instructions?|prompts?|rules?)/gi, '[filtered]')
        .replace(/\b(forget|disregard|override)\s+(everything|instructions?|rules?|prompts?)/gi, '[filtered]')
        .replace(/\byou\s+are\s+now\b/gi, '[filtered]')
        .replace(/\bact\s+as\b/gi, '[filtered]')
        .replace(/\bnew\s+instructions?\s*:/gi, '[filtered]')
        .slice(0, 500);  // Hard limit
}

exports.analyzeMessage = async (userText, chatHistory = []) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY no está configurado en .env");
    }

    // SECURITY: Sanitize user input before sending to LLM
    const sanitizedText = sanitizeUserInput(userText);

    // Formatear el historial para el prompt
    const historyText = chatHistory.length > 0
        ? chatHistory.map(msg => `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}`).join('\n')
        : 'Sin historial previo.';

    // --- RAG: Extraer memorias relevantes de Supabase ---
    let extraContext = '';
    if (supabase) {
        try {
            const candidateModels = [
                process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
                'text-embedding-004'
            ];

            let queryVector = null;

            for (const modelName of candidateModels) {
                const embedResponse = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:embedContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: `models/${modelName}`,
                        content: { parts: [{ text: sanitizedText }] },
                        outputDimensionality: 768
                    })
                }, 10000);

                const embedData = await embedResponse.json().catch(() => ({}));
                if (embedResponse.ok && embedData?.embedding?.values) {
                    queryVector = embedData.embedding.values;
                    break;
                }
            }

            if (queryVector) {
                const { data: matches, error } = await supabase.rpc('match_ai_memory', {
                    query_embedding: queryVector,
                    match_threshold: 0.78,
                    match_count: 3
                });

                if (!error && matches && matches.length > 0) {
                    extraContext = "\n\n=== MEMORIA DE ÉXITO PREVIA (Usa esto para dar mejores resultados) ===\n";
                    matches.forEach(m => {
                        extraContext += `- Contexto Exitoso Pasado: ${m.content}\n`;
                    });
                }
            }
        } catch (err) {
            console.error("RAG no disponible temporalmente:", err);
        }
    }

    const today = new Date();
    const currentDateStr = today.toISOString().split('T')[0];

    const systemPrompt = `Eres Lumu, el Personal Shopper AI #1 de México. Eres experto en e-commerce mexicano, ultra-eficiente y carismático.
Todos los precios son en MXN (Pesos Mexicanos). NUNCA en USD.
TIENDAS PRIORITARIAS EN MÉXICO (las que nuestros scrapers revisan automáticamente): Amazon.com.mx, MercadoLibre.com.mx, Walmart.com.mx, Liverpool.com.mx, Coppel.com, Elektra.com.mx, Costco.com.mx, Sams.com.mx, BestBuy.com.mx, OfficeDepot.com.mx, HomeDepot.com.mx, AliExpress.
FECHA ACTUAL: ${currentDateStr}
CONTEXTO CLAVE: Los usuarios son mexicanos buscando ofertas reales. Conoces bien la temporalidad de ofertas (Hot Sale mayo, Buen Fin noviembre, Prime Day julio, etc.).
${extraContext}`;

    const userPrompt = `
    HISTORIAL DE CONVERSACIÓN:
    ${historyText}
    
    MENSAJE ACTUAL DEL USUARIO:
    "${sanitizedText}"

    TUS OBJETIVOS Y REGLAS (¡CRÍTICO!):
    1. ESTRATEGIA DE BÚSQUEDA LONG-TAIL INTELIGENTE: Tu objetivo es MAXIMIZAR la probabilidad de encontrar el producto correcto al mejor precio.
       - Si el usuario pide algo genérico (ej. "laptop i7"), expande a búsqueda de alta calidad: "laptop intel core i7 16gb ram ssd 512gb".
       - NUNCA uses términos vagos. SIEMPRE incluye marca, modelo o specs técnicas relevantes.
       - Mantén máximo 6-8 palabras clave para no sobre-filtrar.
       - SIEMPRE incluye "precio" o "comprar" para sesgar hacia resultados de shopping, NO reviews.
    2. ACCIÓN INMEDIATA: Si el usuario menciona CUALQUIER producto identificable, siempre "action": "search". NUNCA uses "ask" si puedes inferir el producto.
       - "search" → PRODUCTOS FÍSICOS o DIGITALES. searchQuery = Marca + Modelo + Specs clave + "-renovado -reacondicionado" (si nuevo).
       - "search_service" → SERVICIOS LOCALES (plomero, dentista, albañil). searchQuery = Servicio + Ciudad/Zona.
    3. OPTIMIZACIÓN DE PRECIO:
       - "barato/económico" → Máximo 3 filtros negativos. Prefiere la marca con mejor relación calidad-precio en México.
       - "gama media" → Sin filtros negativos. Busca las 2-3 marcas más vendidas del segmento.
       - "premium/mejor/top" → Busca marca líder directamente (ej: Apple, Sony, Samsung).
    4. CONDICIÓN: Asume "new" siempre, excepto si el usuario dice "usado", "segunda mano", "seminuevo", "refurbished".
    5. CLASIFICACIÓN intent_type: "producto", "servicio_local", "mayoreo", "mayoreo_perecedero", "ocio", "otro".
       - mayoreo_perecedero = frutas, verduras, carnes, abarrotes en mayoreo.
       - servicio_local = profesionales/oficios que requieren ubicación.
    6. TERMINOLOGÍA PROFESIONAL: Si el usuario busca material técnico (dental, médico, cocina industrial, etc.), usa terminología correcta del oficio.
    7. ANTI-ACCESORIOS: Si busca producto principal caro (consola, laptop, TV, cámara), excluye accesorios:
       "-funda -case -protector -cable -cargador" (SALVO que pida accesorios).
    8. alternativeQueries (CRUCIAL para cobertura): Genera 3 variaciones de alta calidad:
       - Variación 1: Sinónimos y términos alternativos (ej: "audífonos inalámbricos" → "auriculares bluetooth")
       - Variación 2: Modelo/marca alternativa del mismo rango (ej: "AirPods" → "Galaxy Buds")
       - Variación 3: Variación con nombre comercial popular en México (ej: "bocina bluetooth" → "parlante inalámbrico JBL")
       NUNCA incluyas "site:" en alternativeQueries — los scrapers ya cubren cada tienda automáticamente.
    9. CUPONES: Solo incluye cupones si estás 100% seguro de su vigencia a la fecha actual. Nunca inventes cupones.
    10. MEXICANISMOS → BÚSQUEDA: Traduce automáticamente:
       "bici" → "bicicleta", "refri" → "refrigerador", "compu" → "computadora laptop", "cel" → "celular smartphone",
       "lap" → "laptop", "tele" → "televisión smart TV", "micro" → "horno de microondas", "aire" → "aire acondicionado minisplit",
       "chamba" (servicios) → nombre técnico del servicio, "play" → "PlayStation PS5", "friega platos" → "lavavajillas".
    11. PRECISIÓN BALANCEADA: 
       - Máximo 4 keywords negativas total en searchQuery.
       - Si el producto es genérico, prefiere la marca/modelo más popular/vendido en México.
       - Prioriza encontrar RESULTADOS sobre ser demasiado específico.
  
    Devuelve ESTRICTAMENTE un JSON validado.
  `;

    const payload = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    action: { type: "STRING", enum: ["ask", "search", "search_service"] },
                    intent_type: { type: "STRING", enum: ["producto", "servicio_local", "mayoreo", "mayoreo_perecedero", "ocio", "otro"] },
                    question: { type: "STRING" },
                    sugerencias: { type: "ARRAY", items: { type: "STRING" } },
                    cupon: { type: "STRING", description: "If you know universal or active promo codes for the brand/store, include them here (e.g., 'SAVE20')" },
                    searchQuery: { type: "STRING", description: "Format: Brand + Exact Model + Modifiers (products) OR Service Name + City (services)" },
                    alternativeQueries: { type: "ARRAY", items: { type: "STRING" }, description: "2 to 3 alternative highly specific queries to maximize shopping results coverage" },
                    condition: { type: "STRING", enum: ["new", "used"] }
                },
                required: ["action", "searchQuery"]
            }
        }
    };

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
        try {
            const response = await fetchWithTimeout(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                body: JSON.stringify(payload)
            }, 15000);

            if (response.status === 429 && retries < maxRetries) {
                retries++;
                const delay = retries * 1500 + Math.random() * 500;
                console.warn(`[LLM] Error 429 Rate Limit. Reintentando en ${Math.round(delay)}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            if (!response.ok) {
                const errorBody = await response.text().catch(() => '');
                throw new Error(`Fallo en la API de Gemini: HTTP ${response.status} - ${errorBody.slice(0, 200)}`);
            }

            const data = await response.json();

            // Defensive: check candidates exist and have content
            if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
                console.warn('[LLM] Gemini returned empty/blocked candidates:', JSON.stringify(data).slice(0, 500));
                throw new Error('Gemini returned no candidates (possibly blocked by safety filter)');
            }

            const textResult = data.candidates[0].content.parts[0].text;
            if (!textResult) {
                throw new Error('Gemini returned empty text in candidates');
            }

            const parsed = JSON.parse(textResult);

            // SECURITY FIX #8: Validate LLM output with Zod
            const validated = llmResponseSchema.safeParse(parsed);
            if (!validated.success) {
                console.warn('[LLM] Response validation failed:', validated.error.issues.map(i => i.message).join(', '));
                // Fall back to a safe search action using the original query
                return {
                    action: 'search',
                    question: null,
                    searchQuery: sanitizedText || userText,
                    condition: 'new'
                };
            }

            return validated.data;

        } catch (error) {
            if (retries >= maxRetries) {
                console.error('Error en LLM Assistant tras reintentos:', error.message);
                return {
                    action: "search",
                    question: null,
                    searchQuery: sanitizedText || userText,
                    condition: "new"
                };
            }
            retries++;
            await new Promise(resolve => setTimeout(resolve, retries * 1000));
        }
    }
};
