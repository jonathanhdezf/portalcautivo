/**
 * Store.js
 * Simulates a database using localStorage.
 */

const STORAGE_KEY = 'portal_db_v1';

const INITIAL_DB = {
    users: [
        { id: 'u1', username: 'admin', password: '123', role: 'admin', name: 'Administrador' },
        { id: 'u2', username: 'TorreA-101', password: '123', role: 'resident', name: 'Familia Perez' },
        // Default Departments
        { id: 'd1', username: 'Departamento1', password: '123', role: 'resident', name: 'Departamento 1' },
        { id: 'd2', username: 'Departamento2', password: '123', role: 'resident', name: 'Departamento 2' },
        { id: 'd3', username: 'Departamento3', password: '123', role: 'resident', name: 'Departamento 3' },
        { id: 'd4', username: 'Departamento4', password: '123', role: 'resident', name: 'Departamento 4' },
        { id: 'd5', username: 'Departamento5', password: '123', role: 'resident', name: 'Departamento 5' },
    ],
    // Data keyed by userId
    profiles: {
        'u2': {
            alias: '',
            paymentStatus: 'paid',
            nextPaymentDate: '2026-02-05',
            internetSpeed: 100,
            wifiSSID: 'Residencial_A101',
            wifiPass: 'Perez2026',
            messages: [
                {
                    id: 1,
                    from: 'admin',
                    text: 'Bienvenido a Residencial WiFi.\nActualmente navega a 150 Mb de velocidad.\n¿Sabía que puede disfrutar de Claro Video gratis como parte de su servicio?\nSi tiene alguna duda, estoy aquí para ayudarle.',
                    timestamp: Date.now() - 100000
                },
            ],
            paymentHistory: generateMockHistory()
        },
        'd1': createDefaultProfile(),
        'd2': createDefaultProfile(),
        'd3': createDefaultProfile(),
        'd4': createDefaultProfile(),
        'd5': createDefaultProfile(),
    }
};

function createDefaultProfile() {
    return {
        alias: '',
        paymentStatus: 'pending',
        nextPaymentDate: '2026-02-05',
        internetSpeed: 150,
        wifiSSID: '',
        wifiPass: '',
        messages: [{
            id: Date.now(),
            from: 'admin',
            text: 'Bienvenido a Residencial WiFi.\nActualmente navega a 150 Mb de velocidad.\n¿Sabía que puede disfrutar de Claro Video gratis como parte de su servicio?\nSi tiene alguna duda, estoy aquí para ayudarle.',
            timestamp: Date.now()
        }],
        paymentHistory: generateMockHistory()
    };
}

function generateMockHistory() {
    const history = [];
    const today = new Date();

    // Last Month
    const lastMonth = new Date(today);
    lastMonth.setMonth(today.getMonth() - 1);
    history.push({
        id: Date.now() - 10000000,
        date: lastMonth.toISOString().split('T')[0],
        period: `${lastMonth.toLocaleString('es-MX', { month: 'long' })} ${lastMonth.getFullYear()}`,
        amount: '$2,500.00',
        status: 'paid'
    });

    // Current Month (placeholder based on current status)
    history.push({
        id: Date.now() - 5000000,
        date: today.toISOString().split('T')[0],
        period: `${today.toLocaleString('es-MX', { month: 'long' })} ${today.getFullYear()}`,
        amount: '$2,500.00',
        status: 'pending' // Will sync with main status in logic
    });

    return history;
}

