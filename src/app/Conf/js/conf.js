// ============================================
// conf.js — Conference list page
// ============================================

const API_BASE = window.location.origin;

// State
let currentFilter = 'all';
let currentPage = 1;
let conferences = [];
let totalConferences = 0;
const ITEMS_PER_PAGE = 12;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
    loadConferences();
});

// Check authentication
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            window.location.href = '/auth/Auth.html';
            return;
        }

        const data = await response.json();
        if (data.user) {
            document.getElementById('userName').textContent = data.user.username || data.user.email;
        }
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/auth/Auth.html';
    }
}

// Setup event listeners
function setupEventListeners() {
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            currentPage = 1;
            loadConferences();
        });
    });

    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    searchInput?.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentPage = 1;
            loadConferences();
        }, 500);
    });

    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; loadConferences(); }
    });

    document.getElementById('nextPage')?.addEventListener('click', () => {
        const maxPage = Math.ceil(totalConferences / ITEMS_PER_PAGE);
        if (currentPage < maxPage) { currentPage++; loadConferences(); }
    });
}

// Load conferences
async function loadConferences() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const conferencesList   = document.getElementById('conferencesList');
    const emptyState        = document.getElementById('emptyState');
    const pagination        = document.getElementById('pagination');

    loadingIndicator.style.display = 'flex';
    conferencesList.innerHTML = '';
    conferencesList.style.display = 'none';
    emptyState.style.display = 'none';
    pagination.style.display = 'none';

    try {
        const searchQuery = document.getElementById('searchInput')?.value.trim();
        const offset = (currentPage - 1) * ITEMS_PER_PAGE;
        let url;

        if (currentFilter === 'all') {
            url = `${API_BASE}/api/conferences?limit=${ITEMS_PER_PAGE}&offset=${offset}`;
            if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
        } else {
            url = `${API_BASE}/api/conferences/user/my?role=${currentFilter}`;
        }

        const response = await fetch(url, { credentials: 'include' });

        if (!response.ok) throw new Error('Failed to load conferences');

        const data = await response.json();
        conferences    = data.conferences || [];
        totalConferences = data.total || conferences.length;

        loadingIndicator.style.display = 'none';

        if (conferences.length === 0) {
            emptyState.style.display = 'flex';
        } else {
            renderConferences(conferences);
            conferencesList.style.display = 'block';
            const maxPage = Math.ceil(totalConferences / ITEMS_PER_PAGE);
            if (maxPage > 1 && currentFilter === 'all') {
                pagination.style.display = 'flex';
                updatePagination(maxPage);
            }
        }

    } catch (error) {
        console.error('Load conferences error:', error);
        loadingIndicator.style.display = 'none';
        emptyState.style.display = 'flex';
        showNotification('Failed to load conferences. Please try again.', 'error');
    }
}

// Render conferences
function renderConferences(list) {
    const conferencesList = document.getElementById('conferencesList');
    conferencesList.innerHTML = '';
    list.forEach(conf => conferencesList.appendChild(createConferenceCard(conf)));
}

// Create conference row
const STATUS_BADGE = { Ongoing: 'badge-success', Scheduled: 'badge-accent', Active: 'badge-success', Ended: '' };

function createConferenceCard(conf) {
    const row = document.createElement('article');
    row.className = 'conf-row';

    const status = getConferenceStatus(conf);
    const participantCount = conf.participant_count || 0;
    const maxParticipants  = conf.max_participants;
    const participantText  = maxParticipants ? `${participantCount}/${maxParticipants}` : participantCount;
    const isHost = conf.is_host === 1 || conf.is_host === true;
    const host = escapeHtml(conf.host_username || conf.host_email || 'Unknown');

    row.innerHTML = `
        <div class="conf-main">
            <div class="conf-title">
                <h3>${escapeHtml(conf.name)}</h3>
                <span class="badge ${STATUS_BADGE[status] || ''}">${status}</span>
                ${isHost ? '<span class="badge badge-accent">Host</span>' : ''}
                ${conf.hasPassword ? '<span class="badge">Password</span>' : ''}
            </div>
            ${conf.description ? `<p class="conf-desc">${escapeHtml(conf.description)}</p>` : ''}
            <div class="conf-meta">
                ${isHost ? `<span>ID <span class="mono">${conf.id}</span></span>` : `<span>Host ${host}</span>`}
                <span>${participantText} people</span>
                ${conf.start_time ? `<span>${formatDate(conf.start_time)}</span>` : ''}
            </div>
        </div>
        <div class="conf-actions">
            ${isHost ? `
                <button onclick="editConference(${conf.id})" class="btn btn-sm" type="button">Edit</button>
                <button onclick="deleteConference(${conf.id})" class="btn btn-danger btn-sm" type="button">Delete</button>
            ` : `
                <button onclick="joinConference(${conf.id}, ${!!conf.hasPassword})" class="btn btn-primary btn-sm" type="button">Join</button>
            `}
        </div>
    `;

    return row;
}

// Get conference status
function getConferenceStatus(conf) {
    const now = new Date();
    if (conf.end_time && new Date(conf.end_time) < now) return 'Ended';
    if (conf.start_time) {
        const start = new Date(conf.start_time);
        if (start > now) return 'Scheduled';
        if (start <= now && (!conf.end_time || new Date(conf.end_time) >= now)) return 'Ongoing';
    }
    return 'Active';
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    const now  = new Date();
    if (date.toDateString() === now.toDateString())
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    if (date.getFullYear() === now.getFullYear())
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}



