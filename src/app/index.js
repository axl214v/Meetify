// index.js - Main page logic
const API_BASE = window.location.origin;

// Check if user is already logged in
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/api/auth/check-auth`, {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            if (data.authenticated) {
                // User is logged in, redirect to conferences
                window.location.href = 'Conf/conf.html';
            }
        }
    } catch (error) {
        console.log('Not authenticated:', error);
        // User not logged in, stay on main page
    }
}

// Check server status
async function checkServerStatus() {
    try {
        const response = await fetch(`${API_BASE}/check-status`);
        if (response.ok) {
            const data = await response.json();
            console.log('Server status:', data);
        }
    } catch (error) {
        console.error('Server connection error:', error);
        showConnectionError();
    }
}

// Show connection error
function showConnectionError() {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <strong>⚠️ Connection Error</strong>
        <p>Cannot connect to server. Please make sure the server is running.</p>
    `;
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(239, 68, 68, 0.95);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        max-width: 350px;
    `;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => errorDiv.remove(), 5000);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    checkServerStatus();
    checkAuth();
});

console.log('Meetify v1.0 - Ready!');