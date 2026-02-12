// Const of api
const API_BASE = 'http://localhost:3000';
const serviceStatus = require('/checkStatus/index.js');


// Initialize check on page load
checkServiceStatus(err => {
    console.error('Service status check failed:', err);
    showError('Service temporarily unavailable. Please try again later.');
    // redirect to error page 
    window.location.href = './err/err.html';
});