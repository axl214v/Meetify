const API = window.location.origin;
const PAGE_SIZE = 20;

// ── State ──────────────────────────────────────────────────────────────
const state = {
    conf:  { page: 0, total: 0, search: '' },
    users: { page: 0, total: 0, search: '' }
};

// ── Auto-refresh ────────────────────────────────────────────────────────
const autoRefresh = {
    overview: { intervalId: null, countdownId: null, seconds: 30, remaining: 30, elId: 'overviewCountdown' },
    server:   { intervalId: null, countdownId: null, seconds: 15, remaining: 15, elId: 'serverCountdown' },
};

function startAutoRefresh(key, loadFn) {
    const cfg = autoRefresh[key];
    stopAutoRefresh(key);
    cfg.remaining = cfg.seconds;

    cfg.intervalId = setInterval(() => {
        if (document.hidden) return;
        cfg.remaining = cfg.seconds;
        loadFn();
    }, cfg.seconds * 1000);

    cfg.countdownId = setInterval(() => {
        if (document.hidden) return;
        cfg.remaining--;
        if (cfg.remaining < 0) cfg.remaining = cfg.seconds;
        const el = document.getElementById(cfg.elId);
        if (el) el.textContent = `↻ ${cfg.remaining}s`;
    }, 1000);

    const el = document.getElementById(cfg.elId);
    if (el) el.textContent = `↻ ${cfg.remaining}s`;
}

function stopAutoRefresh(key) {
    const cfg = autoRefresh[key];
    if (cfg.intervalId)   { clearInterval(cfg.intervalId);   cfg.intervalId   = null; }
    if (cfg.countdownId)  { clearInterval(cfg.countdownId);  cfg.countdownId  = null; }
    const el = document.getElementById(cfg.elId);
    if (el) el.textContent = '';
}

function resetCountdown(key) {
    autoRefresh[key].remaining = autoRefresh[key].seconds;
}

// ── Init ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await guardAdmin();
    setupNav();
    setupThemeToggle();
    loadOverview();
    loadServerStats();
    startAutoRefresh('overview', loadOverview);
    startAutoRefresh('server', loadServerStats);

    // Tabs
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Refresh buttons
    document.getElementById('refreshOverview').addEventListener('click', () => {
        resetCountdown('overview');
        loadOverview();
    });
    document.getElementById('refreshConfs').addEventListener('click',    () => loadConferences(0));
    document.getElementById('refreshUsers').addEventListener('click',    () => loadUsers(0));
    document.getElementById('refreshServer').addEventListener('click',   () => {
        resetCountdown('server');
        loadServerStats();
    });
    document.getElementById('refreshSettings').addEventListener('click', loadSmtpSettings);
    document.getElementById('saveSmtp').addEventListener('click',      saveSmtpSettings);
    document.getElementById('testSmtp').addEventListener('click',      testSmtpConnection);
    document.getElementById('sendTestEmail').addEventListener('click',  sendTestEmail);
    document.getElementById('sendNotif').addEventListener('click',      sendNotification);
    document.getElementById('refreshNotifs').addEventListener('click',  loadNotifications);
    document.getElementById('refreshTickets').addEventListener('click',  loadAdminTickets);
    document.getElementById('ticketStatusFilter').addEventListener('change', loadAdminTickets);
    document.getElementById('addSocialBtn').addEventListener('click',   addSocialLink);
    document.getElementById('refreshSocials').addEventListener('click', loadSocials);
    document.getElementById('socialPreset').addEventListener('change',  e => {
        const preset = SOCIAL_PRESETS[e.target.value];
        if (!preset) return;
        document.getElementById('socialLabel').value    = preset.label;
        document.getElementById('socialIcon').value     = preset.icon;
        document.getElementById('socialCategory').value = preset.category;
        if (preset.network) document.getElementById('socialNetwork').value = preset.network;
        toggleSocialFields();
    });
    document.getElementById('socialCategory').addEventListener('change', toggleSocialFields);

    // Search (debounced)
    document.getElementById('confSearch').addEventListener('input',  debounce(e => {
        state.conf.search = e.target.value.trim();
        loadConferences(0);
    }, 400));
    document.getElementById('userSearch').addEventListener('input', debounce(e => {
        state.users.search = e.target.value.trim();
        loadUsers(0);
    }, 400));
});

