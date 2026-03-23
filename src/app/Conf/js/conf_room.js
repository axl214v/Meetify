const API_BASE = window.location.origin;
const SOCKET_URL = window.location.origin;

// State
let socket = null;
let localStream = null;
let screenStream = null;
let peers = {};
let conferenceId = null;
let currentUser = null;
let isAudioEnabled = true;
let isVideoEnabled = true;
let isScreenSharing = false;
let roomTimer = null;
let startTime = null;
let unreadMessages = 0;
let joinedConference = false;

// WebRTC Configuration
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// Get cookie helper
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    conferenceId = urlParams.get('id');

    if (!conferenceId) {
        alert('No conference ID provided');
        window.location.href = 'conf.html';
        return;
    }

    try {
        // Load current user first
        const meRes = await fetch(`${API_BASE}/api/auth/me`, {
            credentials: 'include'
        });

        if (!meRes.ok) {
            window.location.href = '/auth/Auth.html';
            return;
        }

        const meData = await meRes.json();
        currentUser = meData.user;

        // Load conference details
        await loadConferenceDetails();

        // Initialize local media
        await initLocalMedia();

        // Connect to signaling server
        await initSocket();

        // Setup event listeners
        setupEventListeners();

        // Start room timer
        startRoomTimer();

    } catch (error) {
        console.error('Initialization error:', error);
        alert('Failed to join conference. Please check your camera/microphone permissions.');
        window.location.href = 'conf.html';
    }
});

chat = new Chat('chatMessages', 'chatInput', 'sendBtn');

chat.setCurrentUser({
    userId: currentUser.id,
    userName: currentUser.username || currentUser.email
});

chat.onSend((messageData) => {
    socket.emit('chat-message', {
        conferenceId,
        message: messageData.message,
        timestamp: messageData.timestamp
    });
});

// Load conference details
async function loadConferenceDetails() {
    try {
        const response = await fetch(`${API_BASE}/api/conferences/${conferenceId}`, {
            credentials: 'include'
        });

        if (!response.ok) throw new Error('Conference not found');

        const data = await response.json();
        document.getElementById('conferenceName').textContent = data.conference.name;

        await loadParticipants();

    } catch (error) {
        console.error('Load conference error:', error);
        throw error;
    }
}

// Initialize local media
async function initLocalMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        document.getElementById('localVideo').srcObject = localStream;
        console.log('Local media initialized');

    } catch (error) {
        console.error('Error accessing media devices:', error);
        throw error;
    }
}

// Initialize Socket.IO
async function initSocket() {
    const tokenRes = await fetch(`${API_BASE}/api/auth/token`, {
        credentials: 'include'
    });
    const tokenData = await tokenRes.json();
    const token = tokenData.token || null;    
    socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        auth: { token }
    });

    socket.on('connect', () => {
        console.log('Connected to signaling server');
        joinedConference = true;
        socket.emit('join-conference', {
            conferenceId,
            userId: currentUser.id,
            userName: currentUser.username || currentUser.email
        });
    });

    socket.on('room-participants', ({ participants }) => {
        console.log('Existing participants:', participants);
        participants.forEach(async (p) => {
            if (p.userId !== currentUser.id) {
                await createPeerConnection(p.userId, true);
            }
        });
    });

    socket.on('user-connected', async ({ userId, userName }) => {
        console.log('User connected:', userId, userName);
        await createPeerConnection(userId, true);
    });

    socket.on('user-disconnected', ({ userId }) => {
        console.log('User disconnected:', userId);
        if (peers[userId]) {
            peers[userId].close();
            delete peers[userId];
        }
        const videoContainer = document.getElementById(`video-${userId}`);
        if (videoContainer) videoContainer.remove();
        updateParticipantCount();
    });

    socket.on('offer', async ({ userId, offer }) => {
        console.log('Received offer from:', userId);
        await createPeerConnection(userId, false);
        await peers[userId].setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peers[userId].createAnswer();
        await peers[userId].setLocalDescription(answer);
        socket.emit('answer', { to: userId, answer });
    });

    socket.on('answer', async ({ userId, answer }) => {
        console.log('Received answer from:', userId);
        if (peers[userId]) {
            await peers[userId].setRemoteDescription(new RTCSessionDescription(answer));
        }
    });

    socket.on('ice-candidate', async ({ userId, candidate }) => {
        if (peers[userId] && candidate) {
            await peers[userId].addIceCandidate(new RTCIceCandidate(candidate));
        }
    });

    socket.on('chat-message', ({ userId, userName, message, timestamp }) => {
        const isOwn = userId === currentUser.id;
        chat.addMessage({ message, userName, timestamp }, isOwn);
        if (!document.getElementById('chatSidebar').classList.contains('open')) {
            updateChatBadge(chat.getUnreadCount());
        }
    });

    socket.on('user-media-state', ({ userId, audio, video }) => {
        const micStatus = document.querySelector(`#video-${userId} .mic-status`);
        const videoStatus = document.querySelector(`#video-${userId} .video-status`);
        if (micStatus) micStatus.textContent = audio ? '🎤' : '🔇';
        if (videoStatus) videoStatus.textContent = video ? '📹' : '📵';
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from signaling server');
    });

    socket.on('error', (err) => {
        console.error('Socket error:', err);
    });
}

