const db = require('../config/database');
const os = require('os');
const Conference = require('../models/Conference');
const EmailService = require('../services/emailService');
const { forceDisconnectUser } = require('../sockets/conferenceSocket');

const adminController = {

    getStats: async (req, res) => {
        try {
            const [[{ users }]]        = await db.promise().query('SELECT COUNT(*) as users FROM users');
            const [[{ conferences }]]  = await db.promise().query('SELECT COUNT(*) as conferences FROM conferences');
            const [[{ active }]]       = await db.promise().query(`
                SELECT COUNT(*) as active FROM conferences
                WHERE (end_time IS NULL OR end_time >= NOW())
                AND (start_time IS NULL OR start_time <= NOW())
            `);
            const [[{ joins }]]        = await db.promise().query('SELECT COUNT(*) as joins FROM conference_members');
            const [[{ verified }]]     = await db.promise().query('SELECT COUNT(*) as verified FROM users WHERE email_verified = TRUE');
            const [[{ publicConfs }]]  = await db.promise().query('SELECT COUNT(*) as publicConfs FROM conferences WHERE is_public = 1');
            const [[{ ended }]]        = await db.promise().query('SELECT COUNT(*) as ended FROM conferences WHERE end_time IS NOT NULL AND end_time < NOW()');
            const [[{ avgPart }]]      = await db.promise().query(`
                SELECT ROUND(AVG(cnt), 1) as avgPart FROM (
                    SELECT conference_id, COUNT(*) as cnt FROM conference_members GROUP BY conference_id
                ) t
            `);

            const socketConnections = req.app.get('io')?.engine?.clientsCount || 0;

            const [recentUsers] = await db.promise().query(
                'SELECT id, email, username, role, created_at FROM users ORDER BY created_at DESC LIMIT 5'
            );
            const [recentConfs] = await db.promise().query(`
                SELECT c.id, c.name, u.username as host, c.created_at
                FROM conferences c
                LEFT JOIN users u ON c.host_id = u.id
                ORDER BY c.created_at DESC LIMIT 5
            `);

            res.json({
                stats: {
                    users, conferences, activeConferences: active, totalJoins: joins,
                    verifiedUsers: verified, publicConferences: publicConfs,
                    endedConferences: ended, avgParticipants: avgPart || 0,
                    socketConnections
                },
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
                `SELECT id, email, username, role, created_at, avatar_url, email_verified FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
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

    getSmtpSettings: async (req, res) => {
        try {
            const settings = await EmailService.getSmtpSettings();
            // Не отдаём пароль в открытом виде
            const safe = { ...settings };
            if (safe.smtp_password) safe.smtp_password = '••••••••';
            res.json({ settings: safe });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    },

    updateSmtpSettings: async (req, res) => {
        const allowed = ['smtp_host','smtp_port','smtp_secure','smtp_ignore_tls','smtp_user','smtp_password','smtp_from','smtp_enabled'];
        try {
            for (const [key, value] of Object.entries(req.body)) {
                if (!allowed.includes(key)) continue;
                // Если пароль не менялся — пропускаем
                if (key === 'smtp_password' && value === '••••••••') continue;
                await db.promise().query(
                    'INSERT INTO app_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?',
                    [key, value, value]
                );
            }
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    },

    testSmtp: async (req, res) => {
        try {
            const settings = await EmailService.getSmtpSettings();
            // Если передали новые настройки — тестируем их, иначе текущие
            const testSettings = Object.keys(req.body).length ? req.body : settings;
            const result = await EmailService.testConnection(testSettings);
            res.json(result);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    },

    forceVerify: async (req, res) => {
        try {
            await db.promise().query(
                'UPDATE users SET email_verified = TRUE, email_verification_token = NULL, trust_level = GREATEST(trust_level, 1) WHERE id = ?',
                [req.params.id]
            );
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    },

    sendTestEmail: async (req, res) => {
        const { to } = req.body;
        if (!to) return res.status(400).json({ error: 'Email address required' });
        try {
            const result = await EmailService.send({
                to,
                subject: 'Meetify SMTP Test',
                html: `
                    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;
                        background:#0d1220;color:#f1f5f9;border-radius:12px">
                        <h2 style="color:#60a5fa">SMTP Test Successful</h2>
                        <p style="color:#94a3b8">Your Meetify SMTP configuration is working correctly.</p>
                        <p style="color:#475569;font-size:12px;margin-top:24px">Sent at ${new Date().toISOString()}</p>
                    </div>
                `
            });
            if (!result.sent) return res.status(400).json({ error: result.reason });
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
            const io = req.app.get('io');
            if (io) forceDisconnectUser(io, parseInt(req.params.userId), parseInt(req.params.id));
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    }
};

module.exports = adminController;