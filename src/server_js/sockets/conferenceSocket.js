const Conference = require('../models/Conference');
const { registerSfuHandlers, cleanupPeer } = require('./sfuSocket');

const P2P_MAX = 8;

// Active conference rooms and participants
const conferenceRooms = new Map();    // conferenceId -> Set<socketId>
const userSockets = new Map();        // userId -> socketId
const socketUsers = new Map();        // socketId -> { userId, userName, conferenceId }
const userMediaState = new Map();     // userId -> { audio, video }
const screenSharingUsers = new Map(); // conferenceId -> Set<userId>

// Moderation state (session-scoped — cleared when room empties)
const kickedUsers = new Map();        // conferenceId -> Set<userId>
const chatBannedUsers = new Map();    // conferenceId -> Set<userId>
const coHosts = new Map();            // conferenceId -> Set<userId>

async function isConferenceHost(userId, conferenceId) {
    const conference = await Conference.findById(conferenceId);
    return !!(conference && conference.host_id == userId);
}

async function canModerate(userId, conferenceId) {
    if (await isConferenceHost(userId, conferenceId)) return true;
    return coHosts.get(conferenceId)?.has(userId) ?? false;
}

function handleUserDisconnect(socket, conferenceId) {
    const user = socketUsers.get(socket.id);
    if (!user) return;

    screenSharingUsers.get(conferenceId)?.delete(user.userId);
    if (screenSharingUsers.get(conferenceId)?.size === 0) {
        screenSharingUsers.delete(conferenceId);
    }

    userMediaState.delete(user.userId);

    console.log(`[Socket] User ${user.userId} leaving conference ${conferenceId}`);

    if (conferenceRooms.has(conferenceId)) {
        conferenceRooms.get(conferenceId).delete(socket.id);

        if (conferenceRooms.get(conferenceId).size === 0) {
            conferenceRooms.delete(conferenceId);
            kickedUsers.delete(conferenceId);
            chatBannedUsers.delete(conferenceId);
            coHosts.delete(conferenceId);
            console.log(`[Socket] Conference ${conferenceId} empty — moderation state cleared`);
        }
    }

    // Clean up SFU transports/producers/consumers for this peer
    cleanupPeer(socket, socketUsers);

    socketUsers.delete(socket.id);
    userSockets.delete(user.userId);

    socket.leave(`conference-${conferenceId}`);

    socket.to(`conference-${conferenceId}`).emit('user-disconnected', {
        userId: user.userId,
        userName: user.userName
    });

    console.log(`[Socket] User ${user.userId} left conference ${conferenceId}`);
}

/**
 * Initialize Socket.IO for conference signaling
 * @param {SocketIO.Server} io
 */
