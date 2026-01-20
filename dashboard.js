import { auth } from './auth.js';
import { dbData } from './store.js';

// Guard
const user = auth.requireAuth();
if (!user) throw new Error('Unauthorized');

// Check Role - Redirect if admin trying to access resident view (optional, but good practice)
// if (user.role === 'admin') window.location.href = './admin.html';

// document.getElementById('userNameDisplay').textContent = user.name || user.username;

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => auth.logout());

// Data Refresh
function loadData() {
    const profile = dbData.getProfile(user.id);
    if (!profile) return; // Should not happen for valid resident

    // 0. Name Display
    document.getElementById('userNameDisplay').textContent = user.name || user.username;

    // Alias
    const aliasDisplay = document.getElementById('userAliasDisplay');
    if (profile.alias) {
        aliasDisplay.textContent = profile.alias;
        aliasDisplay.style.fontStyle = 'italic';
    } else {
        aliasDisplay.textContent = '+ Agregar Alias';
        aliasDisplay.style.fontStyle = 'normal';
    }

    // 1. Payment Status
    const paymentBadge = document.getElementById('paymentStatus');
    paymentBadge.textContent = getStatusText(profile.paymentStatus);
    paymentBadge.className = `status-badge ${getStatusClass(profile.paymentStatus)}`;

    document.getElementById('paymentDate').textContent = profile.nextPaymentDate;

    // 2. Speed Test (Visual only, but capped by profile.internetSpeed)
    simulateSpeedTest(profile.internetSpeed);

    // 3. Messages
    renderMessages(profile.messages);

    // 4. WiFi Details
    updateWifiDisplay(profile.wifiSSID, profile.wifiPass);
}

function updateWifiDisplay(ssid, pass) {
    const ssidEl = document.getElementById('dashSsid');
    const passEl = document.getElementById('dashPass');
    const qrImg = document.getElementById('dashWifiQr');
    const qrPlaceholder = document.getElementById('dashQrPlaceholder');

    if (ssid && pass) {
        ssidEl.textContent = ssid;
        passEl.textContent = pass;

        // QR Generation
        const wifiString = `WIFI:S:${ssid};T:WPA;P:${pass};;`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(wifiString)}`;

        qrImg.src = qrUrl;
        qrImg.style.display = 'block';
        qrPlaceholder.style.display = 'none';

        // Fade in text for effect
        ssidEl.style.opacity = 1;
    } else {
        ssidEl.textContent = 'Pendiente de configurar';
        ssidEl.style.opacity = 0.5;
        passEl.textContent = '••••••••';

        qrImg.style.display = 'none';
        qrPlaceholder.style.display = 'flex';
    }
}


// Alias Modal Logic
const aliasModal = document.getElementById('aliasModal');
const aliasInput = document.getElementById('aliasInput');
const aliasDisplayStr = document.getElementById('userAliasDisplay');

// Ensure elements exist before adding listeners (just for safety)
if (aliasDisplayStr) {
    aliasDisplayStr.addEventListener('click', () => {
        const profile = dbData.getProfile(user.id);
        aliasInput.value = profile.alias || '';
        aliasModal.style.display = 'flex';
    });

    document.getElementById('cancelAliasBtn').addEventListener('click', () => {
        aliasModal.style.display = 'none';
    });

    document.getElementById('saveAliasBtn').addEventListener('click', () => {
        const newAlias = aliasInput.value.trim();
        dbData.updateProfile(user.id, { alias: newAlias });
        aliasModal.style.display = 'none';
        loadData();
    });
}

// History Modal Logic
const historyModal = document.getElementById('historyModal');
const viewHistoryBtn = document.getElementById('viewHistoryBtn');
const closeHistoryBtn = document.getElementById('closeHistoryBtn'); // Assuming you add this ID to X button if not present, verify HTML change

if (viewHistoryBtn) {
    viewHistoryBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const profile = dbData.getProfile(user.id);
        const tbody = document.getElementById('historyTableBody');
        tbody.innerHTML = '';

        // Sync now handled by store.js source of truth

        profile.paymentHistory.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 0.75rem 0.5rem; border-bottom: 1px solid var(--border);">${item.period}</td>
                <td style="padding: 0.75rem 0.5rem; border-bottom: 1px solid var(--border);">${item.date}</td>
                <td style="padding: 0.75rem 0.5rem; border-bottom: 1px solid var(--border);">${item.amount}</td>
                <td style="padding: 0.75rem 0.5rem; border-bottom: 1px solid var(--border);">
                    <span class="status-badge ${getStatusClass(item.status)}" style="font-size: 0.75rem; padding: 0.1rem 0.5rem;">
                        ${getStatusText(item.status)}
                    </span>
                </td>
            `;
            tbody.appendChild(tr);
        });

        historyModal.style.display = 'flex';
    });

    if (closeHistoryBtn) {
        closeHistoryBtn.addEventListener('click', () => {
            historyModal.style.display = 'none';
        });
    }
}

