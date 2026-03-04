const fetchWithTimeout = require('../utils/fetchWithTimeout');
const supabase = require('../config/supabase');

exports.saveMemory = async (req, res) => {
    try {
        const { query, responseText } = req.body;
        if (!query || !responseText) return res.status(400).json({ error: 'Faltan datos.' });
        if (!supabase) return res.status(200).json({ success: false, skipped: true, message: 'Base de datos no disponible. Memoria omitida.' });

        // 1. Crear el texto a memorizar (Contexto de qué funcionó)
        const memoryContent = `Usuario pidió: "${query}". La IA respondió exitosamente con: "${responseText}"`;

        // 2. Generar el Embedding Vectorial usando Gemini (con fallback de modelos)
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(200).json({ success: false, skipped: true, message: 'GEMINI_API_KEY no configurada. Memoria omitida.' });
        }

        const candidateModels = [
            process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
            'text-embedding-004'
        ];

        let vector = null;
        let lastEmbeddingError = null;

        for (const modelName of candidateModels) {
            const embedResponse = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:embedContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: `models/${modelName}`,
                    content: {
                        parts: [{ text: memoryContent }]
                    },
                    outputDimensionality: 768
                })
            }, 10000);

            const embedData = await embedResponse.json().catch(() => ({}));

            if (embedResponse.ok && embedData?.embedding?.values) {
                vector = embedData.embedding.values;
                break;
            }

            lastEmbeddingError = embedData;
        }

        if (!vector) {
            console.error('Error Embedding Gemini (todos los modelos fallaron):', lastEmbeddingError);
            return res.status(200).json({ success: false, skipped: true, message: 'Embedding no disponible por ahora. Memoria omitida.' });
        }

        // 3. Guardar en Supabase pgvector
        const { error } = await supabase
            .from('ai_memory')
            .insert([{
                content: memoryContent,
                embedding: vector
            }]);

        if (error) {
            console.error('Error insertando en Supabase RAG:', error);
            return res.status(200).json({ success: false, skipped: true, message: 'No se pudo guardar memoria en DB. Continuando sin bloquear la app.' });
        }

        res.json({ success: true, message: 'Memoria agregada permanentemente al cerebro RAG.' });

    } catch (error) {
        console.error('Error saveMemory:', error);
        res.status(500).json({ error: 'Error del servidor en Memoria RAG.' });
    }
};
