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
            emptyState.style.display = 'block';
        } else {
            renderConferences(conferences);
            const maxPage = Math.ceil(totalConferences / ITEMS_PER_PAGE);
            if (maxPage > 1 && currentFilter === 'all') {
                pagination.style.display = 'flex';
                updatePagination(maxPage);
            }
        }

    } catch (error) {
        console.error('Load conferences error:', error);
        loadingIndicator.style.display = 'none';
        emptyState.style.display = 'block';
        showNotification('Failed to load conferences. Please try again.', 'error');
    }
}

// Render conferences
function renderConferences(list) {
    const conferencesList = document.getElementById('conferencesList');
    conferencesList.innerHTML = '';
    list.forEach(conf => conferencesList.appendChild(createConferenceCard(conf)));
}

// Create conference card
function createConferenceCard(conf) {
    const card = document.createElement('div');
    card.className = 'conference-card';

    const status      = getConferenceStatus(conf);
    const statusClass = status.toLowerCase().replace(' ', '-');
    const participantCount = conf.participant_count || 0;
    const maxParticipants  = conf.max_participants;
    const participantText  = maxParticipants ? `${participantCount}/${maxParticipants}` : participantCount;
    const isHost = conf.is_host === 1 || conf.is_host === true;
    const hostBadge = isHost ? '<span class="host-badge">👑 Host</span>' : '';

    card.innerHTML = `
        <div class="card-header">
            <h3>${escapeHtml(conf.name)}</h3>
            <span class="status-badge ${statusClass}">${status}</span>
        </div>
        ${conf.description ? `<p class="card-description">${escapeHtml(conf.description)}</p>` : ''}
        <div class="card-info">
            <div class="info-item">
                <span class="info-label">Host:</span>
                <span>${escapeHtml(conf.host_username || conf.host_email || 'Unknown')}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Participants:</span>
                <span>👥 ${participantText}</span>
            </div>
            ${conf.start_time ? `
                <div class="info-item">
                    <span class="info-label">Start:</span>
                    <span>📅 ${formatDate(conf.start_time)}</span>
                </div>` : ''}
        </div>
        <div class="card-actions">
            ${hostBadge}
            ${isHost ? `
                <button onclick="editConference(${conf.id})" class="secondary">✏️ Edit</button>
                <button onclick="deleteConference(${conf.id})" class="danger">🗑️ Delete</button>
            ` : `
                <button onclick="joinConference(${conf.id})">🚀 Join</button>
            `}
        </div>
    `;

    return card;
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

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Update pagination
function updatePagination(maxPage) {
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === maxPage;
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${maxPage}`;
}

// Join conference
async function joinConference(conferenceId) {
    try {
        const response = await fetch(`${API_BASE}/api/conferences/${conferenceId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({})
        });

        const data = await response.json();

        if (response.ok) {
            window.location.href = `conf_room.html?id=${conferenceId}`;
        } else if (data.requiresPassword) {
            window.location.href = `conf_join.html?id=${conferenceId}`;
        } else {
            showNotification(data.message || 'Failed to join conference', 'error');
        }
    } catch (error) {
        console.error('Join conference error:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

// Edit conference
function editConference(conferenceId) {
    showNotification('Edit functionality coming soon!', 'info');
}

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