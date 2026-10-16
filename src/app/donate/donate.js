const yearEl = document.getElementById('sp-year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

function esc(str) {
    const d = document.createElement('div');
    d.textContent = String(str ?? '');
    return d.innerHTML;
}

function urlHost(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function renderGrid(containerId, links) {
    const el = document.getElementById(containerId);
    if (!links.length) {
        el.innerHTML = `<p class="muted-pad">Nothing here yet.</p>`;
        return;
    }
    el.innerHTML = links.map(l => `
        <a class="link-row" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">
            <span class="link-label">${esc(l.label)}</span>
            <span class="link-sub">${esc(urlHost(l.url))}</span>
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

        renderGrid('donate-grid', donate);
        renderGrid('social-grid', social, false);
        renderCrypto('crypto-grid', crypto);

        if (!donate.length) document.getElementById('section-donate').style.display = 'none';
        if (!crypto.length) document.getElementById('section-crypto').style.display = 'none';
    } catch {
        document.getElementById('donate-grid').innerHTML = '<p class="muted-pad">Could not load. Try again later.</p>';
        document.getElementById('social-grid').innerHTML = '<p class="muted-pad">Could not load. Try again later.</p>';
        document.getElementById('crypto-grid').innerHTML = '<p class="muted-pad">Could not load. Try again later.</p>';
    }
}

// ── Crypto ──────────────────────────────────────────────────────────
let cryptoItems = [];

function renderCrypto(containerId, items) {
    cryptoItems = items;
    const el = document.getElementById(containerId);
    if (!items.length) {
        el.innerHTML = `<p class="muted-pad">Nothing here yet.</p>`;
        return;
    }
    el.innerHTML = items.map((c, i) => `
        <div class="crypto-row">
            <div class="crypto-head">
                <span class="link-label">${esc(c.label)}</span>
                ${c.network ? `<span class="badge">${esc(c.network)}</span>` : ''}
            </div>
            <div class="crypto-addr">${esc(c.address)}</div>
            <div class="crypto-actions">
                <button class="btn btn-sm" data-copy="${i}" type="button">Copy</button>
                <button class="btn btn-sm" data-qr="${i}" type="button">QR code</button>
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
        btn.textContent = 'Copied';
        setTimeout(() => { btn.innerHTML = old; }, 1600);
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
        holder.innerHTML = '<span style="font-size:12px;color:#555;">QR error</span>';
    }

    const copyBtn = document.getElementById('qrCopy');
    copyBtn.onclick = () => copyText(item.address, copyBtn);

    document.getElementById('qrModal').classList.remove('hidden');
}

function closeQR() {
    document.getElementById('qrModal').classList.add('hidden');
}

document.getElementById('qrClose').addEventListener('click', closeQR);
document.getElementById('qrModal').addEventListener('click', e => {
    if (e.target.id === 'qrModal') closeQR();
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeQR();
});

loadLinks();
