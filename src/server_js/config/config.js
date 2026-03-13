// Конфигурационный файл для Meetify

const config = {
  // База данных
  database: {
    host: process.env.DB_HOST || '0.0.0.0',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'meetify',
    port: process.env.DB_PORT || 3306,
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0
  },

  // JWT настройки
  jwt: {
    secret: process.env.JWT_SECRET || 'axl2145kjsdfh!@#$',
    expiresIn: '24h',
    issuer: 'meetify-app',
    audience: 'meetify-users'
  },

  // Серверные настройки
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
    url: process.env.SERVER_URL || 'http://localhost:3000'
  },

  // Клиентские настройки
  client: {
    url: process.env.CLIENT_URL || 'http://localhost:3000',
    allowedOrigins: [
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ]
  },

  // Socket.IO настройки
  socket: {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 45000,
    pingInterval: 25000
  },

  // Безопасность
  security: {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 минут
      max: 100 // лимит запросов на IP
    },
    csrf: {
      enabled: false // включить при необходимости
    }
  },

  // Логирование
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'combined' // или 'json'
  },

  // Файловые настройки
  files: {
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: process.env.MAX_FILE_SIZE || 5 * 1024 * 1024, // 5MB
    allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'webm']
  },

  // Настройки конференций
  conference: {
    maxParticipants: process.env.MAX_PARTICIPANTS || 100,
    maxDuration: process.env.MAX_DURATION || 24 * 60 * 60, // 24 часа в секундах
    recordingEnabled: process.env.RECORDING_ENABLED === 'true' || false,
    screenSharingEnabled: process.env.SCREEN_SHARING_ENABLED === 'true' || true
  },

  // Типы окружений
  environment: {
    development: process.env.NODE_ENV === 'development',
    production: process.env.NODE_ENV === 'production',
    test: process.env.NODE_ENV === 'test'
  }
};

// Валидация конфигурации
function validateConfig() {
  if (!config.jwt.secret) {
    console.warn('Warning: JWT_SECRET is not set in environment variables');
  }

  if (!config.database.database) {
    throw new Error('Database name is required in configuration');
  }

  return true;
}

// Применяем валидацию
validateConfig();

module.exports = config;