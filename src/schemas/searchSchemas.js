const { z } = require('zod');

// Coerce string / null → number | undefined for lat/lng coming from DOM .value
const coerceOptionalNumber = (min, max) =>
    z.preprocess(
        (val) => (val === null || val === undefined || val === '') ? undefined : Number(val),
        z.number().min(min).max(max).optional()
    );

const baseSearchSchema = z.object({
    query: z.string().trim().min(1, 'query es requerido').max(200, 'query supera el máximo de 200 caracteres'),
    radius: z.union([z.string(), z.number()]).optional(),
    lat: coerceOptionalNumber(-90, 90),
    lng: coerceOptionalNumber(-180, 180)
    // userId is now extracted from Authorization header (JWT) via authMiddleware
});

const chatMessageSchema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(2000)
});

const searchProductSchema = baseSearchSchema.extend({
    chatHistory: z.array(chatMessageSchema).max(30).optional(),
    skipLLM: z.boolean().optional()
});

const bulkSearchSchema = z.object({
    queries: z.array(
        z.string().trim().min(1, 'Cada query debe tener contenido').max(200, 'Cada query debe tener máximo 200 caracteres')
    ).min(1, 'queries no puede estar vacío').max(10, 'Máximo 10 queries por request'),
    radius: z.union([z.string(), z.number()]).optional(),
    lat: coerceOptionalNumber(-90, 90),
    lng: coerceOptionalNumber(-180, 180)
    // userId is now extracted from Authorization header (JWT) via authMiddleware
});

const visionSchema = z.object({
    image: z.string().min(20, 'image debe contener datos base64 válidos').max(10485760, 'image supera el límite de 10MB')
});

const memorySchema = z.object({
    query: z.string().trim().min(1, 'query es requerido').max(500),
    responseText: z.string().trim().min(1, 'responseText es requerido').max(5000)
});

const feedbackSchema = z.object({
    message: z.string().trim().min(1, 'message es requerido').max(2000),
    // SECURITY FIX #9: user_id removed from body schema — now taken from JWT via req.userId
    user_email: z.string().email('user_email debe ser email válido').nullable().optional()
});

const trackEventSchema = z.object({
    event_type: z.enum(['click', 'ad_view', 'ad_skip', 'search', 'favorite', 'alert_create'], {
        errorMap: () => ({ message: 'event_type debe ser: click, ad_view, ad_skip, search, favorite, alert_create' })
    }),
    product_title: z.string().max(500).optional().default(''),
    store: z.string().max(200).optional().default(''),
    url: z.string().max(2000).optional().default(''),
    search_query: z.string().max(500).optional().default(''),
    device: z.string().max(50).optional().default('unknown')
});

module.exports = {
    searchProductSchema,
    bulkSearchSchema,
    visionSchema,
    memorySchema,
    feedbackSchema,
    trackEventSchema
};
