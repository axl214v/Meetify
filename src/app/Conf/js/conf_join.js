// js/conf_join.js
const API_BASE = 'http://localhost:3000';
const serviceStatus = require('./checkStatus/index.js');


// Initialize check on page load
checkServiceStatus(err => {
    console.error('Service status check failed:', err);
    showError('Service temporarily unavailable. Please try again later.');
    // redirect to error page 
    window.location.href = './err/err.html';
});

let currentConference = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check if conference ID is in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const conferenceId = urlParams.get('id');
    
    if (conferenceId) {
        document.getElementById('conferenceId').value = conferenceId;
        checkConference();
    }
    
    loadRecentConferences();
});

// Check conference details
async function checkConference() {
    const conferenceIdInput = document.getElementById('conferenceId');
    const checkBtn = document.getElementById('checkBtn');
    const joinBtn = document.getElementById('joinBtn');
    const conferencePreview = document.getElementById('conferencePreview');
    const passwordField = document.getElementById('passwordField');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    
    const conferenceId = conferenceIdInput.value.trim();
    
    // Reset states
    conferenceIdInput.classList.remove('error', 'success');
    errorMessage.style.display = 'none';
    conferencePreview.style.display = 'none';
    passwordField.style.display = 'none';
    joinBtn.style.display = 'none';
    
    // Validation
    if (!conferenceId) {
        showError('Please enter a conference ID');
        conferenceIdInput.classList.add('error');
        return;
    }
    
    if (isNaN(conferenceId) || parseInt(conferenceId) <= 0) {
        showError('Invalid conference ID format');
        conferenceIdInput.classList.add('error');
        return;
    }
    
    // Show loading
    checkBtn.disabled = true;
    checkBtn.classList.add('loading');
    const originalText = checkBtn.textContent;
    checkBtn.textContent = 'Checking...';
    
    try {
        const response = await fetch(`${API_BASE}/api/conferences/${conferenceId}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.status === 404) {
            showError('Conference not found. Please check the ID.');
            conferenceIdInput.classList.add('error');
            return;
        }
        
        if (response.status === 403) {
            showError('This conference is private and you do not have access.');
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to fetch conference details');
        }
        
        const data = await response.json();
        currentConference = data.conference;
        
        // Show conference details
        conferenceIdInput.classList.add('success');
        displayConferencePreview(currentConference);
        
        // Show password field if required
        if (currentConference.password) {
            passwordField.style.display = 'block';
        }
        
        // Show join button
        joinBtn.style.display = 'inline-block';
        
    } catch (error) {
        console.error('Check conference error:', error);
        showError('Network error. Please try again.');
    } finally {
        checkBtn.disabled = false;
        checkBtn.classList.remove('loading');
        checkBtn.textContent = originalText;
    }
}

// Display conference preview
function displayConferencePreview(conference) {
    const conferencePreview = document.getElementById('conferencePreview');
    const previewName = document.getElementById('previewName');
    const previewHost = document.getElementById('previewHost');
    const previewParticipants = document.getElementById('previewParticipants');
    const previewStatus = document.getElementById('previewStatus');
    
    previewName.textContent = conference.name;
    previewHost.textContent = conference.host_username || conference.host_email || 'Unknown';
    
    const participantCount = conference.participantCount || conference.participant_count || 0;
    const maxParticipants = conference.max_participants;
    const participantText = maxParticipants 
        ? `${participantCount}/${maxParticipants}` 
        : `${participantCount}`;
    previewParticipants.textContent = `👥 ${participantText}`;
    
    // Status
    const status = getConferenceStatus(conference);
    previewStatus.textContent = status;
    previewStatus.className = `status-badge ${status.toLowerCase().replace(' ', '-')}`;
    
    conferencePreview.style.display = 'block';
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

// Handle join form submission
document.getElementById('joinConferenceForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!currentConference) {
        showError('Please check the conference first');
        return;
    }
    
    const joinBtn = document.getElementById('joinBtn');
    const passwordInput = document.getElementById('password');
    const password = passwordInput?.value.trim();
    
    // Validate password if required
    if (currentConference.password && !password) {
        showError('Please enter the conference password');
        passwordInput.classList.add('error');
        return;
    }
    
    // Show loading
    joinBtn.disabled = true;
    joinBtn.classList.add('loading');
    const originalText = joinBtn.textContent;
    joinBtn.textContent = 'Joining...';
    
    try {
        const response = await fetch(`${API_BASE}/api/conferences/${currentConference.id}/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ password: password || undefined })
        });
        
        const data = await response.json();
        
        if (response.status === 200) {
            // Success
            if (data.alreadyJoined) {
                showSuccess('You are already a participant in this conference!');
            } else {
                showSuccess('Successfully joined the conference!');
            }
            
            // Save to recent conferences
            saveToRecentConferences(currentConference.id);
            
            // Redirect to conference room after delay
            setTimeout(() => {
                // TODO: Redirect to conference room (On work)
                window.location.href = `conf_room.html?id=${currentConference.id}`;
                return conferenceId;
            }, 1500);
            
        } else if (response.status === 403) {
            if (data.message.includes('password')) {
                showError('Incorrect password. Please try again.');
                passwordInput?.classList.add('error');
            } else if (data.message.includes('started')) {
                showError('Conference has not started yet.');
            } else if (data.message.includes('ended')) {
                showError('Conference has already ended.');
            } else {
                showError(data.message || 'Unable to join conference');
            }
        } else if (response.status === 400) {
            showError(data.message || 'Conference is full or unavailable');
        } else {
            showError('Failed to join conference');
        }
        
    } catch (error) {
        console.error('Join conference error:', error);
        showError('Network error. Please try again.');
    } finally {
        joinBtn.disabled = false;
        joinBtn.classList.remove('loading');
        joinBtn.textContent = originalText;
    }
});

