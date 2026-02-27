// routes/healthRoutes.js
const express = require('express');
const router = express.Router();

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

module.exports = router;