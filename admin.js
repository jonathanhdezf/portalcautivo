import { auth } from './auth.js';
import { dbData } from './store.js';

// Guard
const adminUser = auth.requireAdmin();
if (!adminUser) throw new Error('Unauthorized');

document.getElementById('adminName').textContent = adminUser.name;

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => auth.logout());

// Render Residents
function renderResidentList() {
  const users = dbData.getUsers().filter(u => u.role === 'resident');
  const tbody = document.getElementById('residentTableBody');
  tbody.innerHTML = '';

  users.forEach(user => {
    const profile = dbData.getProfile(user.id);
    if (!profile) return;

    const tr = document.createElement('tr');
    const displayAlias = profile.alias ? `<div style="font-size: 0.85em; color: var(--accent);">${profile.alias}</div>` : '';

    tr.innerHTML = `
      <td style="padding: 1rem; border-bottom: 1px solid var(--border); font-weight: 500;">
        ${user.username}
        ${displayAlias}
      </td>
      <td style="padding: 1rem; border-bottom: 1px solid var(--border);">
        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <span style="padding: 0.25rem 0.5rem; border-radius: 999px; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; background: ${getStatusColor(profile.paymentStatus)}; display: inline-block; width: fit-content;">
                ${getStatusText(profile.paymentStatus)}
            </span>
            <span style="font-size: 0.8rem; color: var(--text-muted);">
                Vence: ${profile.nextPaymentDate}
            </span>
        </div>
      </td>
      <td style="padding: 1rem; border-bottom: 1px solid var(--border);">
        <input type="range" min="0" max="200" value="${profile.internetSpeed}" 
          onchange="updateSpeed('${user.id}', this.value)" style="vertical-align: middle; accent-color: var(--accent);">
        <span id="speed-${user.id}">${profile.internetSpeed}</span> Mbps
      </td>
      <td style="padding: 1rem; border-bottom: 1px solid var(--border);">
        <div style="display:flex; flex-direction:column; gap: 0.5rem;">
            <button onclick="openChat('${user.id}')" class="btn btn-primary" style="font-size: 0.85rem;">
                Mensajes ${profile.messages.filter(m => m.from === 'resident' && !m.read).length ? '🔴' : ''}
            </button>
            <button onclick="openManager('${user.id}')" class="btn" style="font-size: 0.85rem; border: 1px solid var(--border); background: rgba(255,255,255,0.1);">
                Gestionar Cliente
            </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function getStatusColor(status) {
  if (status === 'paid') return 'rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3)';
  if (status === 'pending') return 'rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3)';
  return 'rgba(244, 63, 94, 0.2); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.3)';
}

// Global scope for HTML callbacks
window.updatePayment = (userId, status) => {
  dbData.updateProfile(userId, { paymentStatus: status });
  renderResidentList(); // Refresh to show color change
};

window.updateDate = (userId, dateStr) => {
  if (!dateStr) return;
  // Store as ISO YYYY-MM-DD for consistency and reliability
  dbData.updateProfile(userId, { nextPaymentDate: dateStr });
};

function convertDateForInput(dateString) {
  if (!dateString) return new Date().toISOString().split('T')[0];

  // If already YYYY-MM-DD (simple check)
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateString;
  }

  // Handle "05 de Febrero de 2026" or "05 de Febrero, 2026"
  try {
    const months = {
      'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04', 'mayo': '05', 'junio': '06',
      'julio': '07', 'agosto': '08', 'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
    };

    // Regex allows optional comma and optional 'de' before year
    const parts = dateString.toLowerCase().match(/(\d{1,2}) de ([a-z]+)[,]?(?: de)? (\d{4})/);

    if (parts) {
      const day = parts[1].padStart(2, '0');
      const month = months[parts[2]];
      const year = parts[3];
      if (month) return `${year}-${month}-${day}`;
    }
  } catch (e) { }

  // Fallback: try Date parse (works for some ISO-like or standard formats)
  const d = new Date(dateString);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

window.updateSpeed = (userId, speed) => {
  dbData.updateProfile(userId, { internetSpeed: parseInt(speed) });
  document.getElementById(`speed-${userId}`).textContent = speed;
};

// --- Manager Modal Logic ---
let currentManagerUserId = null;

window.openManager = (userId) => {
  currentManagerUserId = userId;
  const user = dbData.findUserById(userId);
  const profile = dbData.getProfile(userId);
  if (!user || !profile) return;

  document.getElementById('managerModal').style.display = 'flex';
  document.getElementById('managerTitle').textContent = user.username + (profile.alias ? ` (${profile.alias})` : '');

  // Profile Pop
  document.getElementById('mgrAlias').value = profile.alias || '';
  document.getElementById('mgrUsername').value = user.username;
  document.getElementById('mgrPassword').value = ''; // Don't show password

  // Service Pop
  document.getElementById('mgrStatus').value = profile.paymentStatus;
  // Assuming convertDateForInput is available
  document.getElementById('mgrDate').value = convertDateForInput(profile.nextPaymentDate);
  document.getElementById('mgrSpeed').value = profile.internetSpeed;
  document.getElementById('mgrSpeed').value = profile.internetSpeed;
  document.getElementById('mgrSpeedVal').textContent = profile.internetSpeed;

  // WiFi Pop
  document.getElementById('mgrWifiSSID').value = profile.wifiSSID || '';
  document.getElementById('mgrWifiPass').value = profile.wifiPass || '';
  updateQrDisplay(profile.wifiSSID, profile.wifiPass);

  renderManagerHistory(profile.paymentHistory || []);
};

window.closeManager = () => {
  document.getElementById('managerModal').style.display = 'none';
  currentManagerUserId = null;
  renderResidentList(); // Refresh main table
};

// Profile Update
window.saveProfileChanges = () => {
  if (!currentManagerUserId) return;
  const alias = document.getElementById('mgrAlias').value.trim();
  const username = document.getElementById('mgrUsername').value.trim();
  const password = document.getElementById('mgrPassword').value.trim();

  const userUpdates = { username };
  if (password) userUpdates.password = password;

  dbData.updateUser(currentManagerUserId, userUpdates);
  dbData.updateProfile(currentManagerUserId, { alias });

  alert('Perfil actualizado');
  openManager(currentManagerUserId); // Refresh title
};

// Service Update
window.saveServiceChanges = () => {
  if (!currentManagerUserId) return;
  const paymentStatus = document.getElementById('mgrStatus').value;
  const dateStr = document.getElementById('mgrDate').value;
  const internetSpeed = parseInt(document.getElementById('mgrSpeed').value);

  const wifiSSID = document.getElementById('mgrWifiSSID').value.trim();
  const wifiPass = document.getElementById('mgrWifiPass').value.trim();

  // Date Logic
  let nextPaymentDate = dbData.getProfile(currentManagerUserId).nextPaymentDate;
  if (dateStr) {
    const [y, m, d] = dateStr.split('-');
    const dateObj = new Date(y, m - 1, d);
    nextPaymentDate = dateObj.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  dbData.updateProfile(currentManagerUserId, { paymentStatus, nextPaymentDate, internetSpeed, wifiSSID, wifiPass });

  updateQrDisplay(wifiSSID, wifiPass);
  alert('Servicio y WiFi actualizados');
};

function updateQrDisplay(ssid, pass) {
  const img = document.getElementById('mgrQrCode');
  const placeholder = document.getElementById('mgrQrPlaceholder');

  if (ssid && pass) {
    // WIFI:S:MySSID;T:WPA;P:MyPass;;
    const wifiString = `WIFI:S:${ssid};T:WPA;P:${pass};;`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(wifiString)}`;

    img.src = qrUrl;
    img.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    img.style.display = 'none';
    placeholder.style.display = 'flex';
    placeholder.textContent = 'Ingrese SSID y Contraseña para ver QR';
  }
}

window.generateRandomPass = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pass = '';
  for (let i = 0; i < 8; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  document.getElementById('mgrWifiPass').value = pass;
};

// Speed Slider in Modal
document.getElementById('mgrSpeed').addEventListener('input', (e) => {
  document.getElementById('mgrSpeedVal').textContent = e.target.value;
});

// --- History Logic ---

function renderManagerHistory(history) {
  const tbody = document.getElementById('mgrHistoryBody');
  tbody.innerHTML = '';

  const reversed = [...history].reverse();

  reversed.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border);">${item.period}</td>
            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border);">${item.amount}</td>
            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border);">${getStatusText(item.status)}</td>
            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border); text-align: right;">
                <button onclick="editHistoryItem('${item.id}')" style="font-size: 0.7rem; margin-right: 0.2rem; cursor: pointer;">✏️</button>
                <button onclick="deleteHistoryItem('${item.id}')" style="font-size: 0.7rem; color: #f87171; cursor: pointer;">🗑️</button>
            </td>
        `;
    tbody.appendChild(tr);
  });
}

window.openAddHistory = () => {
  document.getElementById('historyEditForm').style.display = 'block';
  document.getElementById('histId').value = '';
  document.getElementById('histPeriod').value = '';
  document.getElementById('histDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('histAmount').value = '$2,500.00';
  document.getElementById('histStatus').value = 'paid';
};

window.cancelHistoryEdit = () => {
  document.getElementById('historyEditForm').style.display = 'none';
};

window.saveHistoryItem = () => {
  if (!currentManagerUserId) return;

  const id = document.getElementById('histId').value;
  const item = {
    period: document.getElementById('histPeriod').value,
    date: document.getElementById('histDate').value,
    amount: document.getElementById('histAmount').value,
    status: document.getElementById('histStatus').value
  };

  if (id) {
    dbData.updateHistoryItem(currentManagerUserId, id, item);
  } else {
    dbData.addHistoryItem(currentManagerUserId, item);
  }

  // Refresh
  const profile = dbData.getProfile(currentManagerUserId);
  renderManagerHistory(profile.paymentHistory);
  document.getElementById('historyEditForm').style.display = 'none';
};

window.editHistoryItem = (itemId) => {
  const profile = dbData.getProfile(currentManagerUserId);
  const item = profile.paymentHistory.find(h => h.id == itemId);
  if (!item) return;

  document.getElementById('historyEditForm').style.display = 'block';
  document.getElementById('histId').value = itemId;
  document.getElementById('histPeriod').value = item.period;
  document.getElementById('histDate').value = item.date;
  document.getElementById('histAmount').value = item.amount;
  document.getElementById('histStatus').value = item.status;
};

window.deleteHistoryItem = (itemId) => {
  if (confirm('¿Seguro que quieres borrar este registro?')) {
    dbData.deleteHistoryItem(currentManagerUserId, itemId);
    const profile = dbData.getProfile(currentManagerUserId);
    renderManagerHistory(profile.paymentHistory);
  }
};

function getStatusText(status) {
  if (status === 'paid') return 'Pagado';
  if (status === 'pending') return 'Pendiente';
  return 'Vencido';
}

// Chat Modal Logic
const modal = document.getElementById('chatModal');
const chatTitle = document.getElementById('chatTitle');
const chatMsgs = document.getElementById('chatMessages');
let currentChatUserId = null;

window.openChat = (userId) => {
  currentChatUserId = userId;

  const user = dbData.findUserById(userId);
  const profile = dbData.getProfile(userId);
  const displayName = profile.alias || user.username;

  chatTitle.textContent = `Chat: ${displayName}`;
  modal.style.display = 'flex';

  // Mark as read
  dbData.markMessagesRead(userId);
  renderResidentList(); // Update notification dot

  renderChatMessages();
};

window.closeChat = () => {
  modal.style.display = 'none';
  currentChatUserId = null;
};

// User Deletion
window.deleteUser = () => {
  if (!currentManagerUserId) return;
  if (confirm('🚨 ¿Estás seguro de ELIMINAR este usuario permanentemente?\n\nEsta acción NO se puede deshacer.')) {
    dbData.deleteUser(currentManagerUserId);
    closeManager();
    renderResidentList();
  }
};

function renderChatMessages() {
  if (!currentChatUserId) return;
  const profile = dbData.getProfile(currentChatUserId);
  chatMsgs.innerHTML = '';

  profile.messages.forEach(msg => {
    const div = document.createElement('div');
    const isAdmin = msg.from === 'admin';
    const time = new Date(msg.timestamp).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });

    div.style.cssText = `
      display: flex; flex-direction: column;
      margin-bottom: 0.5rem; 
      max-width: 80%;
      align-self: ${isAdmin ? 'flex-end' : 'flex-start'};
    `;

    div.innerHTML = `
        <div style="
            padding: 0.5rem; 
            border-radius: 0.5rem; 
            background: ${isAdmin ? 'var(--accent)' : 'var(--border)'};
            color: ${isAdmin ? 'white' : 'var(--text-main)'};
        ">
            ${msg.text}
        </div>
        <span style="font-size: 0.65rem; color: var(--text-muted); margin-top: 0.2rem; align-self: ${isAdmin ? 'flex-end' : 'flex-start'};">
            ${time}
        </span>
    `;
    chatMsgs.appendChild(div);
  });
  chatMsgs.scrollTop = chatMsgs.scrollHeight;
}

document.getElementById('adminChatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('adminMsgInput');
  const text = input.value.trim();
  if (text && currentChatUserId) {
    dbData.addMessage(currentChatUserId, { from: 'admin', text });
    notify.playSendSound();
    input.value = '';
    renderChatMessages();
    renderResidentList(); // Update count
  }
});

// Admin Emoji Picker
document.querySelectorAll('.admin-emoji').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById('adminMsgInput');
    input.value += btn.textContent;
    input.focus();
  });
});

// Create User Logic
window.openCreateUser = () => {
  document.getElementById('createUserModal').style.display = 'flex';
  document.getElementById('newUsername').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('newRole').value = 'resident';
};
window.closeCreateUser = () => {
  document.getElementById('createUserModal').style.display = 'none';
};

window.createUser = (e) => {
  e.preventDefault();
  const username = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('newPassword').value.trim();
  const role = document.getElementById('newRole').value;

  if (username && password) {
    try {
      // Check if user exists first
      const exists = dbData.getUsers().find(u => u.username === username);
      if (exists) {
        alert('El usuario ya existe');
        return;
      }

      dbData.createUser({ username, password, role, name: username });
      alert('Usuario creado exitosamente');
      closeCreateUser();
      renderResidentList();
    } catch (err) {
      alert('Error al crear usuario: ' + err.message);
    }
  }
};

import { notify } from './notifications.js';

// Initial Render
renderResidentList();
notify.requestPermission();

// Admin Polling
let lastTotalMessages = 0;
let isFirstLoad = true;

setInterval(() => {
  // Refresh list to update unread badges
  renderResidentList();
  checkNewMessages();
}, 5000);

function checkNewMessages() {
  const users = dbData.getUsers().filter(u => u.role === 'resident');
  let totalMessages = 0;

  users.forEach(u => {
    const p = dbData.getProfile(u.id);
    if (p) totalMessages += p.messages.length;
  });

  if (!isFirstLoad && totalMessages > lastTotalMessages) {
    // Just generic notification for now as strict per-user tracking is complex here
    notify.playReceiveSound();
    notify.show('Portal Admin', 'Tiene nuevos mensajes de residentes.');
  }

  lastTotalMessages = totalMessages;
  isFirstLoad = false;
}
