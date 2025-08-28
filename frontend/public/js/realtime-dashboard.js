/**
 * Real-Time Dashboard with WebSocket Integration
 * Connects to backend WebSocket for live updates
 */

class RealtimeDashboard {
    constructor() {
        this.ws = null;
        this.reconnectInterval = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.isAuthenticated = false;
        
        // Chart instance
        this.realTimeChart = null;
        
        // Data cache
        this.currentMetrics = {};
        this.activityHistory = [];
        
        // Event handlers
        this.onMetricsUpdate = null;
        this.onActivityUpdate = null;
        this.onStatusUpdate = null;
    }

    async initialize() {
        console.log('🚀 Initializing Real-time Dashboard...');
        
        try {
            // Check authentication
            if (!window.AuthGuard || !window.AuthGuard.isLoggedIn()) {
                console.log('❌ User not authenticated');
                return false;
            }

            // Initialize chart
            this.initializeChart();
            
            // Connect to WebSocket
            await this.connectWebSocket();
            
            // Load initial data
            await this.loadInitialData();
            
            // Setup event handlers
            this.setupEventHandlers();
            
            console.log('✅ Real-time Dashboard initialized successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize dashboard:', error);
            return false;
        }
    }

    async connectWebSocket() {
        return new Promise((resolve, reject) => {
            try {
                // Get WebSocket URL
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const host = window.location.host;
                const wsUrl = `${protocol}//${host}/ws`;
                
                console.log('🔌 Connecting to WebSocket:', wsUrl);
                
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = () => {
                    console.log('✅ WebSocket connected');
                    this.reconnectAttempts = 0;
                    this.authenticate();
                    resolve();
                };
                
                this.ws.onmessage = (event) => {
                    this.handleWebSocketMessage(event);
                };
                
                this.ws.onclose = (event) => {
                    console.log('🔌 WebSocket connection closed:', event.code);
                    this.isAuthenticated = false;
                    this.handleReconnection();
                };
                
                this.ws.onerror = (error) => {
                    console.error('❌ WebSocket error:', error);
                    reject(error);
                };
                
                // Connection timeout
                setTimeout(() => {
                    if (this.ws.readyState !== WebSocket.OPEN) {
                        reject(new Error('WebSocket connection timeout'));
                    }
                }, 10000);
                
            } catch (error) {
                reject(error);
            }
        });
    }

