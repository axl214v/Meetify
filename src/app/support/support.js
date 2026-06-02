const API = window.location.origin;
let currentUser = null;

const STATUS_LABEL = { open: 'Open', in_progress: 'In Progress', closed: 'Closed' };
const CAT_LABEL    = { technical: 'Technical', account: 'Account', general: 'General', other: 'Other' };

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

async function init() {
    try {
        const res  = await fetch(API + '/api/auth/me', { credentials: 'include' });
        const data = await res.json();
        if (!res.ok || !data.user) {
            document.getElementById('authWall').style.display = 'block';
            return;
        }
        currentUser = data.user;
        document.getElementById('navAuthBtn')?.remove();
        document.getElementById('ticketsView').style.display = 'block';
        loadTickets();
        wireForm();
    } catch {
        document.getElementById('authWall').style.display = 'block';
    }
}

function wireForm() {
    document.getElementById('btnNewTicket').addEventListener('click', () => {
        document.getElementById('formCard').classList.add('open');
        document.getElementById('btnNewTicket').style.display = 'none';
        document.getElementById('fTitle').focus();
    });

    document.getElementById('btnCancelForm').addEventListener('click', closeForm);

    document.getElementById('btnSubmitForm').addEventListener('click', doCreateTicket);

    document.getElementById('fMessage').addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') doCreateTicket();
    });
}

function closeForm() {
    document.getElementById('formCard').classList.remove('open');
    document.getElementById('btnNewTicket').style.display = '';
    document.getElementById('fTitle').value = '';
    document.getElementById('fMessage').value = '';
    document.getElementById('fCategory').value = 'technical';
}

async function loadTickets() {
    const list = document.getElementById('ticketList');
    try {
        const res   = await fetch(API + '/api/support/tickets', { credentials: 'include' });
        const data  = await res.json();
        const items = data.tickets || [];

        if (!items.length) {
            list.innerHTML = `<div class="empty"><div class="empty-icon">📭</div><p>No tickets yet.</p><a class="btn btn-primary" id="emptyNewBtn" href="#">+ Create your first ticket</a></div>`;
            document.getElementById('emptyNewBtn')?.addEventListener('click', e => {
                e.preventDefault();
                document.getElementById('btnNewTicket').click();
            });
            return;
        }

        list.innerHTML = items.map(t => `
            <a class="ticket-row" href="/support/ticket.html?id=${t.id}">
                <div class="t-dot ${t.status}"></div>
                <div class="t-info">
                    <div class="t-title">${esc(t.title)}</div>
                    <div class="t-meta">
                        <span>${timeAgo(t.updated_at)}</span>
                        <span>${esc(CAT_LABEL[t.category] || t.category)}</span>
                    </div>
                </div>
                <span class="t-badge b-${t.status}">${esc(STATUS_LABEL[t.status] || t.status)}</span>
                <span class="t-replies">💬 ${t.reply_count}</span>
                <span class="t-arrow">→</span>
            </a>
        `).join('');
    } catch {
        list.innerHTML = '<div class="empty"><p>Failed to load tickets.</p></div>';
    }
}

async function doCreateTicket() {
    const title    = document.getElementById('fTitle').value.trim();
    const category = document.getElementById('fCategory').value;
    const message  = document.getElementById('fMessage').value.trim();
    const btn      = document.getElementById('btnSubmitForm');

    if (!title)   { alert('Title is required'); return; }
    if (!message) { alert('Message is required'); return; }

    btn.disabled = true;
    btn.textContent = 'Submitting...';
    try {
        const res  = await fetch(API + '/api/support/tickets', {
            method:      'POST',
            credentials: 'include',
            headers:     { 'Content-Type': 'application/json' },
            body:        JSON.stringify({ title, category, message })
        });
        const data = await res.json();
        if (!res.ok) { alert(data.error || 'Failed to create ticket'); return; }
        window.location.href = `/support/ticket.html?id=${data.ticketId}`;
    } catch {
        alert('Network error. Please try again.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Submit Ticket';
    }
}

init();