function getStatusText(status) {
    if (status === 'paid') return 'Pagado';
    if (status === 'pending') return 'Pendiente';
    return 'Vencido';
}

function getStatusClass(status) {
    if (status === 'paid') return 'status-paid';
    if (status === 'pending') return 'status-pending';
    return 'status-error'; // Needs CSS
}

// Speed Animation
let speedInterval;
function simulateSpeedTest(maxSpeed) {
    const speedValue = document.getElementById('speedValue');
    const speedBar = document.getElementById('speedBar');

    // Reset
    if (speedInterval) clearInterval(speedInterval);

    let current = 0;
    speedInterval = setInterval(() => {
        // Ease out animation
        const diff = maxSpeed - current;
        const step = Math.max(0.5, diff * 0.1);
        current += step;

        if (Math.abs(maxSpeed - current) < 0.5) {
            current = maxSpeed;
            clearInterval(speedInterval);
        }

        speedValue.textContent = Math.floor(current);
        speedBar.style.width = `${Math.min(100, (current / 200) * 100)}%`; // Assumes 200mbps max visual scale
    }, 50);
}

// Messages
const messageList = document.getElementById('messageList');

function renderMessages(messages) {
    // Smart Scroll: Check if user is near bottom before update
    const isAtBottom = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < 50;
    const wasEmpty = messageList.innerHTML === '';

    messageList.innerHTML = '';
    messages.forEach(msg => {
        const div = document.createElement('div');
        const isSent = msg.from !== 'admin';
        const time = new Date(msg.timestamp).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });

        div.className = `message ${isSent ? 'sent' : 'received'}`;

        div.innerHTML = `
      <div style="font-weight: 600; font-size: 0.8rem; margin-bottom: 0.25rem; color: ${isSent ? 'rgba(255,255,255,0.9)' : 'inherit'}">
        ${isSent ? 'Tú' : 'Administración'}
      </div>
      <div>${msg.text}</div>
      <div style="font-size: 0.65rem; opacity: 0.7; margin-top: 0.25rem; text-align: right;">
        ${time}
      </div>
    `;
        messageList.appendChild(div);
    });

    // Only auto-scroll if user was already at bottom or list was empty (first load)
    if (isAtBottom || wasEmpty) {
        messageList.scrollTop = messageList.scrollHeight;
    }
}

document.getElementById('messageForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('messageInput');
    const text = input.value.trim();

    if (text) {
        dbData.addMessage(user.id, { from: 'resident', text });
        notify.playSendSound();
        input.value = '';
        loadData(); // Refresh UI
    }
});

// Emoji Picker Logic
document.querySelectorAll('.btn-emoji').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = document.getElementById('messageInput');
        input.value += btn.textContent;
        input.focus();
    });
});

import { notify } from './notifications.js';

// Initial Load
loadData();
notify.requestPermission();

// State for diffing
let lastMessageCount = 0;
let isFirstLoad = true;

// Poll for data updates (Real-time simulation)
setInterval(() => {
    loadData();
    checkNewMessages();
}, 2000);

function checkNewMessages() {
    const profile = dbData.getProfile(user.id);
    if (!profile) return;

    const currentCount = profile.messages.length;

    if (!isFirstLoad && currentCount > lastMessageCount) {
        // Find the new messages
        const newMessages = profile.messages.slice(lastMessageCount);
        const incoming = newMessages.filter(m => m.from === 'admin');

        if (incoming.length > 0) {
            notify.playReceiveSound();
            notify.show('Nuevo Mensaje', incoming[incoming.length - 1].text);
        }
    }

    lastMessageCount = currentCount;
    isFirstLoad = false;
}
