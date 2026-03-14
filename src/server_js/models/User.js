const db = require('../config/database');

const User = {
    findByEmail: (email) => {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM users WHERE email = ?';
            db.query(query, [email], (error, results) => {
                if (error) return reject(error);
                resolve(results[0]);
            });
        });
    },

    create: (userData) => {
        return new Promise((resolve, reject) => {
            const query = 'INSERT INTO users (email, username, password) VALUES (?, ?, ?)';
            db.query(query, [userData.email, userData.username, userData.password], (error, results) => {
                if (error) return reject(error);
                resolve({ id: results.insertId, ...userData });
            });
        });
    }
};

module.exports = User;