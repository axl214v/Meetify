const express = require('express');
const router = express.Router();

const healthService = require('../services/healthService');
const checkStatus = async (req, res, next) => {
  try {
    const data = await healthService.getStatus();
    res.json(data);   // {status:"ok",timestamp:"…"}
  } catch (err) {
    console.error('Health‑check failed', err);
    res.status(503).json({ status: 'error', message: 'Health check failed' });
  }
};

router.get('/check-status', checkStatus);  

module.exports = router;