// ============================================
// Theme Switcher
// Saves preference to localStorage
// Apply on all pages by including this script
// ============================================

(function () {
    const STORAGE_KEY = 'meetify-theme';
    const DEFAULT_THEME = 'dark';

    // Apply theme immediately to avoid flash
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
    }

    // Get saved theme or default
    function getSavedTheme() {
        return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
    }

    // Toggle between dark and light
    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        localStorage.setItem(STORAGE_KEY, next);
        updateButton(next);
    }

    // Update button icon and label
    function updateButton(theme) {
        const btn = document.getElementById('themeToggleBtn');
        if (!btn) return;
        btn.textContent = theme === 'dark' ? '☀️' : '🌙';
        btn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    }

    // Apply saved theme on load
    applyTheme(getSavedTheme());

    // Setup button after DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        updateButton(getSavedTheme());

        const btn = document.getElementById('themeToggleBtn');
        if (btn) {
            btn.addEventListener('click', toggleTheme);
        }
    });
})();