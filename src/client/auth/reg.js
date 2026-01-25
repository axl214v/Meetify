// const of api
const API_BASE = 'http://localhost:3000';

// Utility function for showing errors
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
        
        if (!res.ok) {
            showError('Service temporarily unavailable. Please try again later.');
        }
        return res.ok;
    } catch (err) {
        console.error('Service status check failed:', err);
        showError('Service temporarily unavailable. Please try again later.');
        return false;
    }
}

// Initialize check on page load
checkServiceStatus();

// Validation functions
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    // Минимум 8 символов, хотя бы одна буква и одна цифра
    return password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}

function validateName(name) {
    // Минимум 2 символа, только буквы и пробелы
    return name.length >= 2 && /^[A-Za-zА-Яа-яЁё\s]+$/.test(name);
}

// Handle registration form submission
document.getElementById('submit')?.addEventListener('click', async function (e) {
    e.preventDefault();
    
    const submitButton = document.getElementById('submit');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    
    // Reset previous error states
    nameInput.classList.remove('error', 'success');
    emailInput.classList.remove('error', 'success');
    passwordInput.classList.remove('error', 'success');
    
    // Check if all fields are filled
    if (!name || !email || !password) {
        showError('Please fill in all required fields.');
        if (!name) nameInput.classList.add('error');
        if (!email) emailInput.classList.add('error');
        if (!password) passwordInput.classList.add('error');
        return;
    }
    
    // Validate name
    if (!validateName(name)) {
        showError('Name must be at least 2 characters and contain only letters.', nameInput);
        return;
    }
    
    // Validate email
    if (!validateEmail(email)) {
        showError('Please enter a valid email address.', emailInput);
        return;
    }
    
    // Validate password
    if (!validatePassword(password)) {
        showError('Password must be at least 8 characters and contain letters and numbers.', passwordInput);
        return;
    }
    
    // Disable button and show loading state
    submitButton.disabled = true;
    submitButton.classList.add('loading');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Registering...';
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include', 
            body: JSON.stringify({ name, email, password })
        });
        
        const result = await response.json();
        
        if (response.status === 200) {
            // Show success state
            nameInput.classList.add('success');
            emailInput.classList.add('success');
            passwordInput.classList.add('success');
            
            alert('Registration successful! Please login.');
            
            // Small delay for visual feedback
            setTimeout(() => {
                window.location.href = 'Auth.html';
            }, 300);
        } else {
            console.error('Registration error:', result.error || result);
            
            // Handle specific error messages
            let errorMessage = 'Server error. Please try again later.';
            
            if (result.error) {
                if (result.error.includes('email')) {
                    errorMessage = 'This email is already registered.';
                    emailInput.classList.add('error');
                } else if (result.error.includes('password')) {
                    errorMessage = 'Password does not meet requirements.';
                    passwordInput.classList.add('error');
                } else {
                    errorMessage = result.error;
                }
            }
            
            showError(errorMessage);
        }
    } catch (err) {
        console.error('Registration request failed:', err);
        showError('Network error. Please check your connection and try again.');
    } finally {
        // Restore button state
        submitButton.disabled = false;
        submitButton.classList.remove('loading');
        submitButton.textContent = originalText;
    }
});

// Handle navigation button
document.getElementById('authb')?.addEventListener('click', function() {
    window.location.href = 'Auth.html';
});

// Optional: Add Enter key support
document.getElementById('password')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        document.getElementById('submit')?.click();
    }
});

// Optional: Real-time validation feedback
document.getElementById('email')?.addEventListener('blur', function() {
    const email = this.value.trim();
    if (email && !validateEmail(email)) {
        this.classList.add('error');
    } else if (email) {
        this.classList.remove('error');
    }
});

document.getElementById('password')?.addEventListener('input', function() {
    const password = this.value;
    const strength = document.getElementById('password-strength');
    
    if (strength) {
        if (password.length === 0) {
            strength.textContent = '';
        } else if (password.length < 8) {
            strength.textContent = 'Weak: At least 8 characters needed';
            strength.style.color = '#ef4444';
        } else if (!validatePassword(password)) {
            strength.textContent = 'Medium: Add letters and numbers';
            strength.style.color = '#f59e0b';
        } else {
            strength.textContent = 'Strong password!';
            strength.style.color = '#10b981';
        }
    }
});