// Create WebRTC peer connection
async function createPeerConnection(userId, isInitiator) {
    if (peers[userId]) {
        peers[userId].close();
    }

    const peerConnection = new RTCPeerConnection(rtcConfig);
    peers[userId] = peerConnection;

    // Add local tracks
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        addRemoteVideo(userId, remoteStream);
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                to: userId,
                candidate: event.candidate
            });
        }
    };

    // Handle connection state
    peerConnection.onconnectionstatechange = () => {
        console.log(`Connection state with ${userId}:`, peerConnection.connectionState);
        if (peerConnection.connectionState === 'disconnected' ||
            peerConnection.connectionState === 'failed') {
            if (peers[userId]) {
                peers[userId].close();
                delete peers[userId];
            }
            const videoContainer = document.getElementById(`video-${userId}`);
            if (videoContainer) videoContainer.remove();
            updateParticipantCount();
        }
    };

    // If initiator, create and send offer
    if (isInitiator) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', { to: userId, offer });
    }

    return peerConnection;
}

// Add remote video
function addRemoteVideo(userId, stream) {
    let videoContainer = document.getElementById(`video-${userId}`);
    if (videoContainer) videoContainer.remove();

    videoContainer = document.createElement('div');
    videoContainer.id = `video-${userId}`;
    videoContainer.className = 'video-container';

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsinline = true;
    video.srcObject = stream;

    const overlay = document.createElement('div');
    overlay.className = 'video-overlay';
    overlay.innerHTML = `
        <span class="participant-name">User ${userId}</span>
        <div class="participant-status">
            <span class="status-icon active mic-status">🎤</span>
            <span class="status-icon active video-status">📹</span>
        </div>
    `;

    videoContainer.appendChild(video);
    videoContainer.appendChild(overlay);
    document.getElementById('videoGrid').appendChild(videoContainer);
    updateParticipantCount();
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('toggleMic').addEventListener('click', toggleMicrophone);
    document.getElementById('toggleVideo').addEventListener('click', toggleCamera);
    document.getElementById('toggleScreen').addEventListener('click', toggleScreenShare);
    document.getElementById('toggleParticipants').addEventListener('click', () => toggleSidebar('participants'));
    document.getElementById('toggleChat').addEventListener('click', () => {
        toggleSidebar('chat');
        chat.setVisibility(true);
        updateChatBadge(0);
    });
    document.getElementById('leaveBtn').addEventListener('click', leaveConference);
    document.getElementById('chatInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

// Toggle microphone
function toggleMicrophone() {
    isAudioEnabled = !isAudioEnabled;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) audioTrack.enabled = isAudioEnabled;

    const btn = document.getElementById('toggleMic');
    const status = document.getElementById('localMicStatus');
    btn.classList.toggle('muted', !isAudioEnabled);
    status.textContent = isAudioEnabled ? '🎤' : '🔇';

    socket?.emit('media-state-change', {
        conferenceId,
        audio: isAudioEnabled,
        video: isVideoEnabled
    });
}

// Toggle camera
function toggleCamera() {
    isVideoEnabled = !isVideoEnabled;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) videoTrack.enabled = isVideoEnabled;

    const btn = document.getElementById('toggleVideo');
    const status = document.getElementById('localVideoStatus');
    btn.classList.toggle('off', !isVideoEnabled);
    status.textContent = isVideoEnabled ? '📹' : '📵';

    socket?.emit('media-state-change', {
        conferenceId,
        audio: isAudioEnabled,
        video: isVideoEnabled
    });
}

// Toggle screen share
async function toggleScreenShare() {
    const btn = document.getElementById('toggleScreen');

    if (!isScreenSharing) {
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: 'always' },
                audio: false
            });

            const screenTrack = screenStream.getVideoTracks()[0];

            Object.values(peers).forEach(peer => {
                const sender = peer.getSenders().find(s => s.track?.kind === 'video');
                if (sender) sender.replaceTrack(screenTrack);
            });

            document.getElementById('localVideo').srcObject = screenStream;

            screenTrack.onended = () => stopScreenShare();

            isScreenSharing = true;
            btn.classList.add('sharing');
            btn.textContent = '⏹️';

            socket?.emit('screen-share-start', { conferenceId });

        } catch (error) {
            console.error('Screen share error:', error);
            alert('Failed to share screen');
        }
    } else {
        stopScreenShare();
    }
}