// ── Guard: redirect if not admin ────────────────────────────────────────
async function guardAdmin() {
    try {
        const res  = await apiFetch('/api/auth/me');
        const data = await res.json();
        if (!res.ok || data.user?.role !== 'admin') {
            window.location.href = '/auth/Auth.html';
            return;
        }
        const name = data.user.username || data.user.email || 'Admin';
        document.getElementById('adminName').textContent   = name;
        document.getElementById('adminAvatar').textContent = name[0].toUpperCase();
    } catch {
        window.location.href = '/auth/Auth.html';
    }
}

// ── Navigation ──────────────────────────────────────────────────────────
function switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));

    // Stop all auto-refresh, restart relevant ones
    stopAutoRefresh('overview');
    stopAutoRefresh('server');
    if (tab === 'overview') startAutoRefresh('overview', loadOverview);
    if (tab === 'server')   startAutoRefresh('server', loadServerStats);

    // Lazy load on first visit
    if (tab === 'conferences' && state.conf.total === 0)   loadConferences(0);
    if (tab === 'users'       && state.users.total === 0)  loadUsers(0);
    if (tab === 'settings')       loadSmtpSettings();
    if (tab === 'notifications')  loadNotifications();
    if (tab === 'socials')        loadSocials();
    if (tab === 'support')        loadAdminTickets();
}

function setupNav() {}  // placeholder — tabs wired in DOMContentLoaded

// ── Theme ───────────────────────────────────────────────────────────────
function setupThemeToggle() {
    document.getElementById('themeToggle').addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
    });
}

// ── Overview ────────────────────────────────────────────────────────────
async function loadOverview() {
    try {
        const res  = await apiFetch('/api/admin/stats');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        const { stats, recentUsers, recentConferences } = data;

        document.getElementById('statUsers').textContent         = fmt(stats.users);
        document.getElementById('statConferences').textContent   = fmt(stats.conferences);
        document.getElementById('statActive').textContent        = fmt(stats.activeConferences);
        document.getElementById('statJoins').textContent         = fmt(stats.totalJoins);
        document.getElementById('statVerified').textContent      = fmt(stats.verifiedUsers);
        document.getElementById('statSockets').textContent       = fmt(stats.socketConnections);
        document.getElementById('statPublic').textContent        = fmt(stats.publicConferences);
        document.getElementById('statAvg').textContent           = stats.avgParticipants ?? '0';
        document.getElementById('lastUpdated').textContent       = 'Updated ' + new Date().toLocaleTimeString();

        renderMiniTable('recentUsersTable', recentUsers, u => `
            <td>${escHtml(u.username || u.email)}</td>
            <td><span class="badge badge-${u.role}">${u.role}</span></td>
            <td>${timeAgo(u.created_at)}</td>
        `);

        renderMiniTable('recentConfsTable', recentConferences, c => `
            <td>${escHtml(c.name)}</td>
            <td>${escHtml(c.host || '—')}</td>
            <td>${timeAgo(c.created_at)}</td>
        `);

    } catch (e) {
        toast('Failed to load overview: ' + e.message, 'error');
    }
}

function renderMiniTable(id, rows, rowFn) {
    const tbody = document.querySelector(`#${id} tbody`);
    if (!rows?.length) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="3">No data</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map(r => `<tr>${rowFn(r)}</tr>`).join('');
}