export const dbData = {
    init() {
        if (!localStorage.getItem(STORAGE_KEY)) {
            this.save(INITIAL_DB);
        }
    },

    getAll() {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : INITIAL_DB;
    },

    save(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    },

    // User Methods
    getUsers() {
        return this.getAll().users;
    },

    findUser(username) {
        return this.getUsers().find(u => u.username === username);
    },

    createUser(user) {
        const db = this.getAll();
        if (db.users.find(u => u.username === user.username)) {
            throw new Error('El usuario ya existe');
        }
        const newUser = { ...user, id: 'u' + Date.now() };
        db.users.push(newUser);

        // Create empty profile if resident
        if (user.role === 'resident') {
            db.profiles[newUser.id] = {
                alias: '',
                paymentStatus: 'pending',
                nextPaymentDate: getNextMonthDate(),
                internetSpeed: 150, // Default speed
                wifiSSID: '',
                wifiPass: '',
                messages: [{
                    id: Date.now(),
                    from: 'admin',
                    text: 'Bienvenido a Residencial WiFi.\nActualmente navega a 150 Mb de velocidad.\n¿Sabía que puede disfrutar de Claro Video gratis como parte de su servicio?\nSi tiene alguna duda, estoy aquí para ayudarle.',
                    timestamp: Date.now()
                }],
                paymentHistory: generateMockHistory()
            };
        }

        this.save(db);
        return newUser;
    },

    // Profile Methods
    getProfile(userId) {
        return this.getAll().profiles[userId];
    },

    updateProfile(userId, updates) {
        const db = this.getAll();
        if (!db.profiles[userId]) return null;

        // Apply updates
        db.profiles[userId] = { ...db.profiles[userId], ...updates };

        // SYNC LOGIC: If paymentStatus changed, update the latest history item too
        if (updates.paymentStatus && db.profiles[userId].paymentHistory.length > 0) {
            const history = db.profiles[userId].paymentHistory;
            const lastItem = history[history.length - 1];
            // Update the last item's status to match the main profile status
            lastItem.status = updates.paymentStatus;
        }

        this.save(db);
        return db.profiles[userId];
    },

    // Messaging
    addMessage(userId, message) {
        const db = this.getAll();
        if (!db.profiles[userId]) return;

        const newMsg = {
            id: Date.now(),
            timestamp: Date.now(),
            ...message,
            read: false // Default to unread
        };

        db.profiles[userId].messages.push(newMsg);
        this.save(db);
        return newMsg;
    },

    markMessagesRead(userId) {
        const db = this.getAll();
        if (!db.profiles[userId]) return;

        let changed = false;
        db.profiles[userId].messages.forEach(msg => {
            if (msg.from === 'resident' && !msg.read) {
                msg.read = true;
                changed = true;
            }
        });

        if (changed) this.save(db);
    },

    findUserById(userId) {
        return this.getUsers().find(u => u.id === userId);
    },

    updateUser(userId, updates) {
        const db = this.getAll();
        const userIndex = db.users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            db.users[userIndex] = { ...db.users[userIndex], ...updates };
            this.save(db);
        }
    },

    addHistoryItem(userId, item) {
        const db = this.getAll();
        const profile = db.profiles[userId];
        if (profile) {
            if (!profile.paymentHistory) profile.paymentHistory = [];
            profile.paymentHistory.push({ ...item, id: Date.now() });
            this.save(db);
        }
    },

    updateHistoryItem(userId, itemId, updates) {
        const db = this.getAll();
        const profile = db.profiles[userId];
        if (profile && profile.paymentHistory) {
            const index = profile.paymentHistory.findIndex(h => h.id == itemId);
            if (index !== -1) {
                profile.paymentHistory[index] = { ...profile.paymentHistory[index], ...updates };
                this.save(db);
            }
        }
    },

    deleteHistoryItem(userId, itemId) {
        const db = this.getAll();
        const profile = db.profiles[userId];
        if (profile && profile.paymentHistory) {
            profile.paymentHistory = profile.paymentHistory.filter(h => h.id != itemId);
            this.save(db);
        }
    },

    deleteUser(userId) {
        const db = this.getAll();
        db.users = db.users.filter(u => u.id !== userId);
        delete db.profiles[userId];
        this.save(db);
    }
};

function getNextMonthDate() {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(5); // Default to 5th of next month
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
}

// Initialize on load
dbData.init();
