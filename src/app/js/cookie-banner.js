(function () {
    try { if (localStorage.getItem('cookie_accepted')) return; } catch { /* storage blocked: show banner */ }

    // Shared across all pages, including ones not yet on tokens.css, so every
    // var() carries its graphite fallback.
    const style = document.createElement('style');
    style.textContent = `
        #cookie-banner {
            position: fixed; z-index: 9999;
            left: 16px; right: 16px; bottom: 16px;
            max-width: 520px;
            display: flex; align-items: center; gap: 16px;
            padding: 12px 16px;
            background: var(--surface, #181b1e);
            color: var(--text-2, #a0a7b0);
            border: 1px solid var(--border-strong, #3a4148);
            border-radius: 16px;
            box-shadow: var(--shadow-overlay, 0 8px 24px rgba(0,0,0,0.45));
            font: 13px/1.5 'Geist', system-ui, sans-serif;
        }
        #cookie-banner a { color: var(--accent-text, #7aa7fa); text-decoration: underline; text-underline-offset: 3px; }
        #cookie-banner code { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 0.92em; color: var(--text, #e6e8eb); }
        #cookie-ok {
            flex: none; height: 30px; padding: 0 12px;
            border: 1px solid var(--border-strong, #3a4148); border-radius: 10px;
            background: var(--surface-2, #1f2327); color: var(--text, #e6e8eb);
            font: 500 13px/1 'Geist', system-ui, sans-serif; cursor: pointer;
        }
        #cookie-ok:hover { background: var(--surface-3, #272c31); }
        #cookie-ok:focus-visible { outline: 2px solid var(--accent-hover, #5a90f8); outline-offset: 2px; }
    `;
    document.head.appendChild(style);

    const banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie notice');

    const text = document.createElement('span');
    text.innerHTML = `
        Meetify sets one session cookie, <code>token</code>, to keep you signed in.
        No tracking, no ads. <a href="/legal/privacy.html" target="_blank" rel="noopener">Privacy policy</a>
    `;

    const btn = document.createElement('button');
    btn.id = 'cookie-ok';
    btn.type = 'button';
    btn.textContent = 'Got it';
    btn.addEventListener('click', () => {
        try { localStorage.setItem('cookie_accepted', '1'); } catch { /* ignore */ }
        banner.remove();
    });

    banner.append(text, btn);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => document.body.appendChild(banner));
    } else {
        document.body.appendChild(banner);
    }
})();