// ── Conferences ─────────────────────────────────────────────────────────
async function loadConferences(page = 0) {
    state.conf.page = page;
    const offset = page * PAGE_SIZE;
    const params = new URLSearchParams({ limit: PAGE_SIZE, offset });
    if (state.conf.search) params.set('search', state.conf.search);

    try {
        const res  = await apiFetch(`/api/admin/conferences?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        state.conf.total = data.total;
        const tbody = document.querySelector('#confsTable tbody');

        if (!data.conferences?.length) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No conferences found</td></tr>';
            document.getElementById('confPagination').innerHTML = '';
            return;
        }

        tbody.innerHTML = data.conferences.map(c => {
            const status = isActive(c) ? 'active' : 'ended';
            return `
            <tr>
                <td class="mono">#${c.id}</td>
                <td>${escHtml(c.name)}</td>
                <td>${escHtml(c.host_username || c.host_email || '—')}</td>
                <td class="mono">${c.participant_count ?? 0}${c.max_participants ? ' / ' + c.max_participants : ''}</td>
                <td><span class="badge badge-${status}">${status}</span></td>
                <td>${fmtDate(c.created_at)}</td>
                <td>
                    <div class="actions">
                        <button class="btn-sm btn-sm-danger" onclick="confirmDeleteConf(${c.id}, '${escAttr(c.name)}')">Delete</button>
                    </div>
                </td>
            </tr>`;
        }).join('');

        renderPagination('confPagination', state.conf.total, page, loadConferences);

    } catch (e) {
        toast('Failed to load conferences: ' + e.message, 'error');
    }
}

async function deleteConference(id) {
    try {
        const res = await apiFetch(`/api/admin/conferences/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error);
        toast('Conference deleted', 'success');
        loadConferences(state.conf.page);
        loadOverview();
    } catch (e) {
        toast('Error: ' + e.message, 'error');
    }
}

function confirmDeleteConf(id, name) {
    showConfirmModal(
        '⚠',
        'Delete Conference',
        `Delete "${name}"? This cannot be undone.`,
        () => deleteConference(id)
    );
}

