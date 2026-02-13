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