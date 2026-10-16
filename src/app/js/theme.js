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
        let saved = null;
        try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* storage blocked */ }
        if (saved === 'dark' || saved === 'light') return saved;
        // No saved choice: follow the system theme
        return window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : DEFAULT_THEME;
    }

    // Toggle between dark and light
    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
        updateButton(next);
    }

    // Update button label (the icon is part of the page markup)
    function updateButton(theme) {
        const btn = document.getElementById('themeToggleBtn');
        if (!btn) return;
        const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
        btn.title = label;
        btn.setAttribute('aria-label', label);
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