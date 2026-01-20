/**
 * Auth.js
 * Manages user sessions.
 */
import { dbData } from './store.js';

const SESSION_KEY = 'portal_session';

export const auth = {
    login(username, password) {
        const user = dbData.findUser(username);
        if (user && user.password === password) {
            localStorage.setItem(SESSION_KEY, JSON.stringify(user));
            return { success: true, user };
        }
        return { success: false, error: 'Credenciales inválidas' };
    },

    register(username, password, role = 'resident') {
        try {
            const newUser = dbData.createUser({ username, password, role, name: username });
            this.login(username, password); // Auto login
            return { success: true, user: newUser };
        } catch (e) {
            return { success: false, error: e.message };
        }
    },

    logout() {
        localStorage.removeItem(SESSION_KEY);
        window.location.href = './index.html';
    },

    getUser() {
        const data = localStorage.getItem(SESSION_KEY);
        return data ? JSON.parse(data) : null;
    },

    // Guards
    requireAuth() {
        const user = this.getUser();
        if (!user) {
            window.location.href = './index.html';
            return null;
        }
        return user;
    },

    requireAdmin() {
        const user = this.requireAuth();
        if (user && user.role !== 'admin') {
            window.location.href = './dashboard.html';
            return null;
        }
        return user;
    }
};
