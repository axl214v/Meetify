// ============================================
// resetpass-confirm.js — Set new password page
// ============================================

const API_BASE = window.location.origin;

let resetToken = null;

function showMsg(message, type = 'error') {
    const el = document.getElementById('confirmMessage');
    if (!el) return;
    el.textContent = message;
    el.className = `auth-message ${type}`;
}

// ============================================
// Validate token on page load
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    resetToken = urlParams.get('token');

    if (!resetToken) {
        showState('invalid');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/auth/reset-password/validate?token=${resetToken}`);

        if (res.ok) {
            showState('form');
        } else {
            showState('invalid');
        }
    } catch {
        showState('invalid');
    }
});

function showState(state) {
    document.getElementById('loadingBlock').style.display  = state === 'loading'  ? 'block' : 'none';
    document.getElementById('invalidBlock').style.display  = state === 'invalid'  ? 'block' : 'none';
    document.getElementById('confirmCard').style.display   = state === 'form'     ? 'block' : 'none';
}

// ============================================
// Password strength indicator
// ============================================

document.getElementById('newPassword')?.addEventListener('input', function () {
    const el = document.getElementById('password-strength');
    const password = this.value;
    if (!password) { el.textContent = ''; return; }

    let score = 0;
    if (password.length >= 8)            score++;
    if (password.length >= 12)           score++;
    if (/[A-Z]/.test(password))          score++;
    if (/[0-9]/.test(password))          score++;
    if (/[^A-Za-z0-9]/.test(password))   score++;

    const levels = [
        { label: 'Too short',    color: '#ef4444' },
        { label: 'Weak',         color: '#ef4444' },
        { label: 'Fair',         color: '#f59e0b' },
        { label: 'Good',         color: '#10b981' },
        { label: 'Strong',       color: '#10b981' },
        { label: 'Very strong',  color: '#3b82f6' },
    ];

    const level = levels[Math.min(score, 5)];
    el.textContent = level.label;
    el.style.color  = level.color;
});

// ============================================
// Submit new password
// ============================================

document.getElementById('submitBtn')?.addEventListener('click', async function () {
    const newPassword     = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const btn             = this;

    document.getElementById('newPassword').classList.remove('error', 'success');
    document.getElementById('confirmPassword').classList.remove('error', 'success');

    if (!newPassword || newPassword.length < 8) {
        showMsg('Password must be at least 8 characters.');
        document.getElementById('newPassword').classList.add('error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showMsg('Passwords do not match.');
        document.getElementById('confirmPassword').classList.add('error');
        return;
    }

    btn.disabled = true;
    btn.classList.add('loading');
    const originalText = btn.textContent;
    btn.textContent = 'Saving...';

    try {
        const res = await fetch(`${API_BASE}/api/auth/reset-password/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: resetToken, newPassword })
        });

        const data = await res.json();

        if (res.ok) {
            document.getElementById('newPassword').classList.add('success');
            document.getElementById('confirmPassword').classList.add('success');
            showMsg('Password changed successfully! Redirecting to sign in...', 'success');

            setTimeout(() => {
                window.location.href = '/auth/Auth.html';
            }, 2000);
        } else {
            showMsg(data.message || 'Failed to reset password. The link may have expired.');
        }

    } catch {
        showMsg('Network error. Please try again.');
    } finally {
        btn.disabled = false;
        btn.classList.remove('loading');
        btn.textContent = originalText;
    }
});

document.getElementById('confirmPassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('submitBtn')?.click();
});