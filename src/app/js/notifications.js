(function () {
    const API = window.location.origin;

    const CAT = {
        info:        { label: 'Info',        color: '#3b82f6', bg: 'rgba(59,130,246,0.18)',  icon: 'ℹ' },
        update:      { label: 'Update',      color: '#10b981', bg: 'rgba(16,185,129,0.18)',  icon: '↑' },
        maintenance: { label: 'Maint.',      color: '#f59e0b', bg: 'rgba(245,158,11,0.18)',  icon: '⚙' },
        warning:     { label: 'Warning',     color: '#ef4444', bg: 'rgba(239,68,68,0.18)',   icon: '⚠' }
    };

    // ── Inject styles ──────────────────────────────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        :root {
            --nb-bg:      #1e2130;
            --nb-border:  rgba(255,255,255,0.10);
            --nb-text:    #e2e8f0;
            --nb-text2:   #94a3b8;
            --nb-hover:   rgba(255,255,255,0.05);
        }
        [data-theme="light"] {
            --nb-bg:      #ffffff;
            --nb-border:  rgba(0,0,0,0.10);
            --nb-text:    #1a202c;
            --nb-text2:   #718096;
            --nb-hover:   rgba(0,0,0,0.04);
        }
        #nb-wrap {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 9980;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 8px;
        }
        #nb-panel {
            width: 340px;
            max-height: 460px;
            background: var(--nb-bg);
            border: 1px solid var(--nb-border);
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.35);
            display: none;
            flex-direction: column;
            overflow: hidden;
        }
        #nb-panel.open { display: flex; }
        #nb-panel-head {
            padding: 13px 16px;
            border-bottom: 1px solid var(--nb-border);
            font-size: 13px;
            font-weight: 600;
            color: var(--nb-text);
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-shrink: 0;
        }
        #nb-panel-head span { opacity: 0.5; font-size: 11px; font-weight: 400; }
        #nb-list {
            overflow-y: auto;
            flex: 1;
        }
        #nb-empty {
            padding: 36px 16px;
            text-align: center;
            color: var(--nb-text2);
            font-size: 13px;
        }
        .nb-item {
            padding: 11px 16px;
            border-bottom: 1px solid var(--nb-border);
            transition: background 0.15s;
        }
        .nb-item:last-child { border-bottom: none; }
        .nb-item:hover { background: var(--nb-hover); }
        .nb-item-top {
            display: flex;
            align-items: center;
            gap: 7px;
            margin-bottom: 3px;
        }
        .nb-badge {
            font-size: 10px;
            font-weight: 600;
            padding: 1px 6px;
            border-radius: 4px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            flex-shrink: 0;
        }
        .nb-title {
            font-size: 13px;
            font-weight: 500;
            color: var(--nb-text);
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .nb-time {
            font-size: 10px;
            color: var(--nb-text2);
            white-space: nowrap;
            flex-shrink: 0;
        }
        .nb-msg {
            font-size: 12px;
            color: var(--nb-text2);
            line-height: 1.5;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }
        #nb-btn {
            width: 46px;
            height: 46px;
            border-radius: 50%;
            background: var(--nb-bg);
            border: 1px solid var(--nb-border);
            color: var(--nb-text);
            font-size: 19px;
            cursor: pointer;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 14px rgba(0,0,0,0.25);
            transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
            flex-shrink: 0;
        }
        #nb-btn:hover {
            transform: scale(1.08);
            border-color: #3b82f6;
            box-shadow: 0 4px 18px rgba(59,130,246,0.25);
        }
        #nb-badge {
            position: absolute;
            top: -3px;
            right: -3px;
            min-width: 18px;
            height: 18px;
            background: #ef4444;
            border-radius: 9px;
            font-size: 10px;
            font-weight: 700;
            color: #fff;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 0 4px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
        #nb-badge.visible { display: flex; }
        .nb-toast {
            position: fixed;
            top: 20px;
            right: 20px;
            min-width: 280px;
            max-width: 360px;
            padding: 13px 15px;
            background: var(--nb-bg);
            border: 1px solid var(--nb-border);
            border-radius: 10px;
            box-shadow: 0 6px 24px rgba(0,0,0,0.35);
            z-index: 9999;
            display: flex;
            gap: 10px;
            align-items: flex-start;
            animation: nb-slide 0.28s ease;
            cursor: pointer;
        }
        @keyframes nb-slide {
            from { transform: translateX(110%); opacity: 0; }
            to   { transform: translateX(0);   opacity: 1; }
        }
        .nb-toast-icon {
            font-size: 17px;
            flex-shrink: 0;
            margin-top: 1px;
        }
        .nb-toast-body { flex: 1; overflow: hidden; }
        .nb-toast-title {
            font-size: 13px;
            font-weight: 600;
            color: var(--nb-text);
            margin-bottom: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .nb-toast-msg {
            font-size: 12px;
            color: var(--nb-text2);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .nb-toast-close {
            font-size: 15px;
            color: var(--nb-text2);
            cursor: pointer;
            flex-shrink: 0;
            line-height: 1;
            opacity: 0.6;
        }
        .nb-toast-close:hover { opacity: 1; }
        @media (max-width: 480px) {
            #nb-panel { width: calc(100vw - 48px); }
        }
    `;
    document.head.appendChild(style);

    // ── State ──────────────────────────────────────────────────────────────
    let notifications = [];
    let panelOpen     = false;

    function getLastSeen() {
        return parseInt(localStorage.getItem('nb_last_seen') || '0', 10);
    }
    function setLastSeen(id) {
        localStorage.setItem('nb_last_seen', String(id));
    }
    function unreadCount() {
        const last = getLastSeen();
        return notifications.filter(n => n.id > last).length;
    }

    // ── DOM ────────────────────────────────────────────────────────────────
    const wrap  = document.createElement('div'); wrap.id = 'nb-wrap';
    const panel = document.createElement('div'); panel.id = 'nb-panel';
    panel.innerHTML = `
        <div id="nb-panel-head">
            Notifications
            <span id="nb-panel-sub">—</span>
        </div>
        <div id="nb-list"><div id="nb-empty">No notifications yet</div></div>
    `;
    const btn = document.createElement('button'); btn.id = 'nb-btn';
    btn.setAttribute('title', 'Notifications');
    btn.innerHTML = `◎<span id="nb-badge"></span>`;

    wrap.appendChild(panel);
    wrap.appendChild(btn);
    document.body.appendChild(wrap);

    const badgeEl   = document.getElementById('nb-badge');
    const listEl    = document.getElementById('nb-list');
    const emptyEl   = document.getElementById('nb-empty');
    const panelSub  = document.getElementById('nb-panel-sub');

    // ── Render ─────────────────────────────────────────────────────────────
    function renderList() {
        const last = getLastSeen();
        if (!notifications.length) {
            listEl.innerHTML = '<div id="nb-empty">No notifications yet</div>';
            return;
        }
        listEl.innerHTML = notifications.map(n => {
            const cat  = CAT[n.category] || CAT.info;
            const unread = n.id > last ? 'style="background:var(--nb-hover);"' : '';
            return `<div class="nb-item" ${unread}>
                <div class="nb-item-top">
                    <span class="nb-badge" style="background:${cat.bg};color:${cat.color};">${cat.label}</span>
                    <span class="nb-title">${escHtml(n.title)}</span>
                    <span class="nb-time">${timeAgo(n.created_at)}</span>
                </div>
                <div class="nb-msg">${escHtml(n.message)}</div>
            </div>`;
        }).join('');
        panelSub.textContent = `${notifications.length} total`;
    }

    function updateBadge() {
        const cnt = unreadCount();
        if (cnt > 0) {
            badgeEl.textContent = cnt > 9 ? '9+' : String(cnt);
            badgeEl.classList.add('visible');
        } else {
            badgeEl.classList.remove('visible');
        }
    }

    function prepend(notif) {
        notifications.unshift(notif);
        if (notifications.length > 50) notifications.pop();
        renderList();
        updateBadge();
    }

    // ── Toggle panel ───────────────────────────────────────────────────────
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
        if (panelOpen && !wrap.contains(e.target)) {
            panelOpen = false;
            panel.classList.remove('open');
        }
    });

    // ── Toast ──────────────────────────────────────────────────────────────
    function showToast(notif) {
        const cat = CAT[notif.category] || CAT.info;
        const el  = document.createElement('div');
        el.className = 'nb-toast';
        el.style.borderLeftColor = cat.color;
        el.style.borderLeftWidth = '3px';
        el.innerHTML = `
            <span class="nb-toast-icon" style="color:${cat.color};">${cat.icon}</span>
            <div class="nb-toast-body">
                <div class="nb-toast-title">${escHtml(notif.title)}</div>
                <div class="nb-toast-msg">${escHtml(notif.message)}</div>
            </div>
            <span class="nb-toast-close">✕</span>
        `;
        const dismiss = () => el.remove();
        el.querySelector('.nb-toast-close').addEventListener('click', dismiss);
        el.addEventListener('click', () => { dismiss(); panelOpen = true; panel.classList.add('open'); });
        document.body.appendChild(el);
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
        } catch { /* not logged in or network error — silent */ }
    }

    // ── Socket.IO real-time ────────────────────────────────────────────────
    async function connectSocket() {
        if (typeof io === 'undefined') return;
        try {
            const tokenRes = await fetch(`${API}/api/auth/token`, { credentials: 'include' });
            if (!tokenRes.ok) return;
            const { token } = await tokenRes.json();
            if (!token) return;

            const socket = io(API, {
                transports: ['websocket', 'polling'],
                auth: { token },
                path: '/socket.io/'
            });
            socket.on('admin-notification', notif => {
                prepend(notif);
                showToast(notif);
            });
        } catch { /* silent */ }
    }

    // ── Helpers ────────────────────────────────────────────────────────────
    function escHtml(str) {
        const d = document.createElement('div');
        d.textContent = String(str ?? '');
        return d.innerHTML;
    }

    function timeAgo(ts) {
        if (!ts) return '';
        const diff = Date.now() - new Date(ts).getTime();
        const m = Math.floor(diff / 60000);
        if (m < 1)  return 'just now';
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        return `${Math.floor(h / 24)}d ago`;
    }

    // ── Boot ───────────────────────────────────────────────────────────────
    loadHistory();
    connectSocket();
})();
