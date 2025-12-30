// Const of api
const API_BASE = 'http://localhost:3000';

// Check service status
fetch(`${API_BASE}/check-status`, {
  method: 'GET'
  .then(res => {
        if (res.ok) return res.json();}),
        else: alert('Сервис временно не доступен. Попробуйте позже.')
}); 