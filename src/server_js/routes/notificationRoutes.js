const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Notification = require('../models/Notification');

router.get('/', authenticateToken, async (req, res) => {
    try {
        const notifications = await Notification.getAll(50);
        res.json({ notifications });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
