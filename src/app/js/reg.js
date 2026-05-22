// ============================================
// reg.js — Registration page logic
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
// Validation helpers
// ============================================

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
    return password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}

function validateName(name) {
    return name.length >= 2 && /^[A-Za-zА-Яа-яЁё\s]+$/.test(name);
}

// ============================================
// Registration form handler
// ============================================

document.getElementById('submit')?.addEventListener('click', async function (e) {
    e.preventDefault();
    clearMsg();

    const submitButton  = document.getElementById('submit');
    const nameInput     = document.getElementById('name');
    const emailInput    = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    const name     = nameInput.value.trim();
    const email    = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const ageConsent = document.getElementById('ageConsent')?.checked;
    const consent    = document.getElementById('consent')?.checked;

    // Reset states
    nameInput.classList.remove('error', 'success');
    emailInput.classList.remove('error', 'success');
    passwordInput.classList.remove('error', 'success');
    document.getElementById('ageConsent')?.closest('.form-group-consent')?.classList.remove('consent-error');
    document.getElementById('consent')?.closest('.form-group-consent')?.classList.remove('consent-error');

    // Validation
    if (!name || !email || !password) {
        showMsg('Please fill in all required fields.');
        if (!name)     nameInput.classList.add('error');
        if (!email)    emailInput.classList.add('error');
        if (!password) passwordInput.classList.add('error');
        return;
    }

    if (!ageConsent) {
        showMsg('You must be at least 16 years old to register.');
        document.getElementById('ageConsent')?.closest('.form-group-consent')?.classList.add('consent-error');
        return;
    }

    if (!consent) {
        showMsg('Please agree to the Terms of Service and Privacy Policy.');
        document.getElementById('consent')?.closest('.form-group-consent')?.classList.add('consent-error');
        return;
    }

    if (!validateName(name)) {
        showMsg('Name must be at least 2 characters and contain only letters.');
        nameInput.classList.add('error');
        return;
    }

    if (!validateEmail(email)) {
        showMsg('Please enter a valid email address.');
        emailInput.classList.add('error');
        return;
    }

    if (!validatePassword(password)) {
        showMsg('Password must be at least 8 characters and contain letters and numbers.');
        passwordInput.classList.add('error');
        return;
    }

    // Loading state
    submitButton.disabled = true;
    submitButton.classList.add('loading');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Creating account...';

    try {
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, email, password })
        });

        const result = await response.json();

        if (response.ok) {
            nameInput.classList.add('success');
            emailInput.classList.add('success');
            passwordInput.classList.add('success');
            showMsg('Account created! Redirecting to login...', 'success');

            setTimeout(() => {
                window.location.href = '/auth/Auth.html';
            }, 1000);

        } else {
            // Handle specific errors
            let errorMessage = result.message || 'Server error. Please try again.';

            if (errorMessage.toLowerCase().includes('email') ||
                errorMessage.toLowerCase().includes('exists')) {
                errorMessage = 'This email is already registered.';
                emailInput.classList.add('error');
            }

            showMsg(errorMessage);
        }

    } catch (err) {
        console.error('Registration request failed:', err);
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
    window.location.href = '/auth/Auth.html';
});

document.getElementById('password')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('submit')?.click();
});

// ============================================
// Real-time password strength
// ============================================

document.getElementById('password')?.addEventListener('input', function () {
    const password = this.value;
    const el = document.getElementById('password-strength');
    if (!el) return;

    if (!password) { el.textContent = ''; return; }

    let score = 0;
    if (password.length >= 8)             score++;
    if (password.length >= 12)            score++;
    if (/[A-Z]/.test(password))           score++;
    if (/[0-9]/.test(password))           score++;
    if (/[^A-Za-z0-9]/.test(password))   score++;

    const levels = [
        { label: 'Too short',    color: '#ef4444' },
        { label: 'Weak',         color: '#ef4444' },
        { label: 'Fair',         color: '#f59e0b' },
        { label: 'Good',         color: '#10b981' },
        { label: 'Strong',       color: '#10b981' },
        { label: 'Very strong',  color: '#3b82f6' }
    ];

    const level = levels[Math.min(score, 5)];
    el.textContent = level.label;
    el.style.color = level.color;
});

// Real-time email validation
document.getElementById('email')?.addEventListener('blur', function () {
    const email = this.value.trim();
    if (email && !validateEmail(email)) {
        this.classList.add('error');
    } else if (email) {
        this.classList.remove('error');
    }
});