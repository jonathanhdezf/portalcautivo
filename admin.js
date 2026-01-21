import { auth } from './auth.js';
import { dbData } from './store.js';
import { notify } from './notifications.js';

// Guard
const adminUser = await auth.requireAdmin();
if (!adminUser) throw new Error('Unauthorized');

document.getElementById('adminName').textContent = adminUser.name;

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => auth.logout());

// Render Residents
async function renderResidentList() {
  const users = await dbData.getUsers();
  // Filter only resident roles? users table in Supabase (profiles) has 'role'
  const residents = users.filter(u => u.role === 'resident');

  // Fetch profiles for all residents concurrently
  const profiles = await Promise.all(residents.map(u => dbData.getProfile(u.id)));

  const tbody = document.getElementById('residentTableBody');
  tbody.innerHTML = '';

  residents.forEach((user, index) => {
    const profile = profiles[index];
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
                Vence: ${profile.nextPaymentDate || 'N/A'}
            </span>
        </div>
      </td>
      <td style="padding: 1rem; border-bottom: 1px solid var(--border);">
        <input type="range" min="0" max="200" value="${profile.internetSpeed}" 
          class="speed-slider" data-userid="${user.id}" style="vertical-align: middle; accent-color: var(--accent);">
        <span id="speed-${user.id}">${profile.internetSpeed}</span> Mbps
      </td>
      <td style="padding: 1rem; border-bottom: 1px solid var(--border);">
        <div style="display:flex; flex-direction:column; gap: 0.5rem;">
            <button class="btn btn-primary open-chat-btn" data-userid="${user.id}" style="font-size: 0.85rem;">
                Mensajes ${profile.messages.filter(m => m.from === 'resident' && !m.read).length ? '🔴' : ''}
            </button>
            <button class="btn open-mgr-btn" data-userid="${user.id}" style="font-size: 0.85rem; border: 1px solid var(--border); background: rgba(255,255,255,0.1);">
                Gestionar Cliente
            </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Re-attach listeners (since we redrew DOM)
  document.querySelectorAll('.speed-slider').forEach(input => {
    input.addEventListener('change', (e) => updateSpeed(e.target.dataset.userid, e.target.value));
    input.addEventListener('input', (e) => {
      document.getElementById(`speed-${e.target.dataset.userid}`).textContent = e.target.value;
    });
  });
  document.querySelectorAll('.open-chat-btn').forEach(btn => {
    btn.addEventListener('click', () => openChat(btn.dataset.userid));
  });
  document.querySelectorAll('.open-mgr-btn').forEach(btn => {
    btn.addEventListener('click', () => openManager(btn.dataset.userid));
  });
}

function getStatusColor(status) {
  if (status === 'paid') return 'rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3)';
  if (status === 'pending') return 'rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3)';
  return 'rgba(244, 63, 94, 0.2); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.3)';
}

// Actions
window.updateSpeed = async (userId, speed) => {
  await dbData.updateProfile(userId, { internetSpeed: parseInt(speed) });
  // No need to re-render whole list usually, but safely we can
};

function convertDateForInput(dateString) {
  if (!dateString) return new Date().toISOString().split('T')[0];
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) return dateString;
  try {
    const months = {
      'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04', 'mayo': '05', 'junio': '06',
      'julio': '07', 'agosto': '08', 'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
    };
    const parts = dateString.toLowerCase().match(/(\d{1,2}) de ([a-z]+)[,]?(?: de)? (\d{4})/);
    if (parts) {
      const day = parts[1].padStart(2, '0');
      const month = months[parts[2]];
      const year = parts[3];
      if (month) return `${year}-${month}-${day}`;
    }
  } catch (e) { }
  const d = new Date(dateString);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return new Date().toISOString().split('T')[0];
}


// --- Manager Modal Logic ---
let currentManagerUserId = null;

window.openManager = async (userId) => {
  currentManagerUserId = userId;
  const user = await dbData.findUserById(userId);
  const profile = await dbData.getProfile(userId);
  if (!user || !profile) return;

  document.getElementById('managerModal').style.display = 'flex';
  document.getElementById('managerTitle').textContent = user.username + (profile.alias ? ` (${profile.alias})` : '');

  // Profile
  document.getElementById('mgrAlias').value = profile.alias || '';
  document.getElementById('mgrUsername').value = user.username;
  document.getElementById('mgrPassword').value = '';

  // Service
  document.getElementById('mgrStatus').value = profile.paymentStatus;
  document.getElementById('mgrDate').value = convertDateForInput(profile.nextPaymentDate);
  document.getElementById('mgrSpeed').value = profile.internetSpeed;
  document.getElementById('mgrSpeedVal').textContent = profile.internetSpeed;

  // WiFi
  document.getElementById('mgrWifiSSID').value = profile.wifiSSID || '';
  document.getElementById('mgrWifiPass').value = profile.wifiPass || '';
  updateQrDisplay(profile.wifiSSID, profile.wifiPass);

  renderManagerHistory(profile.paymentHistory || []);
};

window.closeManager = () => {
  document.getElementById('managerModal').style.display = 'none';
  currentManagerUserId = null;
  renderResidentList();
};

window.saveProfileChanges = async () => {
  if (!currentManagerUserId) return;
  const alias = document.getElementById('mgrAlias').value.trim();
  const username = document.getElementById('mgrUsername').value.trim();
  // Password update not supported directly via this method in this simple mapping without backend logic

  await dbData.updateUser(currentManagerUserId, { username }); // This actually calls updateProfile in store.js shim
  await dbData.updateProfile(currentManagerUserId, { alias });

  alert('Perfil actualizado');
  openManager(currentManagerUserId);
};

window.saveServiceChanges = async () => {
  if (!currentManagerUserId) return;
  const paymentStatus = document.getElementById('mgrStatus').value;
  const dateStr = document.getElementById('mgrDate').value;
  const internetSpeed = parseInt(document.getElementById('mgrSpeed').value);
  const wifiSSID = document.getElementById('mgrWifiSSID').value.trim();
  const wifiPass = document.getElementById('mgrWifiPass').value.trim();

  let nextPaymentDate = (await dbData.getProfile(currentManagerUserId)).nextPaymentDate;
  if (dateStr) {
    const [y, m, d] = dateStr.split('-');
    const dateObj = new Date(y, m - 1, d);
    nextPaymentDate = dateObj.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  await dbData.updateProfile(currentManagerUserId, { paymentStatus, nextPaymentDate, internetSpeed, wifiSSID, wifiPass });
  updateQrDisplay(wifiSSID, wifiPass);
  alert('Servicio y WiFi actualizados');
};

function updateQrDisplay(ssid, pass) {
  const img = document.getElementById('mgrQrCode');
  const placeholder = document.getElementById('mgrQrPlaceholder');
  if (ssid && pass) {
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

window.saveHistoryItem = async () => {
  if (!currentManagerUserId) return;
  const id = document.getElementById('histId').value;
  const item = {
    period: document.getElementById('histPeriod').value,
    date: document.getElementById('histDate').value,
    amount: document.getElementById('histAmount').value,
    status: document.getElementById('histStatus').value
  };

  if (id) {
    await dbData.updateHistoryItem(currentManagerUserId, id, item);
  } else {
    await dbData.addHistoryItem(currentManagerUserId, item);
  }

  // Refresh
  const profile = await dbData.getProfile(currentManagerUserId);
  renderManagerHistory(profile.paymentHistory);
  document.getElementById('historyEditForm').style.display = 'none';
};

window.editHistoryItem = async (itemId) => {
  const profile = await dbData.getProfile(currentManagerUserId);
  const item = profile.paymentHistory.find(h => h.id == itemId);
  if (!item) return;

  document.getElementById('historyEditForm').style.display = 'block';
  document.getElementById('histId').value = itemId;
  document.getElementById('histPeriod').value = item.period;
  document.getElementById('histDate').value = item.date;
  document.getElementById('histAmount').value = item.amount;
  document.getElementById('histStatus').value = item.status;
};

window.deleteHistoryItem = async (itemId) => {
  if (confirm('¿Seguro que quieres borrar este registro?')) {
    await dbData.deleteHistoryItem(currentManagerUserId, itemId);
    const profile = await dbData.getProfile(currentManagerUserId);
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

window.openChat = async (userId) => {
  currentChatUserId = userId;
  const user = await dbData.findUserById(userId);
  const profile = await dbData.getProfile(userId);
  const displayName = profile.alias || user.username;

  chatTitle.textContent = `Chat: ${displayName}`;
  modal.style.display = 'flex';

  await dbData.markMessagesRead(userId);
  renderResidentList();

  renderChatMessages();
};

window.closeChat = () => {
  modal.style.display = 'none';
  currentChatUserId = null;
};

window.deleteUser = async () => {
  if (!currentManagerUserId) return;
  if (confirm('🚨 ¿Estás seguro de ELIMINAR este usuario permanentemente?')) {
    await dbData.deleteUser(currentManagerUserId);
    closeManager();
    renderResidentList();
  }
};

async function renderChatMessages(forceScroll = false) {
  if (!currentChatUserId) return;
  const profile = await dbData.getProfile(currentChatUserId);

  const threshold = 100;
  const isAtBottom = chatMsgs.scrollHeight - chatMsgs.scrollTop - chatMsgs.clientHeight < threshold;
  const wasEmpty = chatMsgs.innerHTML === '';

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

  if (forceScroll || isAtBottom || wasEmpty) {
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
  }
}

document.getElementById('adminChatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('adminMsgInput');
  const text = input.value.trim();
  if (text && currentChatUserId) {
    await dbData.addMessage(currentChatUserId, { from: 'admin', text });
    notify.playSendSound();
    input.value = '';
    renderChatMessages(true);
    renderResidentList();
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

window.openCreateUser = () => {
  document.getElementById('createUserModal').style.display = 'flex';
  document.getElementById('newUsername').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('newRole').value = 'resident';
};
window.closeCreateUser = () => {
  document.getElementById('createUserModal').style.display = 'none';
};

window.createUser = async (e) => {
  e.preventDefault();
  const username = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('newPassword').value.trim();
  const role = document.getElementById('newRole').value;

  if (username && password) {
    // Just use auth.register logic via store or directly?
    // Auth.js handles registration.
    // Store.js createUser is just a stub in new implementation because auth handles it.
    // So we should call auth.register here? But auth.register logs us in!
    // We are admin. We want to create another user without logging out.
    // Supabase client SDK doesn't easily support "create user" without being that user, UNLESS we use service role (server-side).
    // Client-side, creating a user logs you in as that user automatically.
    // FIX: warn user or use a workaround? 
    // In this "scratch" implementation, we can't easily create users as admin without logging out.
    // We will alert the user about this limitation for now.
    alert('Nota: Supabase no permite crear usuarios desde el cliente sin cerrar sesión. Por favor usa el panel de Supabase o regístrate en la página principal.');
    closeCreateUser();
  }
};

// Initial Render
renderResidentList();
notify.requestPermission();

// Admin Polling
let lastTotalMessages = 0;
let isFirstLoad = true;

setInterval(() => {
  renderResidentList();
  checkNewMessages();
}, 5000);

async function checkNewMessages() {
  const users = await dbData.getUsers();
  // Optimization needed here for scaling but fine for demo
  // But we need to filter resident
  const residents = users.filter(u => u.role === 'resident');

  let totalMessages = 0;
  for (const u of residents) {
    const p = await dbData.getProfile(u.id);
    if (p) totalMessages += p.messages.length;
  }

  if (!isFirstLoad && totalMessages > lastTotalMessages) {
    notify.playReceiveSound();
    notify.show('Portal Admin', 'Tiene nuevos mensajes de residentes.');
  }

  lastTotalMessages = totalMessages;
  isFirstLoad = false;
}
