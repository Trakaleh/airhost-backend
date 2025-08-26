const { ObjectId } = require('mongodb');

class AnalyticsService {
    constructor(db) {
        this.db = db;
        this.analyticsCollection = db.collection('analytics');
        this.eventsCollection = db.collection('events');
    }

    // Obtener dashboard analytics general
    async getDashboardAnalytics(userId) {
        try {
            const [
                propertyStats,
                bookingStats,
                revenueStats,
                messageStats,
                lockStats
            ] = await Promise.all([
                this.getPropertyStats(userId),
                this.getBookingStats(userId),
                this.getRevenueStats(userId),
                this.getMessageStats(userId),
                this.getLockStats(userId)
            ]);

            const analytics = {
                properties: propertyStats.total || 0,
                bookings: bookingStats.active || 0,
                messages: messageStats.total_sent || 0,
                revenue: revenueStats.monthly || 0,
                
                // Additional detailed stats
                detailed: {
                    properties: propertyStats,
                    bookings: bookingStats,
                    revenue: revenueStats,
                    messages: messageStats,
                    locks: lockStats
                },

                // Performance metrics
                performance: {
                    occupancy_rate: bookingStats.occupancy_rate || 0,
                    avg_booking_value: revenueStats.avg_booking_value || 0,
                    response_time: messageStats.avg_response_time || 0,
                    automation_rate: messageStats.automation_rate || 0
                },

                generated_at: new Date()
            };

            return { success: true, data: analytics };
        } catch (error) {
            console.error('❌ Error obteniendo analytics del dashboard:', error);
            return { success: false, error: error.message };
        }
    }

