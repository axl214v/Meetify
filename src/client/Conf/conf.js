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


// Function that creates a conference
async function createConference() {
  // Проверяем, есть ли уже форма в HTML
  const existingForm = document.getElementById('conference-form');
  
  // Если формы нет, создаем модальное окно с полной формой
  if (!existingForm) {
    showCreateConferenceModal();
    return;
  }
  else {
    submitConferenceForm(document.getElementById('conference-form'));
  }
}

// Показать модальное окно для создания конференции с полными полями
function showCreateConferenceModal() {
  const modalHTML = `
    <div id="conference-modal" style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    ">
      <div style="
        background: white;
        padding: 25px;
        border-radius: 10px;
        width: 90%;
        max-width: 600px;
        max-height: 90vh;
        overflow-y: auto;
      ">
        <h2 style="margin-top: 0; color: #333;">Создать конференцию</h2>
        <form id="conference-form">
          <!-- Обязательные поля -->
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
              Название конференции *
            </label>
            <input type="text" id="conference-name" required 
                   placeholder="Введите название конференции"
                   style="width: 100%; padding: 10px; box-sizing: border-box; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          
          <!-- Описание -->
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
              Описание
            </label>
            <textarea id="conference-description" 
                     placeholder="Опишите тему или цель конференции (необязательно)"
                     style="width: 100%; padding: 10px; box-sizing: border-box; border: 1px solid #ddd; border-radius: 4px; height: 100px; resize: vertical;"></textarea>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <!-- Максимальное количество участников -->
            <div>
              <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
                Максимальное количество участников
              </label>
              <input type="number" id="conference-max-participants" value="20" min="2" max="500"
                     style="width: 100%; padding: 10px; box-sizing: border-box; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            
            <!-- Публичная/приватная -->
            <div>
              <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
                Тип конференции
              </label>
              <div style="display: flex; gap: 15px; align-items: center; height: 40px;">
                <label style="display: flex; align-items: center; gap: 5px;">
                  <input type="radio" name="conference-type" id="conference-public" value="public" checked>
                  Публичная
                </label>
                <label style="display: flex; align-items: center; gap: 5px;">
                  <input type="radio" name="conference-type" id="conference-private" value="private">
                  Приватная
                </label>
              </div>
            </div>
          </div>
          
          <!-- Поле пароля (скрыто по умолчанию) -->
          <div id="password-field" style="display: none; margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
              Пароль для входа *
            </label>
            <input type="password" id="conference-password"
                   placeholder="Введите пароль для приватной конференции"
                   style="width: 100%; padding: 10px; box-sizing: border-box; border: 1px solid #ddd; border-radius: 4px;">
            <small style="display: block; margin-top: 5px; color: #666;">
              Участникам потребуется ввести этот пароль для присоединения к конференции
            </small>
          </div>
          
          <!-- Время начала и окончания -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
            <div>
              <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
                Дата и время начала
              </label>
              <input type="datetime-local" id="conference-start-time"
                     style="width: 100%; padding: 10px; box-sizing: border-box; border: 1px solid #ddd; border-radius: 4px;">
              <small style="display: block; margin-top: 5px; color: #666;">
                (необязательно)
              </small>
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
                Дата и время окончания
              </label>
              <input type="datetime-local" id="conference-end-time"
                     style="width: 100%; padding: 10px; box-sizing: border-box; border: 1px solid #ddd; border-radius: 4px;">
              <small style="display: block; margin-top: 5px; color: #666;">
                (необязательно)
              </small>
            </div>
          </div>
          
          <!-- Кнопки -->
          <div style="display: flex; gap: 15px; justify-content: flex-end; padding-top: 20px; border-top: 1px solid #eee;">
            <button type="button" id="cancel-create" style="
              padding: 10px 20px;
              background: #f5f5f5;
              color: #333;
              border: 1px solid #ddd;
              border-radius: 4px;
              cursor: pointer;
              font-weight: 500;
            ">
              Отмена
            </button>
            <button type="submit" style="
              padding: 10px 25px;
              background: #007bff;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-weight: 500;
            ">
              Создать конференцию
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  // Добавляем модальное окно в DOM
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHTML;
  document.body.appendChild(modalContainer);
  
  // Настройка видимости поля пароля в зависимости от типа конференции
  const publicRadio = document.getElementById('conference-public');
  const privateRadio = document.getElementById('conference-private');
  const passwordField = document.getElementById('password-field');
  const passwordInput = document.getElementById('conference-password');
  
  function updatePasswordFieldVisibility() {
    if (privateRadio.checked) {
      passwordField.style.display = 'block';
      passwordInput.required = true;
    } else {
      passwordField.style.display = 'none';
      passwordInput.required = false;
    }
  }
  
  publicRadio.addEventListener('change', updatePasswordFieldVisibility);
  privateRadio.addEventListener('change', updatePasswordFieldVisibility);
  
  // Установка минимальной даты для полей времени (текущая дата)
  const now = new Date();
  const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  document.getElementById('conference-start-time').min = localDateTime;
  document.getElementById('conference-end-time').min = localDateTime;
  
  // Обработчик отправки формы
  const form = document.getElementById('conference-form');
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    await submitConferenceForm();
  });
  
  // Обработчик отмены
  const cancelBtn = document.getElementById('cancel-create');
  cancelBtn.addEventListener('click', function() {
    document.body.removeChild(modalContainer);
  });
  
  // Закрытие модального окна при клике на фон
  const modal = document.getElementById('conference-modal');
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      document.body.removeChild(modalContainer);
    }
  });
}

// Отправка данных на сервер
async function submitConferenceForm() {
  // Собираем данные из формы
  const conferenceData = {
    name: document.getElementById('conference-name').value.trim(),
    description: document.getElementById('conference-description').value.trim() || null,
    maxParticipants: parseInt(document.getElementById('conference-max-participants').value) || 20,
    isPublic: document.getElementById('conference-public').checked
  };
  
  // Обработка пароля для приватной конференции
  if (!conferenceData.isPublic) {
    const password = document.getElementById('conference-password').value.trim();
    if (!password) {
      alert('Для приватной конференции необходимо указать пароль');
      document.getElementById('conference-password').focus();
      return;
    }
    conferenceData.password = password;
  }
  
  // Обработка времени начала и окончания
  const startTimeInput = document.getElementById('conference-start-time').value;
  const endTimeInput = document.getElementById('conference-end-time').value;
  
  if (startTimeInput) {
    conferenceData.startTime = new Date(startTimeInput).toISOString();
  }
  
  if (endTimeInput) {
    conferenceData.endTime = new Date(endTimeInput).toISOString();
    
    // Проверка, чтобы время окончания было после времени начала
    if (conferenceData.startTime && new Date(conferenceData.endTime) <= new Date(conferenceData.startTime)) {
      alert('Время окончания должно быть позже времени начала');
      return;
    }
  }
  
  // Валидация обязательных полей
  if (!conferenceData.name) {
    alert('Пожалуйста, введите название конференции');
    document.getElementById('conference-name').focus();
    return;
  }
  
  // Валидация максимального количества участников
  if (conferenceData.maxParticipants < 2 || conferenceData.maxParticipants > 500) {
    alert('Максимальное количество участников должно быть от 2 до 500');
    return;
  }
  
  try {
    // Показываем индикатор загрузки
    const submitButton = document.querySelector('#conference-form button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Создание...';
    submitButton.disabled = true;
    
    // Отправляем запрос на создание конференции
    const res = await fetch(`${API_BASE}/conferences`, {
      method: 'POST',
      credentials: 'include',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(conferenceData)
    });
    
    // Восстанавливаем кнопку
    submitButton.textContent = originalText;
    submitButton.disabled = false;
    
    // Обработка ответа
    if (!res.ok) {
      let errorMessage = 'Ошибка при создании конференции';
      try {
        const errorData = await res.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      }
      throw new Error(errorMessage);
    }
    
    const data = await res.json();
    
    // Закрываем модальное окно
    const modal = document.getElementById('conference-modal');
    if (modal) {
      modal.parentElement.remove();
    }
    
    // Показываем сообщение об успехе и перенаправляем
    if (data.conference && data.conference.id) {
      alert(`Конференция "${conferenceData.name}" успешно создана!`);
      window.location.href = `/conference/${data.conference.id}`;
    } else {
      alert('Конференция создана, но произошла ошибка при получении данных');
    }
    
  } catch (err) {
    console.error('Ошибка создания конференции:', err);
    alert(`Не удалось создать конференцию: ${err.message}`);
  }
}

// Обновляем обработчики в DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  checkServiceStatus();
  checkAuthStatus();
  
  const connectBtn = document.getElementById('conf_connect');
  if (connectBtn) connectBtn.addEventListener('click', connectConference);
  
  const createBtn = document.getElementById('createconf');
  if (createBtn) {
    createBtn.addEventListener('click', createConference);
  }
});

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
    createBtn.addEventListener('click', () => {
      createConference();
    });
  }
});