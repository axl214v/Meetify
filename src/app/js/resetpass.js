// ============================================
// resetpass.js — Password reset page logic
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

// ============================================
// Submit handler
// ============================================

document.getElementById('submitBtn')?.addEventListener('click', async function () {
    clearMsg();

    const nameInput  = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const btn        = document.getElementById('submitBtn');

    const name  = nameInput.value.trim();
    const email = emailInput.value.trim();

    // Reset states
    nameInput.classList.remove('error', 'success');
    emailInput.classList.remove('error', 'success');

    // Validation
    if (!name) {
        showMsg('Please enter your display name.');
        nameInput.classList.add('error');
        nameInput.focus();
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        showMsg('Please enter a valid email address.');
        emailInput.classList.add('error');
        return;
    }

    // Loading
    btn.disabled = true;
    btn.classList.add('loading');
    const originalText = btn.textContent;
    btn.textContent = 'Resetting...';

    try {
        const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, email })
        });

        const data = await response.json();

        if (response.ok) {
            // Show success block with temporary password
            nameInput.classList.add('success');
            emailInput.classList.add('success');

            document.querySelector('.auth-form').style.display = 'none';
            document.getElementById('successBlock').style.display = 'block';
            document.getElementById('tempPassword').textContent = data.tempPassword;

            // Setup copy button
            document.getElementById('copyBtn').addEventListener('click', () => {
                navigator.clipboard.writeText(data.tempPassword)
                    .then(() => {
                        const btn = document.getElementById('copyBtn');
                        btn.textContent = 'Copied!';
                        setTimeout(() => btn.textContent = 'Copy', 2000);
                    })
                    .catch(() => {
                        const input = document.createElement('input');
                        input.value = data.tempPassword;
                        document.body.appendChild(input);
                        input.select();
                        document.execCommand('copy');
                        document.body.removeChild(input);
                    });
            });

        } else if (response.status === 404) {
            showMsg('No account found with this name and email combination.');
            nameInput.classList.add('error');
            emailInput.classList.add('error');
        } else {
            showMsg(data.message || 'Failed to reset password. Please try again.');
        }

    } catch (err) {
        console.error('Reset password error:', err);
        showMsg('Network error. Please check your connection.');
    } finally {
        btn.disabled = false;
        btn.classList.remove('loading');
        btn.textContent = originalText;
    }
});

// Enter key support
document.getElementById('email')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('submitBtn')?.click();
});