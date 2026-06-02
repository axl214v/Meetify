const API = window.location.origin;
const ticketId = new URLSearchParams(location.search).get('id');
let currentUser = null;

function esc(str) {
    const d = document.createElement('div');
    d.textContent = String(str ?? '');
    return d.innerHTML;
}

function fmtDate(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_LABEL = { open: 'Open', in_progress: 'In Progress', closed: 'Closed' };
const CAT_LABEL    = { technical: 'Technical', account: 'Account', general: 'General', other: 'Other' };

async function init() {
    if (!ticketId) { location.href = '/support/support.html'; return; }

    try {
        const res  = await fetch(API + '/api/auth/me', { credentials: 'include' });
        const data = await res.json();
        if (!res.ok || !data.user) { location.href = '/auth/Auth.html'; return; }
        currentUser = data.user;
        loadTicket();
    } catch {
        location.href = '/auth/Auth.html';
    }
}

async function loadTicket() {
    const page = document.getElementById('page');
    try {
        const res  = await fetch(`${API}/api/support/tickets/${ticketId}`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) { page.innerHTML = `<p style="color:#ef4444;">${esc(data.error)}</p>`; return; }

        const { ticket, replies } = data;
        const isAdmin = currentUser.role === 'admin';
        const isClosed = ticket.status === 'closed';

        document.title = `#${ticket.id} — ${ticket.title}`;

        const adminActions = isAdmin ? `
            <div class="admin-actions">
                <select class="status-select" id="statusSelect">
                    <option value="open"        ${ticket.status === 'open'        ? 'selected' : ''}>Open</option>
                    <option value="in_progress" ${ticket.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                    <option value="closed"      ${ticket.status === 'closed'      ? 'selected' : ''}>Closed</option>
                </select>
                <button class="btn btn-danger" id="deleteTicketBtn" style="font-size:12px;padding:5px 12px;">Delete</button>
            </div>
        ` : '';

        page.innerHTML = `
            <a class="back-btn" href="/support/support.html">← My Tickets</a>

            <div class="ticket-hd">
                <div class="ticket-hd-top">
                    <div class="ticket-title-big">${esc(ticket.title)}</div>
                    ${adminActions}
                </div>
                <div class="ticket-meta-row">
                    <span class="status-badge badge-${ticket.status}">${esc(STATUS_LABEL[ticket.status] || ticket.status)}</span>
                    <span class="cat-badge">${esc(CAT_LABEL[ticket.category] || ticket.category)}</span>
                    <span>#${ticket.id}</span>
                    <span>by ${esc(ticket.username)}</span>
                    <span>${fmtDate(ticket.created_at)}</span>
                </div>
            </div>

            <div class="divider"></div>

            <div class="thread" id="thread">
                ${replies.map(r => renderMessage(r)).join('')}
            </div>

            <div class="divider"></div>

            ${isClosed
                ? `<div class="closed-notice">This ticket is closed. <a href="/support/support.html" style="color:var(--accent);">Open a new ticket</a> if you need further help.</div>`
                : `<div class="reply-form">
                    <textarea id="replyText" placeholder="Write your reply..."></textarea>
                    <div class="reply-actions">
                        <button class="btn btn-primary" id="sendReply">Send Reply</button>
                        ${isAdmin ? `
                            <button class="btn" id="sendAndClose" style="font-size:12px;">Send &amp; Close</button>
                        ` : ''}
                    </div>
                   </div>`
            }
        `;

        if (isAdmin) {
            document.getElementById('statusSelect')?.addEventListener('change', async e => {
                await updateStatus(e.target.value);
            });
            document.getElementById('deleteTicketBtn')?.addEventListener('click', async () => {
                if (!confirm('Delete this ticket permanently?')) return;
                const r = await fetch(`${API}/api/admin/support/tickets/${ticketId}`, { method: 'DELETE', credentials: 'include' });
                if (r.ok) location.href = '/admin/admin.html';
            });
            document.getElementById('sendAndClose')?.addEventListener('click', async () => {
                await sendReply();
                await updateStatus('closed');
                loadTicket();
            });
        }

        if (!isClosed) {
            document.getElementById('sendReply')?.addEventListener('click', async () => {
                await sendReply();
                loadTicket();
            });
            document.getElementById('replyText')?.addEventListener('keydown', e => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('sendReply')?.click();
                }
            });
        }

    } catch (e) {
        page.innerHTML = `<p style="color:#ef4444;">Failed to load ticket.</p>`;
    }
}

function renderMessage(r) {
    const isAdmin = r.is_admin;
    const initial = (r.username || '?')[0].toUpperCase();
    return `
        <div class="msg ${isAdmin ? 'msg-admin' : ''}">
            <div class="msg-avatar ${isAdmin ? 'msg-admin-av' : 'msg-user-av'}">${initial}</div>
            <div class="msg-body">
                <div class="msg-header">
                    <span class="msg-name">${esc(r.username)}</span>
                    ${isAdmin ? '<span class="msg-admin-label">Admin</span>' : ''}
                    <span class="msg-time">${fmtDate(r.created_at)}</span>
                </div>
                <div class="msg-text">${esc(r.message)}</div>
            </div>
        </div>
    `;
}

async function sendReply() {
    const text = document.getElementById('replyText')?.value.trim();
    if (!text) return;
    const res = await fetch(`${API}/api/support/tickets/${ticketId}/replies`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
    });
    if (!res.ok) {
        const d = await res.json();
        alert(d.error || 'Failed to send reply');
    }
}

async function updateStatus(status) {
    await fetch(`${API}/api/admin/support/tickets/${ticketId}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
}

init();
