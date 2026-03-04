require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function createPaymentLink() {
    try {
        console.log('1. Creando producto VIP...');
        const product = await stripe.products.create({
            name: 'Lumu VIP',
            description: 'Suscripción VIP con búsquedas ilimitadas e IA experta sin restricciones.',
        });
        console.log(`Producto creado: ${product.id}`);

        console.log('2. Creando precio de $39 MXN recurrentes...');
        const price = await stripe.prices.create({
            unit_amount: 3900, // 39.00 MXN en centavos
            currency: 'mxn',
            recurring: { interval: 'month' },
            product: product.id,
        });
        console.log(`Precio creado: ${price.id}`);

        console.log('3. Generando Payment Link...');
        const paymentLink = await stripe.paymentLinks.create({
            line_items: [
                {
                    price: price.id,
                    quantity: 1,
                },
            ],
            // Queremos que al pagar redirija a la app
            after_completion: {
                type: 'redirect',
                redirect: {
                    url: 'https://lumu.dev?pago=exitoso', // Cambia a tu dominio si es otro
                },
            },
        });

        console.log('\n=============================================');
        console.log('✅ STRIPE PAYMENT LINK CREADO EXISTOSAMENTE');
        console.log('URL: ' + paymentLink.url);
        console.log('=============================================\n');
    } catch (err) {
        console.error('Error al generar enlace:', err.message);
    }
}

createPaymentLink();
