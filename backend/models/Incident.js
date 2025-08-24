const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
    reservation: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Reservation', 
        required: true 
    },
    property: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Property', 
        required: true 
    },
    
    type: { 
        type: String, 
        enum: ['damage', 'missing_items', 'cleanliness', 'noise', 'other'], 
        required: true 
    },
    
    title: { type: String, required: true },
    description: { type: String, required: true },
    estimated_cost: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'EUR' },
    
    evidence_photos: [String],
    evidence_videos: [String],
    
    status: { 
        type: String, 
        enum: ['reported', 'under_review', 'charged', 'resolved', 'dismissed'], 
        default: 'reported' 
    },
    
    resolution: {
        action_taken: String,
        charged_amount: Number,
        charged_at: Date,
        stripe_charge_id: String,
        notes: String
    },
    
    reported_by: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    resolved_by: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    resolved_at: Date
    
}, { timestamps: true });

module.exports = mongoose.model('Incident', incidentSchema);