// ── Users ────────────────────────────────────────────────────────────────
async function loadUsers(page = 0) {
    state.users.page = page;
    const offset = page * PAGE_SIZE;
    const params = new URLSearchParams({ limit: PAGE_SIZE, offset });
    if (state.users.search) params.set('search', state.users.search);

    try {
        const res  = await apiFetch(`/api/admin/users?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        state.users.total = data.total;
        const tbody = document.querySelector('#usersTable tbody');

        if (!data.users?.length) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No users found</td></tr>';
            document.getElementById('userPagination').innerHTML = '';
            return;
        }

        tbody.innerHTML = data.users.map(u => `
            <tr>
                <td class="mono">#${u.id}</td>
                <td>${escHtml(u.username)}</td>
                <td>${escHtml(u.email)}</td>
                <td><span class="badge badge-${u.role}">${u.role}</span></td>
                <td>${fmtDate(u.created_at)}</td>
                <td>
                    <div class="actions">
                        <button class="btn-sm btn-sm-neutral"
                            onclick="confirmToggleRole(${u.id}, '${escAttr(u.username)}', '${u.role}')">
                            ${u.role === 'admin' ? '↓ Demote' : '↑ Promote'}
                        </button>
                        <button class="btn-sm btn-sm-danger"
                            onclick="confirmDeleteUser(${u.id}, '${escAttr(u.username)}')">Delete</button>
                    </div>
                </td>
            </tr>
        `).join('');

        renderPagination('userPagination', state.users.total, page, loadUsers);

    } catch (e) {
        toast('Failed to load users: ' + e.message, 'error');
    }
}

// ── Settings ─────────────────────────────────────────────────────────
async function loadSmtpSettings() {
    try {
        const res  = await apiFetch('/api/admin/settings/smtp');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        const s = data.settings;
        document.getElementById('smtpHost').value     = s.smtp_host     || '';
        document.getElementById('smtpPort').value     = s.smtp_port     || '587';
        document.getElementById('smtpUser').value     = s.smtp_user     || '';
        document.getElementById('smtpPassword').value = s.smtp_password || '';
        document.getElementById('smtpFrom').value     = s.smtp_from     || '';
        document.getElementById('smtpSecure').value     = s.smtp_secure     || 'false';
        document.getElementById('smtpIgnoreTls').value = s.smtp_ignore_tls || 'false';
        document.getElementById('smtpEnabled').value   = s.smtp_enabled    || 'false';

        const badge = document.getElementById('smtpStatusBadge');
        badge.textContent = s.smtp_enabled === 'true' ? 'Enabled' : 'Disabled';
        badge.style.color = s.smtp_enabled === 'true' ? 'var(--success)' : 'var(--text3)';

        await loadVerificationStats();
    } catch (e) {
        toast('Failed to load SMTP settings: ' + e.message, 'error');
    }
}

async function saveSmtpSettings() {
    const body = {
        smtp_host:     document.getElementById('smtpHost').value.trim(),
        smtp_port:     document.getElementById('smtpPort').value.trim(),
        smtp_user:     document.getElementById('smtpUser').value.trim(),
        smtp_password: document.getElementById('smtpPassword').value,
        smtp_from:     document.getElementById('smtpFrom').value.trim(),
        smtp_secure:      document.getElementById('smtpSecure').value,
        smtp_ignore_tls:  document.getElementById('smtpIgnoreTls').value,
        smtp_enabled:     document.getElementById('smtpEnabled').value,
    };

    try {
        const res = await apiFetch('/api/admin/settings/smtp', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast('SMTP settings saved', 'success');
        loadSmtpSettings();
    } catch (e) {
        toast('Error: ' + e.message, 'error');
    }
}

async function testSmtpConnection() {
    try {
        const res  = await apiFetch('/api/admin/settings/smtp/test', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            toast('SMTP connection successful ✓', 'success');
        } else {
            toast('Connection failed: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (e) {
        toast('Error: ' + e.message, 'error');
    }
}

async function sendTestEmail() {
    const to = document.getElementById('testEmailAddr').value.trim();
    if (!to) { toast('Enter email address', 'error'); return; }

    try {
        const res  = await apiFetch('/api/admin/settings/smtp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to })
        });
        const data = await res.json();
        if (data.success) {
            toast(`Test email sent to ${to}`, 'success');
        } else {
            toast('Send failed: ' + (data.error || 'Unknown'), 'error');
        }
    } catch (e) {
        toast('Error: ' + e.message, 'error');
    }
}

async function loadVerificationStats() {
    try {
        const res  = await apiFetch('/api/admin/users?limit=100');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        const verified   = data.users.filter(u => u.email_verified).length;
        const unverified = data.users.filter(u => !u.email_verified);

        document.getElementById('verifiedCount').textContent =
            `${verified}/${data.total} verified`;

        const tbody = document.querySelector('#verificationTable tbody');
        if (!unverified.length) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="4">All users verified</td></tr>';
            return;
        }

        tbody.innerHTML = unverified.map(u => `
            <tr>
                <td>${escHtml(u.username)}</td>
                <td class="mono">${escHtml(u.email)}</td>
                <td><span class="badge badge-ended">Not verified</span></td>
                <td>
                    <button class="btn-sm btn-sm-neutral"
                        onclick="forceVerify(${u.id})">Force verify</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Verification stats error:', e);
    }
}

async function forceVerify(userId) {
    try {
        const res = await apiFetch(`/api/admin/users/${userId}/verify`, { method: 'POST' });
        if (!res.ok) throw new Error((await res.json()).error);
        toast('User verified', 'success');
        loadVerificationStats();
    } catch (e) {
        toast('Error: ' + e.message, 'error');
    }
}

async function deleteUser(id) {
    try {
        const res = await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error);
        toast('User deleted', 'success');
        loadUsers(state.users.page);
        loadOverview();
    } catch (e) {
        toast('Error: ' + e.message, 'error');
    }
}

async function toggleRole(id, currentRole) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
        const res = await apiFetch(`/api/admin/users/${id}/role`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: newRole })
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast(`Role changed to ${newRole}`, 'success');
        loadUsers(state.users.page);
    } catch (e) {
        toast('Error: ' + e.message, 'error');
    }
}

function confirmDeleteUser(id, name) {
    showConfirmModal('⚠', 'Delete User', `Delete user "${name}"? This cannot be undone.`, () => deleteUser(id));
}

function confirmToggleRole(id, name, role) {
    const next = role === 'admin' ? 'user' : 'admin';
    showConfirmModal('◑', 'Change Role', `Change "${name}" role to ${next}?`, () => toggleRole(id, role));
}

