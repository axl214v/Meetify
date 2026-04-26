const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const UserService = require('./userService');
const db = require('../config/database');

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
        avatar_url: user.avatar_url,
        role: user.role,
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

  static async forgotPassword(email) {
    const crypto = require('crypto');
    const config = require('../config/config');
 
    // Find user — don't throw if not found (security)
    const user = await User.findByEmail(email);
    if (!user) {
        return { resetLink: null }; // silent — don't reveal email existence
    }
 
    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
 
    // Save token to DB
    await db.promise().execute(
        'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
        [user.id, token, expiresAt]
    );
 
    // Build reset URL
    const resetLink = `${config.client.url}/auth/resetpass-confirm.html?token=${token}`;
 
    // TODO: When email service is ready, send email here:
    // await EmailService.sendPasswordReset(email, resetLink);
 
    // DEV MODE: return link directly (remove resetLink in production)
    return { resetLink };
}
 
static async validateResetToken(token) {
    const [rows] = await db.promise().execute(
        'SELECT * FROM password_reset_tokens WHERE token = ? AND used = FALSE AND expires_at > NOW()',
        [token]
    );
 
    if (rows.length === 0) {
        throw new Error('Invalid or expired reset token');
    }
 
    return rows[0];
}
 
static async confirmResetPassword(token, newPassword) {
    const bcrypt = require('bcrypt');
 
    // Validate token
    const tokenRow = await this.validateResetToken(token);
 
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
 
    // Update user password
    await User.update(tokenRow.user_id, { password: hashedPassword });
 
    // Mark token as used
    await db.promise().execute(
        'UPDATE password_reset_tokens SET used = TRUE WHERE token = ?',
        [token]
    );
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