// Check authentication status for next step
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
  alert('Пожалуйста авторизуйтесь!');
  window.location.href = '../auth/auth.html';
});


// Function that joins the conferention
function connect_conferention(){
  var id_conf = document.getElementById('id_conf');
  fetch('http://localhost:3000/joinconf',{
    method: 'POST',
    credentials: 'include',
    body:{
      id: id_conf,}
  .catch(err => {
    console.log(err.message);
    alert('Пожалуйста проверьте что конференция доступна и код конференции правильный.');
  })  
})}

// Checking if button pressed and call a function
document.getElementById('conf_connect').onclick = await connect_conferention();
