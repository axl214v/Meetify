const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const UserService = require('./userService');

class AuthService {
  // Регистрация нового пользователя
  static async register(userData) {
    try {
      // Валидация данных пользователя
      const validation = UserService.validateUserData(userData);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      // Создание пользователя через UserService
      const user = await UserService.createUser(userData);
      
      // Генерация JWT токена
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email 
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      return {
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.created_at
        },
        token
      };
    } catch (error) {
      console.error('Error registering user:', error);
      throw error;
    }
  }

  // Аутентификация пользователя
  static async login(email, password) {
    try {
      // Проверяем существование пользователя
      const user = await User.findByEmail(email);
      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Проверяем пароль
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        throw new Error('Invalid email or password');
      }

      // Генерируем JWT токен
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email 
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      return {
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.created_at
        },
        token
      };
    } catch (error) {
      console.error('Error logging in user:', error);
      throw error;
    }
  }

  // Проверка валидности токена
  static async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      return decoded;
    } catch (error) {
      console.error('Error verifying token:', error);
      throw new Error('Invalid token');
    }
  }
  
  // Получение текущего пользователя по ID из токена
  static async getCurrentUser(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    
    return {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.created_at
    };
  }

  // Обновление токена (refresh)
  static async refreshToken(refreshToken) {
    try {
      // Проверяем refresh токен
      const decoded = this.verifyRefreshToken(refreshToken);
      if (!decoded) {
        throw new Error('Invalid refresh token');
      }

      // Получаем пользователя
      const user = await User.findById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Генерируем новый access токен
      const newToken = jwt.sign(
        { 
          userId: user.id, 
          email: user.email 
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      return {
        token: newToken,
        user: {
          id: user.id,
          email: user.email
        }
      };
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw error;
    }
  }

  // Выход пользователя (инвалидация токена)
  static async logout(token) {
    try {
      // В будущем можно добавить логику инвалидации токена
      // Например, добавление в черный список
      return { message: 'Successfully logged out' };
    } catch (error) {
      console.error('Error logging out:', error);
      throw error;
    }
  }

  // Проверка авторизации пользователя
  static async isAuthorized(req, res, next) {
    try {
      // Получаем токен из заголовка
      const token = req.header('Authorization')?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
      }

      // Проверяем токен
      const decoded = await this.verifyToken(token);
      
      // Добавляем пользователя в запрос
      req.user = decoded;
      next();
    } catch (error) {
      console.error('Authorization error:', error);
      res.status(401).json({ message: 'Invalid or expired token.' });
    }
  }

  static async resetPassword(name, email) {
    // Find user by email
    const user = await User.findByEmail(email);
 
    if (!user) {
        throw new Error('User not found');
    }
 
    // Check name matches (case-insensitive)
    const nameMatches = user.username &&
        user.username.toLowerCase() === name.toLowerCase();
 
    if (!nameMatches) {
        throw new Error('User not found');
    }
 
    // Generate temporary password — 12 chars, readable
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let tempPassword = '';
    for (let i = 0; i < 12; i++) {
        tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
 
    // Hash and save
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    await User.update(user.id, { password: hashedPassword });
 
    return { tempPassword };
  }

  // Валидация данных для регистрации
  static validateRegistrationData(userData) {
    const errors = [];

    if (!userData.email) {
      errors.push('Email is required');
    } else if (!this.isValidEmail(userData.email)) {
      errors.push('Invalid email format');
    }

    if (!userData.password) {
      errors.push('Password is required');
    } else if (userData.password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }

    if (!userData.confirmPassword) {
      errors.push('Confirm password is required');
    } else if (userData.password !== userData.confirmPassword) {
      errors.push('Passwords do not match');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Валидация email
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Генерация refresh токена
  static generateRefreshToken(userId) {
    return jwt.sign(
      { userId },
      config.jwt.secret,
      { expiresIn: '7d' }
    );
  }

  // Валидация refresh токена
  static verifyRefreshToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error) {
      return null;
    }
  }

  // Проверка, что пользователь не авторизован (для регистрации/входа)
  static async isNotAuthenticated(req, res, next) {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      
      if (token) {
        // Если токен есть, проверяем его
        const decoded = await this.verifyToken(token);
        // Если токен валиден, пользователь уже авторизован
        return res.status(400).json({ message: 'You are already logged in' });
      }
      
      next();
    } catch (error) {
      // Если токена нет или он невалиден, продолжаем (пользователь не авторизован)
      next();
    }
  }
}

module.exports = AuthService;