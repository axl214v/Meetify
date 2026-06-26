const mediasoup = require('mediasoup');
const config    = require('../config');

const workers = [];
let workerIdx = 0;

const mediaCodecs = [
    {
        kind:      'audio',
        mimeType:  'audio/opus',
        clockRate: 48000,
        channels:  2,
    },
    {
        kind:       'video',
        mimeType:   'video/VP9',
        clockRate:  90000,
        parameters: { 'profile-id': 0 }
    },
    {
        kind:      'video',
        mimeType:  'video/VP8',
        clockRate: 90000,
    }
];

async function createWorkers() {
    const n = config.mediasoup.numWorkers;
    console.log(`[mediasoup] Starting ${n} worker(s)...`);
    for (let i = 0; i < n; i++) {
        workers.push(await spawnWorker(i));
    }
    console.log(`[mediasoup] ${workers.length} worker(s) ready`);
}

async function spawnWorker(index) {
    const w = await mediasoup.createWorker({
        logLevel:   'warn',
        logTags:    ['rtp', 'srtp', 'rtcp'],
        rtcMinPort: config.mediasoup.minPort,
        rtcMaxPort: config.mediasoup.maxPort
    });
    w.on('died', err => {
        console.error(`[mediasoup] Worker ${index} died, restarting in 2s...`, err?.message);
        setTimeout(async () => {
            try {
                workers[index] = await spawnWorker(index);
                console.log(`[mediasoup] Worker ${index} restarted`);
            } catch (e) {
                console.error(`[mediasoup] Worker ${index} restart failed:`, e.message);
            }
        }, 2000);
    });
    console.log(`[mediasoup] Worker ${index} created (pid=${w.pid})`);
    return w;
}

function getWorker() {
    const w = workers[workerIdx];
    workerIdx = (workerIdx + 1) % workers.length;
    return w;
}

async function createRouter() {
    return getWorker().createRouter({ mediaCodecs });
}

function getWebRtcTransportOptions() {
    return {
        listenIps: [{ ip: '0.0.0.0', announcedIp: config.mediasoup.announcedIp }],
        enableUdp:                       true,
        enableTcp:                       true,
        preferUdp:                       true,
        initialAvailableOutgoingBitrate: 2_500_000
    };
}

module.exports = { createWorkers, createRouter, getWebRtcTransportOptions };
