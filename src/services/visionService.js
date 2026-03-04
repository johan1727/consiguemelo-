const fetchWithTimeout = require('../utils/fetchWithTimeout');

exports.identifyProduct = async (imageBase64) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY no está configurado en .env");
    }

    // Gemini 2.5 Flash soporta imágenes — use header instead of query param to avoid key in logs
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;

    const payload = {
        contents: [{
            parts: [
                { text: "Identifica el producto comercial principal en esta imagen. Devuelve un objeto JSON con: 'productName' (nombre común del producto), 'brand' (marca, si es visible), y 'searchQuery' (una búsqueda perfecta para Google Shopping México para encontrar este producto exacto, en español). Sé preciso y específico." },
                {
                    inline_data: {
                        mime_type: "image/jpeg",
                        data: imageBase64 // Base64 string without data:image/jpeg;base64, prefix
                    }
                }
            ]
        }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    productName: { type: "STRING" },
                    brand: { type: "STRING" },
                    searchQuery: { type: "STRING" }
                },
                required: ["productName", "searchQuery"]
            }
        }
    };

    try {
        const response = await fetchWithTimeout(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify(payload)
        }, 25000);

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Fallo en Gemini Vision: ${response.status} - ${errBody}`);
        }

        const data = await response.json();
        const textResult = data.candidates[0].content.parts[0].text;
        return JSON.parse(textResult);

    } catch (error) {
        console.error('Error en visionService:', error);
        throw error;
    }
};
