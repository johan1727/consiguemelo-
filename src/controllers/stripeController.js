const supabase = require('../config/supabase');

const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

exports.handleWebhook = async (req, res) => {
    if (!stripe) {
        console.error('STRIPE_SECRET_KEY not configured');
        return res.status(500).json({ error: 'Stripe not configured' });
    }
    if (!supabase) {
        console.error('Database not available');
        return res.status(503).json({ error: 'Database unavailable' });
    }
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        if (!sig || !endpointSecret) {
            throw new Error('Falta stripe-signature o STRIPE_WEBHOOK_SECRET en producción.');
        }
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        // === IDEMPOTENCY CHECK: evita procesar el mismo evento dos veces ===
        const { data: existing } = await supabase
            .from('webhook_events')
            .select('event_id')
            .eq('event_id', event.id)
            .maybeSingle();

        if (existing) {
            console.log(`[Stripe] Evento ya procesado (idempotent skip): ${event.id}`);
            return res.status(200).send('Already processed');
        }

        // Registrar el evento ANTES de procesar (claim it)
        const { error: insertErr } = await supabase
            .from('webhook_events')
            .insert({ event_id: event.id, event_type: event.type, payload: { object_id: event.data?.object?.id } });

        if (insertErr) {
            // Si falla por PK duplicada, otro worker ya lo tomó
            if (insertErr.code === '23505') {
                console.log(`[Stripe] Evento reclamado por otro worker: ${event.id}`);
                return res.status(200).send('Already processed');
            }
            console.error('[Stripe] Error registrando evento:', insertErr.message);
        }

        // Handle the event
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const userId = session.client_reference_id;

                if (!userId) {
                    console.error('⚠️ Checkout completado sin client_reference_id. Email del cliente:', session.customer_email || 'desconocido');
                    console.error('⚠️ Session ID:', session.id, '| Customer:', session.customer);
                    // Try to find user by email as fallback
                    let resolvedUserId = null;
                    if (session.customer_email && supabase) {
                        const { data: userByEmail } = await supabase
                            .from('profiles')
                            .select('id')
                            .eq('email', session.customer_email)
                            .maybeSingle();
                        if (userByEmail) {
                            resolvedUserId = userByEmail.id;
                            console.log(`✅ Encontrado usuario por email: ${resolvedUserId}`);
                        }
                    }
                    if (!resolvedUserId) {
                        console.error('❌ No se pudo vincular el pago a ningún usuario. Se requiere intervención manual.');
                        // Still store the subscription for manual resolution
                        await supabase
                            .from('subscriptions')
                            .insert([{
                                user_id: null,
                                stripe_customer_id: session.customer,
                                stripe_subscription_id: session.subscription,
                                stripe_payment_intent_id: session.payment_intent,
                                status: 'pending_user_link',
                                amount_paid: session.amount_total,
                                currency: session.currency
                            }]);
                        break;
                    }
                    // Use resolved userId
                    const plan = session.metadata?.plan || 'personal_vip';
                    await supabase
                        .from('profiles')
                        .update({ is_premium: true, plan: plan })
                        .eq('id', resolvedUserId);
                    await supabase
                        .from('subscriptions')
                        .insert([{
                            user_id: resolvedUserId,
                            stripe_customer_id: session.customer,
                            stripe_subscription_id: session.subscription,
                            stripe_payment_intent_id: session.payment_intent,
                            status: 'active',
                            amount_paid: session.amount_total,
                            currency: session.currency
                        }]);
                    console.log('✅ Perfil y suscripción actualizados vía email fallback.');
                    break;
                }

                if (userId) {
                    console.log(`✅ Pago exitoso para el usuario: ${userId}. Actualizando perfil a VIP...`);

                    // 1. Actualizar perfil (VIP + Detectar Plan)
                    const plan = session.metadata?.plan || 'personal_vip';
                    await supabase
                        .from('profiles')
                        .update({ is_premium: true, plan: plan })
                        .eq('id', userId);

                    // 2. Crear registro de suscripción
                    await supabase
                        .from('subscriptions')
                        .insert([{
                            user_id: userId,
                            stripe_customer_id: session.customer,
                            stripe_subscription_id: session.subscription,
                            stripe_payment_intent_id: session.payment_intent,
                            status: 'active',
                            amount_paid: session.amount_total,
                            currency: session.currency
                        }]);

                    console.log('✅ Perfil y suscripción actualizados exitosamente.');
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                console.log(`❌ Suscripción cancelada: ${subscription.id}`);

                // 1. Marcar suscripción como cancelada
                const { data } = await supabase
                    .from('subscriptions')
                    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                    .eq('stripe_subscription_id', subscription.id)
                    .select('user_id')
                    .single();

                // 2. Quitar premium al usuario
                if (data && data.user_id) {
                    await supabase
                        .from('profiles')
                        .update({ is_premium: false, plan: 'free' })
                        .eq('id', data.user_id);
                    console.log(`📉 Acceso premium revocado para el usuario ${data.user_id}`);
                }
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                console.warn(`⚠️ Pago de factura fallido para la suscripción: ${invoice.subscription}`);

                const { data } = await supabase
                    .from('subscriptions')
                    .update({ status: 'past_due', updated_at: new Date().toISOString() })
                    .eq('stripe_subscription_id', invoice.subscription)
                    .select('user_id')
                    .single();

                if (data && data.user_id) {
                    await supabase
                        .from('profiles')
                        .update({ is_premium: false, plan: 'free' })
                        .eq('id', data.user_id);
                    console.log(`📉 Acceso premium pausado por falta de pago para el usuario ${data.user_id}`);
                }
                break;
            }

            case 'charge.refunded': {
                const charge = event.data.object;
                console.log(`💸 Cargo reembolsado: ${charge.id}`);
                // Podría buscarse por payment_intent y cancelar
                if (charge.payment_intent) {
                    const { data } = await supabase
                        .from('subscriptions')
                        .update({ status: 'refunded', updated_at: new Date().toISOString() })
                        .eq('stripe_payment_intent_id', charge.payment_intent)
                        .select('user_id')
                        .single();

                    if (data && data.user_id) {
                        await supabase
                            .from('profiles')
                            .update({ is_premium: false, plan: 'free' })
                            .eq('id', data.user_id);
                        console.log(`📉 Acceso premium revocado (reembolso) para el usuario ${data.user_id}`);
                    }
                }
                break;
            }

            default:
                console.log(`Unhandled event type ${event.type}`);
        }
    } catch (err) {
        console.error(`Error procesando webhook Stripe (${event.type}):`, err.message);
        // Retornar 500 para que Stripe reintente en caso de error interno transitorio
        return res.status(500).send('Internal Server Error processing Webhook');
    }

    // Return a 200 response to acknowledge receipt of the event
    res.send();
};
