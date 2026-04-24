const db = require('../config/database');
const os = require('os');
const Conference = require('../models/Conference');

const adminController = {

    getStats: async (req, res) => {
        try {
            const [[{ users }]]       = await db.promise().query('SELECT COUNT(*) as users FROM users');
            const [[{ conferences }]] = await db.promise().query('SELECT COUNT(*) as conferences FROM conferences');
            const [[{ active }]]      = await db.promise().query(`
                SELECT COUNT(*) as active FROM conferences
                WHERE (end_time IS NULL OR end_time >= NOW())
                AND (start_time IS NULL OR start_time <= NOW())
            `);
            const [[{ joins }]]       = await db.promise().query('SELECT COUNT(*) as joins FROM conference_members');
            const [recentUsers]       = await db.promise().query(
                'SELECT id, email, username, role, created_at FROM users ORDER BY created_at DESC LIMIT 5'
            );
            const [recentConfs]       = await db.promise().query(`
                SELECT c.id, c.name, u.username as host, c.created_at
                FROM conferences c
                LEFT JOIN users u ON c.host_id = u.id
                ORDER BY c.created_at DESC LIMIT 5
            `);

            res.json({
                stats: { users, conferences, activeConferences: active, totalJoins: joins },
                recentUsers,
                recentConferences: recentConfs
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    },

    getServerStats: (req, res) => {
        const totalMem = os.totalmem();
        const freeMem  = os.freemem();
        res.json({
            uptime:      Math.floor(process.uptime()),
            memTotal:    totalMem,
            memUsed:     totalMem - freeMem,
            memFree:     freeMem,
            memPercent:  Math.round(((totalMem - freeMem) / totalMem) * 100),
            cpuModel:    os.cpus()[0]?.model || 'Unknown',
            cpuCores:    os.cpus().length,
            loadAvg:     os.loadavg(),
            nodeVersion: process.version,
            platform:    os.platform()
        });
    },

    getUsers: async (req, res) => {
        const limit  = Math.min(parseInt(req.query.limit)  || 20, 100);
        const offset = parseInt(req.query.offset) || 0;
        const search = req.query.search ? `%${req.query.search}%` : null;

        try {
            const where  = search ? 'WHERE email LIKE ? OR username LIKE ?' : '';
            const params = search ? [search, search] : [];

            const [users] = await db.promise().query(
                `SELECT id, email, username, role, created_at, avatar_url FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            );
            const [[{ total }]] = await db.promise().query(
                `SELECT COUNT(*) as total FROM users ${where}`, params
            );
            res.json({ users, total });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    },

    deleteUser: async (req, res) => {
        if (parseInt(req.params.id) === req.user.id)
            return res.status(400).json({ error: 'Cannot delete yourself' });
        try {
            const [[user]] = await db.promise().query('SELECT role FROM users WHERE id = ?', [req.params.id]);
            if (!user) return res.status(404).json({ error: 'User not found' });
            if (user.role === 'admin') return res.status(403).json({ error: 'Cannot delete admin' });

            await db.promise().query('DELETE FROM users WHERE id = ?', [req.params.id]);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    },

    updateUserRole: async (req, res) => {
        const { role } = req.body;
        if (!['user', 'admin'].includes(role))
            return res.status(400).json({ error: 'Invalid role' });
        if (parseInt(req.params.id) === req.user.id)
            return res.status(400).json({ error: 'Cannot change own role' });
        try {
            await db.promise().query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    },

    getConferences: async (req, res) => {
        const limit  = Math.min(parseInt(req.query.limit)  || 20, 100);
        const offset = parseInt(req.query.offset) || 0;
        const search = req.query.search || null;
        try {
            const result = await Conference.findAllWithParticipantCount({
                limit, offset,
                filters: search ? { search } : {}
            });
            res.json(result);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    },

    deleteConference: async (req, res) => {
        try {
            const deleted = await Conference.delete(req.params.id);
            if (!deleted) return res.status(404).json({ error: 'Conference not found' });
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    },

    kickParticipant: async (req, res) => {
        try {
            await Conference.removeParticipant(req.params.id, req.params.userId);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    }
};

module.exports = adminController;