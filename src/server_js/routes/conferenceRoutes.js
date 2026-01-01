const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('../middleware/auth');
const { 
  createConference,
  getConference,
  getConferences,
  updateConference,
  deleteConference,
  joinConference,
  leaveConference,
  getConferenceParticipants,
  getUserConferences
} = require('../controllers/conferenceController');

// ============================================
// Middleware для валидации
// ============================================

/**
 * Валидация ID конференции
 */
const validateConferenceId = (req, res, next) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ 
      message: 'Invalid conference ID',
      error: 'Conference ID must be a positive integer'
    });
  }
  req.params.id = id;
  next();
};

/**
 * Валидация query параметров для списка конференций
 */
const validateQueryParams = (req, res, next) => {
  const { limit, offset } = req.query;
  
  if (limit !== undefined) {
    const parsedLimit = parseInt(limit);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({ 
        message: 'Invalid limit parameter',
        error: 'Limit must be between 1 and 100'
      });
    }
    req.query.limit = parsedLimit;
  }
  
  if (offset !== undefined) {
    const parsedOffset = parseInt(offset);
    if (isNaN(parsedOffset) || parsedOffset < 0) {
      return res.status(400).json({ 
        message: 'Invalid offset parameter',
        error: 'Offset must be a non-negative integer'
      });
    }
    req.query.offset = parsedOffset;
  }
  
  next();
};

// ============================================
// Rate Limiting
// ============================================

/**
 * Rate limiter для создания конференций
 * Ограничение: 5 конференций за 15 минут
 */
const createConferenceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5,
  message: {
    message: 'Too many conferences created',
    error: 'You can only create 5 conferences per 15 minutes. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter для присоединения к конференциям
 * Ограничение: 20 попыток за минуту
 */
const joinConferenceLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 минута
  max: 20,
  message: {
    message: 'Too many join requests',
    error: 'You can only join 20 conferences per minute. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter для общих запросов
 * Ограничение: 100 запросов за минуту
 */
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 минута
  max: 100,
  message: {
    message: 'Too many requests',
    error: 'You have exceeded the rate limit. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});


router.use(authenticateToken);

router.use(generalLimiter);

router.get('/', validateQueryParams, getConferences);
router.get('/user/my', getUserConferences);
router.post('/', createConferenceLimiter, createConference);
router.get('/:id', validateConferenceId, getConference);
router.put('/:id', validateConferenceId, updateConference);
router.delete('/:id', validateConferenceId, deleteConference);
router.get('/:id/participants', validateConferenceId, getConferenceParticipants);
router.post('/:id/join', validateConferenceId, joinConferenceLimiter, joinConference);
router.post('/:id/leave', validateConferenceId, leaveConference);


// Обработка 404 для несуществующих conference маршрутов
router.use((req, res) => {
  res.status(404).json({ 
    message: 'Conference endpoint not found',
    availableEndpoints: [
      'GET /api/conferences',
      'GET /api/conferences/user/my',
      'POST /api/conferences',
      'GET /api/conferences/:id',
      'PUT /api/conferences/:id',
      'DELETE /api/conferences/:id',
      'GET /api/conferences/:id/participants',
      'POST /api/conferences/:id/join',
      'POST /api/conferences/:id/leave'
    ]
  });
});

module.exports = router;