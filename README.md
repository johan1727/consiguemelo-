# Lumu - Personal Shopper AI

Backend API para Lumu, un asistente de compras inteligente que compara precios en Amazon, Mercado Libre y tiendas locales usando IA.

## 🚀 Stack Tecnológico

- **Backend:** Node.js + Express.js
- **Base de datos:** Supabase (PostgreSQL + pgvector para RAG)
- **IA:** Google Gemini 2.5 Flash (LLM + Vision)
- **Búsqueda:** Serper.dev API (Google Shopping + Places)
- **Pagos:** Stripe
- **Despliegue:** Vercel Serverless

## 📋 Requisitos Previos

- Node.js 18+ 
- npm o yarn
- Cuenta en Supabase
- API Keys: Gemini, Serper, Stripe

## ⚙️ Instalación

1. **Clonar y instalar dependencias**
```bash
git clone <repo-url>
cd lumu
npm install
```

2. **Configurar variables de entorno**

Copia `.env.example` a `.env` y completa todas las variables:

```bash
cp .env.example .env
```

Variables críticas:
- `GEMINI_API_KEY`: Clave de Google AI Studio
- `SERPER_API_KEY`: Clave de Serper.dev
- `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`: Credenciales de Supabase
- `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET`: Claves de Stripe
- `FRONTEND_ORIGINS`: Lista de orígenes permitidos en CORS (producción)

3. **Configurar base de datos**

Ejecuta las migraciones en Supabase SQL Editor:
```bash
migrations/001_subscriptions.sql
migrations/002_db_improvements.sql
migrations/02_add_plan_to_profiles.sql
migrations/03_create_rate_limits_table.sql
setup_rag.sql
setup_feedback_table.sql
```

4. **Iniciar servidor local**
```bash
npm run dev    # Con nodemon (desarrollo)
npm start      # Producción
```

El servidor arrancará en `http://localhost:3000`

## 🔐 Seguridad

### Hardening implementado
- ✅ Helmet.js para headers HTTP seguros
- ✅ CORS estricto con allow-list por origen
- ✅ Validación de payload con Zod en todos los endpoints
- ✅ Rate limiting con Supabase + fallback RAM
- ✅ Timeouts en llamadas externas (10-25s según servicio)
- ✅ Sanitización de inputs (HTML stripping, longitud máxima)

### Variables de entorno en producción
⚠️ **NUNCA** commitear archivos `.env` al repositorio.

En Vercel:
1. Ve a Project Settings → Environment Variables
2. Agrega todas las variables de `.env.example`
3. Configura `NODE_ENV=production`
4. Configura `FRONTEND_ORIGINS` con tu dominio: `https://lumu.vercel.app`

## 🧪 Pruebas de API

### Endpoint: POST /api/buscar
Buscar productos con IA conversacional.

```bash
curl -X POST http://localhost:3000/api/buscar \
  -H "Content-Type: application/json" \
  -d '{
    "query": "laptop gaming RTX 4060",
    "radius": "global",
    "userId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Validación esperada:**
- `query` requerido (1-200 chars)
- `userId` debe ser UUID válido (opcional)
- `lat`/`lng` deben ser coordenadas válidas (opcional)

### Endpoint: POST /api/vision
Identificar producto desde imagen.

```bash
curl -X POST http://localhost:3000/api/vision \
  -H "Content-Type: application/json" \
  -d '{
    "image": "base64_encoded_image_data_here"
  }'
```

### Endpoint: POST /api/bulk-search
Búsqueda masiva para plan B2B (requiere autenticación).

```bash
curl -X POST http://localhost:3000/api/bulk-search \
  -H "Content-Type: application/json" \
  -d '{
    "queries": ["iPhone 15 Pro", "MacBook Air M3"],
    "userId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Validación:**
- Máximo 10 queries por request
- `userId` requerido y debe ser UUID
- Valida plan B2B en backend

## 📁 Estructura del Proyecto

