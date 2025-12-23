const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { 
  createConference,
  getConference,
  updateConference,
  deleteConference,
  joinConference,
  leaveConference,
  getConferenceParticipants,
  getConferences
} = require('../controllers/conferenceController');

// Все маршруты конференций требуют аутентификации
router.use(authenticateToken);

// Создание новой конференции
router.post('/', createConference);

// Получение информации о конференции
router.get('/:id', getConference);

// Обновление конференции
router.put('/:id', updateConference);

// Удаление конференции
router.delete('/:id', deleteConference);

// Присоединение к конференции
router.post('/:id/join', joinConference);

// Покидание конференции
router.post('/:id/leave', leaveConference);

// Получение участников конференции
router.get('/:id/participants', getConferenceParticipants);

// Получение списка конференций
router.get('/', getConferences);

module.exports = router;
