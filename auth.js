/**
 * Auth.js
 * Manages user sessions via Supabase.
 */
import { supabase } from './lib/supabase.js';

export const auth = {
    async login(email, password) {
        // Supabase requires email, but our app uses 'username' sometimes.
        // For this migration, we will assume the input IS an email or we fake an email if it's just a username
        // E.g. username@residential.app
        // ideally user inputs email.

        let finalEmail = email;
        if (!email.includes('@')) {
            finalEmail = `${email.replace(/\s+/g, '')}@portal.local`; // Mock domain for username-based login
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email: finalEmail,
            password: password
        });

        if (error) return { success: false, error: error.message };

        // Fetch role from metadata
        const user = data.user;
        const role = user.user_metadata.role || 'resident';
        const name = user.user_metadata.name || email;

        return {
            success: true,
            user: { ...user, role, name, username: email }
        };
    },

    async register(username, password, role = 'resident') {
        let finalEmail = username;
        if (!username.includes('@')) {
            finalEmail = `${username.replace(/\s+/g, '')}@portal.local`;
        }

        const { data, error } = await supabase.auth.signUp({
            email: finalEmail,
            password: password,
            options: {
                data: {
                    role: role,
                    username: username,
                    name: username
                }
            }
        });

        if (error) return { success: false, error: error.message };
        return { success: true, user: data.user };
    },

    async logout() {
        await supabase.auth.signOut();
        window.location.href = './index.html';
    },

    async getUser() {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return null;

        const u = data.session.user;
        return {
            id: u.id,
            email: u.email,
            role: u.user_metadata.role,
            name: u.user_metadata.name || u.email,
            username: u.user_metadata.username
        };
    },

    // Guards - Now Async!
    async requireAuth() {
        const user = await this.getUser();
        if (!user) {
            window.location.href = './index.html';
            return null;
        }
        return user;
    },

    async requireAdmin() {
        const user = await this.requireAuth();
        if (user && user.role !== 'admin') {
            window.location.href = './dashboard.html';
            return null;
        }
        return user;
    }
};
