const mysql = require('mysql');
const config = require('../config/config');

const pool = mysql.createPool({
  host: config.database.host,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  port: config.database.port,
});

async function checkDb() {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        return reject(err);
      }
      connection.release();
      resolve();
    });
  });
}

module.exports = {
  async getStatus() {
     await checkDb();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  },
};