// ── Server Stats ─────────────────────────────────────────────────────────
async function loadServerStats() {
    try {
        const res  = await apiFetch('/api/admin/server');
        const d    = await res.json();
        if (!res.ok) throw new Error(d.error);

        document.getElementById('srvUptime').textContent   = fmtUptime(d.uptime);
        document.getElementById('srvNode').textContent     = d.nodeVersion;
        document.getElementById('srvPlatform').textContent = d.platform;
        document.getElementById('srvCores').textContent    = d.cpuCores + ' cores';
        document.getElementById('srvCpuModel').textContent = d.cpuModel;

        document.getElementById('memPercent').textContent  = d.memPercent + '%';
        document.getElementById('memUsed').textContent     = fmtBytes(d.memUsed);
        document.getElementById('memFree').textContent     = fmtBytes(d.memFree);
        document.getElementById('memTotal').textContent    = fmtBytes(d.memTotal);
        document.getElementById('memBar').style.width      = d.memPercent + '%';

        // Color mem bar by usage
        const bar = document.getElementById('memBar');
        bar.style.background = d.memPercent > 85
            ? 'linear-gradient(90deg, #e05555, #f07070)'
            : d.memPercent > 65
                ? 'linear-gradient(90deg, #f0a030, #f8c060)'
                : 'linear-gradient(90deg, var(--accent), var(--accent2))';

        const [l1, l5, l15] = d.loadAvg;
        document.getElementById('load1').textContent  = l1.toFixed(2);
        document.getElementById('load5').textContent  = l5.toFixed(2);
        document.getElementById('load15').textContent = l15.toFixed(2);

        const sub = document.getElementById('serverLastUpdated');
        if (sub) sub.textContent = 'Updated ' + new Date().toLocaleTimeString();

    } catch (e) {
        toast('Failed to load server stats: ' + e.message, 'error');
    }
}

// ── Pagination ────────────────────────────────────────────────────────────
function renderPagination(containerId, total, currentPage, loadFn) {
    const pages = Math.ceil(total / PAGE_SIZE);
    const el = document.getElementById(containerId);
    if (pages <= 1) { el.innerHTML = ''; return; }

    let html = '';
    for (let i = 0; i < pages; i++) {
        html += `<button class="page-btn${i === currentPage ? ' active' : ''}" onclick="${loadFn.name}(${i})">${i + 1}</button>`;
    }
    el.innerHTML = html;
}

// ── Confirm Modal ──────────────────────────────────────────────────────────
function showConfirmModal(icon, title, body, onConfirm) {
    const overlay = document.getElementById('confirmModal');
    document.getElementById('modalIcon').textContent  = icon;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').textContent  = body;

    overlay.classList.add('open');

    const confirmBtn = document.getElementById('modalConfirm');
    const cancelBtn  = document.getElementById('modalCancel');

    const close = () => { overlay.classList.remove('open'); };

    confirmBtn.onclick = () => { close(); onConfirm(); };
    cancelBtn.onclick  = close;
    overlay.onclick    = e => { if (e.target === overlay) close(); };
}

// ── Toast ──────────────────────────────────────────────────────────────────
function toast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    document.getElementById('toastContainer').appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

// ── Helpers ────────────────────────────────────────────────────────────────
function apiFetch(url, opts = {}) {
    return fetch(API + url, { credentials: 'include', ...opts });
}

function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = String(str ?? '');
    return d.innerHTML;
}

