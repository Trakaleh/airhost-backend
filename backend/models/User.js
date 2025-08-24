const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    // Información básica
    email: { 
        type: String, 
        required: true, 
        unique: true, 
        lowercase: true,
        trim: true
    },
    password: { 
        type: String, 
        required: true, 
        minlength: 6 
    },
    name: { 
        type: String, 
        required: true,
        trim: true
    },
    phone: { 
        type: String, 
        required: true,
        trim: true
    },
    company: { 
        type: String, 
        default: ''
    },
    
    // Plan y suscripción
    plan: { 
        type: String, 
        enum: ['basic', 'pro', 'enterprise'], 
        default: 'basic' 
    },
    
    subscription: {
        stripe_customer_id: String,
        stripe_subscription_id: String,
        status: { 
            type: String, 
            enum: ['active', 'canceled', 'past_due'], 
            default: 'active' 
        },
        current_period_end: Date
    },
    
    // Preferencias
    preferences: {
        language: { 
            type: String, 
            enum: ['es', 'en', 'fr'], 
            default: 'es' 
        },
        currency: { 
            type: String, 
            enum: ['EUR', 'USD', 'GBP'], 
            default: 'EUR' 
        },
        timezone: { 
            type: String, 
            default: 'Europe/Madrid' 
        },
        notifications: {
            email: { type: Boolean, default: true },
            whatsapp: { type: Boolean, default: true }
        }
    },
    
    // Estado de la cuenta
    lastLogin: Date,
    isActive: { type: Boolean, default: true }
    
}, { 
    timestamps: true 
});

// Hash password antes de guardar
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        this.password = await bcrypt.hash(this.password, 12);
        next();
    } catch (error) {
        next(error);
    }
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error('Error comparando contraseñas');
    }
};

module.exports = mongoose.model('User', userSchema);