function initializeConferenceSocket(io) {
    io.on('error', (error) => {
        console.error('[Socket] Socket.IO error:', error);
    });

    io.on('connection', (socket) => {
        console.log(`[Socket] Client connected: ${socket.id}`);

        // Register mediasoup SFU handlers (no-ops for P2P rooms)
        registerSfuHandlers(io, socket, socketUsers);

        // Join Conference
        socket.on('join-conference', async ({ conferenceId, userName }) => {
            try {
                const userId = socket.user.userId;
                console.log(`[Socket] join-conference: userId=${userId}, conf=${conferenceId}`);

                if (kickedUsers.get(conferenceId)?.has(userId)) {
                    socket.emit('join-rejected', { reason: 'kicked' });
                    return;
                }

                const conference = await Conference.findById(conferenceId);
                if (!conference) {
                    socket.emit('error', { message: 'Conference not found' });
                    return;
                }

                // P2P hard cap: reject if room is already at the limit
                if (conference.mode !== 'sfu') {
                    const currentSize = conferenceRooms.get(conferenceId)?.size || 0;
                    if (currentSize >= P2P_MAX) {
                        socket.emit('join-rejected', { reason: 'full' });
                        return;
                    }
                }

                socket.join(`conference-${conferenceId}`);
                socketUsers.set(socket.id, { userId, userName, conferenceId });
                userSockets.set(userId, socket.id);

                if (!conferenceRooms.has(conferenceId)) {
                    conferenceRooms.set(conferenceId, new Set());
                }
                conferenceRooms.get(conferenceId).add(socket.id);

                const roomParticipants = Array.from(conferenceRooms.get(conferenceId))
                    .filter(sid => sid !== socket.id)
                    .map(sid => socketUsers.get(sid))
                    .filter(Boolean)
                    .map(u => ({
                        ...u,
                        mediaState: userMediaState.get(u.userId) || { audio: true, video: true }
                    }));

                const sharingSet = screenSharingUsers.get(conferenceId);

                socket.emit('room-participants', {
                    participants: roomParticipants,
                    roomState: {
                        someoneIsScreenSharing: !!(sharingSet && sharingSet.size > 0),
                        coHosts: Array.from(coHosts.get(conferenceId) || []),
                        chatBanned: Array.from(chatBannedUsers.get(conferenceId) || [])
                    },
                    iceServers: require('../config/stunServer').getIceServers()
                });

                socket.to(`conference-${conferenceId}`).emit('user-connected', {
                    userId,
                    userName,
                    socketId: socket.id
                });

                console.log(`[Socket] User ${userId} joined conf ${conferenceId}. Total: ${conferenceRooms.get(conferenceId).size}`);
            } catch (error) {
                console.error('[Socket] join-conference error:', error);
                socket.emit('error', { message: 'Failed to join conference' });
            }
        });

        // WebRTC Signaling - Offer
        socket.on('offer', ({ to, offer }) => {
            const fromUser = socketUsers.get(socket.id);
            if (!fromUser) return;

            const toSocketId = userSockets.get(to);
            if (toSocketId) {
                io.to(toSocketId).emit('offer', { userId: fromUser.userId, userName: fromUser.userName, offer });
                console.log(`[Socket] Offer: ${fromUser.userId} -> ${to}`);
            } else {
                console.warn(`[Socket] Offer target ${to} not found`);
            }
        });

        // WebRTC Signaling - Answer
        socket.on('answer', ({ to, answer }) => {
            const fromUser = socketUsers.get(socket.id);
            if (!fromUser) return;

            const toSocketId = userSockets.get(to);
            if (toSocketId) {
                io.to(toSocketId).emit('answer', { userId: fromUser.userId, userName: fromUser.userName, answer });
                console.log(`[Socket] Answer: ${fromUser.userId} -> ${to}`);
            } else {
                console.warn(`[Socket] Answer target ${to} not found`);
            }
        });

        // WebRTC Signaling - ICE Candidate
        socket.on('ice-candidate', ({ to, candidate }) => {
            const fromUser = socketUsers.get(socket.id);
            if (!fromUser) return;

            const toSocketId = userSockets.get(to);
            if (toSocketId) {
                io.to(toSocketId).emit('ice-candidate', { userId: fromUser.userId, candidate });
            }
        });

        // Chat Message
        socket.on('chat-message', ({ conferenceId, message, timestamp }) => {
            const userId = socket.user.userId;
            const user = socketUsers.get(socket.id);
            if (!user) return;

            if (chatBannedUsers.get(conferenceId)?.has(userId)) {
                socket.emit('chat-blocked', { message: 'You are banned from chat in this conference' });
                return;
            }

            io.to(`conference-${conferenceId}`).emit('chat-message', {
                userId,
                userName: user.userName,
                message,
                timestamp: timestamp || new Date().toISOString()
            });

            console.log(`[Socket] Chat from ${user.userName} in conf ${conferenceId}`);
        });

        // Media State Updates
        socket.on('media-state-change', ({ conferenceId, audio, video }) => {
            const userId = socket.user.userId;
            const user = socketUsers.get(socket.id);
            if (!user) return;

            userMediaState.set(userId, { audio, video });

            socket.to(`conference-${conferenceId}`).emit('user-media-state', { userId, audio, video });
        });

        // Screen Share Start
        socket.on('screen-share-start', ({ conferenceId }) => {
            const user = socketUsers.get(socket.id);
            if (!user) return;

            if (!screenSharingUsers.has(conferenceId)) {
                screenSharingUsers.set(conferenceId, new Set());
            }
            screenSharingUsers.get(conferenceId).add(user.userId);

            socket.to(`conference-${conferenceId}`).emit('user-screen-share-start', {
                userId: user.userId,
                userName: user.userName
            });

            console.log(`[Socket] ${user.userName} started screen sharing`);
        });

        // Screen Share Stop
        socket.on('screen-share-stop', ({ conferenceId }) => {
            const user = socketUsers.get(socket.id);
            if (!user) return;

            screenSharingUsers.get(conferenceId)?.delete(user.userId);

            socket.to(`conference-${conferenceId}`).emit('user-screen-share-stop', { userId: user.userId });

            console.log(`[Socket] ${user.userName} stopped screen sharing`);
        });

        // Leave Conference
        socket.on('leave-conference', ({ conferenceId }) => {
            handleUserDisconnect(socket, conferenceId);
        });

        // Disconnect
        socket.on('disconnect', () => {
            const user = socketUsers.get(socket.id);
            if (user) handleUserDisconnect(socket, user.conferenceId);
            console.log(`[Socket] Client disconnected: ${socket.id}`);
        });

        // ============================================================
        // Host / Co-host Moderation
        // ============================================================

        socket.on('host:kick', async ({ conferenceId, targetUserId }) => {
            const moderatorId = socket.user.userId;
            try {
                if (!(await canModerate(moderatorId, conferenceId))) {
                    socket.emit('error', { message: 'Not authorized to moderate' });
                    return;
                }

                if (!kickedUsers.has(conferenceId)) kickedUsers.set(conferenceId, new Set());
                kickedUsers.get(conferenceId).add(targetUserId);

                const moderatorUser = socketUsers.get(socket.id);
                io.to(`conference-${conferenceId}`).emit('user-kicked', {
                    userId: targetUserId,
                    kickerName: moderatorUser?.userName || 'Host'
                });

                forceDisconnectUser(io, targetUserId, conferenceId);
                console.log(`[Socket] User ${targetUserId} kicked from conf ${conferenceId} by ${moderatorId}`);
            } catch (err) {
                console.error('[Socket] host:kick error:', err);
            }
        });

        socket.on('host:force-media', async ({ conferenceId, targetUserId, audio, video, screen }) => {
            const moderatorId = socket.user.userId;
            try {
                if (!(await canModerate(moderatorId, conferenceId))) {
                    socket.emit('error', { message: 'Not authorized to moderate' });
                    return;
                }

                const targetSocketId = userSockets.get(targetUserId);
                if (!targetSocketId) return;

                const payload = {};
                if (audio !== undefined) payload.audio = audio;
                if (video !== undefined) payload.video = video;
                if (screen !== undefined) payload.screen = screen;

                io.to(targetSocketId).emit('force-muted', payload);

                if (audio !== undefined || video !== undefined) {
                    const current = userMediaState.get(targetUserId) || { audio: true, video: true };
                    const updated = {
                        audio: audio !== undefined ? audio : current.audio,
                        video: video !== undefined ? video : current.video
                    };
                    userMediaState.set(targetUserId, updated);
                    io.to(`conference-${conferenceId}`).emit('user-media-state', { userId: targetUserId, ...updated });
                }

                console.log(`[Socket] host:force-media on ${targetUserId} by ${moderatorId}:`, payload);
            } catch (err) {
                console.error('[Socket] host:force-media error:', err);
            }
        });

        socket.on('host:chat-ban', async ({ conferenceId, targetUserId, banned }) => {
            const moderatorId = socket.user.userId;
            try {
                if (!(await canModerate(moderatorId, conferenceId))) {
                    socket.emit('error', { message: 'Not authorized to moderate' });
                    return;
                }

                if (banned) {
                    if (!chatBannedUsers.has(conferenceId)) chatBannedUsers.set(conferenceId, new Set());
                    chatBannedUsers.get(conferenceId).add(targetUserId);
                } else {
                    chatBannedUsers.get(conferenceId)?.delete(targetUserId);
                }

                const targetSocketId = userSockets.get(targetUserId);
                if (targetSocketId) {
                    io.to(targetSocketId).emit('chat-banned', { banned });
                }

                io.to(`conference-${conferenceId}`).emit('user-chat-banned', { userId: targetUserId, banned });
                console.log(`[Socket] User ${targetUserId} chat-${banned ? 'banned' : 'unbanned'} by ${moderatorId}`);
            } catch (err) {
                console.error('[Socket] host:chat-ban error:', err);
            }
        });

        socket.on('host:promote-co-host', async ({ conferenceId, targetUserId }) => {
            const requesterId = socket.user.userId;
            try {
                if (!(await isConferenceHost(requesterId, conferenceId))) {
                    socket.emit('error', { message: 'Only the host can promote co-hosts' });
                    return;
                }

                if (!coHosts.has(conferenceId)) coHosts.set(conferenceId, new Set());
                coHosts.get(conferenceId).add(targetUserId);

                io.to(`conference-${conferenceId}`).emit('user-role-change', { userId: targetUserId, isCoHost: true });
                console.log(`[Socket] User ${targetUserId} promoted to co-host in conf ${conferenceId}`);
            } catch (err) {
                console.error('[Socket] host:promote-co-host error:', err);
            }
        });

        socket.on('host:demote-co-host', async ({ conferenceId, targetUserId }) => {
            const requesterId = socket.user.userId;
            try {
                if (!(await isConferenceHost(requesterId, conferenceId))) {
                    socket.emit('error', { message: 'Only the host can demote co-hosts' });
                    return;
                }

                coHosts.get(conferenceId)?.delete(targetUserId);

                io.to(`conference-${conferenceId}`).emit('user-role-change', { userId: targetUserId, isCoHost: false });
                console.log(`[Socket] User ${targetUserId} demoted from co-host in conf ${conferenceId}`);
            } catch (err) {
                console.error('[Socket] host:demote-co-host error:', err);
            }
        });
    });

    console.log('[Socket] Conference socket initialized');
}

function getActiveParticipantsCount(conferenceId) {
    return conferenceRooms.has(conferenceId) ? conferenceRooms.get(conferenceId).size : 0;
}

function getActiveConferences() {
    return Array.from(conferenceRooms.keys());
}

function forceDisconnectUser(io, userId, conferenceId) {
    const socketId = userSockets.get(userId);
    if (!socketId) return;

    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
        socket.emit('force-disconnect', { message: 'You have been removed from the conference' });
        handleUserDisconnect(socket, conferenceId);
        socket.disconnect(true);
        console.log(`[Socket] Force disconnected user ${userId} from conf ${conferenceId}`);
    }
}

module.exports = {
    initializeConferenceSocket,
    getActiveParticipantsCount,
    getActiveConferences,
    forceDisconnectUser
};
