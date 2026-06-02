const API = window.location.origin;
let currentUser = null;

function esc(str) {
    const d = document.createElement('div');
    d.textContent = String(str ?? '');
    return d.innerHTML;
}

function timeAgo(ts) {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const STATUS_LABEL = { open: 'Open', in_progress: 'In Progress', closed: 'Closed' };
const CAT_LABEL    = { technical: 'Technical', account: 'Account', general: 'General', other: 'Other' };

async function init() {
    try {
        const res  = await fetch(API + '/api/auth/me', { credentials: 'include' });
        const data = await res.json();
        if (!res.ok || !data.user) { showAuthWall(); return; }
        currentUser = data.user;
        document.getElementById('navAuthBtn')?.remove();
        showTicketsView();
    } catch {
        showAuthWall();
    }
}

function showAuthWall() {
    document.getElementById('authWall').style.display = 'block';
}

function showTicketsView() {
    document.getElementById('authWall').style.display = 'none';
    document.getElementById('ticketsView').style.display = 'block';
    loadTickets();

    document.getElementById('newTicketToggle').addEventListener('click', () => {
        document.getElementById('newTicketWrap').classList.add('open');
        document.getElementById('newTicketToggle').style.display = 'none';
    });
    document.getElementById('cancelTicket').addEventListener('click', () => {
        document.getElementById('newTicketWrap').classList.remove('open');
        document.getElementById('newTicketToggle').style.display = '';
    });
    document.getElementById('submitTicket').addEventListener('click', submitTicket);
}

async function loadTickets() {
    const list = document.getElementById('ticketsList');
    try {
        const res   = await fetch(API + '/api/support/tickets', { credentials: 'include' });
        const data  = await res.json();
        const items = data.tickets || [];

        if (!items.length) {
            list.innerHTML = `<div class="empty"><div class="empty-icon">📭</div><p>No tickets yet. Create one if you need help.</p></div>`;
            return;
        }
        list.innerHTML = items.map(t => `
            <a class="ticket-card" href="/support/ticket.html?id=${t.id}">
                <div class="ticket-status ${t.status}"></div>
                <div class="ticket-info">
                    <div class="ticket-title">${esc(t.title)}</div>
                    <div class="ticket-meta">
                        <span>${timeAgo(t.updated_at)}</span>
                        <span>${esc(CAT_LABEL[t.category] || t.category)}</span>
                    </div>
                </div>
                <span class="ticket-badge badge-${t.status}">${esc(STATUS_LABEL[t.status] || t.status)}</span>
                <span class="ticket-replies">💬 ${t.reply_count}</span>
                <span class="ticket-arrow">→</span>
            </a>
        `).join('');
    } catch {
        list.innerHTML = '<div class="empty"><p>Failed to load tickets.</p></div>';
    }
}

async function submitTicket() {
    const title    = document.getElementById('ticketTitle').value.trim();
    const category = document.getElementById('ticketCategory').value;
    const message  = document.getElementById('ticketMessage').value.trim();
    const btn      = document.getElementById('submitTicket');

    if (!title)   { alert('Title is required'); return; }
    if (!message) { alert('Message is required'); return; }

    btn.disabled = true;
    btn.textContent = 'Submitting...';
    try {
        const res  = await fetch(API + '/api/support/tickets', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, category, message })
        });
        const data = await res.json();
        if (!res.ok) { alert(data.error || 'Failed to create ticket'); return; }
        window.location.href = `/support/ticket.html?id=${data.ticketId}`;
    } catch {
        alert('Network error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Submit Ticket';
    }
}

init();
