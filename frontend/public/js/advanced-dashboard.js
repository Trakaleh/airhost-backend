/**
 * Advanced Dashboard Controller
 * Handles real-time dashboard updates and enhanced analytics
 */

class AdvancedDashboard {
    constructor() {
        this.api = window.AirHostAPI;
        this.wsConnected = false;
        this.updateInterval = null;
        this.chartInstances = new Map();
        this.notifications = [];
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Advanced Dashboard');
        
        try {
            // Load initial data
            await this.loadDashboardData();
            
            // Setup real-time updates
            this.setupRealTimeUpdates();
            
            // Setup WebSocket connection
            this.setupWebSocketConnection();
            
            // Setup periodic refresh
            this.startPeriodicUpdate();
            
            console.log('✅ Advanced Dashboard initialized successfully');
            
        } catch (error) {
            console.error('❌ Error initializing Advanced Dashboard:', error);
            this.showErrorMessage('Error initializing dashboard');
        }
    }

    /**
     * Load comprehensive dashboard data
     */
    async loadDashboardData() {
        try {
            console.log('📊 Loading dashboard data...');
            
            const [dashboardData, insights, wsInfo] = await Promise.all([
                this.api.get('/api/dashboard/advanced'),
                this.api.get('/api/analytics/insights'),
                this.api.get('/api/dashboard/ws-info')
            ]);

            if (dashboardData.success) {
                this.renderDashboardOverview(dashboardData.data);
                this.renderRevenueCharts(dashboardData.data.revenue);
                this.renderBookingMetrics(dashboardData.data.bookings);
                this.renderChannelPerformance(dashboardData.data.channels);
                this.renderRecentActivity(dashboardData.data.recentActivity);
                this.renderAlerts(dashboardData.data.alerts);
            }

            if (insights.success) {
                this.renderPerformanceInsights(insights.insights);
            }

            if (wsInfo.success) {
                this.renderWebSocketStatus(wsInfo.websocket);
            }

            console.log('✅ Dashboard data loaded successfully');
            
        } catch (error) {
            console.error('❌ Error loading dashboard data:', error);
            this.showErrorMessage('Error loading dashboard data: ' + this.api.formatError(error));
        }
    }

    /**
     * Render dashboard overview metrics
     */
    renderDashboardOverview(data) {
        const overview = data.overview;
        
        // Update main KPI cards
        this.updateKPICard('total-properties', overview.totalProperties, 'Propiedades');
        this.updateKPICard('active-reservations', overview.activeReservations, 'Reservas Activas');
        this.updateKPICard('monthly-revenue', this.formatCurrency(overview.monthlyRevenue), 'Ingresos del Mes');
        this.updateKPICard('occupancy-rate', overview.occupancyRate + '%', 'Tasa de Ocupación');
        this.updateKPICard('average-rating', overview.averageRating, 'Calificación Promedio');
        this.updateKPICard('today-checkins', overview.todayCheckins, 'Check-ins Hoy');
        this.updateKPICard('today-checkouts', overview.todayCheckouts, 'Check-outs Hoy');
    }

    /**
     * Update individual KPI card
     */
    updateKPICard(id, value, label) {
        const card = document.getElementById(id);
        if (card) {
            const valueElement = card.querySelector('.kpi-value');
            const labelElement = card.querySelector('.kpi-label');
            
            if (valueElement) valueElement.textContent = value;
            if (labelElement) labelElement.textContent = label;
            
            // Add animation effect
            card.classList.add('updated');
            setTimeout(() => card.classList.remove('updated'), 1000);
        }
    }

    /**
     * Render revenue charts
     */
    renderRevenueCharts(revenueData) {
        // Revenue trend chart
        this.createLineChart('revenue-chart', {
            labels: ['Hoy', 'Semana', 'Mes', 'Año'],
            datasets: [{
                label: 'Ingresos',
                data: [
                    revenueData.today,
                    revenueData.week,
                    revenueData.month,
                    revenueData.year
                ],
                borderColor: '#00d084',
                backgroundColor: 'rgba(0, 208, 132, 0.1)',
                borderWidth: 2,
                fill: true
            }]
        });
    }

    /**
     * Render booking metrics
     */
    renderBookingMetrics(bookingData) {
        // Booking status pie chart
        this.createDoughnutChart('booking-status-chart', {
            labels: ['Confirmadas', 'Check-in', 'Completadas', 'Canceladas'],
            datasets: [{
                data: [
                    bookingData.confirmed,
                    bookingData.checkedIn,
                    bookingData.completed,
                    bookingData.cancelled
                ],
                backgroundColor: [
                    '#00d084',
                    '#3b82f6',
                    '#10b981',
                    '#ef4444'
                ]
            }]
        });

        // Update booking stats
        this.updateElement('total-bookings', bookingData.total);
        this.updateElement('conversion-rate', bookingData.conversionRate + '%');
    }

