const { ObjectId } = require('mongodb');

class PropertyService {
    constructor(db) {
        this.db = db;
        this.collection = db.collection('properties');
    }

    // Crear nueva propiedad
    async createProperty(userId, propertyData) {
        try {
            const property = {
                user_id: new ObjectId(userId),
                name: propertyData.name,
                address: propertyData.address,
                description: propertyData.description,
                property_type: propertyData.property_type || 'apartment',
                bedrooms: propertyData.bedrooms || 1,
                bathrooms: propertyData.bathrooms || 1,
                max_guests: propertyData.max_guests || 2,
                amenities: propertyData.amenities || [],
                base_price: propertyData.base_price || 0,
                cleaning_fee: propertyData.cleaning_fee || 0,
                
                // Canal channels configuration
                channels: {
                    airbnb: {
                        is_active: false,
                        listing_id: null,
                        ical_url: null,
                        sync_enabled: false
                    },
                    booking: {
                        is_active: false,
                        listing_id: null,
                        ical_url: null,
                        sync_enabled: false
                    },
                    vrbo: {
                        is_active: false,
                        listing_id: null,
                        ical_url: null,
                        sync_enabled: false
                    }
                },

                // Smart lock configuration
                smart_lock: {
                    enabled: false,
                    device_id: null,
                    brand: null, // yale, august, schlage, etc.
                    access_codes: []
                },

                // WiFi information
                wifi: {
                    network_name: '',
                    password: ''
                },

                // House rules and instructions
                house_rules: propertyData.house_rules || '',
                check_in_instructions: propertyData.check_in_instructions || '',
                check_out_instructions: propertyData.check_out_instructions || '',

                // Status and timestamps
                status: 'active',
                created_at: new Date(),
                updated_at: new Date()
            };

            const result = await this.collection.insertOne(property);
            console.log(`✅ Propiedad creada: ${result.insertedId}`);
            
            return { 
                success: true, 
                property_id: result.insertedId,
                property: { ...property, _id: result.insertedId }
            };
        } catch (error) {
            console.error('❌ Error creando propiedad:', error);
            return { success: false, error: error.message };
        }
    }

    // Obtener propiedades del usuario
    async getUserProperties(userId) {
        try {
            const properties = await this.collection
                .find({ user_id: new ObjectId(userId) })
                .sort({ created_at: -1 })
                .toArray();

            return { success: true, properties };
        } catch (error) {
            console.error('❌ Error obteniendo propiedades:', error);
            return { success: false, error: error.message };
        }
    }

    // Obtener propiedad por ID
    async getProperty(propertyId, userId = null) {
        try {
            const query = { _id: new ObjectId(propertyId) };
            if (userId) {
                query.user_id = new ObjectId(userId);
            }

            const property = await this.collection.findOne(query);
            
            if (!property) {
                return { success: false, error: 'Propiedad no encontrada' };
            }

            return { success: true, property };
        } catch (error) {
            console.error('❌ Error obteniendo propiedad:', error);
            return { success: false, error: error.message };
        }
    }

    // Actualizar propiedad
    async updateProperty(propertyId, userId, updateData) {
        try {
            // Remove undefined values
            const cleanUpdate = Object.fromEntries(
                Object.entries(updateData).filter(([_, value]) => value !== undefined)
            );

            cleanUpdate.updated_at = new Date();

            const result = await this.collection.updateOne(
                { _id: new ObjectId(propertyId), user_id: new ObjectId(userId) },
                { $set: cleanUpdate }
            );

            if (result.matchedCount === 0) {
                return { success: false, error: 'Propiedad no encontrada' };
            }

            console.log(`✅ Propiedad actualizada: ${propertyId}`);
            return { success: true, updated_count: result.modifiedCount };
        } catch (error) {
            console.error('❌ Error actualizando propiedad:', error);
            return { success: false, error: error.message };
        }
    }

    // Eliminar propiedad
    async deleteProperty(propertyId, userId) {
        try {
            const result = await this.collection.deleteOne({
                _id: new ObjectId(propertyId),
                user_id: new ObjectId(userId)
            });

            if (result.deletedCount === 0) {
                return { success: false, error: 'Propiedad no encontrada' };
            }

            console.log(`✅ Propiedad eliminada: ${propertyId}`);
            return { success: true };
        } catch (error) {
            console.error('❌ Error eliminando propiedad:', error);
            return { success: false, error: error.message };
        }
    }

    // Configurar canales de la propiedad
    async updateChannelConfig(propertyId, userId, channelData) {
        try {
            const result = await this.collection.updateOne(
                { _id: new ObjectId(propertyId), user_id: new ObjectId(userId) },
                { 
                    $set: { 
                        [`channels.${channelData.channel}`]: channelData.config,
                        updated_at: new Date()
                    }
                }
            );

            if (result.matchedCount === 0) {
                return { success: false, error: 'Propiedad no encontrada' };
            }

            console.log(`✅ Canal ${channelData.channel} configurado para propiedad ${propertyId}`);
            return { success: true };
        } catch (error) {
            console.error('❌ Error configurando canal:', error);
            return { success: false, error: error.message };
        }
    }

    // Obtener estadísticas de propiedades del usuario
    async getPropertyStats(userId) {
        try {
            const stats = await this.collection.aggregate([
                { $match: { user_id: new ObjectId(userId) } },
                {
                    $group: {
                        _id: null,
                        total_properties: { $sum: 1 },
                        active_properties: {
                            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] }
                        },
                        total_max_guests: { $sum: "$max_guests" },
                        avg_base_price: { $avg: "$base_price" }
                    }
                }
            ]).toArray();

            const result = stats[0] || {
                total_properties: 0,
                active_properties: 0,
                total_max_guests: 0,
                avg_base_price: 0
            };

            return { success: true, stats: result };
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = PropertyService;