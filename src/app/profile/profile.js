// ============================================
// profile.js — Profile page logic
// ============================================

const API_BASE = window.location.origin;

let currentUser = null;
let currentHistoryRole = 'all';

// ============================================
// Toast notification (no alert dependency)
// ============================================

function showToast(message, type = 'info', duration = 3500) {
    document.querySelectorAll('.profile-toast').forEach(el => el.remove());

    const colors = {
        success: { border: 'rgba(16,185,129,0.3)',  text: '#6ee7b7', icon: '✓' },
        error:   { border: 'rgba(239,68,68,0.3)',   text: '#fca5a5', icon: '✕' },
        warning: { border: 'rgba(245,158,11,0.3)',  text: '#fcd34d', icon: '⚠' },
        info:    { border: 'rgba(59,130,246,0.3)',  text: '#93c5fd', icon: 'ℹ' },
    };

    const c = colors[type] || colors.info;
    const toast = document.createElement('div');
    toast.className = 'profile-toast';
    toast.innerHTML = `<span>${c.icon}</span><span>${message}</span>`;
    toast.style.cssText = `
        position:fixed;top:20px;right:20px;
        display:flex;align-items:center;gap:10px;
        background:#1a1f2e;border:1px solid ${c.border};
        color:${c.text};padding:0.8rem 1.2rem;
        border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.4);
        z-index:99999;font-family:'Outfit',sans-serif;
        font-size:0.9rem;font-weight:500;max-width:360px;
        animation:toastIn 0.25s ease both;backdrop-filter:blur(12px);
    `;

    if (!document.getElementById('profile-toast-styles')) {
        const s = document.createElement('style');
        s.id = 'profile-toast-styles';
        s.textContent = `
            @keyframes toastIn  { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
            @keyframes toastOut { from{opacity:1;transform:translateX(0)}    to{opacity:0;transform:translateX(16px)} }
        `;
        document.head.appendChild(s);
    }

    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.2s ease forwards';
        setTimeout(() => toast.remove(), 200);
    }, duration);
}

// ============================================
// Confirm dialog (replaces native confirm())
// ============================================

