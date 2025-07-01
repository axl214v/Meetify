document.getElementById('submit').onclick = function () {
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  [nameInput, emailInput, passwordInput].forEach(input => input.style.border = '');

  if (!name || !email || !password) {
    alert('Пожалуйста, заполните все поля.');

    if (!name) nameInput.style.border = '2px solid red';
    if (!email) emailInput.style.border = '2px solid red';
    if (!password) passwordInput.style.border = '2px solid red';

    return;
  }

  fetch('http://localhost:3000/register', {
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
      window.location.href = 'auth.html';
    } else {
      console.error('Ошибка регистрации:', result.error || result);
      alert(result.error || 'Ошибка сервера');
    }
  })
  .catch(err => {
    console.error('Ошибка запроса:', err);
    alert('Ошибка запроса: сервер недоступен?');
  });
};
