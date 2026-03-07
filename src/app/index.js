// index.js - Main page script
const API_BASE = window.location.origin; // Use current host

// Check backend health
fetch(`${API_BASE}/check-status`, {
    method: 'GET'
})
.then(res => {
    if (res.ok) {
        return res.json();
    } else {
        console.warn('Backend not responding');
    }
})
.then(data => {
    if (data) {
        console.log('Backend status:', data.status);
    }
})
.catch(err => {
    console.warn('Backend check failed:', err.message);
});

// Check if user is authenticated
fetch(`${API_BASE}/api/auth/check-auth`, {
    method: 'GET',
    credentials: 'include'
})
.then(res => {
    if (res.ok) {
        return res.json();
    }
    throw new Error('Not authenticated');
})
.then(data => {
    if (data.authenticated) {
        // User is logged in, could redirect to dashboard
        console.log('User authenticated:', data.user);
    }
})
.catch(err => {
    console.log('User not authenticated');
});

// Navigation handlers
document.addEventListener('DOMContentLoaded', () => {
    console.log('Meetify v1.0 - Ready!');
    
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});