const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
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
const logRoutes = require('./routes/logRoutes');

// Socket handlers
const { initializeConferenceSocket } = require('./sockets/conferenceSocket');

// Создаём экземпляр приложения
const app = express();

// IMPORTANT: Создаём HTTP server (оборачиваем Express)
const server = http.createServer(app);

// Инициализация Socket.IO
const io = socketIO(server, {
  cors: config.socket.cors,
  transports: ['websocket', 'polling'],
  pingTimeout: config.socket.pingTimeout,
  pingInterval: config.socket.pingInterval,
  // Дополнительные настройки для production
  allowEIO3: true, // Совместимость с Engine.IO v3
  path: '/socket.io/'
});

// Делаем io доступным в приложении
app.set('io', io);

// Middleware для доступа к io в routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Middleware
app.use(cors({
  origin: config.client.allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging
app.use((req, res, next) => {
  if (config.logging.level === 'info' || config.environment.development) {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  }
  next();
});

// Маршруты API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conferences', conferenceRoutes);
app.use('/', healthRoutes);
app.use('/api/logs', logRoutes);

// Health check с Socket.IO info
app.get('/check-status', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    socketConnections: io.engine.clientsCount || 0,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Статические файлы
app.use(express.static(path.join(__dirname, '../client')));

// Маршруты для SPA (это ВАЖНО!)
app.get('/meetify/src/client/auth/:page', (req, res) => {
  res.sendFile(path.join(__dirname, '../app/auth', req.params.page));
});

app.get('/meetify/src/client/Conf/:page', (req, res) => {
  res.sendFile(path.join(__dirname, '../app/Conf', req.params.page));
});

// Корневой маршрут
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../app/index.html'));
});

// Для всех остальных маршрутов (SPA fallback)
app.get('*', (req, res, next) => {
  // Пропускаем API запросы
  if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../app/index.html'));
});

// Socket.IO Setup

// Socket.IO Authentication Middleware (опционально)
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.query.token;
  
  // TODO: Добавить проверку JWT токена
  // if (!token) {
  //   return next(new Error('Authentication error'));
  // }
  
  // const decoded = jwt.verify(token, config.jwt.secret);
  // socket.userId = decoded.userId;
  
  console.log(`[Socket.IO] New connection attempt: ${socket.id}`);
  next();
});

// Инициализация Socket.IO обработчиков для конференций
initializeConferenceSocket(io);

// Базовые Socket.IO события
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}, Total: ${io.engine.clientsCount}`);
  
  socket.on('disconnect', (reason) => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}, Reason: ${reason}`);
  });
  
  socket.on('error', (error) => {
    console.error(`[Socket.IO] Socket error (${socket.id}):`, error);
  });
  
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

// Error Handling

// Error middleware
app.use((err, req, res, next) => {
  console.error('[Error Handler]', err.stack);
  
  res.status(err.status || 500).json({
    message: err.message || 'Something went wrong!',
    error: config.environment.development ? err.message : {},
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    message: 'Route not found',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// Graceful Shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown(signal) {
  console.log(`\n${signal} signal received: closing server gracefully`);
  
  server.close(() => {
    console.log('HTTP server closed');
    
    // Close Socket.IO
    io.close(() => {
      console.log('Socket.IO closed');
    });
    
    // Close database connections
    db.end((err) => {
      if (err) {
        console.error('Error closing database:', err);
        process.exit(1);
      }
      console.log('Database connections closed');
      process.exit(0);
    });
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

module.exports = { app, server, io };