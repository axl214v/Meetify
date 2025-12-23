const jwt = require('jsonwebtoken');
const config = require('../config/config');

class JWTUtils {
  // Генерация JWT токена
  static generateToken(payload, options = {}) {
    try {
      const defaultOptions = {
        expiresIn: config.jwt.expiresIn,
        issuer: config.jwt.issuer,
        audience: config.jwt.audience
      };

      const finalOptions = { ...defaultOptions, ...options };
      
      const token = jwt.sign(payload, config.jwt.secret, finalOptions);
      return token;
    } catch (error) {
      console.error('Error generating JWT token:', error);
      throw new Error('Token generation failed');
    }
  }

  // Верификация JWT токена
  static verifyToken(token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      return decoded;
    } catch (error) {
      console.error('Error verifying JWT token:', error);
      
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      }
      
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      
      throw error;
    }
  }

  // Проверка валидности токена
  static isValidToken(token) {
    try {
      this.verifyToken(token);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Извлечение данных из токена
  static getTokenData(token) {
    try {
      const decoded = this.verifyToken(token);
      return decoded;
    } catch (error) {
      return null;
    }
  }

  // Генерация refresh токена
  static generateRefreshToken(payload) {
    try {
      const token = jwt.sign(payload, config.jwt.secret, { 
        expiresIn: '7d',
        issuer: config.jwt.issuer
      });
      return token;
    } catch (error) {
      console.error('Error generating refresh token:', error);
      throw new Error('Refresh token generation failed');
    }
  }

  // Проверка refresh токена
  static verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      return decoded;
    } catch (error) {
      console.error('Error verifying refresh token:', error);
      
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token has expired');
      }
      
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      }
      
      throw error;
    }
  }

  // Обновление access токена с помощью refresh токена
  static async refreshAccessToken(refreshToken) {
    try {
      const decoded = this.verifyRefreshToken(refreshToken);
      
      // Генерируем новый access токен
      const newToken = this.generateToken({
        userId: decoded.userId,
        email: decoded.email
      });
      
      return {
        token: newToken,
        userId: decoded.userId,
        email: decoded.email
      };
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw error;
    }
  }
}

module.exports = JWTUtils;