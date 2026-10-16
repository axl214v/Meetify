// ============================================
// profile.js — Profile page logic
// ============================================

const API_BASE = window.location.origin;

let currentUser = null;
let currentHistoryRole = 'all';

// Toasts and confirm dialogs come from Conf/js/conf_utils.js
const showToast = showNotification;

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

    if (!currentUser.email_verified) {
        document.getElementById('verificationBanner').classList.remove('hidden');
    }
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
                        ${isHost ? '<span class="badge badge-accent">Host</span>' : ''}
                        <span class="badge ${ {Active:'badge-success',Scheduled:'badge-accent'}[status] || '' }">${status}</span>
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
    document.getElementById('backBtn')?.addEventListener('click', () => {
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

    document.getElementById('resendVerificationBtn')?.addEventListener('click', resendVerification);
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
// Resend verification email
// ============================================

async function resendVerification() {
    const btn = document.getElementById('resendVerificationBtn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
        const res = await fetch(`${API_BASE}/api/auth/resend-verification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: currentUser.email })
        });

        showMsg('verificationMsg', 'Verification email sent. Check your inbox.', 'success');
        showToast('Verification email sent', 'success', 3000);
    } catch {
        showMsg('verificationMsg', 'Network error, please try again.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Resend email';
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
    removeBtn.style.display = 'inline-flex';
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
        { label: 'Too short',   color: 'var(--danger)' },
        { label: 'Weak',        color: 'var(--warning)' },
        { label: 'Fair',        color: 'var(--warning)' },
        { label: 'Good',        color: 'var(--success)' },
        { label: 'Strong',      color: 'var(--success)' },
        { label: 'Very strong', color: 'var(--accent-text)' }
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