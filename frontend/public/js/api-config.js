/**
 * AirHost AI - API Configuration
 * Complete API client for frontend integration
 */

// API Configuration
const API_CONFIG = {
    baseURL: window.location.hostname === 'localhost' 
        ? 'http://localhost:3007' 
        : 'https://your-production-domain.com',
    
    websocket: {
        url: window.location.hostname === 'localhost'
            ? 'ws://localhost:3007/ws'
            : 'wss://your-production-domain.com/ws'
    },
    
    endpoints: {
        // Authentication
        auth: {
            login: '/api/auth/login',
            register: '/api/auth/register',
            google: '/api/auth/google',
            profile: '/api/auth/me'
        },
        
        // Properties
        properties: '/api/properties',
        
        // Reservations
        reservations: '/api/reservations',
        
        // Analytics
        analytics: {
            dashboard: '/api/analytics/dashboard',
            realtime: '/api/dashboard/realtime'
        },
        
        // Smart Locks
        smartLocks: '/api/smart-locks',
        
        // Messaging
        messages: {
            templates: '/api/messages/templates',
            automationRules: '/api/messages/automation-rules',
            history: '/api/messages/history'
        },
        
        // Channel Manager
        channels: {
            status: '/api/channel-manager/status',
            connectAirbnb: '/api/channel-manager/connect/airbnb',
            connectBooking: '/api/channel-manager/connect/booking',
            sync: '/api/channel-manager/sync'
        },
        
        // Stripe/Payments
        stripe: {
            customers: '/api/stripe/customers',
            deposits: '/api/stripe/deposits'
        },
        
        // AI Pricing
        pricing: {
            recommendations: '/api/pricing/ai/recommendations',
            analysis: '/api/pricing/ai/analysis',
            apply: '/api/pricing/ai/apply',
            performance: '/api/pricing/ai/performance'
        },
        
        // Notifications
        notifications: {
            list: '/api/notifications',
            markRead: '/api/notifications',
            markAllRead: '/api/notifications/read-all',
            stats: '/api/notifications/stats'
        }
    }
};

// Enhanced API Client Class
class AirHostAPIClient {
    constructor() {
        this.baseURL = API_CONFIG.baseURL;
        this.token = localStorage.getItem('airhost_token');
        this.wsConnection = null;
        this.subscribers = new Map();
        
        // Initialize WebSocket connection if token exists
        if (this.token) {
            this.connectWebSocket();
        }
    }

