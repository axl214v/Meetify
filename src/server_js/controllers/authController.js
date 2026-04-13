const AuthService = require('../services/authService');

// Регистрация нового пользователя
const register = async (req, res) => {
  try {
    const result = await AuthService.register(req.body);
    
    res.status(201).json({
      message: 'User registered successfully',
      ...result
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    // Обработка специфичных ошибок
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      return res.status(409).json({ 
        message: 'User with this email already exists' 
      });
    }
    
    if (error.message.includes('validation') || error.message.includes('Invalid') || error.message.includes('required')) {
      return res.status(400).json({ 
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      message: 'An error occurred during registration. Please try again.' 
    });
  }
};

// Вход пользователя
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Email and password are required' 
      });
    }
    
    const result = await AuthService.login(email, password);
    
    // ✅ сохраняй токен в httpOnly cookie
    res.cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 24 * 60 * 60 * 1000
    });
    
    res.json({
        message: 'Login successful',
        user: result.user
    });
  } catch (error) {
    console.error('Login error:', error);
    
    if (error.message.includes('Invalid')) {
      return res.status(401).json({ 
        message: 'Invalid credentials' 
      });
    }
    
    res.status(500).json({ 
      message: 'An error occurred during login. Please try again.' 
    });
  }
};

// Обновление токена
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ 
        message: 'Refresh token is required' 
      });
    }
    
    const result = await AuthService.refreshToken(refreshToken);
    
    res.json({
      message: 'Token refreshed successfully',
      ...result
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    
    if (error.message.includes('Invalid') || error.message.includes('expired')) {
      return res.status(401).json({ 
        message: 'Invalid or expired refresh token' 
      });
    }
    
    res.status(500).json({ 
      message: 'An error occurred during token refresh' 
    });
  }
};


// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
 
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }
 
        const result = await AuthService.forgotPassword(email);
 
        // Always return 200 — don't reveal if email exists
        res.json({
            message: 'If this email is registered, a reset link has been sent.',
            // DEV MODE: include reset link directly (remove in production)
            resetLink: result.resetLink || null
        });
 
    } catch (error) {
        console.error('Forgot password error:', error.message);
        res.status(500).json({ message: 'Error processing request' });
    }
};
 
// GET /api/auth/reset-password/validate?token=xxx
const validateResetToken = async (req, res) => {
    try {
        const { token } = req.query;
 
        if (!token) {
            return res.status(400).json({ message: 'Token is required' });
        }
 
        await AuthService.validateResetToken(token);
        res.json({ valid: true });
 
    } catch (error) {
        res.status(400).json({ valid: false, message: error.message });
    }
};
 
// POST /api/auth/reset-password/confirm
const confirmResetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
 
        if (!token || !newPassword) {
            return res.status(400).json({ message: 'Token and new password are required' });
        }
 
        if (newPassword.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters' });
        }
 
        await AuthService.confirmResetPassword(token, newPassword);
        res.json({ message: 'Password reset successfully' });
 
    } catch (error) {
        console.error('Confirm reset error:', error.message);
 
        if (error.message.includes('expired') || error.message.includes('Invalid')) {
            return res.status(400).json({ message: error.message });
        }
 
        res.status(500).json({ message: 'Error resetting password' });
    }
};


// Выход пользователя

const logout = async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    const result = await AuthService.logout(token);
    
    res.json(result);
  } catch (error) {
    console.error('Logout error:', error);
    
    res.status(500).json({ 
      message: 'An error occurred during logout' 
    });
  }
};


// Получение текущего пользователя
 
const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await AuthService.getCurrentUser(userId);
    
    res.json({ user });
  } catch (error) {
    console.error('Get current user error:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ 
        message: 'User not found' 
      });
    }
    
    res.status(500).json({ 
      message: 'An error occurred while fetching user data' 
    });
  }
};


// Смена пароля
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        message: 'Current password and new password are required' 
      });
    }
    
    await AuthService.changePassword(userId, currentPassword, newPassword);
    
    res.json({ 
      message: 'Password changed successfully' 
    });
  } catch (error) {
    console.error('Change password error:', error);
    
    if (error.message.includes('incorrect') || error.message.includes('Invalid')) {
      return res.status(401).json({ 
        message: error.message 
      });
    }
    
    if (error.message.includes('validation') || error.message.includes('must')) {
      return res.status(400).json({ 
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      message: 'An error occurred while changing password' 
    });
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  validateResetToken,
  confirmResetPassword,
  refreshToken,
  logout,
  getCurrentUser,
  changePassword
};