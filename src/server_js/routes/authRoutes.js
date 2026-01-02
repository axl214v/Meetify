const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { 
  register, 
  login, 
  refreshToken,
  logout,
  getCurrentUser,
  changePassword
} = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');


//Строгий лимитер для аутентификации
 // 5 попыток за 15 минут
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5,
  message: {
    message: 'Too many authentication attempts',
    error: 'You have exceeded the maximum number of login attempts. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});


// Лимитер для регистрации
// 3 регистрации за час с одного IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 3,
  message: {
    message: 'Too many registration attempts',
    error: 'You can only register 3 accounts per hour from this IP address.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});


// Лимитер для смены пароля
// 3 попытки за час
const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 3,
  message: {
    message: 'Too many password change attempts',
    error: 'You can only change your password 3 times per hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});


// Лимитер для refresh токенов
// 10 запросов за минуту

const refreshLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 минута
  max: 10,
  message: {
    message: 'Too many token refresh requests',
    error: 'Please slow down your token refresh requests.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});


// Публичные маршруты (без аутентификации)

router.post('/register', registerLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refreshLimiter, refreshToken);


// Защищенные маршруты (требуют аутентификации)

router.post('/logout', authenticateToken, logout);
router.get('/me', authenticateToken, getCurrentUser);
router.put('/change-password', authenticateToken, passwordChangeLimiter, changePassword);

// Обработка несуществующих маршрутов
router.use((req, res) => {
  res.status(404).json({
    message: 'Auth endpoint not found',
    availableEndpoints: [
      'POST /api/auth/register',
      'POST /api/auth/login',
      'POST /api/auth/refresh',
      'POST /api/auth/logout (protected)',
      'GET /api/auth/me (protected)',
      'PUT /api/auth/change-password (protected)'
    ]
  });
});

module.exports = router;