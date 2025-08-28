/**
 * Advanced Notification Service
 * Handles all types of notifications: in-app, email, WhatsApp, push notifications
 */

class NotificationService {
    constructor(prisma, websocketService) {
        this.prisma = prisma;
        this.wsService = websocketService;
        this.emailService = null; // Will be initialized later
        this.whatsappService = null; // Will be initialized later
        
        this.notificationTypes = {
            BOOKING_CONFIRMED: 'booking_confirmed',
            BOOKING_CANCELLED: 'booking_cancelled',
            CHECKIN_READY: 'checkin_ready',
            CHECKOUT_REMINDER: 'checkout_reminder',
            PAYMENT_RECEIVED: 'payment_received',
            PAYMENT_FAILED: 'payment_failed',
            PROPERTY_CREATED: 'property_created',
            CHANNEL_SYNC_SUCCESS: 'channel_sync_success',
            CHANNEL_SYNC_ERROR: 'channel_sync_error',
            SMART_LOCK_CONNECTED: 'smart_lock_connected',
            SMART_LOCK_ERROR: 'smart_lock_error',
            SYSTEM_MAINTENANCE: 'system_maintenance',
            PRICING_UPDATED: 'pricing_updated'
        };
    }

    /**
     * Create a new notification
     */
    async createNotification(userId, notification) {
        try {
            const newNotification = await this.prisma.notification.create({
                data: {
                    userId,
                    title: notification.title,
                    message: notification.message,
                    type: notification.type || 'info',
                    category: notification.category || null,
                    entityType: notification.entityType || null,
                    entityId: notification.entityId || null,
                    actionUrl: notification.actionUrl || null,
                    actionText: notification.actionText || null,
                    priority: notification.priority || 'normal',
                    metadata: notification.metadata || null
                }
            });

            // Send real-time notification via WebSocket
            if (this.wsService) {
                this.wsService.broadcastToUser(userId, 'notification', {
                    id: newNotification.id,
                    title: newNotification.title,
                    message: newNotification.message,
                    type: newNotification.type,
                    priority: newNotification.priority,
                    createdAt: newNotification.createdAt
                });
            }

            console.log(`✅ Notification created: ${notification.title} for user ${userId}`);
            return newNotification;

        } catch (error) {
            console.error('❌ Error creating notification:', error);
            throw error;
        }
    }

    /**
     * Get notifications for a user
     */
    async getUserNotifications(userId, options = {}) {
        try {
            const {
                limit = 50,
                offset = 0,
                unreadOnly = false,
                category = null,
                type = null
            } = options;

            const where = { userId };
            if (unreadOnly) where.isRead = false;
            if (category) where.category = category;
            if (type) where.type = type;

            const notifications = await this.prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset
            });

            const unreadCount = await this.prisma.notification.count({
                where: { userId, isRead: false }
            });

