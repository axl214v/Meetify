(function () {
    if (localStorage.getItem('cookie_accepted')) return;

    const isDark = () => document.documentElement.getAttribute('data-theme') !== 'light';

    const banner = document.createElement('div');
    banner.id = 'cookie-banner';

    const applyTheme = () => {
        const dark = isDark();
        banner.style.cssText = `
            position: fixed;
            bottom: 1.25rem;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9999;
            width: min(640px, calc(100vw - 2rem));
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 0.9rem 1.1rem;
            border-radius: 14px;
            font-family: 'Outfit', sans-serif;
            font-size: 0.875rem;
            line-height: 1.55;
            backdrop-filter: blur(16px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.35);
            background: ${dark ? 'rgba(17,24,39,0.95)' : 'rgba(255,255,255,0.95)'};
            border: 1px solid ${dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)'};
            color: ${dark ? '#94a3b8' : '#475569'};
            animation: cookie-slide-in 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards;
        `;
    };

    const style = document.createElement('style');
    style.textContent = `
        @keyframes cookie-slide-in {
            from { opacity: 0; transform: translateX(-50%) translateY(16px); }
            to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes cookie-slide-out {
            from { opacity: 1; transform: translateX(-50%) translateY(0); }
            to   { opacity: 0; transform: translateX(-50%) translateY(16px); }
        }
        #cookie-banner a {
            color: #60a5fa;
            text-decoration: none;
        }
        #cookie-banner a:hover { text-decoration: underline; }
        #cookie-ok {
            flex-shrink: 0;
            padding: 0.48rem 1.15rem;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            font-family: inherit;
            font-size: 0.85rem;
            font-weight: 600;
            background: #3b82f6;
            color: #fff;
            transition: background 0.15s, transform 0.12s;
            white-space: nowrap;
        }
        #cookie-ok:hover { background: #2563eb; transform: translateY(-1px); }
        #cookie-ok:active { transform: translateY(0); }
    `;
    document.head.appendChild(style);

    const text = document.createElement('span');
    text.innerHTML = `
        🍪 We use a single session cookie (<code style="
            font-size:0.78em;background:rgba(255,255,255,0.08);
            border:1px solid rgba(255,255,255,0.12);border-radius:4px;
            padding:0.1em 0.35em;font-family:monospace">token</code>)
        required for authentication. No tracking, no ads.
        <a href="/legal/privacy.html" target="_blank">Privacy Policy</a>
    `;

    const btn = document.createElement('button');
    btn.id = 'cookie-ok';
    btn.textContent = 'Got it';
    btn.addEventListener('click', () => {
        localStorage.setItem('cookie_accepted', '1');
        banner.style.animation = 'cookie-slide-out 0.25s ease forwards';
        setTimeout(() => banner.remove(), 260);
    });

    banner.appendChild(text);
    banner.appendChild(btn);

    applyTheme();

    // Re-apply on theme toggle (in case user switches theme before clicking OK)
    const observer = new MutationObserver(applyTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Add to DOM after page is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => document.body.appendChild(banner));
    } else {
        document.body.appendChild(banner);
    }
})();
