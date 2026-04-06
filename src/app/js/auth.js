// ============================================
// auth.js — Login page logic
// ============================================

const API_BASE = window.location.origin;

// ============================================
// Show inline message instead of alert()
// ============================================

function showMsg(message, type = 'error') {
    const el = document.getElementById('authMessage');
    if (!el) return;
    el.textContent = message;
    el.className = `auth-message ${type}`;
}

function clearMsg() {
    const el = document.getElementById('authMessage');
    if (el) el.className = 'auth-message';
}

// ============================================
// Redirect if already logged in
// ============================================

async function checkAuthentication() {
    try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
            method: 'GET',
            credentials: 'include'
        });
        if (response.ok) {
            window.location.href = '/Conf/pages/conf.html';
        }
    } catch (error) {
        console.error('Auth check failed:', error);
    }
}

checkAuthentication();

// ============================================
// Login form handler
// ============================================

document.getElementById('submit')?.addEventListener('click', async function (e) {
    e.preventDefault();
    clearMsg();

    const submitButton = document.getElementById('submit');
    const emailInput    = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    const email    = emailInput.value.trim();
    const password = passwordInput.value.trim();

    // Reset states
    emailInput.classList.remove('error', 'success');
    passwordInput.classList.remove('error', 'success');

    // Validation
    if (!email || !password) {
        showMsg('Please fill in all required fields.');
        if (!email)    emailInput.classList.add('error');
        if (!password) passwordInput.classList.add('error');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showMsg('Please enter a valid email address.');
        emailInput.classList.add('error');
        return;
    }

    // Loading state
    submitButton.disabled = true;
    submitButton.classList.add('loading');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Signing in...';

    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });

        if (response.status === 200) {
            emailInput.classList.add('success');
            passwordInput.classList.add('success');
            showMsg('Success! Redirecting...', 'success');

            setTimeout(() => {
                window.location.href = '/Conf/pages/conf.html';
            }, 400);

        } else if (response.status === 401) {
            showMsg('Invalid email or password.');
            passwordInput.classList.add('error');
        } else {
            showMsg('Server error. Please try again later.');
        }

    } catch (err) {
        console.error('Login request failed:', err);
        showMsg('Network error. Please check your connection.');
    } finally {
        submitButton.disabled = false;
        submitButton.classList.remove('loading');
        submitButton.textContent = originalText;
    }
});

// ============================================
// Navigation
// ============================================

document.getElementById('authb')?.addEventListener('click', () => {
    window.location.href = '/auth/Reg.html';
});

document.getElementById('reset')?.addEventListener('click', () => {
    window.location.href = '/auth/resetpass.html';
});

document.getElementById('password')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('submit')?.click();
});