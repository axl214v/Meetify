const db = require('../config/database');

const Notification = {
    async create({ title, message, category, createdBy }) {
        const [result] = await db.promise().query(
            'INSERT INTO notifications (title, message, category, created_by) VALUES (?, ?, ?, ?)',
            [title, message, category || 'info', createdBy]
        );
        const [rows] = await db.promise().query(
            `SELECT n.*, u.username AS created_by_name
             FROM notifications n LEFT JOIN users u ON n.created_by = u.id
             WHERE n.id = ?`,
            [result.insertId]
        );
        return rows[0];
    },

    async getAll(limit = 50) {
        const [rows] = await db.promise().query(
            `SELECT n.*, u.username AS created_by_name
             FROM notifications n LEFT JOIN users u ON n.created_by = u.id
             ORDER BY n.created_at DESC LIMIT ?`,
            [limit]
        );
        return rows;
    },

    async deleteById(id) {
        const [result] = await db.promise().query(
            'DELETE FROM notifications WHERE id = ?', [id]
        );
        return result.affectedRows > 0;
    }
};

module.exports = Notification;
