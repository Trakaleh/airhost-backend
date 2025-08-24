const axios = require('axios');

class ChannelManagerService {
    constructor() {
        this.supportedChannels = ['airbnb', 'booking', 'vrbo'];
    }

    async syncCalendars(property) {
        const results = [];

        for (const channel of this.supportedChannels) {
            if (property.channels[channel]?.is_active && property.channels[channel]?.ical_url) {
                try {
                    const reservations = await this.syncICalCalendar(
                        property.channels[channel].ical_url, 
                        channel,
                        property._id
                    );
                    
                    results.push({ 
                        platform: channel, 
                        reservations: reservations,
                        success: true 
                    });

                    // Actualizar última sincronización
                    property.channels[channel].last_sync = new Date();
                    await property.save();

                } catch (error) {
                    console.error(`Error sync ${channel}:`, error);
                    results.push({ 
                        platform: channel, 
                        error: error.message,
                        success: false 
                    });
                }
            }
        }

        return results;
    }

    async syncICalCalendar(icalUrl, platform, propertyId) {
        try {
            const response = await axios.get(icalUrl, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'AirHost-Calendar-Sync/1.0'
                }
            });
            
            // Aquí se parsearía el iCal real, por ahora simulamos
            const reservations = [];
            
            console.log(`✅ Sync ${platform}: ${reservations.length} reservas`);
            return reservations;
            
        } catch (error) {
            console.error(`❌ Error sync ${platform}:`, error.message);
            throw error;
        }
    }

    async checkForConflicts(propertyId, checkIn, checkOut) {
        const Reservation = require('../models/Reservation');
        
        const conflicts = await Reservation.find({
            property: propertyId,
            status: { $ne: 'cancelled' },
            $or: [
                {
                    check_in: { $lte: checkOut },
                    check_out: { $gte: checkIn }
                }
            ]
        });

        return conflicts.length > 0;
    }
}

module.exports = ChannelManagerService;