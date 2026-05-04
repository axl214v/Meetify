const API = window.location.origin;

function show(id) {
    ['stateLoading', 'stateSuccess', 'stateError', 'stateAlready']
        .forEach(s => document.getElementById(s).style.display = s === id ? 'block' : 'none');
}

async function verify() {
    const token = new URLSearchParams(window.location.search).get('token');

    if (!token) {
        document.getElementById('errorText').textContent = 'No verification token provided.';
        document.getElementById('resendForm').style.display = 'block';
        show('stateError');
        return;
    }

    try {
        const res  = await fetch(`${API}/api/auth/verify-email?token=${token}`);
        const data = await res.json();

        if (res.ok) {
            show('stateSuccess');
            return;
        }

        if (data.message?.includes('already')) {
            show('stateAlready');
            return;
        }

        document.getElementById('errorText').textContent =
            data.message || 'The link is invalid or has expired.';
        document.getElementById('resendForm').style.display = 'block';
        show('stateError');

    } catch (e) {
        document.getElementById('errorText').textContent = 'Network error. Please try again.';
        document.getElementById('resendForm').style.display = 'block';
        show('stateError');
    }
}

document.getElementById('resendBtn').addEventListener('click', async () => {
    const email = document.getElementById('resendEmail').value.trim();
    const msgEl = document.getElementById('resendMessage');

    if (!email) {
        msgEl.textContent = 'Please enter your email.';
        msgEl.className = 'auth-message error';
        return;
    }

    const btn = document.getElementById('resendBtn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
        const res  = await fetch(`${API}/api/auth/resend-verification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();

        if (res.ok) {
            msgEl.textContent = 'Verification email sent! Check your inbox.';
            msgEl.className = 'auth-message success';
        } else {
            msgEl.textContent = data.message || 'Failed to send email.';
            msgEl.className = 'auth-message error';
        }
    } catch (e) {
        msgEl.textContent = 'Network error. Please try again.';
        msgEl.className = 'auth-message error';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Resend Verification Email';
    }
});

verify();