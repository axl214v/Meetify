// routes/healthRoutes.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/database');

// Health check endpoint
router.get('/check-status', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    socketConnections: req.app.get('io')?.engine?.clientsCount || 0,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Alternative health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// Root endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'Meetify API',
    version: '1.0.0',
    status: 'running'
  });
});

// Public — no auth required
router.get('/public/socials', async (req, res) => {
    try {
        const [[row]] = await db.promise().query(
            'SELECT value FROM app_settings WHERE `key` = ?', ['social_links']
        );
        const all   = row ? JSON.parse(row.value) : [];
        const links = all.filter(l => l.visible !== false);
        res.json({ links });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;