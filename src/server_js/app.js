const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config/config');

// Сервисы и роуты
const db = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const conferenceRoutes = require('./routes/conferenceRoutes');
const healthRoutes = require('./routes/healthRoutes');

// Создаём экземпляр приложения
const app = express();

// Middleware
app.use(cors(config.client.allowedOrigins));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Маршруты
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conferences', conferenceRoutes);

app.use('/', healthRoutes);

// Статические файлы и корневой роут
app.use(express.static(path.join(__dirname, '../client')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Error‑middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: config.environment.development ? err.message : {}
  });
});

// 404‑handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

module.exports = app;