    /**
     * Render channel performance
     */
    renderChannelPerformance(channelData) {
        const channelContainer = document.getElementById('channel-performance');
        if (!channelContainer) return;

        let html = '<div class="channel-cards">';
        
        Object.entries(channelData).forEach(([channel, data]) => {
            if (channel === 'syncStatus') return;
            
            const status = channelData.syncStatus?.[channel] || 'unknown';
            const statusClass = status === 'connected' ? 'success' : 'warning';
            
            html += `
                <div class="channel-card">
                    <div class="channel-header">
                        <h4 class="channel-name">${this.capitalizeFirst(channel)}</h4>
                        <span class="channel-status ${statusClass}">${status}</span>
                    </div>
                    <div class="channel-metrics">
                        <div class="metric">
                            <span class="metric-label">Reservas</span>
                            <span class="metric-value">${data.bookings || 0}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Ingresos</span>
                            <span class="metric-value">${this.formatCurrency(data.revenue || 0)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Crecimiento</span>
                            <span class="metric-value ${(data.growth || 0) >= 0 ? 'positive' : 'negative'}">
                                ${(data.growth || 0) >= 0 ? '+' : ''}${(data.growth || 0).toFixed(1)}%
                            </span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        channelContainer.innerHTML = html;
    }

    /**
     * Render recent activity feed
     */
    renderRecentActivity(activities) {
        const activityContainer = document.getElementById('recent-activity');
        if (!activityContainer || !Array.isArray(activities)) return;

        let html = '<div class="activity-feed">';
        
        activities.forEach(activity => {
            html += `
                <div class="activity-item">
                    <div class="activity-icon">${activity.icon}</div>
                    <div class="activity-content">
                        <div class="activity-title">${activity.title}</div>
                        <div class="activity-description">${activity.description}</div>
                    </div>
                    <div class="activity-time">${activity.time}</div>
                </div>
            `;
        });
        
        html += '</div>';
        activityContainer.innerHTML = html;
    }

    /**
     * Render system alerts
     */
    renderAlerts(alerts) {
        const alertsContainer = document.getElementById('system-alerts');
        if (!alertsContainer || !Array.isArray(alerts)) return;

        if (alerts.length === 0) {
            alertsContainer.innerHTML = '<div class="no-alerts">No hay alertas activas</div>';
            return;
        }

        let html = '<div class="alerts-list">';
        
        alerts.forEach(alert => {
            html += `
                <div class="alert alert-${alert.type}">
                    <div class="alert-content">
                        <div class="alert-title">${alert.title}</div>
                        <div class="alert-message">${alert.message}</div>
                    </div>
                    <div class="alert-actions">
                        ${alert.action ? `<button class="btn-alert" onclick="advancedDashboard.handleAlertAction('${alert.action}')">${alert.actionText || 'Acción'}</button>` : ''}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        alertsContainer.innerHTML = html;
    }

    /**
     * Render performance insights
     */
    renderPerformanceInsights(insights) {
        // Revenue trends
        if (insights.revenue_trends) {
            this.renderRevenueTrends(insights.revenue_trends);
        }
        
        // Top properties
        if (insights.top_properties) {
            this.renderTopProperties(insights.top_properties);
        }
        
        // Channel performance
        if (insights.channel_performance) {
            this.renderChannelInsights(insights.channel_performance);
        }
    }

    /**
     * Render WebSocket connection status
     */
    renderWebSocketStatus(wsInfo) {
        const statusContainer = document.getElementById('websocket-status');
        if (!statusContainer) return;

        const statusClass = wsInfo.status === 'online' ? 'online' : 'offline';
        
        statusContainer.innerHTML = `
            <div class="ws-status ${statusClass}">
                <div class="ws-indicator"></div>
                <div class="ws-info">
                    <div class="ws-status-text">WebSocket: ${wsInfo.status}</div>
                    <div class="ws-connections">${wsInfo.authenticated} conectados</div>
                </div>
            </div>
        `;
    }

    /**
     * Setup real-time updates
     */
    setupRealTimeUpdates() {
        // Subscribe to real-time dashboard updates
        if (this.api.subscribe) {
            this.api.subscribe('dashboard_realtime', (data) => {
                this.handleRealTimeUpdate(data);
            });

            this.api.subscribe('notification', (notification) => {
                this.showNotification(notification);
            });
        }
    }

    /**
     * Setup WebSocket connection
     */
    setupWebSocketConnection() {
        // Listen for WebSocket connection events
        window.addEventListener('airhostWebSocketConnected', () => {
            this.wsConnected = true;
            this.updateConnectionStatus(true);
        });

        window.addEventListener('airhostWebSocketDisconnected', () => {
            this.wsConnected = false;
            this.updateConnectionStatus(false);
        });
    }

    /**
     * Handle real-time updates
     */
    handleRealTimeUpdate(data) {
        console.log('📡 Real-time update received:', data);
        
        if (data.metrics) {
            // Update live metrics
            this.updateLiveMetrics(data.metrics);
        }
        
        if (data.activity) {
            // Add new activity to feed
            this.addActivityItem(data.activity);
        }
        
        if (data.alerts && data.alerts.length > 0) {
            // Show new alerts
            data.alerts.forEach(alert => this.showAlert(alert));
        }
    }

    /**
     * Update live metrics
     */
    updateLiveMetrics(metrics) {
        // Update real-time counters
        this.updateElement('active-users', metrics.activeUsers);
        this.updateElement('today-bookings-live', metrics.todayBookings);
        this.updateElement('today-revenue-live', this.formatCurrency(metrics.todayRevenue));
        
        // Update system metrics
        if (metrics.systemLoad !== undefined) {
            this.updateProgressBar('system-load', metrics.systemLoad * 100);
        }
    }

    /**
     * Create line chart
     */
    createLineChart(canvasId, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        // Destroy existing chart if exists
        if (this.chartInstances.has(canvasId)) {
            this.chartInstances.get(canvasId).destroy();
        }

        const ctx = canvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                }
            }
        });

        this.chartInstances.set(canvasId, chart);
    }

    /**
     * Create doughnut chart
     */
    createDoughnutChart(canvasId, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        // Destroy existing chart if exists
        if (this.chartInstances.has(canvasId)) {
            this.chartInstances.get(canvasId).destroy();
        }

        const ctx = canvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });

        this.chartInstances.set(canvasId, chart);
    }

    /**
     * Start periodic updates
     */
    startPeriodicUpdate() {
        this.updateInterval = setInterval(async () => {
            try {
                const realtimeData = await this.api.get('/api/dashboard/realtime');
                if (realtimeData.success) {
                    this.updateLiveMetrics(realtimeData.data.metrics || {});
                }
            } catch (error) {
                console.error('❌ Error updating real-time data:', error);
            }
        }, 30000); // Every 30 seconds
    }

    /**
     * Utility functions
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount || 0);
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            element.classList.add('updated');
            setTimeout(() => element.classList.remove('updated'), 1000);
        }
    }

    updateProgressBar(id, percentage) {
        const progressBar = document.getElementById(id);
        if (progressBar) {
            progressBar.style.width = Math.min(100, Math.max(0, percentage)) + '%';
        }
    }

    showNotification(notification) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${notification.type || 'info'}`;
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-title">${notification.title}</div>
                <div class="toast-message">${notification.message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;

        document.body.appendChild(toast);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }

    showAlert(alert) {
        console.log('🚨 New alert:', alert);
        this.showNotification({
            type: alert.type,
            title: 'Nueva Alerta',
            message: alert.message
        });
    }

    showErrorMessage(message) {
        this.showNotification({
            type: 'error',
            title: 'Error',
            message: message
        });
    }

    updateConnectionStatus(connected) {
        const statusIndicator = document.getElementById('connection-status');
        if (statusIndicator) {
            statusIndicator.className = connected ? 'status-online' : 'status-offline';
            statusIndicator.textContent = connected ? 'Conectado' : 'Desconectado';
        }
    }

    /**
     * Handle alert actions
     */
    handleAlertAction(action) {
        switch (action) {
            case 'sync_channels':
                this.syncChannels();
                break;
            case 'optimize_pricing':
                this.optimizePricing();
                break;
            default:
                console.log('Unknown alert action:', action);
        }
    }

    async syncChannels() {
        try {
            await this.api.post('/api/channel-manager/sync');
            this.showNotification({
                type: 'success',
                title: 'Sincronización',
                message: 'Canales sincronizados exitosamente'
            });
        } catch (error) {
            this.showErrorMessage('Error sincronizando canales: ' + this.api.formatError(error));
        }
    }

    async optimizePricing() {
        try {
            // Redirect to pricing optimization page
            window.location.href = '/pricing-ai.html';
        } catch (error) {
            console.error('Error navigating to pricing optimization:', error);
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.chartInstances.forEach(chart => chart.destroy());
        this.chartInstances.clear();
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.advancedDashboard = new AdvancedDashboard();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.advancedDashboard) {
        window.advancedDashboard.destroy();
    }
});