    // Estadísticas de propiedades
    async getPropertyStats(userId) {
        try {
            const properties = this.db.collection('properties');
            
            const stats = await properties.aggregate([
                { $match: { user_id: new ObjectId(userId) } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
                        inactive: { $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] } },
                        total_capacity: { $sum: "$max_guests" },
                        avg_price: { $avg: "$base_price" },
                        
                        // Channel distribution
                        airbnb_connected: {
                            $sum: { $cond: ["$channels.airbnb.is_active", 1, 0] }
                        },
                        booking_connected: {
                            $sum: { $cond: ["$channels.booking.is_active", 1, 0] }
                        },
                        vrbo_connected: {
                            $sum: { $cond: ["$channels.vrbo.is_active", 1, 0] }
                        }
                    }
                }
            ]).toArray();

            return stats[0] || {
                total: 0,
                active: 0,
                inactive: 0,
                total_capacity: 0,
                avg_price: 0,
                airbnb_connected: 0,
                booking_connected: 0,
                vrbo_connected: 0
            };
        } catch (error) {
            console.error('❌ Error obteniendo stats de propiedades:', error);
            throw error;
        }
    }

    // Estadísticas de reservas
    async getBookingStats(userId) {
        try {
            const bookings = this.db.collection('bookings');
            const currentDate = new Date();
            const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

            const stats = await bookings.aggregate([
                { $match: { user_id: new ObjectId(userId) } },
                {
                    $facet: {
                        total: [
                            { $count: "count" }
                        ],
                        active: [
                            {
                                $match: {
                                    check_out: { $gte: currentDate },
                                    status: { $in: ['confirmed', 'checked_in'] }
                                }
                            },
                            { $count: "count" }
                        ],
                        thisMonth: [
                            {
                                $match: {
                                    check_in: { 
                                        $gte: monthStart,
                                        $lte: monthEnd
                                    }
                                }
                            },
                            { $count: "count" }
                        ],
                        upcoming: [
                            {
                                $match: {
                                    check_in: { $gt: currentDate },
                                    status: { $in: ['confirmed', 'pending'] }
                                }
                            },
                            { $count: "count" }
                        ]
                    }
                }
            ]).toArray();

            const result = stats[0];
            
            return {
                total: result.total[0]?.count || 0,
                active: result.active[0]?.count || 0,
                this_month: result.thisMonth[0]?.count || 0,
                upcoming: result.upcoming[0]?.count || 0,
                occupancy_rate: await this.calculateOccupancyRate(userId)
            };
        } catch (error) {
            console.error('❌ Error obteniendo stats de reservas:', error);
            throw error;
        }
    }

    // Estadísticas de ingresos
    async getRevenueStats(userId) {
        try {
            const bookings = this.db.collection('bookings');
            const payments = this.db.collection('payments');
            const currentDate = new Date();
            const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const yearStart = new Date(currentDate.getFullYear(), 0, 1);

            const revenueStats = await payments.aggregate([
                { $match: { user_id: new ObjectId(userId), status: 'completed' } },
                {
                    $facet: {
                        monthly: [
                            {
                                $match: {
                                    created_at: { $gte: monthStart }
                                }
                            },
                            {
                                $group: {
                                    _id: null,
                                    total: { $sum: "$amount" },
                                    count: { $sum: 1 }
                                }
                            }
                        ],
                        yearly: [
                            {
                                $match: {
                                    created_at: { $gte: yearStart }
                                }
                            },
                            {
                                $group: {
                                    _id: null,
                                    total: { $sum: "$amount" },
                                    count: { $sum: 1 }
                                }
                            }
                        ],
                        total: [
                            {
                                $group: {
                                    _id: null,
                                    total: { $sum: "$amount" },
                                    count: { $sum: 1 },
                                    avg: { $avg: "$amount" }
                                }
                            }
                        ]
                    }
                }
            ]).toArray();

            const result = revenueStats[0];

            return {
                monthly: result.monthly[0]?.total || 0,
                yearly: result.yearly[0]?.total || 0,
                total: result.total[0]?.total || 0,
                avg_booking_value: result.total[0]?.avg || 0,
                total_transactions: result.total[0]?.count || 0
            };
        } catch (error) {
            console.error('❌ Error obteniendo stats de ingresos:', error);
            throw error;
        }
    }

    // Estadísticas de mensajes
    async getMessageStats(userId) {
        try {
            const messages = this.db.collection('messages');
            const currentDate = new Date();
            const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

            const messageStats = await messages.aggregate([
                { $match: { user_id: new ObjectId(userId) } },
                {
                    $facet: {
                        total: [
                            {
                                $group: {
                                    _id: null,
                                    sent: { $sum: { $cond: [{ $eq: ["$direction", "outgoing"] }, 1, 0] } },
                                    received: { $sum: { $cond: [{ $eq: ["$direction", "incoming"] }, 1, 0] } },
                                    automated: { $sum: { $cond: ["$is_automated", 1, 0] } }
                                }
                            }
                        ],
                        monthly: [
                            {
                                $match: {
                                    created_at: { $gte: monthStart }
                                }
                            },
                            {
                                $group: {
                                    _id: null,
                                    sent: { $sum: { $cond: [{ $eq: ["$direction", "outgoing"] }, 1, 0] } },
                                    received: { $sum: { $cond: [{ $eq: ["$direction", "incoming"] }, 1, 0] } },
                                    automated: { $sum: { $cond: ["$is_automated", 1, 0] } }
                                }
                            }
                        ]
                    }
                }
            ]).toArray();

            const result = messageStats[0];
            const totalStats = result.total[0] || { sent: 0, received: 0, automated: 0 };
            const monthlyStats = result.monthly[0] || { sent: 0, received: 0, automated: 0 };

            return {
                total_sent: totalStats.sent,
                total_received: totalStats.received,
                total_automated: totalStats.automated,
                monthly_sent: monthlyStats.sent,
                monthly_automated: monthlyStats.automated,
                automation_rate: totalStats.sent > 0 ? (totalStats.automated / totalStats.sent * 100) : 0,
                avg_response_time: await this.calculateAvgResponseTime(userId)
            };
        } catch (error) {
            console.error('❌ Error obteniendo stats de mensajes:', error);
            throw error;
        }
    }

    // Estadísticas de cerraduras inteligentes
    async getLockStats(userId) {
        try {
            const locks = this.db.collection('smart_locks');
            const codes = this.db.collection('access_codes');
            const currentDate = new Date();

            const [lockStats, codeStats] = await Promise.all([
                locks.aggregate([
                    { $match: { user_id: new ObjectId(userId) } },
                    {
                        $group: {
                            _id: null,
                            total_locks: { $sum: 1 },
                            active_locks: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
                            connected_locks: { $sum: { $cond: [{ $eq: ["$connection_status", "connected"] }, 1, 0] } }
                        }
                    }
                ]).toArray(),

                codes.aggregate([
                    { $match: { user_id: new ObjectId(userId) } },
                    {
                        $group: {
                            _id: null,
                            total_codes: { $sum: 1 },
                            active_codes: { 
                                $sum: { 
                                    $cond: [
                                        { 
                                            $and: [
                                                { $eq: ["$status", "active"] },
                                                { $gte: ["$valid_until", currentDate] }
                                            ]
                                        }, 
                                        1, 
                                        0
                                    ]
                                }
                            }
                        }
                    }
                ]).toArray()
            ]);

            const lockResult = lockStats[0] || { total_locks: 0, active_locks: 0, connected_locks: 0 };
            const codeResult = codeStats[0] || { total_codes: 0, active_codes: 0 };

            return {
                ...lockResult,
                ...codeResult
            };
        } catch (error) {
            console.error('❌ Error obteniendo stats de cerraduras:', error);
            throw error;
        }
    }

    // Calcular tasa de ocupación
    async calculateOccupancyRate(userId) {
        try {
            // Simplified occupancy rate calculation
            // In real scenario, this would consider available nights vs booked nights
            const bookings = this.db.collection('bookings');
            const properties = this.db.collection('properties');

            const currentMonth = new Date();
            const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
            const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
            const daysInMonth = monthEnd.getDate();

            const [bookedDays, totalProperties] = await Promise.all([
                bookings.aggregate([
                    {
                        $match: {
                            user_id: new ObjectId(userId),
                            $or: [
                                { check_in: { $gte: monthStart, $lte: monthEnd } },
                                { check_out: { $gte: monthStart, $lte: monthEnd } },
                                { check_in: { $lt: monthStart }, check_out: { $gt: monthEnd } }
                            ]
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total_days: { $sum: { $divide: [{ $subtract: ["$check_out", "$check_in"] }, 86400000] } }
                        }
                    }
                ]).toArray(),

                properties.countDocuments({ user_id: new ObjectId(userId), status: 'active' })
            ]);

            const totalBookedDays = bookedDays[0]?.total_days || 0;
            const totalAvailableDays = totalProperties * daysInMonth;

            return totalAvailableDays > 0 ? (totalBookedDays / totalAvailableDays * 100) : 0;
        } catch (error) {
            console.error('❌ Error calculando tasa de ocupación:', error);
            return 0;
        }
    }

    // Calcular tiempo promedio de respuesta
    async calculateAvgResponseTime(userId) {
        try {
            // Simplified response time calculation
            // In real scenario, this would measure time between guest message and host response
            return Math.floor(Math.random() * 60) + 15; // Random between 15-75 minutes for demo
        } catch (error) {
            console.error('❌ Error calculando tiempo de respuesta:', error);
            return 0;
        }
    }

    // Obtener tendencias de ingresos
    async getRevenueTrends(userId, period = 'monthly') {
        try {
            const payments = this.db.collection('payments');
            let groupBy, dateRange;

            const currentDate = new Date();
            
            switch (period) {
                case 'daily':
                    groupBy = { 
                        year: { $year: "$created_at" },
                        month: { $month: "$created_at" },
                        day: { $dayOfMonth: "$created_at" }
                    };
                    dateRange = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
                    break;
                case 'yearly':
                    groupBy = { year: { $year: "$created_at" } };
                    dateRange = new Date(currentDate.getFullYear() - 2, 0, 1); // Last 3 years
                    break;
                default: // monthly
                    groupBy = { 
                        year: { $year: "$created_at" },
                        month: { $month: "$created_at" }
                    };
                    dateRange = new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), 1); // Last 12 months
                    break;
            }

            const trends = await payments.aggregate([
                {
                    $match: {
                        user_id: new ObjectId(userId),
                        status: 'completed',
                        created_at: { $gte: dateRange }
                    }
                },
                {
                    $group: {
                        _id: groupBy,
                        revenue: { $sum: "$amount" },
                        transactions: { $sum: 1 }
                    }
                },
                { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
            ]).toArray();

            return { success: true, trends };
        } catch (error) {
            console.error('❌ Error obteniendo tendencias de ingresos:', error);
            return { success: false, error: error.message };
        }
    }

    // Registrar evento para analytics
    async recordEvent(userId, eventData) {
        try {
            const event = {
                user_id: new ObjectId(userId),
                event_type: eventData.type,
                event_category: eventData.category,
                event_data: eventData.data || {},
                timestamp: new Date(),
                session_id: eventData.session_id || null,
                user_agent: eventData.user_agent || null,
                ip_address: eventData.ip_address || null
            };

            await this.eventsCollection.insertOne(event);
            console.log(`📊 Evento registrado: ${eventData.type}`);
            
            return { success: true };
        } catch (error) {
            console.error('❌ Error registrando evento:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = AnalyticsService;