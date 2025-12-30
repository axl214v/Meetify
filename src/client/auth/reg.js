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

// Handle registration form submission
document.getElementById('submit').addEventListener('click', function (e) {
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

  if (!name || !email || !password) {
    alert('Please fill in all required fields.');
    
    if (!name) nameInput.classList.add('error');
    if (!email) emailInput.classList.add('error');
    if (!password) passwordInput.classList.add('error');
    
    return;
  }

  // Disable button and show loading state
  submitButton.disabled = true;
  submitButton.textContent = 'Registering...';

  // Sending registration request
  fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include', 
    body: JSON.stringify({ name, email, password })
  })
  .then(async response => {
    const result = await response.json();

    if (response.status === 200) {
      alert('Registration successful! Please login.');
      window.location.href = 'auth.html';
      submitButton.disabled = false;
      submitButton.textContent = 'Register';
    } else {
      console.error('Registration error:', result.error || result);
      alert(result.error || 'Server error. Please try again later.');
      submitButton.disabled = false;
      submitButton.textContent = 'Register';
    }
  })
  .catch(err => {
    console.error('Registration request failed:', err);
    alert('Network error. Please check your connection and try again.');
    submitButton.disabled = false;
    submitButton.textContent = 'Register';
  });
});

// Handle navigation button
document.getElementById('authb').addEventListener('click', function() {
  window.location.href = 'Auth.html';
});