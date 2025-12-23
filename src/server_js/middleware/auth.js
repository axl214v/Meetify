const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/config');

// Middleware для проверки JWT токена
const authenticateToken = async (req, res, next) => {
  try {
    // Получаем токен из заголовка или cookies
    let token = req.header('Authorization')?.replace('Bearer ', '');
    
    // Если токен не в заголовке, проверяем cookies
    if (!token && req.cookies) {
      token = req.cookies.token;
    }

    // Если токен не найден
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    // Проверяем токен
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Проверяем, что пользователь еще существует
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'Invalid token. User not found.' });
    }

    // Добавляем пользователя в запрос
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    res.status(401).json({ message: 'Access denied. Invalid token.' });
  }
};

// Middleware для проверки роли пользователя (для администраторов)
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // В будущем можно добавить проверку роли пользователя
      // if (req.user.role !== requiredRole) {
      //   return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
      // }

      next();
    } catch (error) {
      res.status(500).json({ message: 'Error checking permissions' });
    }
  };
};

// Middleware для проверки, что пользователь не авторизован (для страниц входа/регистрации)
const requireNotAuthenticated = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      // Если токен есть, проверяем его
      const decoded = jwt.verify(token, config.jwt.secret);
      // Если токен валиден, пользователь уже авторизован
      return res.status(400).json({ message: 'You are already logged in' });
    }
    
    next();
  } catch (error) {
    // Если токена нет или он невалиден, продолжаем (пользователь не авторизован)
    next();
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  requireNotAuthenticated
};