function escAttr(str) {
    return String(str ?? '').replace(/'/g, "\\'");
}

function fmt(n) {
    return Number(n).toLocaleString();
}

function fmtDate(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${seconds % 60}s`;
}

function fmtBytes(bytes) {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
    if (bytes >= 1048576)    return (bytes / 1048576).toFixed(0) + ' MB';
    return (bytes / 1024).toFixed(0) + ' KB';
}

function timeAgo(ts) {
    if (!ts) return '—';
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

// ── Notifications ──────────────────────────────────────────────────────────
const NOTIF_CATEGORIES = {
    info:        { label: 'Info',        color: '#3b82f6', bg: 'rgba(59,130,246,0.15)'  },
    update:      { label: 'Update',      color: '#10b981', bg: 'rgba(16,185,129,0.15)'  },
    maintenance: { label: 'Maintenance', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)'  },
    warning:     { label: 'Warning',     color: '#ef4444', bg: 'rgba(239,68,68,0.15)'   }
};

async function loadNotifications() {
    try {
        const res  = await apiFetch('/api/admin/notifications');
        const data = await res.json();
        const tbody = document.getElementById('notifsBody');
        if (!res.ok) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#f87171;padding:24px;">${escHtml(data.error)}</td></tr>`; return; }

        const list = data.notifications;
        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text2);padding:24px;">No notifications sent yet</td></tr>';
            return;
        }
        tbody.innerHTML = list.map(n => {
            const cat = NOTIF_CATEGORIES[n.category] || NOTIF_CATEGORIES.info;
            const badge = `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600;background:${cat.bg};color:${cat.color};text-transform:uppercase;letter-spacing:0.5px;">${cat.label}</span>`;
            return `<tr>
                <td style="white-space:nowrap;">${fmtDate(n.created_at)}</td>
                <td>${badge}</td>
                <td style="font-weight:500;color:var(--text);">${escHtml(n.title)}</td>
                <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escAttr(n.message)}">${escHtml(n.message)}</td>
                <td>${escHtml(n.created_by_name || '—')}</td>
                <td><button class="btn-sm btn-sm-danger" onclick="confirmDeleteNotif(${n.id}, '${escAttr(n.title)}')">Delete</button></td>
            </tr>`;
        }).join('');
    } catch (e) {
        document.getElementById('notifsBody').innerHTML = `<tr><td colspan="6" style="text-align:center;color:#f87171;padding:24px;">Error loading notifications</td></tr>`;
    }
}

async function sendNotification() {
    const title    = document.getElementById('notifTitle').value.trim();
    const message  = document.getElementById('notifMessage').value.trim();
    const category = document.getElementById('notifCategory').value;
    if (!title || !message) { toast('Title and message are required', 'error'); return; }

    const btn = document.getElementById('sendNotif');
    btn.disabled = true;
    btn.textContent = 'Sending...';
    try {
        const res = await apiFetch('/api/admin/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, message, category })
        });
        const data = await res.json();
        if (!res.ok) { toast(data.error || 'Failed to send', 'error'); return; }
        toast('Notification sent to all users', 'success');
        document.getElementById('notifTitle').value   = '';
        document.getElementById('notifMessage').value = '';
        loadNotifications();
    } catch {
        toast('Failed to send notification', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '◎ Send to all users';
    }
}

async function deleteNotification(id) {
    try {
        const res = await apiFetch(`/api/admin/notifications/${id}`, { method: 'DELETE' });
        if (!res.ok) { toast('Failed to delete notification', 'error'); return; }
        toast('Notification deleted', 'success');
        loadNotifications();
    } catch {
        toast('Failed to delete notification', 'error');
    }
}

function confirmDeleteNotif(id, title) {
    showConfirmModal('🗑', 'Delete Notification', `Delete "${title}"? Users will no longer see it in history.`, () => deleteNotification(id));
}

// ── Admin Support Tickets ─────────────────────────────────────────────────
const TICKET_STATUS = { open: 'Open', in_progress: 'In Progress', closed: 'Closed' };
const TICKET_CAT    = { technical: 'Technical', account: 'Account', general: 'General', other: 'Other' };

