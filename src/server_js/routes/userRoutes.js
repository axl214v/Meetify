const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const userController = require('../controllers/userController');
const multer = require('multer');
const path = require('path');

// ============================================
// Multer config for avatar uploads
// ============================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/avatars'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar_${req.user.userId}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG and WebP images are allowed'));
    }
  }
});

// ============================================
// Routes — all require auth
// ============================================

// GET  /api/users/profile       — get current user profile
router.get('/profile', authenticateToken, userController.getProfile);

// PUT  /api/users/profile       — update name
router.put('/profile', authenticateToken, userController.updateProfile);

// POST /api/users/avatar        — upload avatar
router.post('/avatar', authenticateToken, upload.single('avatar'), userController.uploadAvatar);

// DELETE /api/users/avatar      — remove avatar (revert to initials)
router.delete('/avatar', authenticateToken, userController.deleteAvatar);

// GET  /api/users/stats         — conference statistics
router.get('/stats', authenticateToken, userController.getStats);

// DELETE /api/users/account     — delete account
router.delete('/account', authenticateToken, userController.deleteAccount);

module.exports = router;