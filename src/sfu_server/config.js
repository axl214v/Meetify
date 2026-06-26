require('dotenv').config();
const os = require('os');

const config = {
    server: {
        port: parseInt(process.env.PORT) || 3001,
        host: process.env.HOST || '0.0.0.0'
    },
    jwt: {
        sharedSecret: process.env.SFU_SHARED_SECRET || 'change_me_sfu_secret'
    },
    cors: {
        origin: (process.env.CLIENT_ORIGINS || 'http://localhost').split(',').map(s => s.trim()),
        methods: ['GET', 'POST'],
        credentials: true
    },
    mediasoup: {
        numWorkers:  parseInt(process.env.MEDIASOUP_NUM_WORKERS) || os.cpus().length,
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1',
        minPort:     parseInt(process.env.MEDIASOUP_MIN_PORT) || 40000,
        maxPort:     parseInt(process.env.MEDIASOUP_MAX_PORT) || 40059
    }
};

module.exports = config;