            return {
                notifications,
                unreadCount,
                total: notifications.length
            };

        } catch (error) {
            console.error('❌ Error getting user notifications:', error);
            throw error;
        }
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId, userId) {
        try {
            const notification = await this.prisma.notification.update({
                where: {
                    id: notificationId,
                    userId // Ensure user owns the notification
                },
                data: {
                    isRead: true,
                    readAt: new Date()
                }
            });

            // Broadcast update via WebSocket
            if (this.wsService) {
                this.wsService.broadcastToUser(userId, 'notification_read', {
                    notificationId,
                    readAt: notification.readAt
                });
            }

            return notification;

        } catch (error) {
            console.error('❌ Error marking notification as read:', error);
            throw error;
        }
    }

    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(userId) {
        try {
            const result = await this.prisma.notification.updateMany({
                where: {
                    userId,
                    isRead: false
                },
                data: {
                    isRead: true,
                    readAt: new Date()
                }
            });

            // Broadcast update via WebSocket
            if (this.wsService) {
                this.wsService.broadcastToUser(userId, 'all_notifications_read', {
                    markedCount: result.count,
                    readAt: new Date()
                });
            }

            console.log(`✅ Marked ${result.count} notifications as read for user ${userId}`);
            return result;

        } catch (error) {
            console.error('❌ Error marking all notifications as read:', error);
            throw error;
        }
    }

    /**
     * Delete a notification
     */
    async deleteNotification(notificationId, userId) {
        try {
            await this.prisma.notification.delete({
                where: {
                    id: notificationId,
                    userId
                }
            });

            console.log(`✅ Notification deleted: ${notificationId}`);
            return true;

        } catch (error) {
            console.error('❌ Error deleting notification:', error);
            throw error;
        }
    }

    /**
     * Send booking confirmation notification
     */
    async sendBookingConfirmation(userId, reservation) {
        const notification = {
            title: 'Nueva Reserva Confirmada',
            message: `Reserva de ${reservation.guestName} en ${reservation.property?.name} del ${this.formatDate(reservation.checkIn)} al ${this.formatDate(reservation.checkOut)}`,
            type: 'success',
            category: 'reservation',
            entityType: 'reservation',
            entityId: reservation.id,
            actionUrl: `/reservations/${reservation.id}`,
            actionText: 'Ver Reserva',
            priority: 'high'
        };

        return await this.createNotification(userId, notification);
    }

    /**
     * Send payment received notification
     */
    async sendPaymentReceived(userId, payment) {
        const notification = {
            title: 'Pago Recibido',
            message: `Pago de €${payment.amount} recibido correctamente`,
            type: 'success',
            category: 'payment',
            entityType: 'payment',
            entityId: payment.id,
            priority: 'normal'
        };

        return await this.createNotification(userId, notification);
    }

    /**
     * Send channel sync success notification
     */
    async sendChannelSyncSuccess(userId, propertyName, channel, syncedReservations) {
        const notification = {
            title: 'Sincronización Completada',
            message: `${channel} sincronizado exitosamente para ${propertyName}. ${syncedReservations} reservas actualizadas.`,
            type: 'success',
            category: 'system',
            priority: 'low'
        };

        return await this.createNotification(userId, notification);
    }

    /**
     * Send channel sync error notification
     */
    async sendChannelSyncError(userId, propertyName, channel, errorMessage) {
        const notification = {
            title: 'Error en Sincronización',
            message: `Error sincronizando ${channel} para ${propertyName}: ${errorMessage}`,
            type: 'error',
            category: 'system',
            priority: 'high',
            metadata: { errorMessage, channel, propertyName }
        };

        return await this.createNotification(userId, notification);
    }

    /**
     * Send smart lock connected notification
     */
    async sendSmartLockConnected(userId, propertyName, lockName) {
        const notification = {
            title: 'Smart Lock Conectado',
            message: `${lockName} conectado exitosamente en ${propertyName}`,
            type: 'success',
            category: 'system',
            priority: 'normal'
        };

        return await this.createNotification(userId, notification);
    }

    /**
     * Send pricing update notification
     */
    async sendPricingUpdate(userId, propertyName, averageChange) {
        const changeText = averageChange > 0 ? `+${averageChange}%` : `${averageChange}%`;
        const notification = {
            title: 'Precios Actualizados por IA',
            message: `Precios optimizados para ${propertyName}. Cambio promedio: ${changeText}`,
            type: 'info',
            category: 'property',
            priority: 'normal'
        };

        return await this.createNotification(userId, notification);
    }

    /**
     * Send system maintenance notification
     */
    async sendSystemMaintenance(userIds, maintenanceDetails) {
        const notification = {
            title: 'Mantenimiento Programado',
            message: `Mantenimiento del sistema programado: ${maintenanceDetails.description}`,
            type: 'warning',
            category: 'system',
            priority: 'high',
            metadata: maintenanceDetails
        };

        // Send to multiple users
        const promises = userIds.map(userId => this.createNotification(userId, notification));
        return await Promise.all(promises);
    }

    /**
     * Clean up old notifications
     */
    async cleanupOldNotifications(daysOld = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const result = await this.prisma.notification.deleteMany({
                where: {
                    createdAt: { lt: cutoffDate },
                    isRead: true
                }
            });

            console.log(`🧹 Cleaned up ${result.count} old notifications`);
            return result;

        } catch (error) {
            console.error('❌ Error cleaning up notifications:', error);
            throw error;
        }
    }

    /**
     * Get notification statistics
     */
    async getNotificationStats(userId) {
        try {
            const [total, unread, byType, byCategory] = await Promise.all([
                this.prisma.notification.count({ where: { userId } }),
                this.prisma.notification.count({ where: { userId, isRead: false } }),
                this.prisma.notification.groupBy({
                    by: ['type'],
                    where: { userId },
                    _count: { type: true }
                }),
                this.prisma.notification.groupBy({
                    by: ['category'],
                    where: { userId, category: { not: null } },
                    _count: { category: true }
                })
            ]);

            return {
                total,
                unread,
                read: total - unread,
                byType: byType.reduce((acc, item) => {
                    acc[item.type] = item._count.type;
                    return acc;
                }, {}),
                byCategory: byCategory.reduce((acc, item) => {
                    acc[item.category] = item._count.category;
                    return acc;
                }, {})
            };

        } catch (error) {
            console.error('❌ Error getting notification stats:', error);
            throw error;
        }
    }

    // Helper methods
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    formatDateTime(dateString) {
        return new Date(dateString).toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

module.exports = NotificationService;