// ============================================
// index.js — Landing page logic
// ============================================

const API_BASE = window.location.origin;

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return m > 0 ? `${m}m` : 'under a minute';
}

async function loadServerStatus() {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    try {
        const res = await fetch(`${API_BASE}/api/health`);
        if (!res.ok) throw new Error(res.status);
        const data = await res.json();
        dot.classList.add('online');
        text.textContent = `Server online, up ${formatUptime(Math.floor(data.uptime))}`;
    } catch {
        dot.classList.add('offline');
        text.textContent = 'Server unavailable';
    }
}

function showUserNav(user) {
    const name = user.username || user.email;
    const avatar = document.getElementById('navAvatar');

    if (user.avatar_url) {
        avatar.textContent = '';
        const img = document.createElement('img');
        img.src = user.avatar_url;
        img.alt = '';
        avatar.appendChild(img);
    } else {
        avatar.textContent = getInitials(name);
    }
    document.getElementById('navAvatar').parentElement.title = name;
    document.getElementById('navGuest').classList.add('hidden');
    document.getElementById('navUser').classList.remove('hidden');
}

function showGuestNav() {
    // Guests cannot create or join rooms: the two hero actions become account actions
    const cta = document.getElementById('heroCta');
    cta.textContent = 'Create account';
    cta.href = '/auth/Reg.html';
    const second = document.getElementById('heroSecondary');
    second.textContent = 'Sign in';
    second.href = '/auth/Auth.html';
    document.getElementById('navGuest').classList.remove('hidden');
    document.getElementById('navUser').classList.add('hidden');
}

// One reveal pattern: fade up once when a block scrolls into view
function setupReveal() {
    const items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
        items.forEach((el) => el.classList.add('in'));
        return;
    }
    const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
            if (e.isIntersecting) {
                e.target.classList.add('in');
                io.unobserve(e.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach((el) => io.observe(el));
}

document.addEventListener('DOMContentLoaded', async () => {
    setupReveal();
    loadServerStatus();

    try {
        const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
        if (!res.ok) throw new Error(res.status);
        const data = await res.json();
        showUserNav(data.user);
    } catch {
        showGuestNav();
    }
});

// ============================================
// Helpers
// ============================================

function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
