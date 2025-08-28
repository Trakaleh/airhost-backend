class AuthGuard {
    constructor() {
        this.user = null;
        this.isAuthenticated = false;
        this.isChecking = false; // Flag to prevent multiple concurrent checks
    }

    async init() {
        await this.checkAuthStatus();
        this.setupAuthListeners();
    }

    async checkAuthStatus() {
        // Prevent multiple concurrent checks
        if (this.isChecking) {
            return this.isAuthenticated;
        }
        
        this.isChecking = true;
        
        try {
            const token = localStorage.getItem('airhost_token');
            
            if (!token) {
                console.log('🔍 No token found');
                this.clearAuth();
                this.isChecking = false;
                return false;
            }

            // If we already have user data and a valid token, skip API call
            if (this.user && this.isAuthenticated) {
                console.log('✅ Using cached auth state');
                this.isChecking = false;
                return true;
            }

            if (window.AirHostAPI) {
                try {
                    console.log('🔍 Validating token with backend...');
                    const response = await window.AirHostAPI.getProfile();
                    
                    if (response.success && response.user) {
                        this.user = response.user;
                        this.isAuthenticated = true;
                        console.log('✅ User authenticated with backend:', response.user.email);
                        this.isChecking = false;
                        return true;
                    } else {
                        console.warn('❌ Profile validation failed:', response.error || 'No user data');
                        this.clearAuth();
                    }
                } catch (error) {
                    console.warn('❌ Token validation failed:', error.message);
                    
                    // Only clear auth on explicit auth errors
                    if (error.message.includes('401') || error.message.includes('Sesión expirada')) {
                        this.clearAuth();
                    } else {
                        // For network errors, keep token and allow graceful degradation
                        console.log('🔄 Keeping token for retry on network errors');
                        this.isChecking = false;
                        return token ? true : false;
                    }
                }
            } else {
                console.warn('⚠️ AirHostAPI not loaded yet, allowing access with token');
                this.isChecking = false;
                return token ? true : false;
            }
            
            this.clearAuth();
            this.isChecking = false;
            return false;
        } catch (error) {
            console.error('Auth check failed:', error);
            this.clearAuth();
            this.isChecking = false;
            return false;
        }
    }

    async requireAuth() {
        const isAuth = await this.checkAuthStatus();
        
        if (!isAuth) {
            console.log('🔒 Authentication required, redirecting to login');
            const currentPath = window.location.pathname + window.location.search;
            // Use clean URL for login redirect
            window.location.href = `/login?return=${encodeURIComponent(currentPath)}`;
            return false;
        }
        
        return true;
    }

    async logout() {
        try {
            if (window.AirHostAPI) {
                await window.AirHostAPI.logout();
            }
        } catch (error) {
            console.warn('Logout API call failed:', error);
        }
        
        this.clearAuth();
        window.location.href = '/login';
    }

    clearAuth() {
        this.user = null;
        this.isAuthenticated = false;
        localStorage.removeItem('airhost_token');
    }

    getUser() {
        return this.user;
    }

    isLoggedIn() {
        return this.isAuthenticated;
    }

    setupAuthListeners() {
        // Listen for storage changes (other tabs)
        window.addEventListener('storage', (e) => {
            if (e.key === 'airhost_token' && !e.newValue) {
                console.log('🔒 Token removed in another tab, logging out');
                this.clearAuth();
                window.location.href = '/login';
            }
        });

        // Listen for logout buttons
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-logout]') || e.target.closest('[data-logout]')) {
                e.preventDefault();
                this.logout();
            }
        });
    }

    addUserInfo(selector = '.user-info') {
        const userInfoElements = document.querySelectorAll(selector);
        userInfoElements.forEach(element => {
            if (this.user) {
                element.textContent = this.user.email || this.user.name || 'Usuario';
            }
        });
    }

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

// Global AuthGuard instance
window.AuthGuard = new AuthGuard();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await window.AuthGuard.init();
    console.log('🔐 AuthGuard initialized');
});

// Global helper functions
window.requireAuth = async () => {
    return await window.AuthGuard.requireAuth();
};

window.logout = async () => {
    return await window.AuthGuard.logout();
};

console.log('🛡️ Auth system loaded');