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
        const crypto = links.filter(l => l.category === 'crypto');
        const social = links.filter(l => l.category !== 'donate' && l.category !== 'crypto');

        renderGrid('donate-grid', donate, true);
        renderGrid('social-grid', social, false);
        renderCrypto('crypto-grid', crypto);

        if (!donate.length) document.getElementById('section-donate').style.display = 'none';
        if (!crypto.length) document.getElementById('section-crypto').style.display = 'none';
    } catch {
        document.getElementById('donate-grid').innerHTML = '<div class="sp-empty">Failed to load</div>';
        document.getElementById('social-grid').innerHTML = '<div class="sp-empty">Failed to load</div>';
        document.getElementById('crypto-grid').innerHTML = '<div class="sp-empty">Failed to load</div>';
    }
}

// ── Crypto ──────────────────────────────────────────────────────────
let cryptoItems = [];

function renderCrypto(containerId, items) {
    cryptoItems = items;
    const el = document.getElementById(containerId);
    if (!items.length) {
        el.innerHTML = `<div class="sp-empty">Nothing here yet</div>`;
        return;
    }
    el.innerHTML = items.map((c, i) => `
        <div class="sp-crypto-card">
            <div class="sp-crypto-head">
                <div class="sp-card-icon">${esc(c.icon || '🪙')}</div>
                <div class="sp-crypto-meta">
                    <div class="sp-card-label">${esc(c.label)}</div>
                    ${c.network ? `<div class="sp-crypto-net">${esc(c.network)}</div>` : ''}
                </div>
            </div>
            <div class="sp-crypto-addr">${esc(c.address)}</div>
            <div class="sp-crypto-actions">
                <button class="sp-crypto-btn" data-copy="${i}">📋 Copy</button>
                <button class="sp-crypto-btn sp-crypto-btn-primary" data-qr="${i}">▦ QR</button>
            </div>
        </div>
    `).join('');

    el.querySelectorAll('[data-copy]').forEach(btn =>
        btn.addEventListener('click', () => copyText(cryptoItems[+btn.dataset.copy].address, btn)));
    el.querySelectorAll('[data-qr]').forEach(btn =>
        btn.addEventListener('click', () => openQR(cryptoItems[+btn.dataset.qr])));
}

function copyText(text, btn) {
    const done = () => {
        if (!btn) return;
        const old = btn.innerHTML;
        btn.classList.add('copied');
        btn.innerHTML = '✓ Copied';
        setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = old; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
        fallbackCopy(text, done);
    }
}

function fallbackCopy(text, cb) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); if (cb) cb(); } catch {}
    document.body.removeChild(ta);
}

// ── QR modal ──
function openQR(item) {
    if (!item) return;
    document.getElementById('qrTitle').textContent = item.label;
    document.getElementById('qrNet').textContent   = item.network || '';
    document.getElementById('qrAddr').textContent  = item.address;

    const holder = document.getElementById('qrImg');
    try {
        const qr = qrcode(0, 'M');
        qr.addData(item.address);
        qr.make();
        holder.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    } catch (e) {
        holder.innerHTML = '<span style="font-size:12px;color:#888;">QR error</span>';
    }

    const copyBtn = document.getElementById('qrCopy');
    copyBtn.onclick = () => copyText(item.address, copyBtn);

    document.getElementById('qrModal').classList.add('open');
}

function closeQR() {
    document.getElementById('qrModal').classList.remove('open');
}

document.getElementById('qrClose').addEventListener('click', closeQR);
document.getElementById('qrModal').addEventListener('click', e => {
    if (e.target.id === 'qrModal') closeQR();
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeQR();
});

loadLinks();
