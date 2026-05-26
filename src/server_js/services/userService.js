const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

class UserService {
  // Создание нового пользователя
  static async createUser(userData) {
    try {
        const { email, password, name, username } = userData;
        const userName = username || name; // поддержка обоих вариантов

        if (!email) throw new Error('Email is required');

        const existingUser = await User.findByEmail(email);
        if (existingUser) throw new Error('Email already exists');

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            email,
            username: userName,
            password: hashedPassword
        });

        return user;
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
  }

  // Аутентификация пользователя
  static async authenticateUser(email, password) {
    try {
      // Находим пользователя по email
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

      // Возвращаем данные пользователя и токен
      return {
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.created_at
        },
        token
      };
    } catch (error) {
      console.error('Error authenticating user:', error);
      throw error;
    }
  }

  // Получение профиля пользователя
  static async getUserProfile(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar_url: user.avatar_url,
        email_verified: !!user.email_verified,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  }

  // Обновление профиля пользователя
  static async updateUserProfile(userId, updateData) {
    try {
      // Проверяем, что пользователь существует
      const existingUser = await User.findById(userId);
      if (!existingUser) {
        throw new Error('User not found');
      }

      // Если обновляется email, проверяем уникальность
      if (updateData.email) {
        const emailExists = await User.findByEmail(updateData.email);
        if (emailExists && emailExists.id !== userId) {
          throw new Error('Email already exists');
        }
      }

      const updatedUser = await User.update(userId, updateData);
      
      return {
        id: updatedUser.id,
        email: updatedUser.email,
        updatedAt: updatedUser.updated_at
      };
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  // Смена пароля
  static async changeUserPassword(userId, currentPassword, newPassword) {
    try {
      // Проверяем, что пользователь существует
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Проверяем текущий пароль
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        throw new Error('Current password is incorrect');
      }

      // Проверяем длину нового пароля
      if (newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters long');
      }

      // Хешируем новый пароль
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Обновляем пароль
      await User.updatePassword(userId, hashedPassword);

      return { message: 'Password changed successfully' };
    } catch (error) {
      console.error('Error changing user password:', error);
      throw error;
    }
  }

  // Удаление аккаунта пользователя
  static async deleteUserAccount(userId) {
    try {
      // Проверяем, что пользователь существует
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Удаляем пользователя
      await User.delete(userId);

      return { message: 'Account deleted successfully' };
    } catch (error) {
      console.error('Error deleting user account:', error);
      throw error;
    }
  }

  // Получение списка пользователей (для администраторов)
  static async getUsers(limit = 100, offset = 0) {
    try {
      const users = await User.findAll(limit, offset);
      
      return users.map(user => ({
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }));
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  // Проверка существования пользователя
  static async userExists(userId) {
    try {
      const exists = await User.exists(userId);
      return exists;
    } catch (error) {
      console.error('Error checking user existence:', error);
      throw error;
    }
  }

  // Валидация данных пользователя
  static validateUserData(userData) {
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

  // Генерация refresh токена (для будущего использования)
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
}

module.exports = UserService;
