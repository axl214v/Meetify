// Const of api
const API_BASE = 'http://localhost:3000';

// Check service status
fetch(`${API_BASE}/check-status`, {
  method: 'GET'
})
.then(res => {
  if (res.ok) {
    return res.json();
  } else {
    alert('Service temporarily unavailable. Please try again later.');
  }
})
.catch(err => {
  console.error('Service status check failed:', err);
  alert('Service temporarily unavailable. Please try again later.');
});

// Checking if user is authenticated
fetch(`${API_BASE}/check-auth`, {
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
    window.location.href = '../Conf/conf.html';
  }
})
.catch(err => {
  console.log('User not authenticated:', err.message);
});

// Checking login form submission
document.getElementById('submit').addEventListener('click', function (e) {
  e.preventDefault();
  
  const submitButton = document.getElementById('submit');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  // Reset previous error states
  emailInput.classList.remove('error', 'success');
  passwordInput.classList.remove('error', 'success');

  if (!email || !password) {
    alert('Please fill in all required fields.');
    
    if (!email) {
      emailInput.classList.add('error');
    }
    if (!password) {
      passwordInput.classList.add('error');
    }
    
    return;
  }

  // Disable button and show loading state
  submitButton.disabled = true;
  submitButton.textContent = 'Logging in...';

  // Sending login request
  fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include', 
    body: JSON.stringify({ email, password })
  })
  .then(async response => {
    if (response.status === 200) {
      submitButton.disabled = false;
      submitButton.textContent = 'Login';
      window.location.href = '../Conf/conf.html';
    } else if (response.status === 401) {     
      alert('Invalid email or password');
      submitButton.disabled = false;
      submitButton.textContent = 'Login';
      passwordInput.classList.add('error');
    } else {
      const errorText = await response.text();
      console.error('Login error:', errorText);
      alert('Server error. Please try again later.');
      submitButton.disabled = false;
      submitButton.textContent = 'Login';
    }
  })
  .catch(err => {
    console.error('Login request failed:', err);
    alert('Network error. Please check your connection and try again.');
    submitButton.disabled = false;
    submitButton.textContent = 'Login';
  });
});

// Handle navigation buttons
document.getElementById('authb').addEventListener('click', function() {
  window.location.href = 'Reg.html';
});

document.getElementById('reset').addEventListener('click', function() {
  window.location.href = 'resetpass.html';
});