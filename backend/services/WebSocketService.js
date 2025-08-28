const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

class WebSocketService {
    constructor() {
        this.wss = null;
        this.clients = new Map();
        this.updateInterval = null;
    }

    initialize(server) {
        this.wss = new WebSocket.Server({ 
            server,
            path: '/ws',
            verifyClient: (info) => {
                // Allow connections (authentication will be done after connection)
                return true;
            }
        });

        this.wss.on('connection', (ws, req) => {
            console.log('🔌 New WebSocket connection');
            
            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    await this.handleMessage(ws, data);
                } catch (error) {
                    console.error('❌ WebSocket message error:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Invalid message format'
                    }));
                }
            });

            ws.on('close', () => {
                console.log('🔌 WebSocket connection closed');
                this.removeClient(ws);
            });

            ws.on('error', (error) => {
                console.error('❌ WebSocket error:', error);
                this.removeClient(ws);
            });

            // Send initial connection message
            ws.send(JSON.stringify({
                type: 'connected',
                message: 'WebSocket connected successfully'
            }));
        });

        // Start periodic updates
        this.startPeriodicUpdates();

        console.log('✅ WebSocket server initialized');
    }

    async handleMessage(ws, data) {
        switch (data.type) {
            case 'authenticate':
                await this.authenticateClient(ws, data.token);
                break;
            
            case 'subscribe':
                await this.subscribeClient(ws, data.topics);
                break;
            
            case 'unsubscribe':
                this.unsubscribeClient(ws, data.topics);
                break;
            
            default:
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Unknown message type'
                }));
        }
    }

    async authenticateClient(ws, token) {
        try {
            if (!token) {
                ws.send(JSON.stringify({
                    type: 'auth_error',
                    message: 'Token required'
                }));
                return;
            }

            const jwtSecret = process.env.JWT_SECRET || 'airhost-testing-secret-key-2024';
            const decoded = jwt.verify(token, jwtSecret);

            // Store client info
            this.clients.set(ws, {
                userId: decoded.userId,
                subscriptions: new Set(),
                authenticated: true,
                lastActivity: Date.now()
            });

            ws.send(JSON.stringify({
                type: 'authenticated',
                message: 'Authentication successful',
                userId: decoded.userId
            }));

            console.log(`✅ Client authenticated: ${decoded.userId}`);

        } catch (error) {
            console.error('❌ Authentication failed:', error);
            ws.send(JSON.stringify({
                type: 'auth_error',
                message: 'Authentication failed'
            }));
        }
    }

    async subscribeClient(ws, topics) {
        const clientInfo = this.clients.get(ws);
        
        if (!clientInfo || !clientInfo.authenticated) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Authentication required'
            }));
            return;
        }

        if (Array.isArray(topics)) {
            topics.forEach(topic => clientInfo.subscriptions.add(topic));
        } else {
            clientInfo.subscriptions.add(topics);
        }

        ws.send(JSON.stringify({
            type: 'subscribed',
            topics: Array.from(clientInfo.subscriptions)
        }));

        console.log(`📡 Client subscribed to: ${Array.from(clientInfo.subscriptions).join(', ')}`);
    }

    unsubscribeClient(ws, topics) {
        const clientInfo = this.clients.get(ws);
        
        if (!clientInfo) return;

        if (Array.isArray(topics)) {
            topics.forEach(topic => clientInfo.subscriptions.delete(topic));
        } else {
            clientInfo.subscriptions.delete(topics);
        }

        ws.send(JSON.stringify({
            type: 'unsubscribed',
            topics: Array.from(clientInfo.subscriptions)
        }));
    }

    removeClient(ws) {
        this.clients.delete(ws);
    }

    broadcast(topic, data) {
        const message = JSON.stringify({
            type: 'update',
            topic,
            data,
            timestamp: new Date().toISOString()
        });

        this.clients.forEach((clientInfo, ws) => {
            if (clientInfo.authenticated && 
                clientInfo.subscriptions.has(topic) && 
                ws.readyState === WebSocket.OPEN) {
                
                try {
                    ws.send(message);
                } catch (error) {
                    console.error('❌ Error sending message to client:', error);
                    this.removeClient(ws);
                }
            }
        });
    }

    // Broadcast to specific user
    broadcastToUser(userId, topic, data) {
        const message = JSON.stringify({
            type: 'update',
            topic,
            data,
            timestamp: new Date().toISOString()
        });

        this.clients.forEach((clientInfo, ws) => {
            if (clientInfo.userId === userId &&
                clientInfo.authenticated && 
                ws.readyState === WebSocket.OPEN) {
                
                try {
                    ws.send(message);
                } catch (error) {
                    console.error('❌ Error sending message to user:', error);
                    this.removeClient(ws);
                }
            }
        });
    }

    startPeriodicUpdates() {
        this.updateInterval = setInterval(() => {
            this.generateRealtimeData();
        }, 5000); // Update every 5 seconds

        console.log('⏱️  Periodic updates started');
    }

    stopPeriodicUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    generateRealtimeData() {
        if (this.clients.size === 0) return;

        // Generate mock real-time data
        const realtimeData = {
            metrics: {
                todayRevenue: Math.floor(Math.random() * 2000 + 1000),
                activeBookings: Math.floor(Math.random() * 15 + 5),
                todayCheckins: Math.floor(Math.random() * 8 + 1),
                messagesSent: Math.floor(Math.random() * 50 + 20),
                timestamp: new Date().toISOString()
            },
            systemStatus: {
                apiStatus: 'online',
                whatsappBot: Math.random() > 0.1 ? 'active' : 'offline',
                smartLocks: Math.floor(Math.random() * 5 + 2) + ' connected',
                lastSync: 'hace ' + Math.floor(Math.random() * 5 + 1) + ' min'
            },
            activity: this.generateRandomActivity()
        };

        // Broadcast to all subscribed clients
        this.broadcast('dashboard_metrics', realtimeData.metrics);
        this.broadcast('system_status', realtimeData.systemStatus);
        this.broadcast('activity_feed', realtimeData.activity);
    }

    generateRandomActivity() {
        const activities = [
            { icon: '🏠', title: 'Nueva Reserva', desc: 'Apartamento Centro - 3 noches', type: 'booking' },
            { icon: '💬', title: 'Mensaje Enviado', desc: 'Check-in automático enviado', type: 'message' },
            { icon: '🔑', title: 'Check-in Completado', desc: 'Código utilizado correctamente', type: 'checkin' },
            { icon: '💰', title: 'Pago Recibido', desc: '€' + Math.floor(Math.random() * 500 + 100) + ' - Confirmado', type: 'payment' },
            { icon: '📊', title: 'Sync Completado', desc: 'Calendarios actualizados', type: 'sync' },
            { icon: '🔒', title: 'Cerradura Activada', desc: 'Smart lock configurado', type: 'smartlock' }
        ];

        return activities[Math.floor(Math.random() * activities.length)];
    }

    getConnectedClients() {
        return {
            total: this.clients.size,
            authenticated: Array.from(this.clients.values()).filter(c => c.authenticated).length
        };
    }

    cleanup() {
        this.stopPeriodicUpdates();
        
        if (this.wss) {
            this.wss.clients.forEach((ws) => {
                ws.terminate();
            });
            this.wss.close();
        }
        
        this.clients.clear();
        console.log('🧹 WebSocket service cleaned up');
    }
}

module.exports = WebSocketService;