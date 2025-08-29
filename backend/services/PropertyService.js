/**
 * Simple Property Service using Prisma
 * For the 4 core modules simplified system
 */
class PropertyService {
    constructor(prisma) {
        this.prisma = prisma;
    }

    // Get all properties for user
    async getProperties(userId) {
        try {
            const properties = await this.prisma.property.findMany({
                where: { ownerId: userId },
                include: {
                    channels: true,
                    reservations: {
                        where: {
                            status: 'confirmed',
                            checkOut: { gte: new Date() }
                        },
                        take: 5,
                        orderBy: { checkIn: 'asc' }
                    }
                }
            });

            return {
                success: true,
                properties
            };
        } catch (error) {
            console.error('Error fetching properties:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Create new property
    async createProperty(userId, propertyData) {
        try {
            const property = await this.prisma.property.create({
                data: {
                    ownerId: userId,
                    ...propertyData,
                    currency: propertyData.currency || 'EUR',
                    cleaningFee: propertyData.cleaningFee || 0,
                    channelsConfig: propertyData.channelsConfig || {},
                    isActive: true,
                    autoMessaging: propertyData.autoMessaging !== undefined ? propertyData.autoMessaging : true
                }
            });

            return {
                success: true,
                property
            };
        } catch (error) {
            console.error('Error creating property:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Update property
    async updateProperty(userId, propertyId, updateData) {
        try {
            // Verify ownership
            const existingProperty = await this.prisma.property.findFirst({
                where: { 
                    id: propertyId, 
                    ownerId: userId 
                }
            });

            if (!existingProperty) {
                return {
                    success: false,
                    error: 'Property not found or access denied'
                };
            }

            const property = await this.prisma.property.update({
                where: { id: propertyId },
                data: updateData
            });

            return {
                success: true,
                property
            };
        } catch (error) {
            console.error('Error updating property:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get single property
    async getProperty(userId, propertyId) {
        try {
            const property = await this.prisma.property.findFirst({
                where: { 
                    id: propertyId, 
                    ownerId: userId 
                },
                include: {
                    channels: true,
                    reservations: {
                        orderBy: { checkIn: 'desc' },
                        take: 10
                    }
                }
            });

            if (!property) {
                return {
                    success: false,
                    error: 'Property not found'
                };
            }

            return {
                success: true,
                property
            };
        } catch (error) {
            console.error('Error fetching property:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Delete property
    async deleteProperty(userId, propertyId) {
        try {
            // Verify ownership
            const existingProperty = await this.prisma.property.findFirst({
                where: { 
                    id: propertyId, 
                    ownerId: userId 
                }
            });

            if (!existingProperty) {
                return {
                    success: false,
                    error: 'Property not found or access denied'
                };
            }

            await this.prisma.property.delete({
                where: { id: propertyId }
            });

            return {
                success: true,
                message: 'Property deleted successfully'
            };
        } catch (error) {
            console.error('Error deleting property:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Update property stats (for basic analytics)
    async updatePropertyStats(propertyId, stats) {
        try {
            const property = await this.prisma.property.update({
                where: { id: propertyId },
                data: {
                    totalBookings: stats.totalBookings,
                    totalRevenue: stats.totalRevenue,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                property
            };
        } catch (error) {
            console.error('Error updating property stats:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get properties with basic stats for dashboard
    async getPropertiesWithStats(userId) {
        try {
            const properties = await this.prisma.property.findMany({
                where: { ownerId: userId },
                include: {
                    channels: true,
                    reservations: {
                        where: {
                            checkOut: { gte: new Date() }
                        }
                    }
                }
            });

            // Add calculated stats
            const propertiesWithStats = properties.map(property => ({
                ...property,
                activeReservations: property.reservations.length,
                nextCheckIn: property.reservations
                    .filter(r => r.checkIn >= new Date())
                    .sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn))[0]?.checkIn || null
            }));

            return {
                success: true,
                properties: propertiesWithStats
            };
        } catch (error) {
            console.error('Error fetching properties with stats:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = PropertyService;