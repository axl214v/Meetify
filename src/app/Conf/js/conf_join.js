// js/conf_join.js
const API_BASE = window.location.origin;

let currentConference = null;
let inviteCode = null;   // set when the page was opened by a short link /r/<code>

// Short link: /r/abc-defg-hij
function codeFromPath() {
    const m = window.location.pathname.match(/^\/r\/([a-zA-Z0-9-]{1,32})$/);
    return m ? m[1] : null;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check if conference ID is in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const conferenceId = urlParams.get('id');
    const pathCode = codeFromPath();

    if (pathCode) {
        inviteCode = pathCode;
        checkByCode(pathCode);
    } else if (conferenceId) {
        document.getElementById('conferenceId').value = conferenceId;
        checkConference();
    }
    
    loadRecentConferences();
});

// Open a room from its invite code (short link)
async function checkByCode(code) {
    const conferenceIdInput = document.getElementById('conferenceId');
    const joinBtn = document.getElementById('joinBtn');
    const passwordField = document.getElementById('passwordField');
    try {
        const response = await fetch(`${API_BASE}/api/conferences/by-code/${encodeURIComponent(code)}`, {
            method: 'GET',
            credentials: 'include'
        });

        if (response.status === 401) {
            // Signed out: if the host allows guests, offer to join with a name
            if (!(await offerGuestJoin(code))) {
                window.location.href = `/auth/Auth.html?next=${encodeURIComponent(window.location.pathname)}`;
            }
            return;
        }
        if (response.status === 404) {
            inviteCode = null;
            showError(t('This invite link is not valid. Ask the host for a new one, or enter the room ID.'));
            return;
        }
        if (response.status === 429) {
            showError(t('Too many wrong invite links. Try again in 15 minutes.'));
            return;
        }
        if (!response.ok) throw new Error('Failed to fetch conference details');

        const data = await response.json();
        currentConference = data.conference;
        conferenceIdInput.value = currentConference.id;
        conferenceIdInput.classList.add('success');
        displayConferencePreview(currentConference);
        if (currentConference.hasPassword) passwordField.style.display = 'flex';
        joinBtn.style.display = 'inline-flex';
        document.getElementById('checkBtn').style.display = 'none';   // nothing left to look up
    } catch (error) {
        console.error('Check invite error:', error);
        showError(t('Network error. Please try again.'));
    }
}

// ── Guest join (no account) ─────────────────────────────────────────────────
let guestRoom = null;

// Returns true when the guest form is shown, false when the visitor should sign in instead.
async function offerGuestJoin(code) {
    try {
        const response = await fetch(`${API_BASE}/api/guest/room/${encodeURIComponent(code)}`);
        if (response.status === 429) { showError(t('Too many wrong invite links. Try again in 15 minutes.')); return true; }
        if (!response.ok) return false;
        const data = await response.json();
        if (!data.allowGuests) return false;

        guestRoom = data.conference;
        displayConferencePreview({
            name: guestRoom.name,
            host_username: guestRoom.hostName,
            participantCount: guestRoom.participantCount,
            max_participants: guestRoom.max_participants,
            start_time: guestRoom.start_time,
            end_time: guestRoom.end_time
        });
        document.getElementById('roomIdField').style.display = 'none';
        document.getElementById('checkBtn').style.display = 'none';
        document.getElementById('guestNameField').style.display = 'flex';
        if (guestRoom.hasPassword) document.getElementById('passwordField').style.display = 'flex';
        document.getElementById('guestJoinBtn').style.display = 'inline-flex';
        const signIn = document.getElementById('guestSignInLink');
        signIn.href = `/auth/Auth.html?next=${encodeURIComponent(window.location.pathname)}`;
        signIn.style.display = 'inline-flex';
        // A signed-out visitor has no list, profile or support to go to
        document.querySelector('.topbar-nav')?.style.setProperty('display', 'none');
        document.querySelector('.recent')?.style.setProperty('display', 'none');
        document.getElementById('cancelLink').href = '/';
        document.getElementById('joinSubtitle').textContent = t('You were invited to this room.');
        document.getElementById('guestName').focus();
        return true;
    } catch (error) {
        console.error('Guest preview error:', error);
        return false;
    }
}

