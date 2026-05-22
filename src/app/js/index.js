// ============================================
// index.js — Landing page logic
// ============================================

const API_BASE = window.location.origin;

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h uptime`;
    if (h > 0) return `${h}h ${m}m uptime`;
    return `${m}m uptime`;
}

async function loadServerStatus() {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    try {
        const res = await fetch(`${API_BASE}/api/health`);
        if (res.ok) {
            const data = await res.json();
            dot.classList.add('online');
            text.textContent = `Online · ${formatUptime(Math.floor(data.uptime))}`;
        } else {
            dot.classList.add('offline');
            text.textContent = 'Server unavailable';
        }
    } catch {
        dot.classList.add('offline');
        text.textContent = 'Server unavailable';
    }
}

document.addEventListener('DOMContentLoaded', async () => {

    loadServerStatus();

    // Check auth and update nav accordingly
    try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
            credentials: 'include'
        });

        if (res.ok) {
            const data = await res.json();
            const user = data.user;

            // Show logged-in nav
            document.getElementById('navGuest').classList.add('hidden');
            document.getElementById('navUser').classList.remove('hidden');

            // Fill user name and avatar initials
            document.getElementById('navUserName').textContent =
                user.username || user.email;

            const initials = getInitials(user.username || user.email);
            document.getElementById('navAvatar').textContent = initials;

            // If user has avatar — show image instead
            if (user.avatar_url) {
                const avatar = document.getElementById('navAvatar');
                avatar.style.backgroundImage = `url(${user.avatar_url})`;
                avatar.style.backgroundSize = 'cover';
                avatar.style.backgroundPosition = 'center';
                avatar.textContent = '';
            }

            // CTA goes to conferences when logged in
            document.getElementById('heroCta').addEventListener('click', () => {
                window.location.href = '/Conf/pages/conf.html';
            });

            // Hide login button in hero since user is logged in
            document.querySelector('.hero-secondary').style.display = 'none';

        } else {
            // Not logged in — show guest nav
            document.getElementById('navGuest').classList.remove('hidden');
            document.getElementById('navUser').classList.add('hidden');

            // CTA goes to register
            document.getElementById('heroCta').addEventListener('click', () => {
                window.location.href = '/auth/Reg.html';
            });
        }
    } catch (err) {
        console.warn('Auth check failed:', err.message);

        // Show guest nav on error
        document.getElementById('navGuest').classList.remove('hidden');
        document.getElementById('navUser').classList.add('hidden');

        document.getElementById('heroCta').addEventListener('click', () => {
            window.location.href = '/auth/Reg.html';
        });
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