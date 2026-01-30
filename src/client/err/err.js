const { log } = require("console");

// Const of api
const API_BASE = 'http://localhost:3000';

// Utility function for showing user-friendly errors
function showError(message, input = null) {
    alert(message);
    if (input) {
        input.classList.add('error');
    }
}

// Check service status
async function checkServiceStatus() {
    try {
        const res = await fetch(`${API_BASE}/check-status`, {
            method: 'GET'
        });
        
        if (res.ok) {
            console.log('Service is operational.');
            window.location.href = '/index.html'; // Redirect to main page
        }
        return res.ok;
    } catch (err) {
        console.error('Service status check failed:', err);
        error = 'Service temporarily unavailable. Please try again later.';
        showError(error);
        return false;
    }
}

// Initialize checks on page load
checkServiceStatus();

// TODO: Additional error handling can be added here as needed
// TODO: Send request to log errors on the server for further analysis
async function logErrorToServer(errorMessage) {
    try {
        await fetch(`${API_BASE}/api/log-error`, {
            method: 'POST',
            headers: {  'Content-Type': 'application/json' },
            body: JSON.stringify({ error: errorMessage })
        });
    } catch (err) {
        console.error('Failed to log error to server:', err);
    }
}
logErrorToServer(error);