    authenticate() {
        const token = localStorage.getItem('airhost_token');
        if (token && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'authenticate',
                token: token
            }));
        }
    }

    subscribe(topics) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isAuthenticated) {
            this.ws.send(JSON.stringify({
                type: 'subscribe',
                topics: Array.isArray(topics) ? topics : [topics]
            }));
        }
    }

    handleWebSocketMessage(event) {
        try {
            const message = JSON.parse(event.data);
            
            switch (message.type) {
                case 'connected':
                    console.log('🔌 WebSocket connection confirmed');
                    break;
                    
                case 'authenticated':
                    console.log('✅ WebSocket authenticated');
                    this.isAuthenticated = true;
                    this.subscribeToTopics();
                    break;
                    
                case 'auth_error':
                    console.error('❌ WebSocket authentication failed:', message.message);
                    this.showNotification('Error de Autenticación', 'Reconectando...', 'error');
                    break;
                    
                case 'update':
                    this.handleRealtimeUpdate(message);
                    break;
                    
                case 'error':
                    console.error('❌ WebSocket error:', message.message);
                    break;
                    
                default:
                    console.log('📨 Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error);
        }
    }

    subscribeToTopics() {
        const topics = [
            'dashboard_metrics',
            'system_status', 
            'activity_feed',
            'user_notifications'
        ];
        
        this.subscribe(topics);
        console.log('📡 Subscribed to topics:', topics.join(', '));
    }

    handleRealtimeUpdate(message) {
        const { topic, data, timestamp } = message;
        
        switch (topic) {
            case 'dashboard_metrics':
                this.updateMetrics(data);
                break;
                
            case 'system_status':
                this.updateSystemStatus(data);
                break;
                
            case 'activity_feed':
                this.addActivityItem(data);
                break;
                
            case 'user_notifications':
                this.showNotification(data.title, data.message, data.type);
                break;
                
            default:
                console.log('📊 Unknown update topic:', topic);
        }
        
        console.log(`📈 Real-time update: ${topic}`, data);
    }

    handleReconnection() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('❌ Max reconnection attempts reached');
            this.showNotification(
                'Conexión Perdida', 
                'No se puede reconectar al servidor', 
                'error'
            );
            return;
        }
        
        this.reconnectAttempts++;
        console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        
        this.reconnectInterval = setTimeout(() => {
            this.connectWebSocket().catch(error => {
                console.error('❌ Reconnection failed:', error);
            });
        }, this.reconnectDelay);
    }

    async loadInitialData() {
        try {
            if (!window.AirHostAPI) {
                console.warn('⚠️  AirHostAPI not available, using fallback');
                return;
            }

            const response = await window.AirHostAPI.get('/api/dashboard/realtime');
            
            if (response.success && response.data) {
                this.currentMetrics = response.data.metrics;
                this.updateMetrics(response.data.metrics);
                this.updateSystemStatus(response.data.systemStatus);
                
                console.log('✅ Initial dashboard data loaded');
            }
        } catch (error) {
            console.error('❌ Error loading initial data:', error);
        }
    }

    initializeChart() {
        const ctx = document.getElementById('realTimeChart');
        if (!ctx) {
            console.warn('⚠️  Chart canvas not found');
            return;
        }
        
        this.realTimeChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Reservas',
                        data: [],
                        borderColor: '#00d084',
                        backgroundColor: 'rgba(0, 208, 132, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Ingresos (€)',
                        data: [],
                        borderColor: '#3742fa',
                        backgroundColor: 'rgba(55, 66, 250, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 750 },
                plugins: {
                    legend: { labels: { color: '#b3b3b3' } }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#b3b3b3' },
                        grid: { color: '#2a2a2a' }
                    },
                    x: {
                        ticks: { color: '#b3b3b3' },
                        grid: { color: '#2a2a2a' }
                    }
                }
            }
        });
        
        console.log('📊 Chart initialized');
    }

    updateMetrics(metrics) {
        this.currentMetrics = { ...this.currentMetrics, ...metrics };
        
        // Update DOM elements
        this.updateElement('todayRevenue', `€${this.formatNumber(metrics.todayRevenue || 0)}`);
        this.updateElement('activeBookings', metrics.activeBookings || 0);
        this.updateElement('todayCheckins', metrics.todayCheckins || 0);
        this.updateElement('messagesSent', metrics.messagesSent || 0);
        
        // Update chart
        this.updateChart(metrics);
        
        // Trigger custom event
        if (this.onMetricsUpdate) {
            this.onMetricsUpdate(metrics);
        }
        
        console.log('📈 Metrics updated:', metrics);
    }

    updateSystemStatus(status) {
        const statusMapping = {
            'online': { color: 'var(--color-success)', text: 'Online' },
            'active': { color: 'var(--color-success)', text: 'Activo' },
            'offline': { color: 'var(--color-error)', text: 'Desconectado' },
            'warning': { color: 'var(--color-warning)', text: 'Advertencia' }
        };
        
        // Update status indicators
        this.updateStatusIndicator('apiStatus', status.apiStatus, statusMapping);
        this.updateStatusIndicator('whatsappBot', status.whatsappBot, statusMapping);
        
        console.log('🔧 System status updated:', status);
    }

    updateChart(metrics) {
        if (!this.realTimeChart) return;
        
        const now = new Date();
        const timeLabel = now.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        // Add new data point
        this.realTimeChart.data.labels.push(timeLabel);
        this.realTimeChart.data.datasets[0].data.push(metrics.activeBookings || 0);
        this.realTimeChart.data.datasets[1].data.push((metrics.todayRevenue || 0) / 100);
        
        // Keep only last 20 data points
        if (this.realTimeChart.data.labels.length > 20) {
            this.realTimeChart.data.labels.shift();
            this.realTimeChart.data.datasets.forEach(dataset => {
                dataset.data.shift();
            });
        }
        
        this.realTimeChart.update('none');
    }

    addActivityItem(activity) {
        const activityList = document.getElementById('activityList');
        if (!activityList) return;
        
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.style.setProperty('--activity-color', this.getActivityColor(activity.type));
        
        activityItem.innerHTML = `
            <span class="activity-icon">${activity.icon}</span>
            <div class="activity-content">
                <div class="activity-title">${activity.title}</div>
                <div class="activity-description">${activity.desc}</div>
                <div class="activity-time">hace ${Math.floor(Math.random() * 10) + 1} min</div>
            </div>
        `;
        
        activityList.insertBefore(activityItem, activityList.firstChild);
        
        // Keep only last 10 activities
        while (activityList.children.length > 10) {
            activityList.removeChild(activityList.lastChild);
        }
        
        // Show notification for important activities
        if (activity.title.includes('Nueva Reserva') || activity.title.includes('Pago Recibido')) {
            this.showNotification(activity.title, activity.desc, 'success');
        }
        
        console.log('📋 Activity added:', activity);
    }

    getActivityColor(type) {
        const colors = {
            booking: 'var(--color-success)',
            payment: 'var(--color-success)', 
            message: 'var(--color-info)',
            checkin: 'var(--color-warning)',
            sync: 'var(--color-accent)',
            smartlock: 'var(--color-warning)'
        };
        return colors[type] || 'var(--color-accent)';
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    updateStatusIndicator(statusKey, value, mapping) {
        // This would update status indicators in the DOM
        const statusInfo = mapping[value] || { color: 'var(--color-error)', text: value };
        console.log(`🔧 ${statusKey}:`, statusInfo.text);
    }

    showNotification(title, message, type = 'info') {
        const toast = document.getElementById('notificationToast');
        const toastTitle = document.getElementById('toastTitle');
        const toastMessage = document.getElementById('toastMessage');
        
        if (!toast || !toastTitle || !toastMessage) return;
        
        toastTitle.textContent = title;
        toastMessage.textContent = message;
        
        // Add type-specific styling
        toast.className = `notification-toast ${type}`;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
        
        console.log(`🔔 Notification: ${title} - ${message}`);
    }

    formatNumber(num) {
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'k';
        }
        return num.toLocaleString();
    }

    setupEventHandlers() {
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('📱 Page hidden - reducing update frequency');
            } else {
                console.log('📱 Page visible - resuming normal updates');
            }
        });
        
        // Handle page unload
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    cleanup() {
        console.log('🧹 Cleaning up Real-time Dashboard...');
        
        if (this.reconnectInterval) {
            clearTimeout(this.reconnectInterval);
        }
        
        if (this.ws) {
            this.ws.close();
        }
        
        if (this.realTimeChart) {
            this.realTimeChart.destroy();
        }
    }

    // Public methods for external control
    triggerUpdate(type, data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'trigger_update',
                updateType: type,
                data: data
            }));
        }
    }

    getConnectionStatus() {
        return {
            connected: this.ws && this.ws.readyState === WebSocket.OPEN,
            authenticated: this.isAuthenticated,
            reconnectAttempts: this.reconnectAttempts
        };
    }
}

// Create global instance
window.RealtimeDashboard = RealtimeDashboard;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealtimeDashboard;
}

console.log('🔌 Real-time Dashboard script loaded');