// Update pagination
function updatePagination(maxPage) {
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === maxPage;
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${maxPage}`;
}

// Join conference
async function joinConference(conferenceId, requiresPassword = false) {
    let password = null;

    if (requiresPassword) {
        password = await showPasswordPrompt();
        if (password === null) return; // отмена
    }

    try {
        const response = await fetch(`${API_BASE}/api/conferences/${conferenceId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ password })
        });

        const data = await response.json();

        if (response.ok) {
            window.location.href = `conf_room.html?id=${conferenceId}`;
        } else if (data.requiresPassword) {
            // Пароль нужен но не был введён — повторить
            joinConference(conferenceId, true);
        } else if (response.status === 403) {
            showNotification('Incorrect password', 'error');
        } else {
            showNotification(data.message || 'Failed to join conference', 'error');
        }
    } catch (error) {
        console.error('Join conference error:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

// Password prompt for protected rooms
function showPasswordPrompt() {
    return new Promise(resolve => {
        ensureUiStyles();
        const overlay = document.createElement('div');
        overlay.className = 'mf-backdrop';
        overlay.innerHTML = `
            <div class="mf-dialog" role="dialog" aria-modal="true" aria-labelledby="mfPassTitle">
                <h3 id="mfPassTitle">Room password</h3>
                <p>This room is protected. Enter the password to join.</p>
                <input id="confPasswordInput" type="password" placeholder="Password" autocomplete="off">
                <div class="mf-actions">
                    <button class="mf-btn" id="confPassCancel" type="button">Cancel</button>
                    <button class="mf-btn primary" id="confPassConfirm" type="button">Join</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const input = overlay.querySelector('#confPasswordInput');
        input.focus();

        const cleanup = (val) => { overlay.remove(); resolve(val); };

        overlay.querySelector('#confPassCancel').onclick  = () => cleanup(null);
        overlay.querySelector('#confPassConfirm').onclick = () => cleanup(input.value || '');
        input.addEventListener('keydown', e => { if (e.key === 'Enter') cleanup(input.value || ''); });
        overlay.onclick = e => { if (e.target === overlay) cleanup(null); };
    });
}

// Edit conference — open modal with current data
async function editConference(conferenceId) {
    try {
        const response = await fetch(`${API_BASE}/api/conferences/${conferenceId}`, {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to load conference');
        const data = await response.json();
        const conf = data.conference || data;

        document.getElementById('editConfId').value = conf.id;
        document.getElementById('editName').value = conf.name || '';
        document.getElementById('editDescription').value = conf.description || '';
        document.getElementById('editMaxParticipants').value = conf.max_participants || '';
        document.getElementById('editIsPublic').checked = !!conf.is_public;
        document.getElementById('editStartTime').value = toDatetimeLocal(conf.start_time);
        document.getElementById('editEndTime').value = toDatetimeLocal(conf.end_time);
        document.getElementById('editChangePassword').checked = false;
        document.getElementById('editPassword').value = '';
        document.getElementById('editPasswordGroup').style.display = 'none';

        document.getElementById('editModal').style.display = 'grid';
    } catch (err) {
        console.error('editConference error:', err);
        showNotification('Failed to load conference data.', 'error');
    }
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

function togglePasswordField() {
    const show = document.getElementById('editChangePassword').checked;
    document.getElementById('editPasswordGroup').style.display = show ? 'block' : 'none';
    if (!show) document.getElementById('editPassword').value = '';
}

function toDatetimeLocal(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    // format: YYYY-MM-DDTHH:MM
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('editForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editConfId').value;
        const submitBtn = document.getElementById('editSubmitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving…';

        const body = {
            name: document.getElementById('editName').value.trim(),
            description: document.getElementById('editDescription').value.trim() || null,
            maxParticipants: document.getElementById('editMaxParticipants').value
                ? parseInt(document.getElementById('editMaxParticipants').value)
                : null,
            isPublic: document.getElementById('editIsPublic').checked,
            startTime: document.getElementById('editStartTime').value || null,
            endTime: document.getElementById('editEndTime').value || null,
        };

        if (document.getElementById('editChangePassword').checked) {
            body.password = document.getElementById('editPassword').value || null;
        }

        try {
            const response = await fetch(`${API_BASE}/api/conferences/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body)
            });
            const data = await response.json();
            if (response.ok) {
                showNotification('Conference updated', 'success');
                closeEditModal();
                loadConferences();
            } else {
                showNotification(data.message || 'Failed to update conference', 'error');
            }
        } catch (err) {
            console.error('Update conference error:', err);
            showNotification('Network error. Please try again.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Changes';
        }
    });

    // Close modal on overlay click
    document.getElementById('editModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('editModal')) closeEditModal();
    });
});

// Delete conference
async function deleteConference(conferenceId) {
    // Custom confirm toast — show inline confirm instead of native dialog
    const confirmed = await showConfirm('Delete this conference? This cannot be undone.');
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_BASE}/api/conferences/${conferenceId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            showNotification(data.message || 'Conference deleted', 'success');
            loadConferences();
        } else {
            showNotification(data.message || 'Failed to delete conference', 'error');
        }
    } catch (error) {
        console.error('Delete conference error:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}