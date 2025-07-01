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
   return;
  }
})
.catch(err => {
  console.log('Пользователь не авторизован:', err.message);
  window.location.href = '../auth/auth.html';
});

fetch('http://localhost:3000/user', {
  method: 'GET',
  credentials: 'include'
})
.then(data => {
    console.log('Data fetched successfully');
  })