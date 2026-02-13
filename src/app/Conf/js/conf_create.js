// js/conf_create.js
const API_BASE = 'http://localhost:3000';
const serviceStatus = require('./checkStatus/index.js');


// Initialize check on page load
async () => {
    try {
        await checkServiceStatus();
        // инициализация остальных модулей
    } catch (err) {
        console.error('Service check failed', err);
        showError('Service temporarily unavailable. Please try again later.');
        window.location.href = '../err';
    }
}

// Toggle password field
document.getElementById('requirePassword')?.addEventListener('change', function() {
    const passwordField = document.getElementById('passwordField');
    if (passwordField) {
        passwordField.style.display = this.checked ? 'block' : 'none';
        const passwordInput = document.getElementById('password');
        if (!this.checked) {
            passwordInput.value = '';
        }
    }
});

// Create conference form handler
document.getElementById('createConferenceForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const nameInput = document.getElementById('name');
    const descriptionInput = document.getElementById('description');
    const maxParticipantsInput = document.getElementById('maxParticipants');
    const isPublicInput = document.getElementById('isPublic');
    const requirePasswordInput = document.getElementById('requirePassword');
    const passwordInput = document.getElementById('password');
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    
    // Get values
    const name = nameInput.value.trim();
    const description = descriptionInput.value.trim();
    const maxParticipants = maxParticipantsInput.value ? parseInt(maxParticipantsInput.value) : null;
    const isPublic = isPublicInput.checked;
    const requirePassword = requirePasswordInput.checked;
    const password = requirePassword ? passwordInput.value.trim() : null;
    const startTime = startTimeInput.value || null;
    const endTime = endTimeInput.value || null;
    
    // Reset errors
    nameInput.classList.remove('error', 'success');
    descriptionInput.classList.remove('error', 'success');
    
    // Validation
    if (!name) {
        alert('Please enter a conference name');
        nameInput.classList.add('error');
        return;
    }
    
    if (name.length > 255) {
        alert('Name must be less than 255 characters');
        nameInput.classList.add('error');
        return;
    }
    
    if (description && description.length > 1000) {
        alert('Description must be less than 1000 characters');
        descriptionInput.classList.add('error');
        return;
    }
    
    if (requirePassword && !password) {
        alert('Please enter a password');
        passwordInput.classList.add('error');
        return;
    }
    
    if (maxParticipants !== null && (maxParticipants < 2 || maxParticipants > 1000)) {
        alert('Max participants must be between 2 and 1000');
        maxParticipantsInput.classList.add('error');
        return;
    }
    
    // Validate time range
    if (startTime && endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        if (start >= end) {
            alert('End time must be after start time');
            endTimeInput.classList.add('error');
            return;
        }
    }
    
    // Show loading
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating...';
    
    try {
        const response = await fetch(`${API_BASE}/api/conferences`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                name,
                description: description || undefined,
                maxParticipants,
                isPublic,
                password,
                startTime,
                endTime
            })
        });
        
        const data = await response.json();
        
        if (response.status === 201) {
            // Success
            nameInput.classList.add('success');
            
            // Show conference info
            const conferenceInfo = document.getElementById('conferenceInfo');
            const conferenceIdEl = document.getElementById('conferenceId');
            
            if (conferenceInfo && conferenceIdEl) {
                conferenceIdEl.textContent = data.conference.id;
                conferenceInfo.style.display = 'block';
            }
            
            alert(`Conference created successfully!\nID: ${data.conference.id}`);
            
            // Redirect to conference list after 2 seconds
            setTimeout(() => {
                window.location.href = 'conf.html';
            }, 2000);
            
        } else if (response.status === 400) {
            // Validation error
            const errors = data.errors || [data.message];
            alert('Validation failed:\n' + errors.join('\n'));
        } else {
            alert(data.message || 'Failed to create conference');
        }
        
    } catch (error) {
        console.error('Create conference error:', error);
        alert('Network error. Please check your connection.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        submitBtn.textContent = originalText;
    }
});

// Copy conference ID to clipboard
function copyConferenceId() {
    const conferenceId = document.getElementById('conferenceId')?.textContent;
    
    if (conferenceId) {
        navigator.clipboard.writeText(conferenceId).then(() => {
            alert('Conference ID copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy:', err);
            // Fallback for older browsers
            const input = document.createElement('input');
            input.value = conferenceId;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            alert('Conference ID copied to clipboard!');
        });
    }
}

// Set minimum datetime to now
const now = new Date();
now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
const minDateTime = now.toISOString().slice(0, 16);

const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');

if (startTimeInput) {
    startTimeInput.min = minDateTime;
}

if (endTimeInput) {
    endTimeInput.min = minDateTime;
}

// Auto-update end time minimum when start time changes
startTimeInput?.addEventListener('change', function() {
    if (endTimeInput && this.value) {
        endTimeInput.min = this.value;
    }
});