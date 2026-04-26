const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/config');

const authenticateToken = async (req, res, next) => {
    try {
        let token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token && req.cookies) {
            token = req.cookies.token;
        }
        if (!token) {
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }

        const decoded = jwt.verify(token, config.jwt.secret);
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ message: 'Invalid token. User not found.' });
        }

        req.user = { ...user, userId: user.id }; // ← здесь, внутри функции
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

const requireRole = (requiredRole) => {
    return (req, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
            if (req.user.role !== requiredRole) {
                return res.status(403).json({ message: 'Insufficient permissions' });
            }
            next();
        } catch (error) {
            res.status(500).json({ message: 'Error checking permissions' });
        }
    };
};

const requireNotAuthenticated = (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (token) {
            jwt.verify(token, config.jwt.secret);
            return res.status(400).json({ message: 'You are already logged in' });
        }
        next();
    } catch (error) {
        next();
    }
};

module.exports = { authenticateToken, requireRole, requireNotAuthenticated };