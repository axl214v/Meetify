require('dotenv').config();
const http     = require('http');
const socketIO = require('socket.io');
const jwt      = require('jsonwebtoken');
const config   = require('./config');
const { createWorkers }      = require('./mediasoup/workers');
const { registerSfuHandlers } = require('./sockets/sfuSocket');

const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
    } else {
        res.writeHead(404);
        res.end();
    }
});

const io = socketIO(server, {
    cors: config.cors,
    transports: ['websocket'],
    path: '/sfu/'
});

io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
        socket.user = jwt.verify(token, config.jwt.sharedSecret);
        next();
    } catch {
        next(new Error('Unauthorized'));
    }
});

io.on('connection', socket => {
    console.log(`[SFU] Client connected: ${socket.id} user=${socket.user.userId} conf=${socket.user.conferenceId}`);
    registerSfuHandlers(io, socket);
});

(async () => {
    await createWorkers();
    server.listen(config.server.port, config.server.host, () => {
        console.log(`[SFU] Server listening on ${config.server.host}:${config.server.port}`);
        console.log(`[SFU] MEDIASOUP_ANNOUNCED_IP=${config.mediasoup.announcedIp}`);
    });
})();