    // ===========================================
    // CORE HTTP METHODS
    // ===========================================

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...options.headers
            },
            ...options
        };

        // Add authentication token
        if (this.token) {
            config.headers['Authorization'] = `Bearer ${this.token}`;
        }

        // Add body for POST/PUT requests
        if (options.data) {
            config.body = JSON.stringify(options.data);
        }

        try {
            console.log(`📡 ${config.method} ${endpoint}`);
            const response = await fetch(url, config);
            
            // Handle different response types
            const contentType = response.headers.get('Content-Type');
            let data;
            
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = { success: response.ok, data: await response.text() };
            }

            // Enhanced error handling
            if (!response.ok) {
                const error = new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
                error.status = response.status;
                error.code = data.code;
                error.response = data;
                
                // Handle authentication errors
                if (response.status === 401) {
                    this.handleAuthError(data);
                }
                
                throw error;
            }

            console.log(`✅ ${config.method} ${endpoint} - Success`);
            return data;

        } catch (error) {
            console.error(`❌ ${config.method} ${endpoint} - Error:`, error);
            
            // Handle network errors
            if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                throw new Error('Sin conexión al servidor. Verifica tu conexión a internet.');
            }
            
            throw error;
        }
    }

    get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url);
    }

    post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            data
        });
    }

    put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            data
        });
    }

    patch(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PATCH',
            data
        });
    }

    delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }

    // ===========================================
    // AUTHENTICATION METHODS
    // ===========================================

    async login(credentials) {
        try {
            const response = await this.post(API_CONFIG.endpoints.auth.login, credentials);
            
            if (response.success && response.token) {
                this.token = response.token;
                localStorage.setItem('airhost_token', this.token);
                
                // Connect to WebSocket after successful login
                this.connectWebSocket();
                
                console.log('✅ Login successful');
                return response;
            }
            
            throw new Error(response.error || 'Login failed');
        } catch (error) {
            console.error('❌ Login error:', error);
            throw error;
        }
    }

    async register(userData) {
        return await this.post(API_CONFIG.endpoints.auth.register, userData);
    }

    async googleAuth(token) {
        const response = await this.post(API_CONFIG.endpoints.auth.google, { token });
        
        if (response.success && response.token) {
            this.token = response.token;
            localStorage.setItem('airhost_token', response.token);
            this.connectWebSocket();
        }
        
        return response;
    }

    async getProfile() {
        return await this.get(API_CONFIG.endpoints.auth.profile);
    }

    logout() {
        this.token = null;
        localStorage.removeItem('airhost_token');
        this.disconnectWebSocket();
        
        // Redirect to login
        window.location.href = '/login.html';
    }

    handleAuthError(errorData) {
        console.warn('🔐 Authentication error:', errorData);
        
        // Handle different auth error codes
        switch (errorData.code) {
            case 'TOKEN_EXPIRED':
            case 'USER_NOT_FOUND':
            case 'ACCOUNT_INACTIVE':
                this.logout();
                break;
            case 'SUBSCRIPTION_EXPIRED':
                // Show subscription renewal modal instead of logout
                this.showSubscriptionModal();
                break;
        }
    }

    showSubscriptionModal() {
        // Implementation for subscription renewal modal
        console.log('💳 Subscription expired - showing renewal modal');
    }

    // ===========================================
    // PROPERTIES API
    // ===========================================

    async getProperties() {
        return await this.get(API_CONFIG.endpoints.properties);
    }

    async getProperty(id) {
        return await this.get(`${API_CONFIG.endpoints.properties}/${id}`);
    }

    async createProperty(propertyData) {
        return await this.post(API_CONFIG.endpoints.properties, propertyData);
    }

    async updateProperty(id, propertyData) {
        return await this.put(`${API_CONFIG.endpoints.properties}/${id}`, propertyData);
    }

    async deleteProperty(id) {
        return await this.delete(`${API_CONFIG.endpoints.properties}/${id}`);
    }

    // ===========================================
    // RESERVATIONS API
    // ===========================================

    async getReservations(filters = {}) {
        return await this.get(API_CONFIG.endpoints.reservations, filters);
    }

    async getReservation(id) {
        return await this.get(`${API_CONFIG.endpoints.reservations}/${id}`);
    }

    async createReservation(reservationData) {
        return await this.post(API_CONFIG.endpoints.reservations, reservationData);
    }

    async updateReservation(id, reservationData) {
        return await this.put(`${API_CONFIG.endpoints.reservations}/${id}`, reservationData);
    }

    async cancelReservation(id) {
        return await this.delete(`${API_CONFIG.endpoints.reservations}/${id}`);
    }

    // ===========================================
    // ANALYTICS API
    // ===========================================

    async getDashboardAnalytics() {
        return await this.get(API_CONFIG.endpoints.analytics.dashboard);
    }

    async getRealtimeDashboard() {
        return await this.get(API_CONFIG.endpoints.analytics.realtime);
    }

    // ===========================================
    // NOTIFICATIONS API
    // ===========================================

    async getNotifications(options = {}) {
        return await this.get(API_CONFIG.endpoints.notifications.list, options);
    }

    async markNotificationRead(id) {
        return await this.patch(`${API_CONFIG.endpoints.notifications.markRead}/${id}/read`);
    }

    async markAllNotificationsRead() {
        return await this.patch(API_CONFIG.endpoints.notifications.markAllRead);
    }

    async getNotificationStats() {
        return await this.get(API_CONFIG.endpoints.notifications.stats);
    }

    async deleteNotification(id) {
        return await this.delete(`${API_CONFIG.endpoints.notifications.list}/${id}`);
    }

    // ===========================================
    // CHANNEL MANAGER API
    // ===========================================

    async getChannelStatus() {
        return await this.get(API_CONFIG.endpoints.channels.status);
    }

    async connectAirbnb(propertyId, connectionData) {
        return await this.post(API_CONFIG.endpoints.channels.connectAirbnb, {
            propertyId,
            ...connectionData
        });
    }

    async connectBooking(propertyId, connectionData) {
        return await this.post(API_CONFIG.endpoints.channels.connectBooking, {
            propertyId,
            ...connectionData
        });
    }

    async syncChannels(propertyId = null) {
        return await this.post(API_CONFIG.endpoints.channels.sync, {
            propertyId
        });
    }

    // ===========================================
    // AI PRICING API
    // ===========================================

    async getPricingRecommendations(propertyId, dateRange) {
        return await this.post(API_CONFIG.endpoints.pricing.recommendations, {
            propertyId,
            startDate: dateRange.start,
            endDate: dateRange.end
        });
    }

    async getPricingAnalysis(propertyId, days = 30) {
        return await this.get(`${API_CONFIG.endpoints.pricing.analysis}/${propertyId}`, {
            days
        });
    }

    async applyPricingRecommendations(propertyId, recommendations, strategy = 'moderate') {
        return await this.post(API_CONFIG.endpoints.pricing.apply, {
            propertyId,
            recommendations,
            strategy
        });
    }

    async getPricingPerformance(propertyId, period = 30) {
        return await this.get(`${API_CONFIG.endpoints.pricing.performance}/${propertyId}`, {
            period
        });
    }

    // ===========================================
    // WEBSOCKET CONNECTION
    // ===========================================

    connectWebSocket() {
        if (this.wsConnection) {
            this.wsConnection.close();
        }

        try {
            console.log('🔌 Connecting to WebSocket...');
            this.wsConnection = new WebSocket(API_CONFIG.websocket.url);

            this.wsConnection.onopen = () => {
                console.log('✅ WebSocket connected');
                
                // Authenticate WebSocket connection
                if (this.token) {
                    this.wsConnection.send(JSON.stringify({
                        type: 'authenticate',
                        token: this.token
                    }));
                }
            };

            this.wsConnection.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('❌ WebSocket message parse error:', error);
                }
            };

            this.wsConnection.onclose = () => {
                console.log('🔌 WebSocket disconnected');
                // Attempt to reconnect after 5 seconds
                setTimeout(() => {
                    if (this.token) {
                        this.connectWebSocket();
                    }
                }, 5000);
            };

            this.wsConnection.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
            };

        } catch (error) {
            console.error('❌ WebSocket connection failed:', error);
        }
    }

    disconnectWebSocket() {
        if (this.wsConnection) {
            this.wsConnection.close();
            this.wsConnection = null;
        }
    }

    handleWebSocketMessage(data) {
        console.log('📨 WebSocket message:', data);

        switch (data.type) {
            case 'authenticated':
                console.log('✅ WebSocket authenticated');
                // Subscribe to relevant topics
                this.wsConnection.send(JSON.stringify({
                    type: 'subscribe',
                    topics: ['dashboard_metrics', 'system_status', 'activity_feed', 'notification']
                }));
                break;

            case 'update':
                // Broadcast to subscribers
                this.notifySubscribers(data.topic, data.data);
                break;

            case 'notification':
                this.handleRealtimeNotification(data.data);
                break;

            case 'error':
                console.error('❌ WebSocket error:', data.message);
                break;
        }
    }

    // Subscribe to real-time updates
    subscribe(topic, callback) {
        if (!this.subscribers.has(topic)) {
            this.subscribers.set(topic, new Set());
        }
        this.subscribers.get(topic).add(callback);

        // Return unsubscribe function
        return () => {
            const topicSubscribers = this.subscribers.get(topic);
            if (topicSubscribers) {
                topicSubscribers.delete(callback);
            }
        };
    }

    notifySubscribers(topic, data) {
        const subscribers = this.subscribers.get(topic);
        if (subscribers) {
            subscribers.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`❌ Subscriber callback error for topic ${topic}:`, error);
                }
            });
        }
    }

    handleRealtimeNotification(notification) {
        // Show browser notification if permitted
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.title, {
                body: notification.message,
                icon: '/favicon.ico',
                badge: '/favicon.ico'
            });
        }

        // Trigger custom notification event
        window.dispatchEvent(new CustomEvent('airhostNotification', {
            detail: notification
        }));
    }

    // ===========================================
    // UTILITY METHODS
    // ===========================================

    // Request notification permission
    async requestNotificationPermission() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        return false;
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.token;
    }

    // Get stored token
    getToken() {
        return this.token;
    }

    // Format API errors for display
    formatError(error) {
        if (error.response && error.response.error) {
            return error.response.error;
        }
        return error.message || 'Error desconocido';
    }
}

// Create global API instance
window.AirHostAPI = new AirHostAPIClient();

// Expose for debugging
window.API_CONFIG = API_CONFIG;

console.log('🚀 AirHost API Client initialized');
console.log('📡 Base URL:', API_CONFIG.baseURL);
console.log('🔌 WebSocket URL:', API_CONFIG.websocket.url);