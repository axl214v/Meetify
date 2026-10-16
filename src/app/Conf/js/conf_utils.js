/**
 * Format date in a human-readable way
 * @param {string|Date} dateString - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    const now = new Date();
    
    // Check if invalid date
    if (isNaN(date.getTime())) return 'Invalid date';
    
    // If today, show time only
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
    
    // If this year, show month and day
    if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
    
    // Otherwise, show full date
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Format relative time (e.g., "5 minutes ago")
 * @param {string|Date} timestamp - Timestamp to format
 * @returns {string} Relative time string
 */
function formatRelativeTime(timestamp) {
    if (!timestamp) return 'recently';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 10) return 'just now';
    if (diffSecs < 60) return `${diffSecs} seconds ago`;
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return formatDate(timestamp);
}

/**
 * Format duration in seconds to HH:MM:SS or MM:SS
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate conference name
 * @param {string} name - Conference name
 * @returns {object} {valid: boolean, error: string}
 */
function validateConferenceName(name) {
    if (!name || name.trim().length === 0) {
        return { valid: false, error: 'Conference name is required' };
    }
    
    if (name.length > 255) {
        return { valid: false, error: 'Conference name is too long (max 255 characters)' };
    }
    
    return { valid: true };
}

/**
 * Validate participant count
 * @param {number} count - Max participants
 * @returns {object} {valid: boolean, error: string}
 */
function validateParticipantCount(count) {
    if (count === null || count === undefined || count === '') {
        return { valid: true }; // Optional field
    }
    
    const num = parseInt(count);
    
    if (isNaN(num)) {
        return { valid: false, error: 'Participant count must be a number' };
    }
    
    if (num < 2 || num > 1000) {
        return { valid: false, error: 'Participant count must be between 2 and 1000' };
    }
    
    return { valid: true };
}

/**
 * Get conference status based on dates
 * @param {object} conference - Conference object
 * @returns {string} Status: 'Scheduled', 'Ongoing', 'Ended', 'Active'
 */
function getConferenceStatus(conference) {
    const now = new Date();
    
    if (conference.end_time && new Date(conference.end_time) < now) {
        return 'Ended';
    }
    
    if (conference.start_time) {
        const start = new Date(conference.start_time);
        if (start > now) {
            return 'Scheduled';
        } else if (start <= now && (!conference.end_time || new Date(conference.end_time) >= now)) {
            return 'Ongoing';
        }
    }
    
    return 'Active';
}

/**
 * Generate random color for avatar
 * @param {string} str - String to generate color from
 * @returns {string} Hex color code
 */
function stringToColor(str) {
    if (!str) return '#667eea';
    
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
        '#667eea', '#764ba2', '#f093fb', '#4facfe',
        '#43e97b', '#fa709a', '#fee140', '#30cfd0',
        '#a8edea', '#fed6e3', '#c471f5', '#12c2e9'
    ];
    
    return colors[Math.abs(hash) % colors.length];
}

/**
 * Get initials from name
 * @param {string} name - Full name
 * @returns {string} Initials (max 2 characters)
 */
function getInitials(name) {
    if (!name) return 'U';
    
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }
    
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} True if successful
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        // Fallback for older browsers
        const input = document.createElement('input');
        input.value = text;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        const success = document.execCommand('copy');
        document.body.removeChild(input);
        return success;
    }
}

/**
 * Show toast notification
 * @param {string} message
 * @param {string} type - 'success' | 'error' | 'info' | 'warning'
 * @param {number} duration - ms (default 3500)
 */
