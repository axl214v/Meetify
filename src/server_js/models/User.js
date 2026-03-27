const db = require('../config/database');

const User = {
    findById: (id) => {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM users WHERE id = ?';
            db.query(query, [id], (error, results) => {
                if (error) return reject(error);
                resolve(results[0]);
            });
        });
    }, 
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
    },
    update: (id, data) => {
        return new Promise((resolve, reject) => {
            const fields = Object.keys(data)
                .map(key => `${key} = ?`)
                .join(', ');
            const values = [...Object.values(data), id];

            const query = `UPDATE users SET ${fields} WHERE id = ?`;

            db.query(query, values, (error, result) => {
                if (error) return reject(error);
                // возвращаем обновлённого юзера
                db.query('SELECT * FROM users WHERE id = ?', [id], (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows[0]);
                });
            });
        });
    },

    delete: (id) => {
        return new Promise((resolve, reject) => {
            db.query('DELETE FROM users WHERE id = ?', [id], (error) => {
                if (error) return reject(error);
                resolve(true);
            });
        });
    }
};

module.exports = User;