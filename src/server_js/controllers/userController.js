const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/config');

// Получение информации о текущем пользователе
const getProfile = async (req, res) => {
  try {
    const userId = req.user.userId; // userId из JWT токена
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Убираем пароль из ответа
    const userResponse = {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };

    res.json({ user: userResponse });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ message: 'Error fetching user profile' });
  }
};

// Обновление профиля пользователя
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { email } = req.body;

    // Проверяем, что email не пустой
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Проверяем уникальность email
    const existingUser = await User.findByEmail(email);
    if (existingUser && existingUser.id !== userId) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const updatedUser = await User.update(userId, { email });
    
    res.json({ 
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        updatedAt: updatedUser.updated_at
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Error updating profile' });
  }
};

// Получение списка пользователей (для администраторов)
const getUsers = async (req, res) => {
  try {
    // Проверяем, что пользователь авторизован
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // В будущем можно добавить проверку на роль администратора
    // if (req.user.role !== 'admin') {
    //   return res.status(403).json({ message: 'Access denied' });
    // }

    const users = await User.findAll();
    
    // Убираем пароли из ответа
    const usersResponse = users.map(user => ({
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    }));

    res.json({ users: usersResponse });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
};

// Удаление аккаунта пользователя
const deleteUser = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Проверяем существование пользователя
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Удаляем пользователя
    await User.delete(userId);
    
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ message: 'Error deleting account' });
  }
};

// Смена пароля
const changePassword = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    // Проверяем обязательные поля
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required' });
    }

    // Проверяем длину нового пароля
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    // Получаем текущего пользователя
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Проверяем текущий пароль
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Хешируем новый пароль
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Обновляем пароль
    await User.updatePassword(userId, hashedPassword);
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Error changing password' });
  }
};

// Получение статистики пользователя (будущее)
const getUserStats = async (req, res) => {
  try {
    const userId = req.user.userId;

    // В будущем можно добавить запросы к БД для получения статистики
    const stats = {
      userId: userId,
      totalConferences: 0, // Будет заполнено при реализации конференций
      totalMinutes: 0,    // Будет заполнено при реализации конференций
      lastActive: new Date()
    };

    res.json({ stats });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ message: 'Error fetching user stats' });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getUsers,
  deleteUser,
  changePassword,
  getUserStats
};