// Stop screen share
function stopScreenShare() {
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }

    const videoTrack = localStream.getVideoTracks()[0];
    Object.values(peers).forEach(peer => {
        const sender = peer.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);
    });

    document.getElementById('localVideo').srcObject = localStream;
    isScreenSharing = false;
    document.getElementById('toggleScreen').classList.remove('sharing');
    document.getElementById('toggleScreen').textContent = '🖥️';

    socket?.emit('screen-share-stop', { conferenceId });
}

// Toggle sidebar
function toggleSidebar(type) {
    const participantsSidebar = document.getElementById('participantsSidebar');
    const chatSidebar = document.getElementById('chatSidebar');

    if (type === 'participants') {
        chatSidebar.classList.remove('open');
        participantsSidebar.classList.toggle('open');
    } else {
        participantsSidebar.classList.remove('open');
        chatSidebar.classList.toggle('open');
    }
}

// Close sidebar
function closeSidebar(type) {
    if (type === 'participants') {
        document.getElementById('participantsSidebar').classList.remove('open');
    } else {
        document.getElementById('chatSidebar').classList.remove('open');
    }
}

// Load participants
async function loadParticipants() {
    try {
        const response = await fetch(`${API_BASE}/api/conferences/${conferenceId}/participants`, {
            credentials: 'include'
        });

        if (!response.ok) throw new Error('Failed to load participants');

        const data = await response.json();
        renderParticipants(data.participants || []);
        updateParticipantCount();

    } catch (error) {
        console.error('Load participants error:', error);
    }
}

// Render participants
function renderParticipants(participants) {
    const participantsList = document.getElementById('participantsList');

    if (participants.length === 0) {
        participantsList.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center;">No participants yet</p>';
        return;
    }

    participantsList.innerHTML = participants.map(p => {
        const initials = (p.username || p.userName || 'U').substring(0, 2).toUpperCase();
        const hostBadge = p.is_host || p.isHost ? ' 👑' : '';
        return `
            <div class="participant-item">
                <div class="participant-avatar">${initials}</div>
                <div class="participant-info">
                    <strong>${escapeHtml(p.username || p.userName || 'Unknown')}${hostBadge}</strong>
                    <small>Joined ${formatJoinTime(p.joined_at || p.joinedAt)}</small>
                </div>
            </div>
        `;
    }).join('');
}

// Format join time
function formatJoinTime(timestamp) {
    if (!timestamp) return 'recently';
    const date = new Date(timestamp);
    const diffMins = Math.floor((Date.now() - date) / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    return `${diffHours} hours ago`;
}

// Update participant count
function updateParticipantCount() {
    const count = Object.keys(peers).length + 1;
    document.getElementById('participantCount').textContent = count;
}

// Send chat message
function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message || !socket) return;

    socket.emit('chat-message', {
        conferenceId,
        message,
        timestamp: new Date().toISOString()
    });

    input.value = '';
}

// Add chat message
function addChatMessage(userName, message, timestamp) {
    const chatMessages = document.getElementById('chatMessages');
    const messageEl = document.createElement('div');
    messageEl.className = 'chat-message';

    const time = timestamp ? new Date(timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    }) : '';

    messageEl.innerHTML = `
        <strong>${escapeHtml(userName)} <span style="color: rgba(255,255,255,0.5); font-size: 0.85rem; font-weight: normal;">${time}</span></strong>
        <p>${escapeHtml(message)}</p>
    `;

    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Update chat badge
function updateChatBadge() {
    const badge = document.getElementById('chatBadge');
    if (unreadMessages > 0) {
        badge.textContent = unreadMessages > 99 ? '99+' : unreadMessages;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

// Start room timer
function startRoomTimer() {
    startTime = Date.now();
    roomTimer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        document.getElementById('roomTimer').textContent =
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
}

// Leave conference
async function leaveConference() {
    if (!confirm('Are you sure you want to leave this conference?')) return;

    if (roomTimer) clearInterval(roomTimer);
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    if (screenStream) screenStream.getTracks().forEach(track => track.stop());

    Object.values(peers).forEach(peer => peer.close());
    peers = {};

    if (socket) {
        socket.emit('leave-conference', { conferenceId });
        socket.disconnect();
    }

    await fetch(`${API_BASE}/api/conferences/${conferenceId}/leave`, {
        method: 'POST',
        credentials: 'include'
    }).catch(() => {});

    window.location.href = 'conf.html';
}

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (joinedConference && conferenceId) {
        navigator.sendBeacon(`${API_BASE}/api/conferences/${conferenceId}/leave`);
    }
    if (socket) socket.disconnect();
});

// Global functions
window.closeSidebar = closeSidebar;
window.sendMessage = sendMessage;