function showConfirm(message, confirmLabel = 'Confirm', type = 'danger') {
    return new Promise((resolve) => {
        document.querySelectorAll('.profile-confirm').forEach(el => el.remove());

        const overlay = document.createElement('div');
        overlay.className = 'profile-confirm';
        overlay.style.cssText = `
            position:fixed;inset:0;background:rgba(0,0,0,0.6);
            backdrop-filter:blur(4px);z-index:99998;
            display:flex;align-items:center;justify-content:center;
        `;

        const btnStyle = type === 'danger'
            ? 'background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);'
            : 'background:rgba(59,130,246,0.15);color:#93c5fd;border:1px solid rgba(59,130,246,0.3);';

        overlay.innerHTML = `
            <div style="background:#161d2e;border:1px solid rgba(255,255,255,0.08);
                border-radius:14px;padding:1.75rem 2rem;max-width:380px;width:90%;
                box-shadow:0 20px 60px rgba(0,0,0,0.5);font-family:'Outfit',sans-serif;">
                <p style="color:#e2e8f0;font-size:0.95rem;line-height:1.6;margin-bottom:1.5rem;">${message}</p>
                <div style="display:flex;gap:0.75rem;justify-content:flex-end;">
                    <button id="pc-cancel" style="background:rgba(255,255,255,0.05);color:#94a3b8;
                        border:1px solid rgba(255,255,255,0.08);padding:0.55rem 1.2rem;
                        border-radius:8px;cursor:pointer;font-family:'Outfit',sans-serif;font-size:0.88rem;">Cancel</button>
                    <button id="pc-ok" style="${btnStyle}padding:0.55rem 1.2rem;
                        border-radius:8px;cursor:pointer;font-family:'Outfit',sans-serif;
                        font-size:0.88rem;font-weight:600;">${confirmLabel}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        overlay.querySelector('#pc-ok').addEventListener('click', () => { overlay.remove(); resolve(true); });
        overlay.querySelector('#pc-cancel').addEventListener('click', () => { overlay.remove(); resolve(false); });
        overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
    });
}

// ============================================
// Init
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadProfile();
        await loadStats();
        await loadHistory();
        setupEventListeners();
    } catch (error) {
        console.error('Profile init error:', error);
        window.location.href = '/auth/Auth.html';
    }
});

// ============================================
// Load profile
// ============================================

async function loadProfile() {
    const res = await fetch(`${API_BASE}/api/users/profile`, { credentials: 'include' });
    if (!res.ok) throw new Error('Not authenticated');

    const data = await res.json();
    currentUser = data.user;

    document.getElementById('headerEmail').textContent   = currentUser.email;
    document.getElementById('profileName').textContent   = currentUser.username || '—';
    document.getElementById('profileEmail').textContent  = currentUser.email;
    document.getElementById('avatarInitials').textContent = getInitials(currentUser.username || currentUser.email);
    document.getElementById('inputName').value  = currentUser.username || '';
    document.getElementById('inputEmail').value = currentUser.email;

    if (currentUser.avatar_url) showAvatarImage(currentUser.avatar_url);
}

// ============================================
// Load stats
// ============================================

async function loadStats() {
    const res = await fetch(`${API_BASE}/api/users/stats`, { credentials: 'include' });
    if (!res.ok) return;

    const { stats: s } = await res.json();
    document.getElementById('statHosted').textContent   = s.conferencesHosted;
    document.getElementById('statAttended').textContent = s.conferencesAttended;
    document.getElementById('statTotal').textContent    = s.totalConferences;
    document.getElementById('statSince').textContent    = s.memberSince
        ? new Date(s.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : '—';
}

// ============================================
// Load history
// ============================================

async function loadHistory() {
    const list = document.getElementById('historyList');
    list.innerHTML = '<div class="history-empty">Loading...</div>';

    try {
        const role = currentHistoryRole === 'all' ? '' : `?role=${currentHistoryRole}`;
        const res  = await fetch(`${API_BASE}/api/conferences/user/my${role}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed');

        const { conferences = [] } = await res.json();

        if (conferences.length === 0) {
            list.innerHTML = '<div class="history-empty">No conferences yet</div>';
            return;
        }

        list.innerHTML = conferences.map(conf => {
            const isHost = conf.host_id === currentUser.id;
            const date   = conf.created_at
                ? new Date(conf.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—';
            const status = getStatus(conf);

            return `
                <div class="history-item">
                    <div class="history-item-info">
                        <div class="history-item-name">${escapeHtml(conf.name)}</div>
                        <div class="history-item-meta">${date} · ${conf.participant_count || 0} participants</div>
                    </div>
                    <div class="history-item-badges">
                        ${isHost ? '<span class="status-badge" style="background:rgba(245,158,11,0.12);color:#fbbf24;border:1px solid rgba(245,158,11,0.25)">Host</span>' : ''}
                        <span class="status-badge ${status.toLowerCase()}">${status}</span>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        list.innerHTML = '<div class="history-empty">Failed to load history</div>';
    }
}

// ============================================
// Event listeners
// ============================================

function setupEventListeners() {
    document.getElementById('backBtn').addEventListener('click', () => {
        window.location.href = '/Conf/pages/conf.html';
    });

    document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);
    document.getElementById('changePasswordBtn').addEventListener('click', changePassword);

    document.getElementById('newPassword').addEventListener('input', function () {
        updatePasswordStrength(this.value);
    });

    document.getElementById('avatarInput').addEventListener('change', uploadAvatar);

    document.getElementById('removeAvatarBtn').addEventListener('click', async () => {
        const confirmed = await showConfirm('Remove your profile photo?', 'Remove', 'danger');
        if (confirmed) removeAvatar();
    });

    document.querySelectorAll('.filter-pill').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentHistoryRole = this.dataset.role;
            loadHistory();
        });
    });

    document.getElementById('deleteAccountBtn').addEventListener('click', () => {
        document.getElementById('deleteModal').classList.remove('hidden');
        document.getElementById('deletePassword').focus();
    });

    document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
        document.getElementById('deleteModal').classList.add('hidden');
        document.getElementById('deletePassword').value = '';
        hideMsg('deleteMsg');
    });

    document.getElementById('confirmDeleteBtn').addEventListener('click', deleteAccount);

    document.getElementById('deleteModal').addEventListener('click', function (e) {
        if (e.target === this) this.classList.add('hidden');
    });
}

// ============================================
// Save profile
// ============================================

async function saveProfile() {
    const username = document.getElementById('inputName').value.trim();
    const btn = document.getElementById('saveProfileBtn');

    if (!username) { showMsg('profileMsg', 'Name cannot be empty', 'error'); return; }

    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const res  = await fetch(`${API_BASE}/api/users/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username })
        });
        const data = await res.json();

        if (res.ok) {
            currentUser.username = data.user.username;
            document.getElementById('profileName').textContent    = data.user.username;
            document.getElementById('avatarInitials').textContent = getInitials(data.user.username);
            showMsg('profileMsg', 'Profile updated', 'success');
            showToast('Profile updated', 'success', 2500);
        } else {
            showMsg('profileMsg', data.message || 'Failed to update', 'error');
        }
    } catch { showMsg('profileMsg', 'Network error', 'error'); }
    finally  { btn.disabled = false; btn.textContent = 'Save changes'; }
}

// ============================================
// Change password
// ============================================

