// index.js (server entry point)
const { server } = require('./app');
const config = require('./config/config');
const initDatabase = require('./utils/initDatabase');
const { createWorkers } = require('./sfu/mediasoup');
const backupScheduler = require('./services/backupScheduler');

// ============================================
// Initialize Database
// ============================================
(async () => {
  try {
    // Wait for database connection
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Initialize database schema
    await initDatabase();

    // Start mediasoup workers for SFU (Group) calls
    await createWorkers();

    // Start backup scheduler
    await backupScheduler.init();

    // Start server
    startServer();
  } catch (error) {
    console.error('Failed to initialize:', error);
    process.exit(1);
  }
})();

// ============================================
// Start Server
// ============================================
function startServer() {
  const PORT = config.server.port;
  const HOST = config.server.host;

  server.listen(PORT, HOST, () => {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║                                                       ║');
  console.log('║              🚀 Meetify Server Started               ║');
  console.log('║                                                       ║');
  console.log('╠═══════════════════════════════════════════════════════╣');
  console.log(`║  📡 Port:              ${PORT}                        ║`);
  console.log(`║  🌐 Host:              ${HOST}                 ║`);
  console.log(`║  🔧 Environment:       ${process.env.NODE_ENV || 'development'}      ║`);
  console.log(`║  🔌 Socket.IO:         Enabled                       ║`);
  console.log(`║  📊 Database:          ${config.database.database}                  ║`);
  console.log('║                                                       ║');
  console.log('╠═══════════════════════════════════════════════════════╣');
  console.log('║                    Available Routes                  ║');
  console.log('╠═══════════════════════════════════════════════════════╣');
  console.log('║  GET    /                     → Home                 ║');
  console.log('║  GET    /check-status         → Health Check         ║');
  console.log('║  POST   /api/auth/register    → Register             ║');
  console.log('║  POST   /api/auth/login       → Login                ║');
  console.log('║  GET    /api/conferences      → List Conferences     ║');
  console.log('║  POST   /api/conferences      → Create Conference    ║');
  console.log('║  WS     /socket.io            → WebSocket Connection ║');
  console.log('║                                                       ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('\n');
  console.log(`✨ Server ready at: ${config.server.url}`);
  console.log(`🔗 Client URL: ${config.client.url}`);
  console.log('\n');
  
  if (config.environment.development) {
    console.log('🛠️  Development mode: Detailed logging enabled');
  }
  
  if (config.environment.production) {
    console.log('🔒 Production mode: Security features enabled');
  }
  
  console.log('\n📝 Press CTRL+C to stop the server\n');
});
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('\n❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Don't exit in development
  if (config.environment.production) {
    process.exit(1);
  }
});

// Log startup environment info
if (config.environment.development) {
  console.log('\n📌 Development Configuration:');
  console.log('   - CORS:', config.client.allowedOrigins);
  console.log('   - JWT Expiry:', config.jwt.expiresIn);
  console.log('   - Max Conference Participants:', config.conference.maxParticipants);
  console.log('   - Recording Enabled:', config.conference.recordingEnabled);
  console.log('   - Screen Sharing Enabled:', config.conference.screenSharingEnabled);
  console.log('\n');
}