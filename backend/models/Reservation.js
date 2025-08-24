const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
    property: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Property', 
        required: true 
    },
    
    guest: {
        name: { type: String, required: true },
        email: { type: String, required: true },
        phone: String,
        language: { type: String, default: 'es' },
        country: String,
        guest_count: { type: Number, default: 1 }
    },
    
    check_in: { type: Date, required: true },
    check_out: { type: Date, required: true },
    nights: { type: Number, required: true },
    
    source: { 
        type: String, 
        enum: ['airbnb', 'booking', 'vrbo', 'direct', 'manual'], 
        required: true 
    },
    external_id: String,
    
    status: { 
        type: String, 
        enum: ['confirmed', 'checked_in', 'checked_out', 'cancelled'], 
        default: 'confirmed' 
    },
    
    pricing: {
        base_amount: { type: Number, required: true },
        cleaning_fee: { type: Number, default: 0 },
        total_amount: { type: Number, required: true },
        currency: { type: String, default: 'EUR' }
    },
    
    access_codes: {
        code: String,
        generated_at: Date,
        expires_at: Date,
        used_at: Date
    },
    
    deposit: {
        stripe_payment_intent_id: String,
        amount: Number,
        currency: String,
        status: { 
            type: String, 
            enum: ['pending', 'authorized', 'captured', 'released'], 
            default: 'pending' 
        },
        authorized_at: Date,
        released_at: Date
    },
    
    messages_sent: [{
        type: { 
            type: String, 
            enum: ['welcome', 'access_info', 'checkout_reminder', 'review_request', 'custom'] 
        },
        sent_at: Date,
        platform: { type: String, enum: ['whatsapp', 'email', 'sms'] },
        content: String,
        status: { type: String, enum: ['sent', 'delivered', 'failed'], default: 'sent' }
    }],
    
    notes: String
    
}, { timestamps: true });

// Calcular noches automáticamente
reservationSchema.pre('save', function(next) {
    if (this.check_in && this.check_out) {
        const diffTime = Math.abs(this.check_out - this.check_in);
        this.nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    next();
});

module.exports = mongoose.model('Reservation', reservationSchema);