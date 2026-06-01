// ============================================
// conf_create.js — Create conference page
// ============================================

const API_BASE = window.location.origin;

const P2P_MAX = 8;
const SFU_MAX = 100;

document.addEventListener('DOMContentLoaded', () => {

    // Mode card toggle
    const modeCards  = document.querySelectorAll('.mode-card');
    const modeInputs = document.querySelectorAll('input[name="mode"]');
    modeInputs.forEach(radio => {
        radio.addEventListener('change', () => {
            modeCards.forEach(c => c.classList.remove('mode-card--active'));
            radio.closest('.mode-card').classList.add('mode-card--active');
            applyModeCap();
        });
    });

    function getMode() {
        return document.querySelector('input[name="mode"]:checked')?.value || 'p2p';
    }

    function applyModeCap() {
        const maxInput = document.getElementById('maxParticipants');
        if (!maxInput) return;
        const cap = getMode() === 'p2p' ? P2P_MAX : SFU_MAX;
        maxInput.max = cap;
        maxInput.placeholder = `Max ${cap} (leave empty for default)`;
        if (maxInput.value && parseInt(maxInput.value) > cap) maxInput.value = cap;
    }
    applyModeCap();

    // Set minimum datetime to now
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const minDateTime = now.toISOString().slice(0, 16);

    const startTimeInput = document.getElementById('startTime');
    const endTimeInput   = document.getElementById('endTime');

    if (startTimeInput) startTimeInput.min = minDateTime;
    if (endTimeInput)   endTimeInput.min   = minDateTime;

    startTimeInput?.addEventListener('change', function() {
        if (endTimeInput && this.value) endTimeInput.min = this.value;
    });

    // Toggle password field visibility
    document.getElementById('requirePassword')?.addEventListener('change', function() {
        const passwordField = document.getElementById('passwordField');
        if (passwordField) {
            passwordField.style.display = this.checked ? 'block' : 'none';
            if (!this.checked) document.getElementById('password').value = '';
        }
    });

    document.getElementById('backBtn')?.addEventListener('click', () => {
        window.location.href = 'conf.html';
    });

    document.getElementById('cancelBtn')?.addEventListener('click', () => {
        window.location.href = 'conf.html';
    });

    document.getElementById('copyBtn')?.addEventListener('click', copyConferenceId);

    // Create conference form handler
    document.getElementById('createConferenceForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();

        const submitBtn            = document.getElementById('submitBtn');
        const nameInput            = document.getElementById('name');
        const descriptionInput     = document.getElementById('description');
        const maxParticipantsInput = document.getElementById('maxParticipants');
        const isPublicInput        = document.getElementById('isPublic');
        const requirePasswordInput = document.getElementById('requirePassword');
        const passwordInput        = document.getElementById('password');
        const startTimeInput       = document.getElementById('startTime');
        const endTimeInput         = document.getElementById('endTime');

        const mode            = getMode();
        const name            = nameInput.value.trim();
        const description     = descriptionInput.value.trim();
        const maxParticipants = maxParticipantsInput.value ? parseInt(maxParticipantsInput.value) : null;
        const isPublic        = isPublicInput.checked;
        const requirePassword = requirePasswordInput.checked;
        const password        = requirePassword ? passwordInput.value.trim() : null;
        const startTime       = startTimeInput.value || null;
        const endTime         = endTimeInput.value || null;

        // Reset errors
        nameInput.classList.remove('error', 'success');
        descriptionInput.classList.remove('error', 'success');

        // Validation
        if (!name) {
            showNotification('Please enter a conference name', 'error');
            nameInput.classList.add('error');
            nameInput.focus();
            return;
        }

        if (name.length > 255) {
            showNotification('Name must be less than 255 characters', 'error');
            nameInput.classList.add('error');
            return;
        }

        if (description && description.length > 1000) {
            showNotification('Description must be less than 1000 characters', 'error');
            descriptionInput.classList.add('error');
            return;
        }

        if (requirePassword && !password) {
            showNotification('Please enter a conference password', 'error');
            passwordInput.classList.add('error');
            return;
        }

        const cap = mode === 'p2p' ? P2P_MAX : SFU_MAX;
        if (maxParticipants !== null && (maxParticipants < 2 || maxParticipants > cap)) {
            showNotification(`Max participants must be between 2 and ${cap}`, 'error');
            maxParticipantsInput.classList.add('error');
            return;
        }

        if (startTime && endTime && new Date(startTime) >= new Date(endTime)) {
            showNotification('End time must be after start time', 'error');
            endTimeInput.classList.add('error');
            return;
        }

        // Loading
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Creating...';

        try {
            const response = await fetch(`${API_BASE}/api/conferences`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name, description: description || undefined, maxParticipants, isPublic, password, startTime, endTime, mode })
            });

            const data = await response.json();

            if (response.status === 201) {
                nameInput.classList.add('success');

                const conferenceInfo = document.getElementById('conferenceInfo');
                const conferenceIdEl = document.getElementById('conferenceId');

                if (conferenceInfo && conferenceIdEl) {
                    conferenceIdEl.textContent = data.conference.id;
                    conferenceInfo.style.display = 'block';
                }

                showNotification(`Conference created! ID: ${data.conference.id}`, 'success', 4000);

                setTimeout(() => {
                    window.location.href = 'conf.html';
                }, 2000);

            } else if (response.status === 400) {
                const errors = data.errors || [data.message];
                showNotification(errors.join(' · '), 'error');
            } else {
                showNotification(data.message || 'Failed to create conference', 'error');
            }

        } catch (error) {
            console.error('Create conference error:', error);
            showNotification('Network error. Please check your connection.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            submitBtn.textContent = originalText;
        }
    });
});

function copyConferenceId() {
    const conferenceId = document.getElementById('conferenceId')?.textContent;
    if (!conferenceId) return;

    navigator.clipboard.writeText(conferenceId)
        .then(() => showNotification('Conference ID copied!', 'success', 2000))
        .catch(() => {
            const input = document.createElement('input');
            input.value = conferenceId;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            showNotification('Conference ID copied!', 'success', 2000);
        });
}