async function loadAdminTickets() {
    const status = document.getElementById('ticketStatusFilter').value;
    const tbody  = document.getElementById('ticketsBody');
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text2);padding:24px;">Loading...</td></tr>';

    try {
        const params = status ? `?status=${status}` : '';
        const res    = await apiFetch(`/api/admin/support/tickets${params}`);
        const data   = await res.json();
        if (!res.ok) throw new Error(data.error);

        const list = data.tickets;
        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text2);padding:24px;">No tickets found</td></tr>';
            return;
        }

        tbody.innerHTML = list.map(t => {
            const statusColor = t.status === 'open' ? 'active' : t.status === 'in_progress' ? 'scheduled' : 'ended';
            return `<tr>
                <td class="mono">#${t.id}</td>
                <td>${escHtml(t.username)}<br><small class="mono" style="color:var(--text3);">${escHtml(t.email)}</small></td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escAttr(t.title)}">${escHtml(t.title)}</td>
                <td>${escHtml(TICKET_CAT[t.category] || t.category)}</td>
                <td><span class="badge badge-${statusColor}">${escHtml(TICKET_STATUS[t.status] || t.status)}</span></td>
                <td>${timeAgo(t.updated_at)}</td>
                <td class="mono">${t.reply_count}</td>
                <td>
                    <div class="actions">
                        <a class="btn-sm btn-sm-neutral" href="/support/ticket.html?id=${t.id}" target="_blank">View</a>
                        <button class="btn-sm btn-sm-danger" onclick="confirmDeleteTicket(${t.id})">Delete</button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#f87171;padding:24px;">${escHtml(e.message)}</td></tr>`;
    }
}

async function adminDeleteTicket(id) {
    try {
        const res = await apiFetch(`/api/admin/support/tickets/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error);
        toast('Ticket deleted', 'success');
        loadAdminTickets();
    } catch (e) {
        toast('Error: ' + e.message, 'error');
    }
}

function confirmDeleteTicket(id) {
    showConfirmModal('⚠', 'Delete Ticket', `Delete ticket #${id}? All replies will be lost.`, () => adminDeleteTicket(id));
}

// ── Socials ───────────────────────────────────────────────────────────────
const SOCIAL_PRESETS = {
    github:       { label: 'GitHub',           icon: '⌗',  category: 'social'  },
    telegram:     { label: 'Telegram',          icon: '✈',  category: 'social'  },
    discord:      { label: 'Discord',           icon: '◈',  category: 'social'  },
    twitter:      { label: 'Twitter / X',       icon: '✕',  category: 'social'  },
    instagram:    { label: 'Instagram',         icon: '◉',  category: 'social'  },
    youtube:      { label: 'YouTube',           icon: '▶',  category: 'social'  },
    vk:           { label: 'VK',               icon: '◎',  category: 'social'  },
    linkedin:     { label: 'LinkedIn',          icon: '◆',  category: 'social'  },
    boosty:       { label: 'Boosty',           icon: '⚡', category: 'donate'  },
    patreon:      { label: 'Patreon',          icon: '❤',  category: 'donate'  },
    kofi:         { label: 'Ko-fi',            icon: '☕', category: 'donate'  },
    buymeacoffee: { label: 'Buy Me a Coffee',   icon: '☕', category: 'donate'  },
    yoomoney:     { label: 'ЮMoney',           icon: '₽',  category: 'donate'  },
    tinkoff:      { label: 'Tinkoff',          icon: '💳', category: 'donate'  },
    paypal:       { label: 'PayPal',           icon: '💰', category: 'donate'  },
    btc:          { label: 'Bitcoin',          icon: '₿',  category: 'crypto', network: 'Bitcoin' },
    eth:          { label: 'Ethereum',         icon: 'Ξ',  category: 'crypto', network: 'Ethereum · ERC-20' },
    usdt_trc20:   { label: 'USDT',             icon: '₮',  category: 'crypto', network: 'Tron · TRC-20' },
    ton:          { label: 'TON',              icon: '💎', category: 'crypto', network: 'The Open Network' },
    sol:          { label: 'Solana',           icon: '◎',  category: 'crypto', network: 'Solana' },
};

let socialsData = [];

async function loadSocials() {
    try {
        const res  = await apiFetch('/api/admin/settings/socials');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        socialsData = data.links || [];
        renderSocials();
    } catch (e) {
        toast('Failed to load social links: ' + e.message, 'error');
    }
}

function renderSocials() {
    const tbody = document.getElementById('socialsBody');
    if (!socialsData.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text2);padding:24px;">No links added yet</td></tr>';
        return;
    }
    tbody.innerHTML = socialsData.map((s, i) => {
        const catLabel = s.category === 'donate' ? 'Donate' : s.category === 'crypto' ? 'Crypto' : 'Social';
        const catClass = s.category === 'social' ? 'ended' : 'active';
        const target   = s.category === 'crypto'
            ? `${escHtml(s.address || '')}${s.network ? ` <span style="color:var(--text3);">· ${escHtml(s.network)}</span>` : ''}`
            : `<a href="${escAttr(s.url)}" target="_blank" rel="noopener" style="color:var(--accent);">${escHtml(s.url)}</a>`;
        return `
        <tr>
            <td style="font-size:18px;text-align:center;">${escHtml(s.icon || '🔗')}</td>
            <td style="font-weight:500;">${escHtml(s.label)}</td>
            <td class="mono" style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${target}</td>
            <td>
                <span class="badge badge-${catClass}" style="font-size:10px;">${catLabel}</span>
            </td>
            <td>
                <button class="btn-sm btn-sm-neutral" onclick="toggleSocialVisible(${i})">
                    ${s.visible !== false ? '👁 Visible' : '— Hidden'}
                </button>
            </td>
            <td>
                <button class="btn-sm btn-sm-danger" onclick="confirmDeleteSocial(${i}, '${escAttr(s.label)}')">Delete</button>
            </td>
        </tr>`;
    }).join('');
}

async function persistSocials() {
    try {
        const res = await apiFetch('/api/admin/settings/socials', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ links: socialsData })
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast('Saved', 'success');
        renderSocials();
    } catch (e) {
        toast('Error: ' + e.message, 'error');
    }
}

