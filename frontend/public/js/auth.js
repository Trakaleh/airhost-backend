/**
 * Authentication & Route Protection System
 * Handles user authentication state and protects routes
 */

class AuthGuard {
    constructor() {
        this.user = null;
        this.isAuthenticated = false;
        this.isDemoMode = false;
    }

    /**
     * Initialize authentication check
     */
    async init() {
        await this.checkAuthStatus();
        this.setupAuthListeners();
    }

    /**
     * Check current authentication status
     */
    async checkAuthStatus() {
        try {
            // Check for valid JWT token
            const token = localStorage.getItem('airhost_token');
            if (token && window.AirHostAPI) {
                // Validate token with backend
                try {
                    const response = await window.AirHostAPI.getProfile();
                    if (response.success) {
                        this.user = response.user;
                        this.isAuthenticated = true;
                        this.isDemoMode = false;
                        console.log('✅ User authenticated with backend');
                        return true;
                    }
                } catch (error) {
                    console.warn('Token validation failed:', error);
                    this.clearAuth();
                }
            }

            // Check for demo mode
            const demoUser = localStorage.getItem('demo_user');
            const demoMode = localStorage.getItem('demo_mode');
            
            if (demoUser && demoMode) {
                this.user = JSON.parse(demoUser);
                this.isAuthenticated = true;
                this.isDemoMode = true;
                console.log('✅ User in demo mode');
                return true;
            }

            // No authentication found
            this.clearAuth();
            return false;

        } catch (error) {
            console.error('Auth check failed:', error);
            this.clearAuth();
            return false;
        }
    }

    /**
     * Require authentication for current page
     */
    async requireAuth() {
        const isAuth = await this.checkAuthStatus();
        
        if (!isAuth) {
            console.log('🔒 Authentication required, redirecting to login');
            const currentPath = window.location.pathname + window.location.search;
            window.location.href = `/login.html?return=${encodeURIComponent(currentPath)}`;
            return false;
        }

        // Show demo indicator if in demo mode
        if (this.isDemoMode && !document.querySelector('.demo-indicator')) {
            this.showDemoIndicator();
        }

        return true;
    }

    /**
     * Logout user
     */
    async logout() {
        try {
            if (!this.isDemoMode && window.AirHostAPI) {
                await window.AirHostAPI.logout();
            }
        } catch (error) {
            console.warn('Logout API call failed:', error);
        }

        this.clearAuth();
        window.location.href = '/';
    }

    /**
     * Clear authentication data
     */
    clearAuth() {
        this.user = null;
        this.isAuthenticated = false;
        this.isDemoMode = false;
        
        localStorage.removeItem('airhost_token');
        localStorage.removeItem('demo_mode');
        localStorage.removeItem('demo_user');
    }

    /**
     * Get current user
     */
    getUser() {
        return this.user;
    }

    /**
     * Check if user is authenticated
     */
    isLoggedIn() {
        return this.isAuthenticated;
    }

    /**
     * Check if in demo mode
     */
    isDemo() {
        return this.isDemoMode;
    }

    /**
     * Show demo mode indicator
     */
    showDemoIndicator() {
        if (document.querySelector('.demo-indicator')) return;

        const indicator = document.createElement('div');
        indicator.className = 'demo-indicator';
        indicator.innerHTML = '🟡 Modo Demo';
        indicator.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #FF9F0A;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            cursor: pointer;
        `;

        indicator.addEventListener('click', () => {
            alert('Modo Demo Activo\n\n• Todas las funciones disponibles para explorar\n• Los datos se simulan localmente\n• En producción conectará con el backend real\n\n¡Crea una cuenta real para funcionalidad completa!');
        });

        document.body.appendChild(indicator);
    }

    /**
     * Setup authentication event listeners
     */
    setupAuthListeners() {
        // Listen for storage changes (logout from another tab)
        window.addEventListener('storage', (e) => {
            if (e.key === 'airhost_token' && !e.newValue) {
                console.log('🔒 Token removed in another tab, logging out');
                this.clearAuth();
                window.location.href = '/login.html';
            }
        });

        // Setup logout buttons
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-logout]') || e.target.closest('[data-logout]')) {
                e.preventDefault();
                this.logout();
            }
        });
    }

    /**
     * Add user info to page header
     */
    addUserInfo(selector = '.user-info') {
        const userInfoElements = document.querySelectorAll(selector);
        
        userInfoElements.forEach(element => {
            if (this.user) {
                element.textContent = this.user.email || this.user.name || 'Usuario';
            }
        });
    }

    /**
     * Add user avatar to page header
     */
    addUserAvatar(selector = '.user-avatar') {
        const avatarElements = document.querySelectorAll(selector);
        
        avatarElements.forEach(element => {
            if (this.user) {
                const initial = (this.user.name || this.user.email || 'U').charAt(0).toUpperCase();
                element.textContent = initial;
            }
        });
    }
}

// Create global auth guard instance
window.AuthGuard = new AuthGuard();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await window.AuthGuard.init();
    console.log('🔐 AuthGuard initialized');
});

// Utility functions for pages
window.requireAuth = async () => {
    return await window.AuthGuard.requireAuth();
};

window.logout = async () => {
    return await window.AuthGuard.logout();
};

console.log('🛡️ Auth system loaded');