function ensureUiStyles() {
    if (document.getElementById('mf-ui-styles')) return;
    const style = document.createElement('style');
    style.id = 'mf-ui-styles';
    style.textContent = `
        .mf-toast { position: fixed; top: 16px; right: 16px; z-index: 99999; max-width: 360px; display: flex; align-items: flex-start; gap: 10px;
            padding: 12px 16px; background: var(--surface, #0b0f17); color: var(--text, #eef2fa); font: 500 14px/1.45 var(--font, system-ui, sans-serif);
            border: 1px solid var(--border-strong, rgba(148,170,215,.24)); border-left: 3px solid var(--accent, #2f7cf6); border-radius: 10px;
            box-shadow: var(--shadow-overlay, 0 16px 48px rgba(0,0,0,.6)); word-break: break-word; animation: mfIn .2s ease both; }
        .mf-toast.success { border-left-color: var(--success, #3fb985); }
        .mf-toast.error { border-left-color: var(--danger, #ec6a62); }
        .mf-toast.warning { border-left-color: var(--warning, #dcab48); }
        .mf-toast.out { animation: mfOut .2s ease forwards; }
        @keyframes mfIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
        @keyframes mfOut { to { opacity: 0; transform: translateY(-6px); } }
        .mf-backdrop { position: fixed; inset: 0; z-index: 99998; display: grid; place-items: center; padding: 16px; background: var(--overlay, rgba(3,5,9,.7)); }
        .mf-dialog { width: 100%; max-width: 400px; padding: 24px; background: var(--surface, #0b0f17); color: var(--text, #eef2fa); font-family: var(--font, system-ui, sans-serif);
            border: 1px solid var(--border-strong, rgba(148,170,215,.24)); border-radius: 22px; box-shadow: var(--shadow-overlay, 0 16px 48px rgba(0,0,0,.6)); }
        .mf-dialog h3 { font-size: 19px; font-weight: 600; letter-spacing: -.01em; margin: 0 0 8px; }
        .mf-dialog p { color: var(--text-2, #9ba8c0); font-size: 14px; line-height: 1.55; margin: 0 0 20px; }
        .mf-dialog input { width: 100%; height: 40px; padding: 0 12px; margin-bottom: 20px; font: inherit; font-size: 16px; color: inherit; background: var(--surface-2, #111724); border: 1px solid var(--border-strong, rgba(148,170,215,.24)); border-radius: 10px; outline: none; }
        .mf-dialog input:focus { border-color: var(--accent, #2f7cf6); box-shadow: 0 0 0 3px var(--accent-subtle, rgba(47,124,246,.15)); }
        .mf-actions { display: flex; gap: 8px; justify-content: flex-end; }
        .mf-btn { height: 40px; padding: 0 16px; font: 500 14px var(--font, system-ui, sans-serif); color: var(--text, #eef2fa); background: var(--surface-2, #111724); border: 1px solid var(--border-strong, rgba(148,170,215,.24)); border-radius: 10px; cursor: pointer; }
        .mf-btn:hover { background: var(--surface-3, #19202f); }
        .mf-btn.primary { background: var(--accent, #2f7cf6); border-color: transparent; color: #fff; }
        .mf-btn.primary:hover { background: var(--accent-hover, #4b93ff); }
        .mf-btn.danger { background: var(--danger, #ec6a62); border-color: transparent; color: #fff; }
        @media (prefers-reduced-motion: reduce) { .mf-toast { animation: none; } }
    `;
    document.head.appendChild(style);
}

function showNotification(message, type = 'info', duration = 3500) {
    ensureUiStyles();
    document.querySelectorAll('.mf-toast').forEach(el => el.remove());

    const toast = document.createElement('div');
    toast.className = `mf-toast ${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('out');
        setTimeout(() => toast.remove(), 200);
    }, duration);
}

/**
 * Show an inline confirm dialog (replaces native confirm())
 * Returns a Promise<boolean>
 * @param {string} message
 * @param {string} confirmLabel - label for confirm button (default 'Confirm')
 * @param {string} type - 'danger' | 'default'
 */
function showConfirm(message, confirmLabel = 'Confirm', type = 'danger') {
    return new Promise((resolve) => {
        ensureUiStyles();
        document.querySelectorAll('.mf-backdrop').forEach(el => el.remove());

        const overlay = document.createElement('div');
        overlay.className = 'mf-backdrop';
        overlay.innerHTML = `
            <div class="mf-dialog" role="alertdialog" aria-modal="true">
                <p style="color: var(--text, #eef2fa); font-size: 16px; margin-bottom: 20px;">${message}</p>
                <div class="mf-actions">
                    <button class="mf-btn" id="confirmCancel" type="button">Cancel</button>
                    <button class="mf-btn ${type === 'danger' ? 'danger' : 'primary'}" id="confirmOk" type="button">${confirmLabel}</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const done = (v) => { overlay.remove(); resolve(v); };
        overlay.querySelector('#confirmOk').addEventListener('click', () => done(true));
        overlay.querySelector('#confirmCancel').addEventListener('click', () => done(false));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) done(false); });
        overlay.querySelector('#confirmCancel').focus();
    });
}

/**
 * Add CSS animations for notifications
 */
if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Check if user has media permissions
 * @returns {Promise<object>} {camera: boolean, microphone: boolean}
 */
async function checkMediaPermissions() {
    const result = { camera: false, microphone: false };
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        
        result.camera = stream.getVideoTracks().length > 0;
        result.microphone = stream.getAudioTracks().length > 0;
        
        // Stop tracks
        stream.getTracks().forEach(track => track.stop());
    } catch (error) {
        console.error('Media permissions check failed:', error);
    }
    
    return result;
}

/**
 * Format file size
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Generate random ID
 * @param {number} length - Length of ID
 * @returns {string} Random ID
 */
function generateRandomId(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Export functions for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatDate,
        formatRelativeTime,
        formatDuration,
        escapeHtml,
        validateEmail,
        validateConferenceName,
        validateParticipantCount,
        getConferenceStatus,
        stringToColor,
        getInitials,
        copyToClipboard,
        showNotification,
        debounce,
        checkMediaPermissions,
        formatFileSize,
        generateRandomId
    };
}