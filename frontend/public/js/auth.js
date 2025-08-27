/**
 * Authentication & Route Protection System
 * Handles user authentication state and protects routes
 */

class AuthGuard {
    constructor() {
        this.user = null;
        this.isAuthenticated = false;
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
                    if (response.success && response.user) {
                        this.user = response.user;
                        this.isAuthenticated = true;
                        console.log('✅ User authenticated with backend:', response.user.email);
                        return true;
                    } else {
                        console.warn('❌ Profile validation failed:', response.error || 'No user data');
                        this.clearAuth();
                    }
                } catch (error) {
                    console.warn('❌ Token validation failed:', error.message);
                    // Only clear auth if it's a 401 error (invalid token)
                    if (error.message.includes('401') || error.message.includes('Sesión expirada')) {
                        this.clearAuth();
                    } else {
                        // For other errors (network, server), keep token for retry
                        console.log('🔄 Keeping token for retry on network errors');
                        return token ? true : false;
                    }
                }
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


        return true;
    }

    /**
     * Logout user
     */
    async logout() {
        try {
            if (window.AirHostAPI) {
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
        
        localStorage.removeItem('airhost_token');
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