```
lumu/
├── api/
│   └── index.js              # Entrypoint principal (Express app)
├── src/
│   ├── config/
│   │   └── supabase.js       # Cliente Supabase singleton
│   ├── controllers/
│   │   ├── searchController.js    # Búsquedas y visión
│   │   ├── stripeController.js    # Webhooks de Stripe
│   │   ├── memoryController.js    # RAG memory
│   │   └── feedbackController.js  # Feedback de usuarios
│   ├── services/
│   │   ├── llmService.js          # Gemini LLM
│   │   ├── shoppingService.js     # Google Shopping/Places
│   │   ├── visionService.js       # Gemini Vision
│   │   ├── directScraper.js       # Scrapers directo ML/Amazon
│   │   ├── supermarketScraper.js  # Mayoreo (Walmart/Chedraui)
│   │   └── cacheService.js        # Cache de búsquedas
│   ├── middleware/
│   │   └── validateRequest.js     # Validación Zod
│   ├── schemas/
│   │   └── searchSchemas.js       # Esquemas Zod
│   ├── routes/
│   │   └── api.js                 # Rutas de API
│   └── utils/
│       ├── affiliateManager.js    # Links de afiliados
│       └── fetchWithTimeout.js    # Fetch con timeout
├── migrations/                # Migraciones SQL de Supabase
├── public/                    # Frontend estático
├── .env.example              # Plantilla de variables
├── vercel.json               # Config de Vercel
└── package.json
```

## 🚀 Despliegue en Vercel

1. **Conectar repositorio**
   - Importa el proyecto desde GitHub/GitLab
   - Vercel detectará automáticamente `vercel.json`

2. **Configurar variables de entorno**
   - Agrega todas las variables de `.env.example`
   - `NODE_ENV=production`
   - `FRONTEND_ORIGINS=https://tu-dominio.vercel.app`

3. **Deploy**
```bash
vercel --prod
```

### Webhook de Stripe
Configurar endpoint en Stripe Dashboard:
```
https://tu-dominio.vercel.app/api/stripe/webhook
```

## 🐛 Troubleshooting

### Error: "CORS origin no permitido"
**Causa:** `FRONTEND_ORIGINS` no incluye tu dominio.  
**Solución:** Agrega el origen exacto (con protocolo): `https://ejemplo.com`

### Error: "Request timeout after 15000ms"
**Causa:** API externa (Gemini/Serper) tardó demasiado.  
**Solución:** Verifica conectividad y estado de APIs externas.

### Error: "Payload inválido"
**Causa:** Request no cumple con esquema Zod.  
**Solución:** Revisa `details` en la respuesta 400 para ver campos inválidos.

### Error: "Límite diario alcanzado"
**Causa:** Usuario free llegó al límite de 3 búsquedas/día.  
**Solución:** Usuario debe upgradearse a plan VIP.

## 📊 Rate Limits

- **Plan Gratis:** 3 búsquedas/día
- **Plan VIP:** 500 búsquedas/mes
- **Plan B2B:** 5000 búsquedas/mes
- **Rate limit global:** 10 requests/min por IP

## 🔧 Scripts Disponibles

```bash
npm start       # Inicia servidor en producción
npm run dev     # Inicia servidor con nodemon (desarrollo)
```

## 📝 Notas de Implementación

### Cambios recientes (Hardening de Seguridad)
- ✅ Agregado `helmet` y `cors` con configuración estricta
- ✅ Validación de schemas con Zod en todos los endpoints
- ✅ Timeouts configurados en llamadas externas (10-25s)
- ✅ Variables de entorno estandarizadas (`SUPABASE_SERVICE_ROLE_KEY`)
- ✅ CORS en producción requiere `FRONTEND_ORIGINS` configurado

### Próximos pasos sugeridos
- [ ] Implementar logging estructurado (Winston/Pino)
- [ ] Agregar tests automatizados (Jest + Supertest)
- [ ] Configurar CI/CD con GitHub Actions
- [ ] Implementar monitoring con Sentry
- [ ] Agregar más cacheo estratégico
- [ ] Documentar API con OpenAPI/Swagger

## 📄 Licencia

Privado - Todos los derechos reservados.

## 📧 Soporte

Para problemas o preguntas, contacta al equipo de desarrollo.
