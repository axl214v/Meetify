// ============================================
// resetpass.js — Request password reset link
// ============================================

const API_BASE = window.location.origin;

function showMsg(message, type = 'error') {
    const el = document.getElementById('resetMessage');
    if (!el) return;
    el.textContent = message;
    el.className = `auth-message ${type}`;
}

function clearMsg() {
    const el = document.getElementById('resetMessage');
    if (el) el.className = 'auth-message';
}

document.getElementById('submitBtn')?.addEventListener('click', async function () {
    clearMsg();

    const emailInput = document.getElementById('email');
    const btn        = document.getElementById('submitBtn');
    const email      = emailInput.value.trim();

    emailInput.classList.remove('error', 'success');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        showMsg('Please enter a valid email address.');
        emailInput.classList.add('error');
        return;
    }

    btn.disabled = true;
    btn.classList.add('loading');
    const originalText = btn.textContent;
    btn.textContent = 'Sending...';

    try {
        const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (response.ok || response.status === 404) {
            // Always show success — don't reveal whether email is registered
            emailInput.classList.add('success');
            document.getElementById('requestForm').style.display = 'none';
            document.getElementById('successBlock').style.display = 'block';
            document.getElementById('sentToEmail').textContent = email;
        } else {
            showMsg(data.message || 'Failed to send reset link. Please try again.');
        }

    } catch (err) {
        console.error('Forgot password error:', err);
        showMsg('Network error. Please check your connection.');
    } finally {
        btn.disabled = false;
        btn.classList.remove('loading');
        btn.textContent = originalText;
    }
});

document.getElementById('email')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('submitBtn')?.click();
});