// Auto-clear error on input change
document.getElementById('conferenceId')?.addEventListener('input', function() {
    this.classList.remove('error');
    document.getElementById('errorMessage').style.display = 'none';
});

document.getElementById('password')?.addEventListener('input', function() {
    this.classList.remove('error');
});

// Show error message
function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const successMessage = document.getElementById('successMessage');
    
    successMessage.style.display = 'none';
    errorText.textContent = message;
    errorMessage.style.display = 'block';
}

// Show success message
function showSuccess(message) {
    const successMessage = document.getElementById('successMessage');
    const successText = document.getElementById('successText');
    const errorMessage = document.getElementById('errorMessage');
    
    errorMessage.style.display = 'none';
    successText.textContent = message;
    successMessage.style.display = 'block';
}

// Save to recent conferences (localStorage)
function saveToRecentConferences(conferenceId) {
    try {
        let recent = JSON.parse(localStorage.getItem('recentConferences') || '[]');
        
        // Remove if already exists
        recent = recent.filter(id => id !== conferenceId);
        
        // Add to beginning
        recent.unshift(conferenceId);
        
        // Keep only last 5
        recent = recent.slice(0, 5);
        
        localStorage.setItem('recentConferences', JSON.stringify(recent));
    } catch (error) {
        console.error('Error saving to recent:', error);
    }
}

// Load recent conferences
async function loadRecentConferences() {
    const recentList = document.getElementById('recentList');
    
    try {
        const recent = JSON.parse(localStorage.getItem('recentConferences') || '[]');
        
        if (recent.length === 0) {
            recentList.innerHTML = '<p class="empty-text">No recent conferences</p>';
            return;
        }
        
        recentList.innerHTML = '<p class="loading-text">Loading...</p>';
        
        // Fetch details for each recent conference
        const conferencePromises = recent.map(id => 
            fetch(`${API_BASE}/api/conferences/${id}`, {
                method: 'GET',
                credentials: 'include'
            }).then(res => res.ok ? res.json() : null)
            .catch(() => null)
        );
        
        const results = await Promise.all(conferencePromises);
        const conferences = results.filter(r => r && r.conference).map(r => r.conference);
        
        if (conferences.length === 0) {
            recentList.innerHTML = '<p class="empty-text">No recent conferences available</p>';
            return;
        }
        
        // Render recent conferences
        recentList.innerHTML = conferences.map(conf => `
            <div class="recent-item" onclick="quickJoin(${conf.id})">
                <div class="recent-info">
                    <strong>${escapeHtml(conf.name)}</strong>
                    <small>${escapeHtml(conf.host_username || conf.host_email)}</small>
                </div>
                <button class="quick-join-btn">Join</button>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Load recent conferences error:', error);
        recentList.innerHTML = '<p class="empty-text">Error loading recent conferences</p>';
    }
}

// Quick join from recent
function quickJoin(conferenceId) {
    document.getElementById('conferenceId').value = conferenceId;
    checkConference();
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions globally accessible
window.checkConference = checkConference;
window.quickJoin = quickJoin;