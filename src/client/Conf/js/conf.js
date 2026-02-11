// js/conf.js
const API_BASE = 'http://localhost:3000';

async function checkServiceStatus() {
    try {
        const res = await fetch(`${API_BASE}/check-status`, {
            method: 'GET'
        });
        
        if (!res.ok) {
            showError('Service temporarily unavailable. Please try again later.');
            // redirect to error page 
            window.location.href = './err/err.html';
        }
        return res.ok;
    } catch (err) {
        console.error('Service status check failed:', err);
        showError('Service temporarily unavailable. Please try again later.');
        return false;
        // redirect to error page 
        window.location.href = './err/err.html';
    }
}

// Initialize check on page load
checkServiceStatus(err => {
    console.error('Service status check failed:', err);
    showError('Service temporarily unavailable. Please try again later.');
    // redirect to error page 
    window.location.href = './err/err.html';
});

// State
let currentFilter = 'all'; // 'all', 'host', 'participant'
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
        const response = await fetch(`${API_BASE}/check-auth`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            window.location.href = '../auth/Auth.html';
            return;
        }

        const data = await response.json();
        if (data.authenticated && data.user) {
            document.getElementById('userName').textContent = data.user.name || data.user.email;
        }
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '../auth/Auth.html';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            // Update active tab
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Update filter
            currentFilter = this.dataset.filter;
            currentPage = 1;
            loadConferences();
        });
    });

    // Search
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    searchInput?.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentPage = 1;
            loadConferences();
        }, 500);
    });

    // Pagination
    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadConferences();
        }
    });

    document.getElementById('nextPage')?.addEventListener('click', () => {
        const maxPage = Math.ceil(totalConferences / ITEMS_PER_PAGE);
        if (currentPage < maxPage) {
            currentPage++;
            loadConferences();
        }
    });
}

// Load conferences
async function loadConferences() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const conferencesList = document.getElementById('conferencesList');
    const emptyState = document.getElementById('emptyState');
    const pagination = document.getElementById('pagination');

    // Show loading
    loadingIndicator.style.display = 'flex';
    conferencesList.innerHTML = '';
    emptyState.style.display = 'none';
    pagination.style.display = 'none';

    try {
        let url;
        const searchQuery = document.getElementById('searchInput')?.value.trim();
        const offset = (currentPage - 1) * ITEMS_PER_PAGE;

        // Choose endpoint based on filter
        if (currentFilter === 'all') {
            url = `${API_BASE}/api/conferences?limit=${ITEMS_PER_PAGE}&offset=${offset}`;
            if (searchQuery) {
                url += `&search=${encodeURIComponent(searchQuery)}`;
            }
        } else {
            // Get user's conferences with role filter
            url = `${API_BASE}/api/conferences/user/my`;
            if (currentFilter !== 'all') {
                url += `?role=${currentFilter}`;
            }
        }

        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to load conferences');
        }

        const data = await response.json();
        conferences = data.conferences || [];
        totalConferences = data.total || conferences.length;

        // Hide loading
        loadingIndicator.style.display = 'none';

        // Show results or empty state
        if (conferences.length === 0) {
            emptyState.style.display = 'block';
        } else {
            renderConferences(conferences);
            
            // Show pagination if needed
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
        alert('Failed to load conferences. Please try again.');
    }
}

// Render conferences
function renderConferences(conferences) {
    const conferencesList = document.getElementById('conferencesList');
    conferencesList.innerHTML = '';

    conferences.forEach(conf => {
        const card = createConferenceCard(conf);
        conferencesList.appendChild(card);
    });
}

// Create conference card
function createConferenceCard(conf) {
    const card = document.createElement('div');
    card.className = 'conference-card';
    
    // Status badge
    const status = getConferenceStatus(conf);
    const statusClass = status.toLowerCase().replace(' ', '-');
    
    // Participant count
    const participantCount = conf.participant_count || 0;
    const maxParticipants = conf.max_participants;
    const participantText = maxParticipants 
        ? `${participantCount}/${maxParticipants}` 
        : participantCount;

    // Host badge
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
                </div>
            ` : ''}
        </div>
        
        <div class="card-actions">
            ${hostBadge}
            ${isHost ? `
                <button onclick="editConference(${conf.id})" class="secondary">
                    ✏️ Edit
                </button>
                <button onclick="deleteConference(${conf.id})" class="danger">
                    🗑️ Delete
                </button>
            ` : `
                <button onclick="joinConference(${conf.id})">
                    🚀 Join
                </button>
            `}
        </div>
    `;

    return card;
}

// Get conference status
function getConferenceStatus(conf) {
    const now = new Date();
    
    if (conf.end_time && new Date(conf.end_time) < now) {
        return 'Ended';
    }
    
    if (conf.start_time) {
        const start = new Date(conf.start_time);
        if (start > now) {
            return 'Scheduled';
        } else if (start <= now && (!conf.end_time || new Date(conf.end_time) >= now)) {
            return 'Ongoing';
        }
    }
    
    return 'Active';
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    
    // If today, show time only
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    
    // If this year, show month and day
    if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    
    // Otherwise, show full date
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Update pagination
function updatePagination(maxPage) {
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');

    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === maxPage;
    pageInfo.textContent = `Page ${currentPage} of ${maxPage}`;
}

// Join conference
async function joinConference(conferenceId) {
    if (!confirm('Do you want to join this conference?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/conferences/${conferenceId}/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({})
        });

        const data = await response.json();

        if (response.status === 200) {
            alert(data.message || 'Successfully joined!');
            // Redirect to conference room (implement later)
            // window.location.href = `conf_room.html?id=${conferenceId}`;
            loadConferences(); // Reload list
        } else if (response.status === 400 && data.requiresPassword) {
            // Redirect to join page for password input
            window.location.href = `conf_join.html?id=${conferenceId}`;
        } else {
            alert(data.message || 'Failed to join conference');
        }

    } catch (error) {
        console.error('Join conference error:', error);
        alert('Network error. Please try again.');
    }
}

// Edit conference (placeholder)
function editConference(conferenceId) {
    alert(`Edit functionality coming soon for conference #${conferenceId}`);
    // TODO: Implement edit page
}

// Delete conference
async function deleteConference(conferenceId) {
    if (!confirm('Are you sure you want to delete this conference? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/conferences/${conferenceId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message || 'Conference deleted successfully');
            loadConferences(); // Reload list
        } else {
            alert(data.message || 'Failed to delete conference');
        }

    } catch (error) {
        console.error('Delete conference error:', error);
        alert('Network error. Please try again.');
    }
}