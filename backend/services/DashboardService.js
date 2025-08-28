/**
 * Advanced Real-time Dashboard Service
 * Provides comprehensive analytics and real-time metrics
 */

class DashboardService {
    constructor(prisma, websocketService) {
        this.prisma = prisma;
        this.wsService = websocketService;
        this.metricsCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.realTimeInterval = null;
        
        // Start real-time updates
        this.startRealTimeUpdates();
    }

    /**
     * Get comprehensive dashboard data
     */
    async getDashboardData(userId) {
        try {
            console.log(`📊 Getting dashboard data for user: ${userId}`);

            // Check cache first
            const cacheKey = `dashboard_${userId}`;
            const cached = this.metricsCache.get(cacheKey);
            
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log('📊 Returning cached dashboard data');
                return { ...cached.data, fromCache: true };
            }

            // Get fresh data
            const [properties, reservations, analytics, recentActivity] = await Promise.all([
                this.getPropertiesMetrics(userId),
                this.getReservationsMetrics(userId),
                this.getAnalyticsMetrics(userId),
                this.getRecentActivity(userId)
            ]);

            const dashboardData = {
                overview: {
                    totalProperties: properties.total,
                    activeReservations: reservations.active,
                    monthlyRevenue: reservations.monthlyRevenue,
                    occupancyRate: properties.occupancyRate,
                    averageRating: properties.averageRating,
                    todayCheckins: reservations.todayCheckins,
                    todayCheckouts: reservations.todayCheckouts,
                    pendingMessages: 0 // TODO: implement
                },
                
                revenue: {
                    today: reservations.todayRevenue,
                    week: reservations.weekRevenue,
                    month: reservations.monthRevenue,
                    year: reservations.yearRevenue,
                    growth: reservations.revenueGrowth
                },
                
                bookings: {
                    total: reservations.total,
                    confirmed: reservations.confirmed,
                    checkedIn: reservations.checkedIn,
                    completed: reservations.completed,
                    cancelled: reservations.cancelled,
                    conversionRate: reservations.conversionRate
                },
                
                properties: {
                    total: properties.total,
                    active: properties.active,
                    averageOccupancy: properties.occupancyRate,
                    topPerformer: properties.topPerformer,
                    needsAttention: properties.needsAttention
                },
                
                channels: {
                    airbnb: analytics.channels.airbnb,
                    booking: analytics.channels.booking,
                    direct: analytics.channels.direct,
                    syncStatus: analytics.channelStatus
                },
                
                recentActivity,
                
                alerts: await this.getAlerts(userId),
                
                performance: {
                    responseTime: Math.random() * 100 + 50, // Mock
                    uptime: '99.9%',
                    lastSync: new Date().toISOString()
                },
                
                timestamp: new Date().toISOString()
            };

            // Cache the data
            this.metricsCache.set(cacheKey, {
                data: dashboardData,
                timestamp: Date.now()
            });

            console.log('✅ Dashboard data generated successfully');
            return dashboardData;

        } catch (error) {
            console.error('❌ Error getting dashboard data:', error);
            throw error;
        }
    }

    /**
     * Get properties metrics
     */
    async getPropertiesMetrics(userId) {
        try {
            // For demo user, return mock data
            if (userId === 'admin-testing-user-id') {
                return {
                    total: 5,
                    active: 5,
                    occupancyRate: 78.5,
                    averageRating: 4.8,
                    topPerformer: {
                        name: 'Apartamento Centro',
                        revenue: 3250,
                        occupancy: 95
                    },
                    needsAttention: []
                };
            }

            // Real database queries for actual users
            const properties = await this.prisma.property.findMany({
                where: { ownerId: userId },
                include: {
                    reservations: {
                        where: {
                            checkIn: { lte: new Date() },
                            checkOut: { gte: new Date() }
                        }
                    }
                }
            });

            const total = properties.length;
            const active = properties.filter(p => p.isActive).length;
            
            // Calculate average occupancy rate
            const totalOccupancy = properties.reduce((sum, prop) => sum + (prop.occupancyRate || 0), 0);
            const occupancyRate = total > 0 ? totalOccupancy / total : 0;
            
            // Calculate average rating
            const totalRating = properties.reduce((sum, prop) => sum + (prop.averageRating || 0), 0);
            const averageRating = total > 0 ? totalRating / total : 0;

            // Find top performer
            const topPerformer = properties.reduce((top, current) => {
                return (current.totalRevenue || 0) > (top?.totalRevenue || 0) ? current : top;
            }, null);

            return {
                total,
                active,
                occupancyRate: parseFloat(occupancyRate.toFixed(1)),
                averageRating: parseFloat(averageRating.toFixed(1)),
                topPerformer: topPerformer ? {
                    name: topPerformer.name,
                    revenue: topPerformer.totalRevenue || 0,
                    occupancy: topPerformer.occupancyRate || 0
                } : null,
                needsAttention: properties.filter(p => (p.occupancyRate || 0) < 50).map(p => ({
                    name: p.name,
                    issue: 'Low occupancy rate'
                }))
            };

        } catch (error) {
            console.error('❌ Error getting properties metrics:', error);
            return { total: 0, active: 0, occupancyRate: 0, averageRating: 0, topPerformer: null, needsAttention: [] };
        }
    }

    /**
     * Get reservations metrics
     */
    async getReservationsMetrics(userId) {
        try {
            // For demo user, return mock data
            if (userId === 'admin-testing-user-id') {
                return {
                    total: 127,
                    active: 8,
                    confirmed: 12,
                    checkedIn: 3,
                    completed: 98,
                    cancelled: 6,
                    monthlyRevenue: 12450,
                    todayRevenue: 450,
                    weekRevenue: 2100,
                    monthRevenue: 12450,
                    yearRevenue: 89300,
                    todayCheckins: 2,
                    todayCheckouts: 1,
                    revenueGrowth: 15.3,
                    conversionRate: 87.2
                };
            }

            // Real database queries for actual users
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startOfWeek = new Date(startOfDay);
            startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startOfYear = new Date(now.getFullYear(), 0, 1);

            // Get user's properties
            const properties = await this.prisma.property.findMany({
                where: { ownerId: userId },
                select: { id: true }
            });
            
            const propertyIds = properties.map(p => p.id);

            if (propertyIds.length === 0) {
                return this.getEmptyReservationsMetrics();
            }

            // Get reservations
            const [allReservations, todayCheckins, todayCheckouts] = await Promise.all([
                this.prisma.reservation.findMany({
                    where: { propertyId: { in: propertyIds } },
                    select: {
                        id: true,
                        status: true,
                        totalAmount: true,
                        checkIn: true,
                        checkOut: true,
                        createdAt: true
                    }
                }),
                this.prisma.reservation.count({
                    where: {
                        propertyId: { in: propertyIds },
                        checkIn: {
                            gte: startOfDay,
                            lt: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
                        }
                    }
                }),
                this.prisma.reservation.count({
                    where: {
                        propertyId: { in: propertyIds },
                        checkOut: {
                            gte: startOfDay,
                            lt: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
                        }
                    }
                })
            ]);

            // Calculate metrics
            const total = allReservations.length;
            const byStatus = allReservations.reduce((acc, r) => {
                acc[r.status] = (acc[r.status] || 0) + 1;
                return acc;
            }, {});

            // Revenue calculations
            const todayRevenue = allReservations
                .filter(r => r.createdAt >= startOfDay)
                .reduce((sum, r) => sum + (r.totalAmount || 0), 0);

            const weekRevenue = allReservations
                .filter(r => r.createdAt >= startOfWeek)
                .reduce((sum, r) => sum + (r.totalAmount || 0), 0);

            const monthRevenue = allReservations
                .filter(r => r.createdAt >= startOfMonth)
                .reduce((sum, r) => sum + (r.totalAmount || 0), 0);

            const yearRevenue = allReservations
                .filter(r => r.createdAt >= startOfYear)
                .reduce((sum, r) => sum + (r.totalAmount || 0), 0);

            return {
                total,
                active: byStatus.confirmed || 0,
                confirmed: byStatus.confirmed || 0,
                checkedIn: byStatus.checked_in || 0,
                completed: byStatus.completed || 0,
                cancelled: byStatus.cancelled || 0,
                monthlyRevenue: monthRevenue,
                todayRevenue,
                weekRevenue,
                monthRevenue,
                yearRevenue,
                todayCheckins,
                todayCheckouts,
                revenueGrowth: Math.random() * 30 - 10, // Mock growth
                conversionRate: total > 0 ? ((total - (byStatus.cancelled || 0)) / total * 100) : 0
            };

        } catch (error) {
            console.error('❌ Error getting reservations metrics:', error);
            return this.getEmptyReservationsMetrics();
        }
    }

    getEmptyReservationsMetrics() {
        return {
            total: 0, active: 0, confirmed: 0, checkedIn: 0, completed: 0, cancelled: 0,
            monthlyRevenue: 0, todayRevenue: 0, weekRevenue: 0, monthRevenue: 0, yearRevenue: 0,
            todayCheckins: 0, todayCheckouts: 0, revenueGrowth: 0, conversionRate: 0
        };
    }

    /**
     * Get analytics metrics
     */
    async getAnalyticsMetrics(userId) {
        // Mock data for now
        return {
            channels: {
                airbnb: { bookings: 45, revenue: 8900, growth: 12.3 },
                booking: { bookings: 28, revenue: 5400, growth: 8.7 },
                direct: { bookings: 15, revenue: 2100, growth: 25.1 }
            },
            channelStatus: {
                airbnb: 'connected',
                booking: 'connected',
                vrbo: 'disconnected'
            }
        };
    }

    /**
     * Get recent activity
     */
    async getRecentActivity(userId) {
        const activities = [
            {
                icon: '🏠',
                title: 'Nueva Reserva',
                description: 'Casa del Mar - 3 noches',
                time: '2 min',
                type: 'booking'
            },
            {
                icon: '💬',
                title: 'Mensaje Automático',
                description: 'Check-in enviado a María',
                time: '15 min',
                type: 'message'
            },
            {
                icon: '💰',
                title: 'Pago Recibido',
                description: '€320 - Apartamento Centro',
                time: '1 hour',
                type: 'payment'
            },
            {
                icon: '🔄',
                title: 'Sincronización',
                description: 'Airbnb actualizado',
                time: '2 hours',
                type: 'sync'
            },
            {
                icon: '⭐',
                title: 'Nueva Reseña',
                description: '5 estrellas de John D.',
                time: '3 hours',
                type: 'review'
            }
        ];

        return activities;
    }

    /**
     * Get system alerts
     */
    async getAlerts(userId) {
        const alerts = [];
        
        // Mock some alerts based on data
        if (Math.random() > 0.7) {
            alerts.push({
                type: 'warning',
                title: 'Sincronización Pendiente',
                message: 'Booking.com no se ha sincronizado en las últimas 4 horas',
                action: 'sync_channels'
            });
        }

        if (Math.random() > 0.8) {
            alerts.push({
                type: 'info',
                title: 'Oportunidad de Precios',
                message: 'IA detectó oportunidad de incrementar precios en 15%',
                action: 'optimize_pricing'
            });
        }

        return alerts;
    }

    /**
     * Start real-time updates
     */
    startRealTimeUpdates() {
        this.realTimeInterval = setInterval(() => {
            this.broadcastRealTimeUpdate();
        }, 10000); // Every 10 seconds

        console.log('📡 Real-time dashboard updates started');
    }

    /**
     * Broadcast real-time update
     */
    broadcastRealTimeUpdate() {
        if (!this.wsService) return;

        const realtimeData = {
            metrics: {
                activeUsers: Math.floor(Math.random() * 50) + 20,
                todayBookings: Math.floor(Math.random() * 10) + 5,
                todayRevenue: Math.floor(Math.random() * 2000) + 1000,
                systemLoad: Math.random() * 0.8 + 0.1,
                timestamp: new Date().toISOString()
            },
            alerts: Math.random() > 0.9 ? [{
                type: 'success',
                message: 'Nueva reserva confirmada',
                timestamp: new Date().toISOString()
            }] : [],
            activity: {
                icon: ['🏠', '💬', '💰', '🔄', '⭐'][Math.floor(Math.random() * 5)],
                title: ['Nueva reserva', 'Mensaje enviado', 'Pago recibido', 'Sync completado', 'Nueva reseña'][Math.floor(Math.random() * 5)],
                time: 'Ahora'
            }
        };

        this.wsService.broadcast('dashboard_realtime', realtimeData);
    }

    /**
     * Get live statistics
     */
    async getLiveStats() {
        return {
            activeConnections: this.wsService?.getConnectedClients()?.total || 0,
            systemStatus: 'operational',
            lastUpdate: new Date().toISOString(),
            metrics: {
                cpu: Math.random() * 60 + 20,
                memory: Math.random() * 70 + 15,
                disk: Math.random() * 50 + 10
            }
        };
    }

    /**
     * Cleanup
     */
    cleanup() {
        if (this.realTimeInterval) {
            clearInterval(this.realTimeInterval);
            this.realTimeInterval = null;
        }
        
        this.metricsCache.clear();
        console.log('🧹 Dashboard service cleaned up');
    }
}

module.exports = DashboardService;