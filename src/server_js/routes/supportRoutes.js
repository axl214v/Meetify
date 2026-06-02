const express  = require('express');
const router   = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db       = require('../config/database');

const CATEGORIES = ['technical', 'account', 'general', 'other'];

// User: list own tickets
router.get('/tickets', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            `SELECT t.id, t.title, t.category, t.status, t.created_at, t.updated_at,
                    (SELECT COUNT(*) FROM ticket_replies WHERE ticket_id = t.id) AS reply_count
             FROM support_tickets t
             WHERE t.user_id = ?
             ORDER BY t.updated_at DESC`,
            [req.user.userId]
        );
        res.json({ tickets: rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// User: create ticket
router.post('/tickets', authenticateToken, async (req, res) => {
    const { title, category, message } = req.body;
    if (!title?.trim() || !message?.trim())
        return res.status(400).json({ error: 'Title and message are required' });

    try {
        // Max 5 open/in_progress tickets per user
        const [[{ open }]] = await db.promise().query(
            "SELECT COUNT(*) AS open FROM support_tickets WHERE user_id = ? AND status != 'closed'",
            [req.user.userId]
        );
        if (open >= 5)
            return res.status(429).json({ error: 'You already have 5 open tickets. Please close some before opening new ones.' });

        const [result] = await db.promise().query(
            'INSERT INTO support_tickets (user_id, title, category) VALUES (?, ?, ?)',
            [req.user.userId, title.trim(), CATEGORIES.includes(category) ? category : 'general']
        );
        const ticketId = result.insertId;
        await db.promise().query(
            'INSERT INTO ticket_replies (ticket_id, user_id, is_admin, message) VALUES (?, ?, 0, ?)',
            [ticketId, req.user.userId, message.trim()]
        );
        res.status(201).json({ ticketId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get single ticket + replies (own ticket or admin)
router.get('/tickets/:id', authenticateToken, async (req, res) => {
    try {
        const [[ticket]] = await db.promise().query(
            `SELECT t.*, u.username FROM support_tickets t
             JOIN users u ON u.id = t.user_id WHERE t.id = ?`,
            [req.params.id]
        );
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
        if (ticket.user_id !== req.user.userId && req.user.role !== 'admin')
            return res.status(403).json({ error: 'Forbidden' });

        const [replies] = await db.promise().query(
            `SELECT r.*, u.username FROM ticket_replies r
             JOIN users u ON u.id = r.user_id
             WHERE r.ticket_id = ? ORDER BY r.created_at ASC`,
            [req.params.id]
        );
        res.json({ ticket, replies });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Add reply (own ticket or admin)
router.post('/tickets/:id/replies', authenticateToken, async (req, res) => {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });

    try {
        const [[ticket]] = await db.promise().query(
            'SELECT * FROM support_tickets WHERE id = ?', [req.params.id]
        );
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
        if (ticket.user_id !== req.user.userId && req.user.role !== 'admin')
            return res.status(403).json({ error: 'Forbidden' });
        if (ticket.status === 'closed')
            return res.status(400).json({ error: 'Ticket is closed' });

        const isAdmin = req.user.role === 'admin';
        await db.promise().query(
            'INSERT INTO ticket_replies (ticket_id, user_id, is_admin, message) VALUES (?, ?, ?, ?)',
            [req.params.id, req.user.userId, isAdmin ? 1 : 0, message.trim()]
        );
        if (isAdmin && ticket.status === 'open') {
            await db.promise().query(
                "UPDATE support_tickets SET status = 'in_progress' WHERE id = ?", [req.params.id]
            );
        }
        await db.promise().query(
            'UPDATE support_tickets SET updated_at = NOW() WHERE id = ?', [req.params.id]
        );
        res.status(201).json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
