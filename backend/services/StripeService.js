class StripeService {
    constructor() {
        this.stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    }

    // Crear cliente
    async createCustomer(userInfo) {
        try {
            const customer = await this.stripe.customers.create({
                email: userInfo.email,
                name: userInfo.name,
                phone: userInfo.phone,
                metadata: {
                    user_id: userInfo.userId
                }
            });

            console.log(`✅ Cliente Stripe creado: ${customer.id}`);
            return { success: true, customer };
        } catch (error) {
            console.error('❌ Error creando cliente:', error);
            return { success: false, error: error.message };
        }
    }

    // Crear fianza (preautorización)
    async createSecurityDeposit(reservationData) {
        try {
            const { amount, currency, guest, reservationId } = reservationData;
            
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: amount * 100, // Stripe usa centavos
                currency: currency.toLowerCase(),
                capture_method: 'manual', // Solo autorizar, no cobrar
                payment_method_types: ['card'],
                metadata: {
                    type: 'security_deposit',
                    reservation_id: reservationId,
                    guest_email: guest.email,
                    guest_name: guest.name
                }
            });

            return {
                success: true,
                client_secret: paymentIntent.client_secret,
                payment_intent_id: paymentIntent.id
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Cobrar daños
    async chargeDamages(paymentIntentId, amount, description) {
        try {
            const capture = await this.stripe.paymentIntents.capture(paymentIntentId, {
                amount_to_capture: amount * 100,
                metadata: {
                    damage_description: description,
                    charged_at: new Date().toISOString()
                }
            });

            return { 
                success: true, 
                captured_amount: amount,
                charge_id: capture.id 
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Liberar fianza
    async releaseDeposit(paymentIntentId) {
        try {
            await this.stripe.paymentIntents.cancel(paymentIntentId);
            return { success: true, message: 'Fianza liberada correctamente' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Crear suscripción
    async createSubscription(customerId, planType) {
        try {
            const priceIds = {
                basic: 'price_basic_monthly',
                pro: 'price_pro_monthly',
                enterprise: 'price_enterprise_monthly'
            };

            const subscription = await this.stripe.subscriptions.create({
                customer: customerId,
                items: [{ price: priceIds[planType] }],
                payment_behavior: 'default_incomplete',
                expand: ['latest_invoice.payment_intent']
            });

            return {
                success: true,
                subscription_id: subscription.id,
                client_secret: subscription.latest_invoice.payment_intent.client_secret
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = StripeService;