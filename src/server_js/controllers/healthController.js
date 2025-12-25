const healthService = require('../services/healthService');

const checkStatus = async (req, res, next) => {
  try {
    const data = await healthService.getStatus();
    res.json(data);           // {status:"ok",timestamp:"2024‑10‑12T17:05:43.221Z"}
  } catch (err) {
    console.error('Health‑check failed', err);
    // 503 – Service Unavailable
    res.status(503).json({ status: 'error', message: 'Health check failed' });
  }
};

module.exports = {
  checkStatus,
};