function toggleSocialFields() {
    const isCrypto = document.getElementById('socialCategory').value === 'crypto';
    document.getElementById('urlFieldWrap').style.display    = isCrypto ? 'none' : 'block';
    document.getElementById('cryptoFieldWrap').style.display = isCrypto ? 'flex' : 'none';
}

function addSocialLink() {
    const label    = document.getElementById('socialLabel').value.trim();
    let   icon     = document.getElementById('socialIcon').value.trim();
    const category = document.getElementById('socialCategory').value;
    const preset   = document.getElementById('socialPreset').value;

    if (!label) { toast('Label is required', 'error'); return; }

    if (category === 'crypto') {
        const address = document.getElementById('socialAddress').value.trim();
        const network = document.getElementById('socialNetwork').value.trim();
        if (!address) { toast('Wallet address is required', 'error'); return; }
        socialsData.push({
            id: Date.now(), platform: preset || 'crypto', label,
            icon: icon || '🪙', address, network, category, visible: true
        });
    } else {
        const url = document.getElementById('socialUrl').value.trim();
        if (!url) { toast('URL is required', 'error'); return; }
        try { new URL(url); } catch { toast('Invalid URL', 'error'); return; }
        socialsData.push({
            id: Date.now(), platform: preset || 'custom', label,
            icon: icon || '🔗', url, category, visible: true
        });
    }
    persistSocials();

    document.getElementById('socialPreset').value   = '';
    document.getElementById('socialLabel').value    = '';
    document.getElementById('socialIcon').value     = '';
    document.getElementById('socialUrl').value      = '';
    document.getElementById('socialAddress').value  = '';
    document.getElementById('socialNetwork').value  = '';
    document.getElementById('socialCategory').value = 'social';
    toggleSocialFields();
}

function toggleSocialVisible(index) {
    if (!socialsData[index]) return;
    socialsData[index].visible = socialsData[index].visible === false;
    persistSocials();
}

function confirmDeleteSocial(index, label) {
    showConfirmModal('⚠', 'Delete Link', `Remove "${label}" from social links?`, () => {
        socialsData.splice(index, 1);
        persistSocials();
    });
}

function isActive(conf) {
    const now = Date.now();
    const start = conf.start_time ? new Date(conf.start_time).getTime() : 0;
    const end   = conf.end_time   ? new Date(conf.end_time).getTime()   : Infinity;
    return start <= now && now <= end;
}

function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}