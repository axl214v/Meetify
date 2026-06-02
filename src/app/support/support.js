document.getElementById('sp-year').textContent = new Date().getFullYear();

function esc(str) {
    const d = document.createElement('div');
    d.textContent = String(str ?? '');
    return d.innerHTML;
}

function urlHost(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function renderGrid(containerId, links, isDonate) {
    const el = document.getElementById(containerId);
    if (!links.length) {
        el.innerHTML = `<div class="sp-empty">Nothing here yet</div>`;
        return;
    }
    el.innerHTML = links.map(l => `
        <a class="sp-card${isDonate ? ' sp-card-donate' : ''}" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">
            <div class="sp-card-icon">${esc(l.icon || '🔗')}</div>
            <div class="sp-card-body">
                <div class="sp-card-label">${esc(l.label)}</div>
                <div class="sp-card-url">${esc(urlHost(l.url))}</div>
            </div>
            <span class="sp-card-arrow">→</span>
        </a>
    `).join('');
}

async function loadLinks() {
    try {
        const res   = await fetch('/api/public/socials');
        const data  = await res.json();
        const links = data.links || [];

        const donate = links.filter(l => l.category === 'donate');
        const social = links.filter(l => l.category !== 'donate');

        renderGrid('donate-grid', donate, true);
        renderGrid('social-grid', social, false);

        // Hide empty sections
        if (!donate.length) document.getElementById('section-donate').style.display = 'none';
        if (!social.length) document.getElementById('section-social').style.display = 'none';
    } catch {
        document.getElementById('donate-grid').innerHTML = '<div class="sp-empty">Failed to load</div>';
        document.getElementById('social-grid').innerHTML = '<div class="sp-empty">Failed to load</div>';
    }
}

loadLinks();
