/**
 * Store.js
 * Manages data via Supabase.
 */
import { supabase } from './lib/supabase.js';

export const dbData = {
    // No init needed for Supabase (client is stateless)

    // User Methods
    async getUsers() {
        const { data, error } = await supabase
            .from('profiles')
            .select('*');
        if (error) {
            console.error('Error fetching users:', error);
            return [];
        }
        return data || [];
    },

    async findUser(username) {
        // This is tricky with Supabase Auth as we can't search auth.users directly easily from client
        // But we can search our 'profiles' table.
        // However, 'login' in auth.js handles the actual auth. 
        // This method might be obsolete or used for other checks.
        // We'll search profiles by username.
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('username', username)
            .single();
        return data;
    },

    async findUserById(userId) {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        return data;
    },

    async createUser(user) {
        // Handled by Auth.js largely, but maybe we need to ensure profile?
        // Trigger in SQL handles profile creation.
        // So this might just be a no-op or return true.
        return null;
    },

    // Profile Methods
    async getProfile(userId) {
        // Fetch Profile + Messages (joined? No, separate for now to map to existing structure)

        // 1. Get Profile
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !profile) return null;

        // 2. Get Messages
        const { data: messages } = await supabase
            .from('messages')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        // 3. Get Payment History
        const { data: history } = await supabase
            .from('payment_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }); // Reversed for display usually

        // Map to existing structure expected by UI
        return {
            id: profile.id,
            username: profile.username,
            alias: profile.alias || '',
            paymentStatus: profile.payment_status,
            nextPaymentDate: profile.next_payment_date,
            internetSpeed: profile.internet_speed,
            wifiSSID: profile.wifi_ssid,
            wifiPass: profile.wifi_pass,
            messages: messages.map(m => ({
                id: m.id,
                text: m.text,
                from: m.sender_role,
                timestamp: new Date(m.created_at).getTime(), // UI expects numeric timestamp
                read: m.read
            })),
            paymentHistory: history.map(h => ({
                id: h.id,
                period: h.period,
                amount: h.amount,
                status: h.status,
                date: h.date,
                timestamp: new Date(h.created_at).getTime()
            }))
        };
    },

    async updateProfile(userId, updates) {
        // Map camelCase to snake_case
        const sqlUpdates = {};
        if (updates.alias !== undefined) sqlUpdates.alias = updates.alias;
        if (updates.paymentStatus !== undefined) sqlUpdates.payment_status = updates.paymentStatus;
        if (updates.nextPaymentDate !== undefined) sqlUpdates.next_payment_date = updates.nextPaymentDate;
        if (updates.internetSpeed !== undefined) sqlUpdates.internet_speed = updates.internetSpeed;
        if (updates.wifiSSID !== undefined) sqlUpdates.wifi_ssid = updates.wifiSSID;
        if (updates.wifiPass !== undefined) sqlUpdates.wifi_pass = updates.wifiPass;

        const { data, error } = await supabase
            .from('profiles')
            .update(sqlUpdates)
            .eq('id', userId)
            .select()
            .single();

        if (error) console.error('Update profile error:', error);
        return data;
    },

    async updateUser(userId, updates) {
        // Only some things can be updated in profiles. Auth updates (pass) handled by auth api (restricted).
        // We'll just update profile fields if any.
        return this.updateProfile(userId, updates);
    },

    // Messaging
    async addMessage(userId, message) {
        // message: { from: 'resident'|'admin', text: '...' }
        const { data, error } = await supabase
            .from('messages')
            .insert({
                user_id: userId,
                text: message.text,
                sender_role: message.from,
                read: false
            })
            .select()
            .single();

        if (error) console.error('Send Msg Error:', error);
        return data;
    },

    async markMessagesRead(userId) {
        // Mark all messages FROM resident AS read (when admin opens chat)
        // OR all messages FROM admin AS read (when resident opens chat) - logic depends on who calls it.
        // The existing store.js logic was:
        // "Mark all messages FROM resident AS read" implies this is called by Admin.

        // Let's assume this is Admin clearing resident notifications.
        await supabase
            .from('messages')
            .update({ read: true })
            .eq('user_id', userId)
            .eq('sender_role', 'resident')
            .eq('read', false);
    },

    // History
    async addHistoryItem(userId, item) {
        // item: { period, amount, status, date }
        const { error } = await supabase
            .from('payment_history')
            .insert({
                user_id: userId,
                period: item.period,
                amount: item.amount,
                status: item.status,
                date: item.date
            });
        if (error) console.error(error);
    },

    async updateHistoryItem(userId, itemId, updates) {
        const { error } = await supabase
            .from('payment_history')
            .update(updates)
            .eq('id', itemId);
        if (error) console.error(error);
    },

    async deleteHistoryItem(userId, itemId) {
        const { error } = await supabase
            .from('payment_history')
            .delete()
            .eq('id', itemId);
        if (error) console.error(error);
    },

    async deleteUser(userId) {
        // Deleting user from Auth is tricky from client (requires Service Role).
        // But we can delete from 'profiles' which might cascade if set up, 
        // OR we just assume we can't fully delete auth user without Edge Function.
        // For now, we'll try deleting from profiles.
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (error) alert('Note: User profile deleted, but Auth account may remain requires Admin API.');
    }
};
