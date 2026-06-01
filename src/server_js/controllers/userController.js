const UserService = require('../services/userService');
const Conference = require('../models/Conference');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

// ============================================
// GET /api/users/profile
// ============================================

const getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await UserService.getUserProfile(userId);
    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error.message);
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(500).json({ message: 'Error fetching profile' });
  }
};

// ============================================
// PUT /api/users/profile
// ============================================

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { username } = req.body;

    if (!username || username.trim().length < 2) {
      return res.status(400).json({ message: 'Name must be at least 2 characters' });
    }

    if (username.trim().length > 100) {
      return res.status(400).json({ message: 'Name is too long (max 100 characters)' });
    }

    const updated = await User.update(userId, { username: username.trim() });

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updated.id,
        email: updated.email,
        username: updated.username
      }
    });
  } catch (error) {
    console.error('Update profile error:', error.message);
    res.status(500).json({ message: 'Error updating profile' });
  }
};

// ============================================
// POST /api/users/avatar
// ============================================

const uploadAvatar = async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Build public URL for the avatar
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Delete old avatar file if exists
    const user = await User.findById(userId);
    if (user.avatar_url) {
      const oldPath = path.join('/app', user.avatar_url);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Save new avatar URL to DB
    await User.update(userId, { avatar_url: avatarUrl });

    res.json({
      message: 'Avatar uploaded successfully',
      avatarUrl
    });
  } catch (error) {
    console.error('Upload avatar error:', error.message);
    res.status(500).json({ message: 'Error uploading avatar' });
  }
};

// ============================================
// DELETE /api/users/avatar
// ============================================

const deleteAvatar = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (user.avatar_url) {
      const filePath = path.join('/app', user.avatar_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      await User.update(userId, { avatar_url: null });
    }

    res.json({ message: 'Avatar removed successfully' });
  } catch (error) {
    console.error('Delete avatar error:', error.message);
    res.status(500).json({ message: 'Error removing avatar' });
  }
};

// ============================================
// GET /api/users/stats
// ============================================

const getStats = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get conferences hosted by user
    const hosted = await Conference.findUserConferences(userId, 'host');

    // Get conferences attended as participant
    const attended = await Conference.findUserConferences(userId, 'participant');

    // TODO: Add total duration tracking when conference recording is implemented
    const stats = {
      conferencesHosted: hosted.length,
      conferencesAttended: attended.length,
      totalConferences: hosted.length + attended.length,
      memberSince: null // will be filled from user data below
    };

    const user = await User.findById(userId);
    stats.memberSince = user.created_at;

    res.json({ stats });
  } catch (error) {
    console.error('Get stats error:', error.message);
    res.status(500).json({ message: 'Error fetching stats' });
  }
};

// ============================================
// DELETE /api/users/account
// ============================================

const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password required to delete account' });
    }

    // Verify password before deleting
    const bcrypt = require('bcrypt');
    const user = await User.findById(userId);
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    // Delete avatar file if exists
    if (user.avatar_url) {
      const filePath = path.join('/app', user.avatar_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Delete user — conferences cascade via FK
    await User.delete(userId);

    // Clear auth cookie
    res.clearCookie('token');

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error.message);
    res.status(500).json({ message: 'Error deleting account' });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadAvatar,
  deleteAvatar,
  getStats,
  deleteAccount
};