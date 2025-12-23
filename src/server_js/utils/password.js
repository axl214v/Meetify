const bcrypt = require('bcrypt');

class PasswordUtils {
  // Хеширование пароля
  static async hashPassword(password) {
    try {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      return hashedPassword;
    } catch (error) {
      console.error('Error hashing password:', error);
      throw new Error('Password hashing failed');
    }
  }

  // Проверка пароля
  static async verifyPassword(password, hashedPassword) {
    try {
      const isMatch = await bcrypt.compare(password, hashedPassword);
      return isMatch;
    } catch (error) {
      console.error('Error verifying password:', error);
      throw new Error('Password verification failed');
    }
  }

  // Проверка сложности пароля
  static validatePassword(password) {
    const errors = [];

    if (!password) {
      errors.push('Password is required');
    } else {
      if (password.length < 6) {
        errors.push('Password must be at least 6 characters long');
      }

      if (!/(?=.*[a-z])/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
      }

      if (!/(?=.*[A-Z])/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
      }

      if (!/(?=.*\d)/.test(password)) {
        errors.push('Password must contain at least one number');
      }

      if (!/(?=.*[!@#$%^&*])/.test(password)) {
        errors.push('Password must contain at least one special character');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Генерация случайного пароля
  static generateRandomPassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }
    
    return password;
  }
}

module.exports = PasswordUtils;