document.getElementById('guestJoinBtn')?.addEventListener('click', async function () {
    const btn = this;
    const name = document.getElementById('guestName').value.trim();
    const passwordInput = document.getElementById('password');
    if (!name) {
        showError(t('Enter a name so others know who you are.'));
        document.getElementById('guestName').classList.add('error');
        return;
    }
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = t('Joining...');
    try {
        const response = await fetch(`${API_BASE}/api/guest/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: inviteCode, name, password: passwordInput?.value || undefined })
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
            try {
                sessionStorage.setItem('meetify-guest', JSON.stringify({
                    token: data.token, conferenceId: data.conferenceId, userId: data.guest.userId, name: data.guest.name
                }));
            } catch {
                showError(t('Your browser blocks session storage, so a guest cannot join. Allow it or sign in.'));
                return;
            }
            window.location.href = `/Conf/pages/conf_room.html?id=${data.conferenceId}`;
            return;
        }
        if (data.requiresPassword || response.status === 403 && /password/i.test(data.message || '')) {
            passwordInput?.classList.add('error');
        }
        showError(data.message ? t(data.message) : t('Could not join this room.'));
    } catch (error) {
        console.error('Guest join error:', error);
        showError(t('Network error. Please try again.'));
    } finally {
        btn.disabled = false;
        btn.textContent = label;
    }
});

document.getElementById('guestName')?.addEventListener('input', function () { this.classList.remove('error'); });

// Check conference details
async function checkConference() {
    inviteCode = null;   // typed a room ID by hand: the link code no longer applies
    document.getElementById('checkBtn').style.display = '';
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
        showError(t('Please enter a conference ID'));
        conferenceIdInput.classList.add('error');
        return;
    }
    
    if (isNaN(conferenceId) || parseInt(conferenceId) <= 0) {
        showError(t('Invalid conference ID format'));
        conferenceIdInput.classList.add('error');
        return;
    }
    
    // Show loading
    checkBtn.disabled = true;
    checkBtn.classList.add('loading');
    const originalText = checkBtn.textContent;
    checkBtn.textContent = t('Checking...');
    
    try {
        const response = await fetch(`${API_BASE}/api/conferences/${conferenceId}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.status === 401) {
            window.location.href = `/auth/Auth.html?next=${encodeURIComponent(`/Conf/pages/conf_join.html?id=${parseInt(conferenceId)}`)}`;
            return;
        }

        if (response.status === 404) {
            showError(t('Conference not found. Please check the ID.'));
            conferenceIdInput.classList.add('error');
            return;
        }
        
        if (response.status === 403) {
            const err = await response.json();

            if (err.requiresPassword && err.conference) {
            // Приватная конференция с паролем — показываем форму
            currentConference = err.conference;
            conferenceIdInput.classList.add('success');
            displayConferencePreview(err.conference);
            passwordField.style.display = 'flex';
            joinBtn.style.display = 'inline-flex';
            showError(t('This conference is password protected. Enter the password to join.'));
            return;
            } 

            if (err.isPrivate) {
                showError(t('This conference is private and invite-only.'));
            return;
            }

            showError(t('Access denied.'));
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
        if (currentConference.hasPassword) {
            passwordField.style.display = 'flex';
        }
        
        // Show join button
        joinBtn.style.display = 'inline-flex';
        
    } catch (error) {
        console.error('Check conference error:', error);
        showError(t('Network error. Please try again.'));
    } finally {
        checkBtn.disabled = false;
        checkBtn.classList.remove('loading');
        checkBtn.textContent = originalText;
    }
}

// Display conference preview
function displayConferencePreview(conference) {
    const conferencePreview    = document.getElementById('conferencePreview');
    const previewName          = document.getElementById('previewName');
    const previewHost          = document.getElementById('previewHost');
    const previewParticipants  = document.getElementById('previewParticipants');
    const previewStatus        = document.getElementById('previewStatus');

    previewName.textContent = conference.name || '—';
    previewHost.textContent = conference.isPrivate
        ? t('Private')
        : (conference.host_username || conference.host_email || t('Unknown'));

    if (conference.isPrivate) {
        previewParticipants.textContent = '—';
        previewStatus.textContent = t('Private');
        previewStatus.className = 'badge';
    } else {
        const participantCount = conference.participantCount || conference.participant_count || 0;
        const maxParticipants  = conference.max_participants;
        previewParticipants.textContent = `${maxParticipants ? `${participantCount}/${maxParticipants}` : participantCount}`;
        const status = getConferenceStatus(conference);
        previewStatus.textContent = t(status);
        previewStatus.className   = `badge ${ {Ongoing:'badge-success',Scheduled:'badge-accent',Active:'badge-success'}[status] || '' }`;
    }

    conferencePreview.style.display = 'grid';
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
document.getElementById('joinBtn')?.addEventListener('click', async function(e) {
    e.preventDefault();
    
    if (!currentConference) {
        showError(t('Please check the conference first'));
        return;
    }
    
    const joinBtn = document.getElementById('joinBtn');
    const passwordInput = document.getElementById('password');
    const password = passwordInput?.value.trim();
    
    // Validate password if required
    if (currentConference.hasPassword && !password) {
        showError(t('Please enter the conference password'));
        passwordInput.classList.add('error');
        return;
    }
    
    // Show loading
    joinBtn.disabled = true;
    joinBtn.classList.add('loading');
    const originalText = joinBtn.textContent;
    joinBtn.textContent = t('Joining...');
    
    try {
        const response = await fetch(`${API_BASE}/api/conferences/${currentConference.id}/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ password: password || undefined, code: inviteCode || undefined })
        });
        
        const data = await response.json();
        
        if (response.status === 200) {
            // Success
            if (data.alreadyJoined) {
                showSuccess(t('You are already a participant in this conference!'));
            } else {
                showSuccess(t('Successfully joined the conference!'));
            }
            
            // Save to recent conferences
            saveToRecentConferences(currentConference.id);
            
            // Redirect to conference room after delay
            setTimeout(() => {
                window.location.href = `/Conf/pages/conf_room.html?id=${currentConference.id}`;
            }, 1500);
            
        } else if (response.status === 403) {
            if (data.requiresVerification) {
                showError(t('Email verification required. Please verify your email to join private conferences. Go to your profile to resend the verification link.'));
            } else if (data.message.includes('password')) {
                showError(t('Incorrect password. Please try again.'));
                passwordInput?.classList.add('error');
            } else if (data.message.includes('started')) {
                showError(t('Conference has not started yet.'));
            } else if (data.message.includes('ended')) {
                showError(t('Conference has already ended.'));
            } else {
                showError(data.message ? t(data.message) : t('Unable to join conference'));
            }
        } else if (response.status === 400) {
            showError(data.message ? t(data.message) : t('Conference is full or unavailable'));
        } else {
            showError(t('Failed to join conference'));
        }
        
    } catch (error) {
        console.error('Join conference error:', error);
        showError(t('Network error. Please try again.'));
    } finally {
        joinBtn.disabled = false;
        joinBtn.classList.remove('loading');
        joinBtn.textContent = originalText;
    }
});

// Auto-clear error on input change
document.getElementById('conferenceId')?.addEventListener('input', function() {
    inviteCode = null;
    document.getElementById('checkBtn').style.display = '';
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
            recentList.innerHTML = '<p class="muted">' + t('No recent conferences') + '</p>';
            return;
        }
        
        recentList.innerHTML = '<p class="muted">' + t('Loading...') + '</p>';
        
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
            recentList.innerHTML = '<p class="muted">' + t('No recent conferences available') + '</p>';
            return;
        }
        
        // Render recent conferences
        recentList.innerHTML = conferences.map(conf => `
            <div class="recent-item" onclick="quickJoin(${conf.id})">
                <div class="recent-info">
                    <strong>${escapeHtml(conf.name)}</strong>
                    <small>${escapeHtml(conf.host_username || conf.host_email)}</small>
                </div>
                <button class="btn btn-sm" type="button">${t('Join')}</button>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Load recent conferences error:', error);
        recentList.innerHTML = '<p class="muted">' + t('Error loading recent conferences') + '</p>';
    }
}

// Quick join from recent
function quickJoin(conferenceId) {
    document.getElementById('conferenceId').value = conferenceId;
    checkConference();
}



// Make functions globally accessible
window.checkConference = checkConference;
window.quickJoin = quickJoin;