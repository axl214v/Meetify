const Conference = require('../models/Conference');

// Store active conference rooms and participants
const conferenceRooms = new Map(); // conferenceId -> Set of socket IDs
const userSockets = new Map(); // userId -> socket ID
const socketUsers = new Map(); // socket ID -> { userId, userName, conferenceId }
const userMediaState = new Map(); // userId -> { audio, video }
const screenSharingUsers = new Map();

/**
 * Initialize Socket.IO for conference signaling
 * @param {SocketIO.Server} io - Socket.IO server instance
 */
function initializeConferenceSocket(io) {
  io.on('error', (error) => {
    console.error('[Socket] Socket.IO error:', error);
});

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Join Conference
    socket.on('join-conference', async ({ conferenceId, userId, userName }) => {
      try {
          console.log(`[Socket] join-conference received: userId=${userId}, conf=${conferenceId}`);

          const conference = await Conference.findById(conferenceId);
          if (!conference) {
              socket.emit('error', { message: 'Conference not found' });
              return;
          }

          socket.join(`conference-${conferenceId}`);
          socketUsers.set(socket.id, { userId, userName, conferenceId });
          userSockets.set(userId, socket.id);

          if (!conferenceRooms.has(conferenceId)) {
              conferenceRooms.set(conferenceId, new Set());
          }
          conferenceRooms.get(conferenceId).add(socket.id);

          // Участники с их mediaState
          const roomParticipants = Array.from(conferenceRooms.get(conferenceId))
              .filter(sid => sid !== socket.id)
              .map(sid => socketUsers.get(sid))
              .filter(Boolean)
              .map(u => ({
                  ...u,
                  mediaState: userMediaState.get(u.userId) || { audio: true, video: true }
              }));

          // roomState — есть ли активный screen share в комнате
          const sharingSet = screenSharingUsers.get(conferenceId);
          const someoneIsScreenSharing = !!(sharingSet && sharingSet.size > 0);

          socket.emit('room-participants', {
              participants: roomParticipants,
              roomState: { someoneIsScreenSharing }
          });

          socket.to(`conference-${conferenceId}`).emit('user-connected', {
              userId,
              userName,
              socketId: socket.id
          });

          console.log(`[Socket] User ${userId} joined conference ${conferenceId}. Total participants: ${conferenceRooms.get(conferenceId).size}`);

      } catch (error) {
          console.error('[Socket] Join conference error:', error);
          socket.emit('error', { message: 'Failed to join conference' });
      }
  });

    // WebRTC Signaling - Offer
    socket.on('offer', ({ to, offer }) => {
      const fromUser = socketUsers.get(socket.id);
      
      if (!fromUser) {
        console.error('[Socket] Offer from unknown user');
        return;
      }

      const toSocketId = userSockets.get(to);
      
      if (toSocketId) {
        io.to(toSocketId).emit('offer', {
          userId: fromUser.userId,
          userName: fromUser.userName,
          offer
        });
        
        console.log(`[Socket] Offer sent from ${fromUser.userId} to ${to}`);
      } else {
        console.warn(`[Socket] Target user ${to} not found for offer`);
      }
    });

    // WebRTC Signaling - Answer
    socket.on('answer', ({ to, answer }) => {
      const fromUser = socketUsers.get(socket.id);
      
      if (!fromUser) {
        console.error('[Socket] Answer from unknown user');
        return;
      }

      const toSocketId = userSockets.get(to);
      
      if (toSocketId) {
        io.to(toSocketId).emit('answer', {
          userId: fromUser.userId,
          userName: fromUser.userName,
          answer
        });
        
        console.log(`[Socket] Answer sent from ${fromUser.userId} to ${to}`);
      } else {
        console.warn(`[Socket] Target user ${to} not found for answer`);
      }
    });

    // WebRTC Signaling - ICE Candidate
    socket.on('ice-candidate', ({ to, candidate }) => {
      const fromUser = socketUsers.get(socket.id);
      
      if (!fromUser) {
        console.error('[Socket] ICE candidate from unknown user');
        return;
      }

      const toSocketId = userSockets.get(to);
      
      if (toSocketId) {
        io.to(toSocketId).emit('ice-candidate', {
          userId: fromUser.userId,
          candidate
        });
      }
    });

    // Chat Message
    socket.on('chat-message', ({ conferenceId, message, timestamp }) => {
      const user = socketUsers.get(socket.id);
      
      if (!user) {
        console.error('[Socket] Chat message from unknown user');
        return;
      }

      // Broadcast to all participants in the conference (including sender)
      io.to(`conference-${conferenceId}`).emit('chat-message', {
        userId: user.userId,
        userName: user.userName,
        message,
        timestamp: timestamp || new Date().toISOString()
      });

      console.log(`[Socket] Chat message from ${user.userName} in conference ${conferenceId}`);
    });

    // Media State Updates (mic/camera toggle)
    socket.on('media-state-change', ({ conferenceId, audio, video }) => {
        const user = socketUsers.get(socket.id);
        if (!user) return;
        

        userMediaState.set(user.userId, { audio, video });
        
        socket.to(`conference-${conferenceId}`).emit('user-media-state', {
            userId: user.userId,
            audio,
            video

        });
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

      console.log(`[Socket] User ${user.userName} started screen sharing`);
  });

    // Screen Share Stop
    socket.on('screen-share-stop', ({ conferenceId }) => {
      const user = socketUsers.get(socket.id);
      if (!user) return;

      screenSharingUsers.get(conferenceId)?.delete(user.userId);

      socket.to(`conference-${conferenceId}`).emit('user-screen-share-stop', {
          userId: user.userId
      });

      console.log(`[Socket] User ${user.userName} stopped screen sharing`);
  });

    // Leave Conference
    socket.on('leave-conference', ({ conferenceId }) => {
      handleUserDisconnect(socket, conferenceId);
    });

    // Disconnect
    socket.on('disconnect', () => {
      const user = socketUsers.get(socket.id);
      
      if (user) {
        handleUserDisconnect(socket, user.conferenceId);
      }

      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  /**
   * Handle user disconnect from conference
   */
  function handleUserDisconnect(socket, conferenceId) {
    const user = socketUsers.get(socket.id);
    if (!user) return;

    // Очистка screen share
    screenSharingUsers.get(conferenceId)?.delete(user.userId);
    if (screenSharingUsers.get(conferenceId)?.size === 0) {
        screenSharingUsers.delete(conferenceId);
    }

    console.log(`[Socket] User ${user.userId} leaving conference ${conferenceId}`);

    // Remove from room tracking
    if (conferenceRooms.has(conferenceId)) {
      conferenceRooms.get(conferenceId).delete(socket.id);
      
      // Clean up empty rooms
      if (conferenceRooms.get(conferenceId).size === 0) {
        conferenceRooms.delete(conferenceId);
        console.log(`[Socket] Conference ${conferenceId} room is now empty`);
      }
    }

    // Remove from maps
    socketUsers.delete(socket.id);
    userSockets.delete(user.userId);

    // Leave Socket.IO room
    socket.leave(`conference-${conferenceId}`);

    // Notify others
    socket.to(`conference-${conferenceId}`).emit('user-disconnected', {
      userId: user.userId,
      userName: user.userName
    });

    console.log(`[Socket] User ${user.userId} left conference ${conferenceId}`);
  }

  console.log('[Socket] Conference socket initialized');
}

/**
 * Get active participants count for a conference
 * @param {string} conferenceId - Conference ID
 * @returns {number} Number of active participants
 */
function getActiveParticipantsCount(conferenceId) {
  return conferenceRooms.has(conferenceId) 
    ? conferenceRooms.get(conferenceId).size 
    : 0;
}

/**
 * Get all active conference IDs
 * @returns {Array<string>} Array of conference IDs
 */
function getActiveConferences() {
  return Array.from(conferenceRooms.keys());
}

/**
 * Force disconnect a user from conference
 * @param {SocketIO.Server} io - Socket.IO server instance
 * @param {string} userId - User ID to disconnect
 * @param {string} conferenceId - Conference ID
 */
function forceDisconnectUser(io, userId, conferenceId) {
  const socketId = userSockets.get(userId);
  
  if (socketId) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('force-disconnect', { 
        message: 'You have been removed from the conference' 
      });
      
      handleUserDisconnect(socket, conferenceId);
      socket.disconnect(true);
      
      console.log(`[Socket] Force disconnected user ${userId} from conference ${conferenceId}`);
    }
  }
}

module.exports = {
  initializeConferenceSocket,
  getActiveParticipantsCount,
  getActiveConferences,
  forceDisconnectUser
};