// Const of api
const API_BASE = window.location.origin;;
// const serviceStatus = require('./checkStatus/index.js');


// Initialize check on page load
//async () => {
//    try {
//        await checkServiceStatus();
//        // инициализация остальных модулей
//    } catch (err) {
//        console.error('Service check failed', err);
//        showError('Service temporarily unavailable. Please try again later.');
//        window.location.href = '../err';
//    }
//}

// Utility function for showing user-friendly errors
function showError(message, input = null) {
    alert(message);
    if (input) {
        input.classList.add('error');
    }
}
// Checking if user is authenticated
async function checkAuthentication() {
    try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (res.ok) {
            const data = await res.json();
            if (data.authenticated) {
                window.location.href = '/Conf/pages/conf.html';
            }
        }
    } catch (err) {
        console.log('User not authenticated:', err.message);
    }
}
checkAuthentication();


// Login form handler
document.getElementById('submit')?.addEventListener('click', async function (e) {
    e.preventDefault();
    
    const submitButton = document.getElementById('submit');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    
    // Reset previous error states
    emailInput.classList.remove('error', 'success');
    passwordInput.classList.remove('error', 'success');
    
    // Validation
    if (!email || !password) {
        showError('Please fill in all required fields.');
        if (!email) emailInput.classList.add('error');
        if (!password) passwordInput.classList.add('error');
        return;
    }
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showError('Please enter a valid email address.', emailInput);
        return;
    }
    
    // Disable button and show loading state
    submitButton.disabled = true;
    submitButton.classList.add('loading');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Logging in...';
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include', 
            body: JSON.stringify({ email, password })
        });
        
        if (response.status === 200) {
            emailInput.classList.add('success');
            passwordInput.classList.add('success');
            
            // Small delay for visual feedback
            setTimeout(() => {
                window.location.href = '../Conf/pages/conf.html';
            }, 300);
        } else if (response.status === 401) {     
            showError('Invalid email or password.', passwordInput);
        } else {
            const errorText = await response.text();
            console.error('Login error:', errorText);
            showError('Server error. Please try again later.');
        }
    } catch (err) {
        console.error('Login request failed:', err);
        showError('Network error. Please check your connection and try again.');
    } finally {
        // Restore button state
        submitButton.disabled = false;
        submitButton.classList.remove('loading');
        submitButton.textContent = originalText;
    }
});

// Handle navigation buttons
document.getElementById('authb')?.addEventListener('click', function() {
    window.location.href = 'Reg.html';
});

document.getElementById('reset')?.addEventListener('click', function() {
    window.location.href = 'resetpass.html';
});

// Optional: Add Enter key support for login
document.getElementById('password')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        document.getElementById('submit')?.click();
    }
});