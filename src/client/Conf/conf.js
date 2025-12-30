// Const of api
const API_BASE = 'http://localhost:3000';

// Function that checks status of api
async function checkServiceStatus() {
  try {
    const res = await fetch(`${API_BASE}/check-status`, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log('Service status:', data);
  } catch (err) {
    console.error('Service unavailable:', err);
    alert('Сервис временно недоступен. Попробуйте позже.');
  }
}


// function that checks if user is logged in
async function checkAuthStatus() {
  try {
    const res = await fetch(`${API_BASE}/check-auth`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.authenticated) {
      alert('Пожалуйста, авторизуйтесь!');
      window.location.href = '../auth/auth.html';
    }
  } catch (err) {
    console.error('Auth error:', err);
    alert('Пожалуйста, авторизуйтесь!');
    window.location.href = '../auth/auth.html';
  }
}


// Function that connects to the conference
async function connectConference() {
  const idInput = document.getElementById('id_conf');
  if (!idInput) return;

  const conferenceId = idInput.value.trim();
  if (!conferenceId) {
    alert('Введите код конференции.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/joinconf`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: conferenceId }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    window.location.href = `/conference/${data.conferenceId}`;
  } catch (err) {
    console.error(err);
    alert('Проверьте, что конференция доступна и код правильный.');
  }
}


// Checks status of service and checks if user is logged in
document.addEventListener('DOMContentLoaded', () => {
  checkServiceStatus();
  checkAuthStatus();
// On click connects to the conferention
  const connectBtn = document.getElementById('conf_connect');
  if (connectBtn) connectBtn.addEventListener('click', connectConference);
// On click creates conferention(currently not working)
  const createBtn = document.getElementById('createconf');
  if (createBtn) {
    // TODO: Реализовать логику создания конференции
    createBtn.addEventListener('click', () => {
      alert('Создание конференции пока не реализовано.');
    });
  }
});