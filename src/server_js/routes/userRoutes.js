const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { 
  getProfile, 
  updateProfile, 
  getUsers, 
  deleteUser, 
  changePassword,
  getUserStats 
} = require('../controllers/userController');

// Все маршруты пользователя требуют аутентификации
router.use(authenticateToken);

// Получение профиля пользователя
router.get('/profile', getProfile);

// Обновление профиля пользователя
router.put('/profile', updateProfile);

// Получение статистики пользователя
router.get('/stats', getUserStats);

// Смена пароля
router.put('/password', changePassword);

// Удаление аккаунта (для администраторов)
router.delete('/', deleteUser);

// Получение списка пользователей (для администраторов)
// router.get('/', getUsers);

module.exports = router;
