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
    if (tab === 'settings') loadSmtpSettings();
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
        document.getElementById('smtpSecure').value   = s.smtp_secure   || 'false';
        document.getElementById('smtpEnabled').value  = s.smtp_enabled  || 'false';

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
        smtp_secure:   document.getElementById('smtpSecure').value,
        smtp_enabled:  document.getElementById('smtpEnabled').value,
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