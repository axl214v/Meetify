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

const STATUS_BADGE = { open: 'badge-accent', in_progress: 'badge-warning', closed: '' };
const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', closed: 'Closed' };
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
        if (!res.ok) { page.innerHTML = `<div class="panel state"><p>${esc(data.error)}</p><a class="btn" href="/support/support.html">Back to support</a></div>`; return; }

        const { ticket, replies } = data;
        const isAdmin = currentUser.role === 'admin';
        const isClosed = ticket.status === 'closed';

        document.title = `#${ticket.id} — ${ticket.title}`;

        const adminActions = isAdmin ? `
            <div class="form-actions">
                <select class="select" id="statusSelect" style="width:auto;">
                    <option value="open"        ${ticket.status === 'open'        ? 'selected' : ''}>Open</option>
                    <option value="in_progress" ${ticket.status === 'in_progress' ? 'selected' : ''}>In progress</option>
                    <option value="closed"      ${ticket.status === 'closed'      ? 'selected' : ''}>Closed</option>
                </select>
                <button class="btn btn-danger" id="deleteTicketBtn" type="button">Delete</button>
            </div>
        ` : '';

        page.innerHTML = `
            <div class="page-head">
                <div>
                    <h1>${esc(ticket.title)}</h1>
                    <p class="conf-meta" style="margin-top: var(--space-2);">
                        <span class="badge ${STATUS_BADGE[ticket.status] || ''}">${esc(STATUS_LABEL[ticket.status] || ticket.status)}</span>
                        <span>${esc(CAT_LABEL[ticket.category] || ticket.category)}</span>
                        <span>#${ticket.id}</span>
                        <span>${esc(ticket.username)}</span>
                        <span>${fmtDate(ticket.created_at)}</span>
                    </p>
                </div>
                ${adminActions}
            </div>

            <div class="thread" id="thread">
                ${replies.map(r => renderMessage(r)).join('')}
            </div>

            ${isClosed
                ? `<div class="notice notice-info">This ticket is closed. <a href="/support/support.html">Open a new ticket</a> if you still need help.</div>`
                : `<div class="panel form-panel">
                    <div class="form-stack">
                        <div class="field"><label for="replyText">Reply</label><textarea class="textarea" id="replyText" rows="4" placeholder="Write your reply"></textarea></div>
                        <div class="form-actions">
                            <button class="btn btn-primary" id="sendReply" type="button">Send reply</button>
                            ${isAdmin ? `<button class="btn" id="sendAndClose" type="button">Send and close</button>` : ''}
                        </div>
                    </div>
                   </div>`
            }
        `;

        if (isAdmin) {
            document.getElementById('statusSelect')?.addEventListener('change', async e => {
                await updateStatus(e.target.value);
            });
            document.getElementById('deleteTicketBtn')?.addEventListener('click', async () => {
                if (!await showConfirm('Delete this ticket permanently?', 'Delete')) return;
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
        page.innerHTML = `<div class="panel state"><p>Could not load the ticket.</p><a class="btn" href="/support/support.html">Back to support</a></div>`;
    }
}

function renderMessage(r) {
    const isAdmin = r.is_admin;
    return `
        <article class="panel msg-card ${isAdmin ? 'msg-admin' : ''}">
            <div class="msg-head">
                <strong>${esc(r.username)}</strong>
                ${isAdmin ? '<span class="badge badge-accent">Team</span>' : ''}
                <span class="msg-time">${fmtDate(r.created_at)}</span>
            </div>
            <p class="msg-text">${esc(r.message)}</p>
        </article>
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
        showNotification(d.error || 'Could not send the reply.', 'error');
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
