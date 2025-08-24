const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
    owner: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    
    // Información básica
    name: { type: String, required: true },
    description: { type: String, default: '' },
    address: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true },
    postal_code: { type: String, default: '' },
    
    property_type: { 
        type: String, 
        enum: ['apartment', 'house', 'villa', 'studio', 'room'], 
        required: true 
    },
    
    // Capacidad
    max_guests: { type: Number, required: true, min: 1 },
    bedrooms: { type: Number, required: true, min: 0 },
    bathrooms: { type: Number, required: true, min: 1 },
    
    // Channel Manager
    channels: {
        airbnb: {
            listing_id: String,
            ical_url: String,
            last_sync: Date,
            is_active: { type: Boolean, default: false }
        },
        booking: {
            listing_id: String,
            ical_url: String,
            last_sync: Date,
            is_active: { type: Boolean, default: false }
        },
        vrbo: {
            listing_id: String,
            ical_url: String,
            last_sync: Date,
            is_active: { type: Boolean, default: false }
        }
    },
    
    // Smart Lock
    smart_lock: {
        brand: { 
            type: String, 
            enum: ['nuki', 'august', 'yale', 'none'], 
            default: 'none' 
        },
        lock_id: String,
        api_token: String,
        is_active: { type: Boolean, default: false }
    },
    
    // Precios
    pricing: {
        base_price: { type: Number, required: true, min: 0 },
        currency: { type: String, default: 'EUR' },
        cleaning_fee: { type: Number, default: 0 },
        deposit_amount: { type: Number, required: true, min: 0 }
    },
    
    // Información de acceso
    access_info: {
        wifi_name: String,
        wifi_password: String,
        check_in_instructions: String,
        check_out_instructions: String,
        house_rules: String
    },
    
    // Templates de mensajes
    message_templates: {
        welcome: { type: String, default: '¡Hola {{guest_name}}! Bienvenido a {{property_name}}.' },
        access_info: { type: String, default: 'Tu código de acceso es: {{access_code}}' },
        checkout_reminder: { type: String, default: 'Recordatorio: Check-out hoy a las {{checkout_time}}' },
        review_request: { type: String, default: '¡Esperamos tu reseña de 5⭐!' }
    },
    
    // Estado
    is_active: { type: Boolean, default: true },
    auto_messaging: { type: Boolean, default: true }
    
}, { 
    timestamps: true 
});

module.exports = mongoose.model('Property', propertySchema);