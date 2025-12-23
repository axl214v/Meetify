const mysql = require('mysql');
const config = require('../config/config');

// Создаем пул соединений для лучшей производительности
const pool = mysql.createPool({
  host: config.database.host,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  port: config.database.port,
  waitForConnections: config.database.waitForConnections,
  connectionLimit: config.database.connectionLimit,
  queueLimit: config.database.queueLimit
});

// Проверяем соединение
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }
  console.log('Connected to MySQL database');
  connection.release();
});

// Экспортируем пул для использования в других частях приложения
module.exports = pool;
