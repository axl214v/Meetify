// Check service status
fetch('localhost:3000/check-status', {
  method: 'GET'
  .then(res => {
        if (res.ok) return res.json();}),
        else: alert('Сервис временно не доступен. Попробуйте позже.')
}); 

// Checking if user is authenticated
fetch('http://localhost:3000/check-auth', {
  method: 'GET',
  credentials: 'include'
})
.then(res => {
  if (res.ok) return res.json();
  throw new Error('Not authenticated');
})
.then(data => {
  if (data.authenticated) {
    window.location.href = '../Conf/conf.html';
  }
})
.catch(err => {
  console.log('Пользователь не авторизован:', err.message);
});

// Checking login form submission
document.getElementById('submit').onclick = function () {
  const submitButton = document.getElementById('submit');
  submitButton.disabled = true;
  submitButton.textContent = 'Вход...';
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  emailInput.style.border = '';
  passwordInput.style.border = '';

  if (!email || !password) {
    alert('Пожалуйста, заполните все поля.');

    if (!email) {
      emailInput.style.border = '2px solid red';
    }
    if (!password) {
      passwordInput.style.border = '2px solid red';
    }

    return;
  };

  // Sending login request
  fetch('http://localhost:3000/login', {
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
      submitButton.textContent = 'Войти';
      window.location.href = '../Conf/conf.html';
    } else if (response.status === 401) {     
      alert('Неверный логин или пароль');
      submitButton.disabled = false;
      submitButton.textContent = 'Войти';
    } else {
      const errorText = await response.text();
      console.error('Ошибка входа:', errorText);
      alert('Ошибка сервера или сети');
      submitButton.disabled = false;
      submitButton.textContent = 'Войти';
    }
  })
  .catch(err => {
    console.error('Ошибка запроса:', err);
    alert('Ошибка запроса: сервер недоступен?');
  });
};
