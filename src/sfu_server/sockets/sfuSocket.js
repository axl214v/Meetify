const { createRouter, getWebRtcTransportOptions } = require('../mediasoup/workers');

const routers      = new Map(); // conferenceId -> router
const peers        = new Map(); // socketId -> { transports, producers, consumers }
const roomProducers = new Map(); // conferenceId -> Map<producerId, {userId,userName,kind,appData}>

function getPeer(socketId) {
    if (!peers.has(socketId)) {
        peers.set(socketId, { transports: new Map(), producers: new Map(), consumers: new Map() });
    }
    return peers.get(socketId);
}

async function getOrCreateRouter(conferenceId) {
    if (!routers.has(conferenceId)) {
        const router = await createRouter();
        routers.set(conferenceId, router);
        console.log(`[SFU] Router created for room ${conferenceId}`);
    }
    return routers.get(conferenceId);
}

function registerSfuHandlers(io, socket) {
    const { userId, userName, conferenceId } = socket.user;

    socket.join(`conference-${conferenceId}`);

    socket.on('sfu:get-rtp-capabilities', async ({ conferenceId: confId }, ack) => {
        try {
            const router = await getOrCreateRouter(confId);
            ack({ rtpCapabilities: router.rtpCapabilities });
        } catch (err) {
            console.error('[SFU] get-rtp-capabilities:', err.message);
            ack({ error: err.message });
        }
    });

    socket.on('sfu:create-transport', async ({ conferenceId: confId }, ack) => {
        try {
            const router    = await getOrCreateRouter(confId);
            const transport = await router.createWebRtcTransport(getWebRtcTransportOptions());
            transport.on('dtlsstatechange', state => { if (state === 'closed') transport.close(); });
            getPeer(socket.id).transports.set(transport.id, transport);
            ack({
                id:             transport.id,
                iceParameters:  transport.iceParameters,
                iceCandidates:  transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters
            });
        } catch (err) {
            console.error('[SFU] create-transport:', err.message);
            ack({ error: err.message });
        }
    });

    socket.on('sfu:connect-transport', async ({ transportId, dtlsParameters }, ack) => {
        try {
            const transport = peers.get(socket.id)?.transports.get(transportId);
            if (!transport) return ack({ error: 'Transport not found' });
            await transport.connect({ dtlsParameters });
            ack({});
        } catch (err) {
            console.error('[SFU] connect-transport:', err.message);
            ack({ error: err.message });
        }
    });

    socket.on('sfu:produce', async ({ transportId, kind, rtpParameters, appData }, ack) => {
        try {
            const peer      = peers.get(socket.id);
            const transport = peer?.transports.get(transportId);
            if (!transport) return ack({ error: 'Transport not found' });

            const producer = await transport.produce({ kind, rtpParameters, appData: appData || {} });
            peer.producers.set(producer.id, producer);
            producer.on('transportclose', () => producer.close());

            if (!roomProducers.has(conferenceId)) roomProducers.set(conferenceId, new Map());
            roomProducers.get(conferenceId).set(producer.id, { userId, userName, kind, appData: appData || {} });

            socket.to(`conference-${conferenceId}`).emit('sfu:new-producer', {
                producerId: producer.id, userId, userName, kind, appData: appData || {}
            });

            ack({ id: producer.id });
        } catch (err) {
            console.error('[SFU] produce:', err.message);
            ack({ error: err.message });
        }
    });

    socket.on('sfu:get-producers', ({ conferenceId: confId }, ack) => {
        try {
            const producers = [];
            const room = roomProducers.get(confId);
            if (room) {
                for (const [producerId, info] of room) {
                    if (info.userId !== userId) producers.push({ producerId, ...info });
                }
            }
            ack({ producers });
        } catch (err) {
            console.error('[SFU] get-producers:', err.message);
            ack({ producers: [] });
        }
    });

    socket.on('sfu:consume', async ({ transportId, producerId, rtpCapabilities, conferenceId: confId }, ack) => {
        try {
            const router = routers.get(confId);
            if (!router) return ack({ error: 'Router not found' });
            if (!router.canConsume({ producerId, rtpCapabilities })) return ack({ error: 'Cannot consume' });

            const peer      = peers.get(socket.id);
            const transport = peer?.transports.get(transportId);
            if (!transport) return ack({ error: 'Transport not found' });

            const consumer = await transport.consume({ producerId, rtpCapabilities, paused: true });
            peer.consumers.set(consumer.id, consumer);
            consumer.on('transportclose', () => consumer.close());
            consumer.on('producerclose', () => {
                consumer.close();
                peer.consumers.delete(consumer.id);
                socket.emit('sfu:consumer-closed', { consumerId: consumer.id });
            });

            ack({
                id:            consumer.id,
                producerId,
                kind:          consumer.kind,
                rtpParameters: consumer.rtpParameters,
                appData:       consumer.appData
            });
        } catch (err) {
            console.error('[SFU] consume:', err.message);
            ack({ error: err.message });
        }
    });

    socket.on('sfu:resume-consumer', async ({ consumerId }, ack) => {
        try {
            const consumer = peers.get(socket.id)?.consumers.get(consumerId);
            if (!consumer) return ack({ error: 'Consumer not found' });
            await consumer.resume();
            ack({});
        } catch (err) {
            console.error('[SFU] resume-consumer:', err.message);
            ack({ error: err.message });
        }
    });

    socket.on('sfu:close-producer', ({ producerId }, ack) => {
        try {
            const peer     = peers.get(socket.id);
            const producer = peer?.producers.get(producerId);
            if (producer) { producer.close(); peer.producers.delete(producerId); }
            roomProducers.get(conferenceId)?.delete(producerId);
            socket.to(`conference-${conferenceId}`).emit('sfu:producer-closed', { producerId });
            if (typeof ack === 'function') ack({});
        } catch (err) {
            console.error('[SFU] close-producer:', err.message);
            if (typeof ack === 'function') ack({ error: err.message });
        }
    });

    socket.on('disconnect', () => cleanupPeer(socket));
}

function cleanupPeer(socket) {
    const peer = peers.get(socket.id);
    if (!peer) return;

    const conferenceId = socket.user?.conferenceId;

    if (conferenceId) {
        for (const producerId of peer.producers.keys()) {
            roomProducers.get(conferenceId)?.delete(producerId);
            socket.to(`conference-${conferenceId}`).emit('sfu:producer-closed', { producerId });
        }
    }

    for (const transport of peer.transports.values()) transport.close();
    peers.delete(socket.id);

    if (conferenceId) {
        const room = roomProducers.get(conferenceId);
        if (!room || room.size === 0) {
            const router = routers.get(conferenceId);
            if (router) {
                router.close();
                routers.delete(conferenceId);
                roomProducers.delete(conferenceId);
                console.log(`[SFU] Router closed for empty room ${conferenceId}`);
            }
        }
    }
}

module.exports = { registerSfuHandlers };
