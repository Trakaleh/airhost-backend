/**
 * AirHost AI - API Configuration and Connection
 * Handles all backend API communications
 */

class AirHostAPI {
    constructor() {
        // Determine API base URL based on environment
        this.baseURL = this.getBaseURL();
        this.token = localStorage.getItem('airhost_token');
        
        console.log('🔗 AirHost API initialized:', this.baseURL);
    }

    /**
     * Get API base URL based on environment
     */
    getBaseURL() {
        // Check if we're in development
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:3001/api';
        }
        
        // Production - use the current domain with API path (Netlify redirects handle this)
        if (window.location.hostname === 'airhostai.com' || window.location.hostname === 'www.airhostai.com') {
            return '/api'; // Let Netlify handle the redirect to Railway
        }
        
        // Netlify preview deployments
        if (window.location.hostname.includes('netlify.app')) {
            return '/api'; // Let Netlify handle the redirect to Railway
        }
        
        // Direct backend access (fallback)
        return 'https://tu-app.railway.app/api';
    }

    /**
     * Set authentication token
     */
    setToken(token) {
        this.token = token;
        localStorage.setItem('airhost_token', token);
    }

    /**
     * Remove authentication token
     */
    removeToken() {
        this.token = null;
        localStorage.removeItem('airhost_token');
    }

    /**
     * Get request headers
     */
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
        };

        if (this.token) {
            headers.Authorization = `Bearer ${this.token}`;
        }

        return headers;
    }

    /**
     * Make HTTP request to API
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const config = {
            headers: this.getHeaders(),
            ...options,
        };

        try {
            console.log(`🔄 API Request: ${options.method || 'GET'} ${url}`);
            
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            console.log('✅ API Response received');
            return data;
        } catch (error) {
            console.error('❌ API Error:', error);
            
            // Handle authentication errors
            if (error.message.includes('401') || error.message.includes('Token')) {
                this.removeToken();
                // Redirect to login if needed
                if (window.location.pathname !== '/login.html') {
                    // window.location.href = '/login.html';
                }
            }
            
            throw error;
        }
    }

    /**
     * GET request
     */
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    /**
     * POST request
     */
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * PUT request
     */
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    /**
     * DELETE request
     */
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    // ====================================
    // 🔐 AUTHENTICATION METHODS
    // ====================================

    /**
     * Login user
     */
    async login(email, password) {
        try {
            const response = await this.post('/auth/login', { email, password });
            
            if (response.success && response.token) {
                this.setToken(response.token);
            }
            
            return response;
        } catch (error) {
            throw new Error(`Login failed: ${error.message}`);
        }
    }

    /**
     * Register user
     */
    async register(userData) {
        try {
            const response = await this.post('/auth/register', userData);
            
            if (response.success && response.token) {
                this.setToken(response.token);
            }
            
            return response;
        } catch (error) {
            throw new Error(`Registration failed: ${error.message}`);
        }
    }

    /**
     * Logout user
     */
    async logout() {
        try {
            await this.post('/auth/logout');
        } catch (error) {
            console.warn('Logout request failed:', error.message);
        } finally {
            this.removeToken();
        }
    }

    /**
     * Get current user profile
     */
    async getProfile() {
        return this.get('/auth/profile');
    }

    // ====================================
    // 🏠 PROPERTY MANAGEMENT METHODS
    // ====================================

    /**
     * Get all properties
     */
    async getProperties() {
        return this.get('/properties');
    }

    /**
     * Get property by ID
     */
    async getProperty(id) {
        return this.get(`/properties/${id}`);
    }

    /**
     * Create new property
     */
    async createProperty(propertyData) {
        return this.post('/properties', propertyData);
    }

    /**
     * Update property
     */
    async updateProperty(id, propertyData) {
        return this.put(`/properties/${id}`, propertyData);
    }

    /**
     * Delete property
     */
    async deleteProperty(id) {
        return this.delete(`/properties/${id}`);
    }

    // ====================================
    // 📅 BOOKING METHODS
    // ====================================

    /**
     * Get all bookings
     */
    async getBookings() {
        return this.get('/bookings');
    }

    /**
     * Get booking by ID
     */
    async getBooking(id) {
        return this.get(`/bookings/${id}`);
    }

    /**
     * Create booking
     */
    async createBooking(bookingData) {
        return this.post('/bookings', bookingData);
    }

    /**
     * Update booking
     */
    async updateBooking(id, bookingData) {
        return this.put(`/bookings/${id}`, bookingData);
    }

    // ====================================
    // 💬 MESSAGE AUTOMATION METHODS
    // ====================================

    /**
     * Send WhatsApp message
     */
    async sendWhatsAppMessage(to, message, language = 'es') {
        return this.post('/messages/whatsapp', { to, message, language });
    }

    /**
     * Get message templates
     */
    async getMessageTemplates() {
        return this.get('/messages/templates');
    }

    /**
     * Update message template
     */
    async updateMessageTemplate(id, templateData) {
        return this.put(`/messages/templates/${id}`, templateData);
    }

    // ====================================
    // 🔑 SMART LOCK METHODS
    // ====================================

    /**
     * Generate access code
     */
    async generateAccessCode(propertyId, bookingId) {
        return this.post('/smart-locks/generate-code', { propertyId, bookingId });
    }

    /**
     * Get access codes
     */
    async getAccessCodes(propertyId) {
        return this.get(`/smart-locks/codes/${propertyId}`);
    }

    // ====================================
    // 💳 STRIPE PAYMENT METHODS
    // ====================================

    /**
     * Create payment intent for deposit
     */
    async createDepositPayment(bookingId, amount) {
        return this.post('/payments/deposit', { bookingId, amount });
    }

    /**
     * Get payment status
     */
    async getPaymentStatus(paymentId) {
        return this.get(`/payments/status/${paymentId}`);
    }

    // ====================================
    // 📊 ANALYTICS METHODS
    // ====================================

    /**
     * Get analytics dashboard data
     */
    async getDashboardAnalytics() {
        return this.get('/analytics/dashboard');
    }

    /**
     * Get revenue analytics
     */
    async getRevenueAnalytics(period = '30d') {
        return this.get(`/analytics/revenue?period=${period}`);
    }

    // ====================================
    // 🔄 CHANNEL MANAGER METHODS
    // ====================================

    /**
     * Sync calendars
     */
    async syncCalendars(propertyId) {
        return this.post('/channel-manager/sync', { propertyId });
    }

    /**
     * Get sync status
     */
    async getSyncStatus() {
        return this.get('/channel-manager/status');
    }

    /**
     * Connect Airbnb account
     */
    async connectAirbnb(credentials) {
        return this.post('/channel-manager/connect/airbnb', credentials);
    }

    /**
     * Connect Booking.com account
     */
    async connectBooking(credentials) {
        return this.post('/channel-manager/connect/booking', credentials);
    }

    // ====================================
    // 🛠️ UTILITY METHODS
    // ====================================

    /**
     * Check API health
     */
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseURL}/health`);
            return response.ok;
        } catch (error) {
            console.error('Health check failed:', error);
            return false;
        }
    }

    /**
     * Test backend connection
     */
    async testConnection() {
        try {
            const response = await this.get('/test');
            console.log('🎉 Backend connection successful:', response);
            return true;
        } catch (error) {
            console.error('🚨 Backend connection failed:', error);
            return false;
        }
    }
}

// Create global API instance
window.AirHostAPI = new AirHostAPI();

// Auto-test connection on load
document.addEventListener('DOMContentLoaded', async () => {
    const isHealthy = await window.AirHostAPI.healthCheck();
    console.log('🏥 API Health Status:', isHealthy ? '✅ Healthy' : '❌ Unavailable');
    
    if (!isHealthy) {
        console.warn('⚠️ Backend API is not responding. Some features may be unavailable.');
    }
});

console.log('📡 AirHost AI API module loaded successfully');