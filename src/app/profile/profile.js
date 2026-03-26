const API_BASE = window.location.origin;

// ============================================
// State
// ============================================

let currentUser = null;
let currentHistoryRole = 'all';

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
    const res = await fetch(`${API_BASE}/api/users/profile`, {
        credentials: 'include'
    });

    if (!res.ok) throw new Error('Not authenticated');

    const data = await res.json();
    currentUser = data.user;

    // Fill header
    document.getElementById('headerEmail').textContent = currentUser.email;

    // Fill avatar card
    document.getElementById('profileName').textContent = currentUser.username || '—';
    document.getElementById('profileEmail').textContent = currentUser.email;
    document.getElementById('avatarInitials').textContent = getInitials(currentUser.username || currentUser.email);

    // Show avatar image if exists
    if (currentUser.avatar_url) {
        showAvatarImage(currentUser.avatar_url);
    }

    // Fill form fields
    document.getElementById('inputName').value = currentUser.username || '';
    document.getElementById('inputEmail').value = currentUser.email;
}

// ============================================
// Load stats
// ============================================

async function loadStats() {
    const res = await fetch(`${API_BASE}/api/users/stats`, {
        credentials: 'include'
    });

    if (!res.ok) return;

    const data = await res.json();
    const s = data.stats;

    document.getElementById('statHosted').textContent   = s.conferencesHosted;
    document.getElementById('statAttended').textContent = s.conferencesAttended;
    document.getElementById('statTotal').textContent    = s.totalConferences;
    document.getElementById('statSince').textContent    = s.memberSince
        ? new Date(s.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : '—';
}

// ============================================
// Load conference history
// ============================================

async function loadHistory() {
    const list = document.getElementById('historyList');
    list.innerHTML = '<div class="history-empty">Loading...</div>';

    try {
        const role = currentHistoryRole === 'all' ? '' : `?role=${currentHistoryRole}`;
        const res = await fetch(`${API_BASE}/api/conferences/user/my${role}`, {
            credentials: 'include'
        });

        if (!res.ok) throw new Error('Failed to load history');

        const data = await res.json();
        const conferences = data.conferences || [];

        if (conferences.length === 0) {
            list.innerHTML = '<div class="history-empty">No conferences yet</div>';
            return;
        }

        list.innerHTML = conferences.map(conf => {
            const isHost = conf.host_id === currentUser.id;
            const statusClass = getStatusClass(conf);
            const date = conf.created_at
                ? new Date(conf.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—';

            return `
                <div class="history-item">
                    <div class="history-item-info">
                        <div class="history-item-name">${escapeHtml(conf.name)}</div>
                        <div class="history-item-meta">${date} · ${conf.participant_count || 0} participants</div>
                    </div>
                    <div class="history-item-badges">
                        ${isHost ? '<span class="status-badge" style="background:rgba(245,158,11,0.12);color:#fbbf24;border:1px solid rgba(245,158,11,0.25)">Host</span>' : ''}
                        <span class="status-badge ${statusClass}">${getStatus(conf)}</span>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Load history error:', error);
        list.innerHTML = '<div class="history-empty">Failed to load history</div>';
    }
}

// ============================================
// Setup event listeners
// ============================================

function setupEventListeners() {

    // Back button
    document.getElementById('backBtn').addEventListener('click', () => {
        window.location.href = '/Conf/pages/conf.html';
    });

    // Save profile
    document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);

    // Change password
    document.getElementById('changePasswordBtn').addEventListener('click', changePassword);

    // Password strength indicator
    document.getElementById('newPassword').addEventListener('input', function () {
        updatePasswordStrength(this.value);
    });

    // Avatar upload
    document.getElementById('avatarInput').addEventListener('change', uploadAvatar);

    // Remove avatar
    document.getElementById('removeAvatarBtn').addEventListener('click', removeAvatar);

    // History filters
    document.querySelectorAll('.filter-pill').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentHistoryRole = this.dataset.role;
            loadHistory();
        });
    });

    // Delete account — open modal
    document.getElementById('deleteAccountBtn').addEventListener('click', () => {
        document.getElementById('deleteModal').classList.remove('hidden');
        document.getElementById('deletePassword').focus();
    });

    // Delete account — cancel
    document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
        document.getElementById('deleteModal').classList.add('hidden');
        document.getElementById('deletePassword').value = '';
        hideMsg('deleteMsg');
    });

    // Delete account — confirm
    document.getElementById('confirmDeleteBtn').addEventListener('click', deleteAccount);

    // Close modal on overlay click
    document.getElementById('deleteModal').addEventListener('click', function (e) {
        if (e.target === this) {
            this.classList.add('hidden');
        }
    });
}

// ============================================
// Save profile name
// ============================================

async function saveProfile() {
    const username = document.getElementById('inputName').value.trim();
    const btn = document.getElementById('saveProfileBtn');

    if (!username) {
        showMsg('profileMsg', 'Name cannot be empty', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const res = await fetch(`${API_BASE}/api/users/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username })
        });

        const data = await res.json();

        if (res.ok) {
            currentUser.username = data.user.username;
            document.getElementById('profileName').textContent = data.user.username;
            document.getElementById('avatarInitials').textContent = getInitials(data.user.username);
            showMsg('profileMsg', 'Profile updated successfully', 'success');
        } else {
            showMsg('profileMsg', data.message || 'Failed to update profile', 'error');
        }
    } catch (error) {
        showMsg('profileMsg', 'Network error. Please try again.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save changes';
    }
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
        showMsg('passwordMsg', 'Please fill in all password fields', 'error');
        return;
    }

    if (newPassword.length < 8) {
        showMsg('passwordMsg', 'New password must be at least 8 characters', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showMsg('passwordMsg', 'Passwords do not match', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Changing...';

    try {
        const res = await fetch(`${API_BASE}/api/auth/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ currentPassword, newPassword })
        });

        const data = await res.json();

        if (res.ok) {
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            document.getElementById('passwordStrength').textContent = '';
            showMsg('passwordMsg', 'Password changed successfully', 'success');
        } else {
            showMsg('passwordMsg', data.message || 'Failed to change password', 'error');
        }
    } catch (error) {
        showMsg('passwordMsg', 'Network error. Please try again.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Change password';
    }
}

// ============================================
// Avatar upload
// ============================================

async function uploadAvatar() {
    const file = document.getElementById('avatarInput').files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        alert('File is too large. Maximum size is 5MB.');
        return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    try {
        const res = await fetch(`${API_BASE}/api/users/avatar`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        const data = await res.json();

        if (res.ok) {
            showAvatarImage(data.avatarUrl);
            currentUser.avatar_url = data.avatarUrl;
        } else {
            alert(data.message || 'Failed to upload avatar');
        }
    } catch (error) {
        alert('Network error. Please try again.');
    }

    // Reset input
    document.getElementById('avatarInput').value = '';
}

// ============================================
// Remove avatar
// ============================================

async function removeAvatar() {
    if (!confirm('Remove your profile photo?')) return;

    try {
        const res = await fetch(`${API_BASE}/api/users/avatar`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (res.ok) {
            document.getElementById('avatarImg').classList.add('hidden');
            document.getElementById('avatarInitials').classList.remove('hidden');
            document.getElementById('removeAvatarBtn').style.display = 'none';
            currentUser.avatar_url = null;
        }
    } catch (error) {
        alert('Network error. Please try again.');
    }
}

// ============================================
// Delete account
// ============================================

async function deleteAccount() {
    const password = document.getElementById('deletePassword').value;
    const btn = document.getElementById('confirmDeleteBtn');

    if (!password) {
        showMsg('deleteMsg', 'Please enter your password', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Deleting...';

    try {
        const res = await fetch(`${API_BASE}/api/users/account`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ password })
        });

        const data = await res.json();

        if (res.ok) {
            alert('Your account has been deleted. Goodbye!');
            window.location.href = '/auth/Auth.html';
        } else {
            showMsg('deleteMsg', data.message || 'Failed to delete account', 'error');
            btn.disabled = false;
            btn.textContent = 'Delete permanently';
        }
    } catch (error) {
        showMsg('deleteMsg', 'Network error. Please try again.', 'error');
        btn.disabled = false;
        btn.textContent = 'Delete permanently';
    }
}

// ============================================
// Helpers
// ============================================

function showAvatarImage(url) {
    const img = document.getElementById('avatarImg');
    const initials = document.getElementById('avatarInitials');
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

    // Auto hide after 4s
    setTimeout(() => el.classList.add('hidden'), 4000);
}

function hideMsg(id) {
    document.getElementById(id).classList.add('hidden');
}

function updatePasswordStrength(password) {
    const el = document.getElementById('passwordStrength');

    if (!password) {
        el.textContent = '';
        el.style.background = 'var(--bg-2)';
        return;
    }

    let score = 0;
    if (password.length >= 8)  score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const levels = [
        { label: 'Too short',  color: '#ef4444' },
        { label: 'Weak',       color: '#f59e0b' },
        { label: 'Fair',       color: '#f59e0b' },
        { label: 'Good',       color: '#10b981' },
        { label: 'Strong',     color: '#10b981' },
        { label: 'Very strong', color: '#3b82f6' }
    ];

    const level = levels[Math.min(score, 5)];
    el.textContent = level.label;
    el.style.color = level.color;
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

function getStatusClass(conf) {
    const s = getStatus(conf);
    return s.toLowerCase();
}