async function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword     = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const btn             = document.getElementById('changePasswordBtn');

    if (!currentPassword || !newPassword || !confirmPassword) {
        showMsg('passwordMsg', 'Please fill in all fields', 'error'); return;
    }
    if (newPassword.length < 8) {
        showMsg('passwordMsg', 'New password must be at least 8 characters', 'error'); return;
    }
    if (newPassword !== confirmPassword) {
        showMsg('passwordMsg', 'Passwords do not match', 'error'); return;
    }

    btn.disabled = true;
    btn.textContent = 'Changing...';

    try {
        const res  = await fetch(`${API_BASE}/api/auth/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = await res.json();

        if (res.ok) {
            ['currentPassword','newPassword','confirmPassword'].forEach(id => document.getElementById(id).value = '');
            document.getElementById('passwordStrength').textContent = '';
            showMsg('passwordMsg', 'Password changed', 'success');
            showToast('Password changed successfully', 'success', 2500);
        } else {
            showMsg('passwordMsg', data.message || 'Failed', 'error');
        }
    } catch { showMsg('passwordMsg', 'Network error', 'error'); }
    finally  { btn.disabled = false; btn.textContent = 'Change password'; }
}

// ============================================
// Avatar upload
// ============================================

async function uploadAvatar() {
    const file = document.getElementById('avatarInput').files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        showToast('File is too large. Max 5MB.', 'error'); return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    try {
        const res  = await fetch(`${API_BASE}/api/users/avatar`, {
            method: 'POST', credentials: 'include', body: formData
        });
        const data = await res.json();

        if (res.ok) {
            showAvatarImage(data.avatarUrl);
            currentUser.avatar_url = data.avatarUrl;
            showToast('Photo updated', 'success', 2500);
        } else {
            showToast(data.message || 'Failed to upload', 'error');
        }
    } catch { showToast('Network error', 'error'); }

    document.getElementById('avatarInput').value = '';
}

// ============================================
// Remove avatar
// ============================================

async function removeAvatar() {
    try {
        const res = await fetch(`${API_BASE}/api/users/avatar`, {
            method: 'DELETE', credentials: 'include'
        });

        if (res.ok) {
            document.getElementById('avatarImg').classList.add('hidden');
            document.getElementById('avatarInitials').classList.remove('hidden');
            document.getElementById('removeAvatarBtn').style.display = 'none';
            currentUser.avatar_url = null;
            showToast('Photo removed', 'info', 2500);
        }
    } catch { showToast('Network error', 'error'); }
}

// ============================================
// Delete account
// ============================================

async function deleteAccount() {
    const password = document.getElementById('deletePassword').value;
    const btn      = document.getElementById('confirmDeleteBtn');

    if (!password) { showMsg('deleteMsg', 'Please enter your password', 'error'); return; }

    btn.disabled = true;
    btn.textContent = 'Deleting...';

    try {
        const res  = await fetch(`${API_BASE}/api/users/account`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ password })
        });
        const data = await res.json();

        if (res.ok) {
            showToast('Account deleted. Goodbye!', 'info', 2000);
            setTimeout(() => window.location.href = '/auth/Auth.html', 1500);
        } else {
            showMsg('deleteMsg', data.message || 'Failed', 'error');
            btn.disabled = false;
            btn.textContent = 'Delete permanently';
        }
    } catch {
        showMsg('deleteMsg', 'Network error', 'error');
        btn.disabled = false;
        btn.textContent = 'Delete permanently';
    }
}

// ============================================
// Helpers
// ============================================

function showAvatarImage(url) {
    const img       = document.getElementById('avatarImg');
    const initials  = document.getElementById('avatarInitials');
    const removeBtn = document.getElementById('removeAvatarBtn');
    img.src = url;
    img.classList.remove('hidden');
    initials.classList.add('hidden');
    removeBtn.style.display = 'block';
}

function showMsg(id, message, type) {
    const el = document.getElementById(id);
    el.textContent = message;
    el.className = `form-msg ${type}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
}

function hideMsg(id) {
    document.getElementById(id).classList.add('hidden');
}

function updatePasswordStrength(password) {
    const el = document.getElementById('passwordStrength');
    if (!password) { el.textContent = ''; return; }

    let score = 0;
    if (password.length >= 8)           score++;
    if (password.length >= 12)          score++;
    if (/[A-Z]/.test(password))         score++;
    if (/[0-9]/.test(password))         score++;
    if (/[^A-Za-z0-9]/.test(password))  score++;

    const levels = [
        { label: 'Too short',   color: '#ef4444' },
        { label: 'Weak',        color: '#f59e0b' },
        { label: 'Fair',        color: '#f59e0b' },
        { label: 'Good',        color: '#10b981' },
        { label: 'Strong',      color: '#10b981' },
        { label: 'Very strong', color: '#3b82f6' }
    ];

    const level = levels[Math.min(score, 5)];
    el.textContent = level.label;
    el.style.color  = level.color;
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getStatus(conf) {
    const now = new Date();
    if (conf.end_time && new Date(conf.end_time) < now) return 'Ended';
    if (conf.start_time && new Date(conf.start_time) > now) return 'Scheduled';
    return 'Active';
}