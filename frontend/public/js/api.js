class AirHostAPI {
    constructor() {
        this.baseURL = this.getBaseURL();
        this.token = localStorage.getItem('airhost_token');
        console.log('🔗 AirHost API initialized:', this.baseURL);
    }

    getBaseURL() {
        return 'https://airhost-backend-production.up.railway.app/api';
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('airhost_token', token);
    }

    removeToken() {
        this.token = null;
        localStorage.removeItem('airhost_token');
    }

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (this.token) {
            headers.Authorization = `Bearer ${this.token}`;
        }
        return headers;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.getHeaders(),
            ...options,
        };

        try {
            console.log(`🔄 API Request: ${options.method || 'GET'} ${url}`);
            const response = await fetch(url, config);
            let data;

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = { error: `Unexpected response format: ${response.status}` };
            }

            if (!response.ok) {
                if (response.status === 401) {
                    this.removeToken();
                    throw new Error('Sesión expirada. Por favor, inicia sesión de nuevo.');
                } else if (response.status === 404) {
                    throw new Error('Endpoint no encontrado. El backend podría no estar disponible.');
                } else if (response.status === 500) {
                    throw new Error('Error interno del servidor.');
                } else {
                    throw new Error(data.error || `Error HTTP ${response.status}: ${response.statusText}`);
                }
            }

            console.log('✅ API Response received');
            return data;
        } catch (error) {
            console.error('❌ API Error:', error);
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                throw new Error('No se puede conectar al servidor. Verifique su conexión a internet.');
            }
            throw error;
        }
    }

    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

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

    async logout() {
        try {
            await this.post('/auth/logout');
        } catch (error) {
            console.warn('Logout request failed:', error.message);
        } finally {
            this.removeToken();
        }
    }

    async getProfile() {
        return this.get('/auth/me');
    }

    async getProperties() {
        return this.get('/properties');
    }

    async getProperty(id) {
        return this.get(`/properties/${id}`);
    }

    async createProperty(propertyData) {
        return this.post('/properties', propertyData);
    }

    async updateProperty(id, propertyData) {
        return this.put(`/properties/${id}`, propertyData);
    }

    async deleteProperty(id) {
        return this.delete(`/properties/${id}`);
    }

    async getReservations() {
        return this.get('/reservations');
    }

    async getReservation(id) {
        return this.get(`/reservations/${id}`);
    }

    async createReservation(reservationData) {
        return this.post('/reservations', reservationData);
    }

    async updateReservation(id, reservationData) {
        return this.put(`/reservations/${id}`, reservationData);
    }

    async cancelReservation(id) {
        return this.delete(`/reservations/${id}`);
    }

    async getBookings() {
        return this.get('/reservations');
    }

    async getBooking(id) {
        return this.get(`/reservations/${id}`);
    }

    async createBooking(bookingData) {
        return this.post('/reservations', bookingData);
    }

    async updateBooking(id, bookingData) {
        return this.put(`/reservations/${id}`, bookingData);
    }

    async sendWhatsAppMessage(to, message, language = 'es') {
        return this.post('/messages/whatsapp', { to, message, language });
    }

    async getMessageTemplates() {
        return this.get('/messages/templates');
    }

    async updateMessageTemplate(id, templateData) {
        return this.put(`/messages/templates/${id}`, templateData);
    }

    async generateAccessCode(propertyId, bookingId) {
        return this.post('/smart-locks/generate-code', { propertyId, bookingId });
    }

    async getAccessCodes(propertyId) {
        return this.get(`/smart-locks/codes/${propertyId}`);
    }

    async createDepositPayment(bookingId, amount) {
        return this.post('/payments/deposit', { bookingId, amount });
    }

    async getPaymentStatus(paymentId) {
        return this.get(`/payments/status/${paymentId}`);
    }

    async getDashboardAnalytics() {
        return this.get('/analytics/dashboard');
    }

    async getRevenueAnalytics(period = '30d') {
        return this.get(`/analytics/revenue?period=${period}`);
    }

    async syncCalendars(propertyId) {
        return this.post('/channel-manager/sync', { propertyId });
    }

    async getSyncStatus() {
        return this.get('/channel-manager/status');
    }

    async connectAirbnb(credentials) {
        return this.post('/channel-manager/connect/airbnb', credentials);
    }

    async connectBooking(credentials) {
        return this.post('/channel-manager/connect/booking', credentials);
    }

    async healthCheck() {
        try {
            const response = await fetch(`${this.baseURL}/health`);
            return response.ok;
        } catch (error) {
            console.error('Health check failed:', error);
            return false;
        }
    }

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

window.AirHostAPI = new AirHostAPI();

document.addEventListener('DOMContentLoaded', async () => {
    const isHealthy = await window.AirHostAPI.healthCheck();
    console.log('🏥 API Health Status:', isHealthy ? '✅ Healthy' : '❌ Unavailable');
    if (!isHealthy) {
        console.warn('⚠️ Backend API is not responding. Some features may be unavailable.');
    }
});

console.log('📡 AirHost AI API module loaded successfully');