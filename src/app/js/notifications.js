(function () {
    'use strict';
    const API = window.location.origin;

    const CAT = {
        info:        { label: 'Info',        color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
        update:      { label: 'Update',      color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
        maintenance: { label: 'Maintenance', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
        warning:     { label: 'Warning',     color: '#f87171', bg: 'rgba(248,113,113,0.12)' }
    };

    // ── Styles ─────────────────────────────────────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        /* dark = default (project default) */
        :root {
            --nb-bg:       #0d1220;
            --nb-surface:  #111827;
            --nb-border:   rgba(255,255,255,0.08);
            --nb-border-h: rgba(255,255,255,0.14);
            --nb-text:     #f1f5f9;
            --nb-text2:    #94a3b8;
            --nb-text3:    #475569;
            --nb-hover:    rgba(255,255,255,0.04);
            --nb-accent:   #3b82f6;
            --nb-accent2:  #6366f1;
            --nb-danger:   #ef4444;
        }
        html[data-theme="light"] {
            --nb-bg:       #ffffff;
            --nb-surface:  #f8fafc;
            --nb-border:   rgba(0,0,0,0.08);
            --nb-border-h: rgba(0,0,0,0.15);
            --nb-text:     #0f172a;
            --nb-text2:    #64748b;
            --nb-text3:    #94a3b8;
            --nb-hover:    rgba(0,0,0,0.03);
            --nb-accent:   #3b82f6;
            --nb-accent2:  #6366f1;
            --nb-danger:   #ef4444;
        }

        /* ── Container ── */
        #nb-wrap {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 9980;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 8px;
            font-family: 'Outfit', system-ui, sans-serif;
            pointer-events: none;
        }

        /* ── Panel ── */
        #nb-panel {
            width: 356px;
            max-height: 480px;
            background: var(--nb-bg);
            border: 1px solid var(--nb-border);
            border-radius: 16px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2), 0 16px 48px rgba(0,0,0,0.55);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transform-origin: bottom right;
            transform: translateY(8px) scale(0.97);
            opacity: 0;
            pointer-events: none;
            transition: transform 0.22s cubic-bezier(0.4,0,0.2,1),
                        opacity   0.18s ease;
        }
        #nb-panel.open {
            transform: translateY(0) scale(1);
            opacity: 1;
            pointer-events: auto;
        }

        /* Accent line */
        #nb-accent {
            height: 2px;
            flex-shrink: 0;
            background: linear-gradient(90deg, var(--nb-accent), var(--nb-accent2));
        }

        /* Header */
        #nb-hd {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 13px 16px;
            border-bottom: 1px solid var(--nb-border);
            flex-shrink: 0;
        }
        #nb-hd-title {
            font-size: 13px;
            font-weight: 600;
            color: var(--nb-text);
            letter-spacing: 0.01em;
        }
        #nb-hd-meta {
            font-size: 11px;
            font-weight: 500;
            color: var(--nb-text3);
            background: var(--nb-hover);
            border: 1px solid var(--nb-border);
            border-radius: 99px;
            padding: 2px 10px;
        }

        /* List */
        #nb-list {
            overflow-y: auto;
            flex: 1;
            scrollbar-width: thin;
            scrollbar-color: var(--nb-border-h) transparent;
        }
        #nb-list::-webkit-scrollbar       { width: 3px; }
        #nb-list::-webkit-scrollbar-thumb { background: var(--nb-border-h); border-radius: 2px; }

        /* Empty state */
        #nb-empty {
            padding: 44px 20px;
            text-align: center;
        }
        #nb-empty-ring {
            width: 44px;
            height: 44px;
            margin: 0 auto 12px;
            border-radius: 50%;
            border: 1px solid var(--nb-border-h);
            background: var(--nb-surface);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--nb-text3);
        }
        #nb-empty-title { font-size: 13px; font-weight: 600; color: var(--nb-text2); margin-bottom: 3px; }
        #nb-empty-sub   { font-size: 12px; color: var(--nb-text3); }

        /* Items */
        .nb-item {
            padding: 11px 16px;
            border-bottom: 1px solid var(--nb-border);
            border-left: 2px solid transparent;
            transition: background 0.15s;
            cursor: default;
        }
        .nb-item:last-child { border-bottom: none; }
        .nb-item:hover      { background: var(--nb-hover); }
        .nb-item-top {
            display: flex;
            align-items: center;
            gap: 7px;
            margin-bottom: 4px;
        }
        .nb-cat {
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.07em;
            text-transform: uppercase;
            padding: 2px 7px;
            border-radius: 99px;
            flex-shrink: 0;
        }
        .nb-title {
            font-size: 13px;
            font-weight: 500;
            color: var(--nb-text);
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .nb-time { font-size: 10px; color: var(--nb-text3); flex-shrink: 0; }
        .nb-msg  {
            font-size: 12px;
            color: var(--nb-text2);
            line-height: 1.5;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        /* ── Bell button ── */
        #nb-btn {
            pointer-events: auto;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: var(--nb-bg);
            border: 1px solid var(--nb-border-h);
            color: var(--nb-text2);
            cursor: pointer;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.2);
            transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1),
                        border-color 0.18s,
                        color        0.18s,
                        box-shadow   0.18s;
        }
        #nb-btn:hover {
            transform: scale(1.1);
            border-color: var(--nb-accent);
            color: var(--nb-accent);
            box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 16px rgba(59,130,246,0.2);
        }
        #nb-btn.has-unread {
            border-color: rgba(59,130,246,0.45);
            color: var(--nb-accent);
        }

        /* Bell ring */
        @keyframes nb-ring {
            0%,100% { transform: rotate(0);    }
            15%     { transform: rotate(14deg); }
            30%     { transform: rotate(-8deg); }
            45%     { transform: rotate(10deg); }
            60%     { transform: rotate(-4deg); }
            75%     { transform: rotate(4deg);  }
        }
        #nb-btn.ringing #nb-icon { animation: nb-ring 0.5s ease; }

        /* Badge */
        #nb-dot {
            position: absolute;
            top: -1px;
            right: -1px;
            min-width: 18px;
            height: 18px;
            padding: 0 5px;
            background: var(--nb-danger);
            border-radius: 9px;
            font-size: 9px;
            font-weight: 700;
            color: #fff;
            display: none;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(239,68,68,0.5);
        }
        #nb-dot.on {
            display: flex;
            animation: nb-pop 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes nb-pop {
            from { transform: scale(0); opacity: 0; }
            to   { transform: scale(1); opacity: 1; }
        }

        /* ── Toast container ── */
        #nb-toasts {
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 8px;
            pointer-events: none;
        }
        .nb-toast {
            pointer-events: auto;
            width: 308px;
            background: var(--nb-bg);
            border: 1px solid var(--nb-border-h);
            border-radius: 12px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.4), 0 12px 36px rgba(0,0,0,0.3);
            display: flex;
            align-items: stretch;
            overflow: hidden;
            position: relative;
            cursor: pointer;
            font-family: 'Outfit', system-ui, sans-serif;
            animation: nb-tin 0.3s cubic-bezier(0.4,0,0.2,1) forwards;
        }
        .nb-toast.nb-tout { animation: nb-tout 0.2s ease-in forwards; }
        @keyframes nb-tin  { from { transform: translateX(108%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes nb-tout { from { transform: translateX(0); opacity: 1; }    to { transform: translateX(108%); opacity: 0; } }
        .nb-toast-stripe  { width: 3px; flex-shrink: 0; }
        .nb-toast-body    { padding: 11px 12px; flex: 1; min-width: 0; }
        .nb-toast-cat     { font-size: 9px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 3px; }
        .nb-toast-title   { font-size: 13px; font-weight: 600; color: var(--nb-text); line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .nb-toast-msg     { font-size: 11px; color: var(--nb-text2); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .nb-toast-x       { width: 36px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--nb-text3); flex-shrink: 0; transition: color 0.15s; }
        .nb-toast-x:hover { color: var(--nb-text); }
        .nb-toast-bar     { position: absolute; bottom: 0; left: 0; height: 2px; opacity: 0.4; animation: nb-bar 6s linear forwards; }
        @keyframes nb-bar { from { width: 100%; } to { width: 0; } }

        /* ── Modal ── */
        #nb-modal-overlay {
            position: fixed;
            inset: 0;
            z-index: 10000;
            background: rgba(0,0,0,0.55);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease;
        }
        #nb-modal-overlay.open {
            opacity: 1;
            pointer-events: auto;
        }
        #nb-modal {
            width: min(480px, calc(100vw - 32px));
            background: var(--nb-bg);
            border: 1px solid var(--nb-border-h);
            border-radius: 18px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 32px 80px rgba(0,0,0,0.4);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transform: scale(0.94) translateY(8px);
            transition: transform 0.22s cubic-bezier(0.4,0,0.2,1);
            font-family: 'Outfit', system-ui, sans-serif;
        }
        #nb-modal-overlay.open #nb-modal {
            transform: scale(1) translateY(0);
        }
        #nb-modal-stripe { height: 3px; flex-shrink: 0; }
        #nb-modal-hd {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            padding: 18px 20px 14px;
            gap: 12px;
        }
        #nb-modal-hd-left { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; }
        #nb-modal-cat {
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            padding: 2px 8px;
            border-radius: 99px;
            align-self: flex-start;
        }
        #nb-modal-title {
            font-size: 15px;
            font-weight: 600;
            color: var(--nb-text);
            line-height: 1.35;
            word-break: break-word;
        }
        #nb-modal-close {
            width: 30px;
            height: 30px;
            border-radius: 8px;
            background: var(--nb-hover);
            border: 1px solid var(--nb-border);
            color: var(--nb-text3);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            flex-shrink: 0;
            transition: background 0.15s, color 0.15s;
        }
        #nb-modal-close:hover { background: var(--nb-border); color: var(--nb-text); }
        #nb-modal-body {
            padding: 0 20px 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        #nb-modal-divider { height: 1px; background: var(--nb-border); }
        #nb-modal-msg {
            font-size: 13px;
            color: var(--nb-text2);
            line-height: 1.65;
            word-break: break-word;
            white-space: pre-wrap;
            max-height: 40vh;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: var(--nb-border-h) transparent;
        }
        #nb-modal-msg::-webkit-scrollbar       { width: 3px; }
        #nb-modal-msg::-webkit-scrollbar-thumb { background: var(--nb-border-h); border-radius: 2px; }
        #nb-modal-time {
            font-size: 11px;
            color: var(--nb-text3);
        }

        .nb-item { cursor: pointer; }

        @media (max-width: 480px) {
            #nb-panel { width: calc(100vw - 48px); }
            .nb-toast { width: calc(100vw - 32px); }
        }
    `;
    document.head.appendChild(style);

    // ── State ──────────────────────────────────────────────────────────────
    let notifications = [];
    let panelOpen     = false;

    const getLastSeen = () => parseInt(localStorage.getItem('nb_last_seen') || '0', 10);
    const setLastSeen = id  => localStorage.setItem('nb_last_seen', String(id));
    const unreadCount = ()  => notifications.filter(n => n.id > getLastSeen()).length;

    // ── DOM ────────────────────────────────────────────────────────────────
    const wrap    = Object.assign(document.createElement('div'),    { id: 'nb-wrap' });
    const panel   = Object.assign(document.createElement('div'),    { id: 'nb-panel' });
    const btn     = Object.assign(document.createElement('button'), { id: 'nb-btn'   });
    const tbox    = Object.assign(document.createElement('div'),    { id: 'nb-toasts' });
    const overlay = Object.assign(document.createElement('div'),    { id: 'nb-modal-overlay' });

    overlay.innerHTML = `
        <div id="nb-modal">
            <div id="nb-modal-stripe"></div>
            <div id="nb-modal-hd">
                <div id="nb-modal-hd-left">
                    <span id="nb-modal-cat"></span>
                    <div id="nb-modal-title"></div>
                </div>
                <button id="nb-modal-close" aria-label="Close">✕</button>
            </div>
            <div id="nb-modal-body">
                <div id="nb-modal-divider"></div>
                <div id="nb-modal-msg"></div>
                <div id="nb-modal-time"></div>
            </div>
        </div>`;

    panel.innerHTML = `
        <div id="nb-accent"></div>
        <div id="nb-hd">
            <span id="nb-hd-title">Notifications</span>
            <span id="nb-hd-meta">—</span>
        </div>
        <div id="nb-list">
            <div id="nb-empty">
                <div id="nb-empty-ring">${BELL_SVG(18)}</div>
                <div id="nb-empty-title">No notifications yet</div>
                <div id="nb-empty-sub">You're all caught up</div>
            </div>
        </div>`;

    btn.setAttribute('aria-label', 'Notifications');
    btn.innerHTML = `${BELL_SVG(17, 'nb-icon')}<span id="nb-dot"></span>`;

    wrap.append(panel, btn);
    document.body.append(wrap, tbox, overlay);

    const dotEl     = document.getElementById('nb-dot');
    const listEl    = document.getElementById('nb-list');
    const metaEl    = document.getElementById('nb-hd-meta');
    const modalClose = document.getElementById('nb-modal-close');

    function BELL_SVG(size, id) {
        const idAttr = id ? ` id="${id}"` : '';
        return `<svg${idAttr} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>`;
    }

    // ── Render ─────────────────────────────────────────────────────────────
    function renderList() {
        if (!notifications.length) {
            listEl.innerHTML = `<div id="nb-empty">
                <div id="nb-empty-ring">${BELL_SVG(18)}</div>
                <div id="nb-empty-title">No notifications yet</div>
                <div id="nb-empty-sub">You're all caught up</div>
            </div>`;
            metaEl.textContent = '—';
            return;
        }
        const last   = getLastSeen();
        const unread = notifications.filter(n => n.id > last).length;
        metaEl.textContent = unread > 0 ? `${unread} new` : `${notifications.length} total`;

        listEl.innerHTML = notifications.map(n => {
            const cat   = CAT[n.category] || CAT.info;
            const isNew = n.id > last;
            return `<div class="nb-item" data-id="${n.id}" style="border-left-color:${isNew ? cat.color : 'transparent'}">
                <div class="nb-item-top">
                    <span class="nb-cat" style="background:${cat.bg};color:${cat.color};">${cat.label}</span>
                    <span class="nb-title">${esc(n.title)}</span>
                    <span class="nb-time">${ago(n.created_at)}</span>
                </div>
                <div class="nb-msg">${esc(n.message)}</div>
            </div>`;
        }).join('');

        listEl.querySelectorAll('.nb-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = parseInt(el.dataset.id, 10);
                const notif = notifications.find(n => n.id === id);
                if (notif) openModal(notif);
            });
        });
    }

    function updateBadge() {
        const cnt = unreadCount();
        btn.classList.toggle('has-unread', cnt > 0);
        if (cnt > 0) {
            dotEl.textContent = cnt > 9 ? '9+' : String(cnt);
            dotEl.classList.add('on');
        } else {
            dotEl.classList.remove('on');
        }
    }

    function prepend(notif) {
        notifications.unshift(notif);
        if (notifications.length > 50) notifications.pop();
        btn.classList.remove('ringing');
        void btn.offsetWidth;
        btn.classList.add('ringing');
        btn.addEventListener('animationend', () => btn.classList.remove('ringing'), { once: true });
        renderList();
        updateBadge();
    }

    // ── Modal ──────────────────────────────────────────────────────────────
    function openModal(notif) {
        const cat = CAT[notif.category] || CAT.info;
        document.getElementById('nb-modal-stripe').style.background = cat.color;
        document.getElementById('nb-modal-cat').textContent  = cat.label;
        document.getElementById('nb-modal-cat').style.background = cat.bg;
        document.getElementById('nb-modal-cat').style.color  = cat.color;
        document.getElementById('nb-modal-title').textContent = notif.title || '';
        document.getElementById('nb-modal-msg').textContent   = notif.message || '';
        document.getElementById('nb-modal-time').textContent  = notif.created_at
            ? new Date(notif.created_at).toLocaleString() : '';
        overlay.classList.add('open');
    }

    function closeModal() { overlay.classList.remove('open'); }

    modalClose.addEventListener('click', closeModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

    // ── Panel toggle ───────────────────────────────────────────────────────
    btn.addEventListener('click', () => {
        panelOpen = !panelOpen;
        panel.classList.toggle('open', panelOpen);
        if (panelOpen && notifications.length) {
            const maxId = Math.max(...notifications.map(n => n.id));
            setLastSeen(maxId);
            updateBadge();
            renderList();
        }
    });

    document.addEventListener('click', e => {
        if (panelOpen && !wrap.contains(e.target) && !overlay.contains(e.target)) {
            panelOpen = false;
            panel.classList.remove('open');
        }
    });

    // ── Toast ──────────────────────────────────────────────────────────────
    function showToast(notif) {
        const cat = CAT[notif.category] || CAT.info;
        const el  = document.createElement('div');
        el.className = 'nb-toast';
        el.innerHTML = `
            <div class="nb-toast-stripe" style="background:${cat.color};"></div>
            <div class="nb-toast-body">
                <div class="nb-toast-cat" style="color:${cat.color};">${cat.label}</div>
                <div class="nb-toast-title">${esc(notif.title)}</div>
                <div class="nb-toast-msg">${esc(notif.message)}</div>
            </div>
            <div class="nb-toast-x" role="button" aria-label="Dismiss">✕</div>
            <div class="nb-toast-bar" style="background:${cat.color};"></div>`;
        const dismiss = () => {
            el.classList.add('nb-tout');
            el.addEventListener('animationend', () => el.remove(), { once: true });
        };
        el.querySelector('.nb-toast-x').addEventListener('click', e => { e.stopPropagation(); dismiss(); });
        el.addEventListener('click', () => { dismiss(); panelOpen = true; panel.classList.add('open'); });
        tbox.appendChild(el);
        setTimeout(dismiss, 6000);
    }

    // ── Load history ───────────────────────────────────────────────────────
    async function loadHistory() {
        try {
            const res = await fetch(`${API}/api/notifications`, { credentials: 'include' });
            if (!res.ok) return;
            const data = await res.json();
            notifications = data.notifications || [];
            renderList();
            updateBadge();
        } catch { /* silent */ }
    }

    // ── Socket ─────────────────────────────────────────────────────────────
    async function connectSocket() {
        if (typeof io === 'undefined') return;
        try {
            const r = await fetch(`${API}/api/auth/token`, { credentials: 'include' });
            if (!r.ok) return;
            const { token } = await r.json();
            if (!token) return;
            const socket = io(API, { transports: ['websocket', 'polling'], auth: { token }, path: '/socket.io/' });
            socket.on('admin-notification', notif => { prepend(notif); showToast(notif); });
        } catch { /* silent */ }
    }

    // ── Helpers ────────────────────────────────────────────────────────────
    function esc(str) {
        const d = document.createElement('div');
        d.textContent = String(str ?? '');
        return d.innerHTML;
    }

    function ago(ts) {
        if (!ts) return '';
        const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
        if (m < 1)  return 'now';
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        return `${Math.floor(h / 24)}d ago`;
    }

    // ── Boot ───────────────────────────────────────────────────────────────
    loadHistory();
    connectSocket();
})();
