// js/conf_room.js
const API_BASE = 'http://localhost:3000';
const SOCKET_URL = 'http://localhost:3000';
const serviceStatus = require('./checkStatus/index.js');


// Initialize check on page load
async () => {
    try {
        await checkServiceStatus();
        // инициализация остальных модулей
    } catch (err) {
        console.error('Service check failed', err);
        showError('Service temporarily unavailable. Please try again later.');
        window.location.href = '../err';
    }
}

// State
let socket = null;
let localStream = null;
let screenStream = null;
let peers = {}; // { userId: RTCPeerConnection }
let conferenceId = null;
let currentUser = null;
let isAudioEnabled = true;
let isVideoEnabled = true;
let isScreenSharing = false;
let roomTimer = null;
let startTime = null;
let unreadMessages = 0;

// WebRTC Configuration
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Get conference ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    conferenceId = urlParams.get('id');

    if (!conferenceId) {
        alert('No conference ID provided');
        window.location.href = 'conf.html';
        return;
    }

    try {
        // Load conference details
        await loadConferenceDetails();
        
        // Initialize local media
        await initLocalMedia();
        
        // Connect to signaling server
        initSocket();
        
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

// Load conference details
async function loadConferenceDetails() {
    try {
        const response = await fetch(`${API_BASE}/api/conferences/${conferenceId}`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Conference not found');
        }

        const data = await response.json();
        const conference = data.conference;

        document.getElementById('conferenceName').textContent = conference.name;
        
        // Load participants
        await loadParticipants();
        
    } catch (error) {
        console.error('Load conference error:', error);
        throw error;
    }
}

// Initialize local media (camera + microphone)
async function initLocalMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        const localVideo = document.getElementById('localVideo');
        localVideo.srcObject = localStream;

        console.log('Local media initialized');
    } catch (error) {
        console.error('Error accessing media devices:', error);
        throw error;
    }
}

// Initialize Socket.IO connection
function initSocket() {
    socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
        console.log('Connected to signaling server');
        
        // Join conference room
        socket.emit('join-conference', { conferenceId });
    });

    socket.on('user-connected', async ({ userId }) => {
        console.log('User connected:', userId);
        
        // Create peer connection for new user
        await createPeerConnection(userId, true);
    });

    socket.on('user-disconnected', ({ userId }) => {
        console.log('User disconnected:', userId);
        
        // Remove peer connection
        if (peers[userId]) {
            peers[userId].close();
            delete peers[userId];
        }
        
        // Remove video element
        const videoContainer = document.getElementById(`video-${userId}`);
        if (videoContainer) {
            videoContainer.remove();
        }
        
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
        console.log('Received ICE candidate from:', userId);
        
        if (peers[userId]) {
            await peers[userId].addIceCandidate(new RTCIceCandidate(candidate));
        }
    });

    socket.on('chat-message', ({ userId, userName, message, timestamp }) => {
        addChatMessage(userName, message, timestamp);
        
        // Update unread count if chat is closed
        const chatSidebar = document.getElementById('chatSidebar');
        if (!chatSidebar.classList.contains('open')) {
            unreadMessages++;
            updateChatBadge();
        }
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from signaling server');
    });
}

// Create WebRTC peer connection
async function createPeerConnection(userId, isInitiator) {
    const peerConnection = new RTCPeerConnection(rtcConfig);
    peers[userId] = peerConnection;

    // Add local stream tracks
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
        console.log('Received track from:', userId);
        
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

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
        console.log(`Connection state with ${userId}:`, peerConnection.connectionState);
        
        if (peerConnection.connectionState === 'disconnected' || 
            peerConnection.connectionState === 'failed') {
            if (peers[userId]) {
                peers[userId].close();
                delete peers[userId];
            }
            
            const videoContainer = document.getElementById(`video-${userId}`);
            if (videoContainer) {
                videoContainer.remove();
            }
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

// Add remote video to grid
function addRemoteVideo(userId, stream) {
    // Remove existing video if any
    let videoContainer = document.getElementById(`video-${userId}`);
    if (videoContainer) {
        videoContainer.remove();
    }

    // Create new video container
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
        <span class="participant-name">Participant ${userId.substring(0, 8)}</span>
        <div class="participant-status">
            <span class="status-icon active">🎤</span>
            <span class="status-icon active">📹</span>
        </div>
    `;

    videoContainer.appendChild(video);
    videoContainer.appendChild(overlay);

    document.getElementById('videoGrid').appendChild(videoContainer);
    
    updateParticipantCount();
}

// Setup event listeners
function setupEventListeners() {
    // Toggle microphone
    document.getElementById('toggleMic').addEventListener('click', toggleMicrophone);

    // Toggle video
    document.getElementById('toggleVideo').addEventListener('click', toggleCamera);

    // Toggle screen share
    document.getElementById('toggleScreen').addEventListener('click', toggleScreenShare);

    // Toggle participants sidebar
    document.getElementById('toggleParticipants').addEventListener('click', () => {
        toggleSidebar('participants');
    });

    // Toggle chat sidebar
    document.getElementById('toggleChat').addEventListener('click', () => {
        toggleSidebar('chat');
        unreadMessages = 0;
        updateChatBadge();
    });

    // Leave conference
    document.getElementById('leaveBtn').addEventListener('click', leaveConference);

    // Chat input - send on Enter
    document.getElementById('chatInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

// Toggle microphone
function toggleMicrophone() {
    isAudioEnabled = !isAudioEnabled;
    
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = isAudioEnabled;
    }

    const btn = document.getElementById('toggleMic');
    const status = document.getElementById('localMicStatus');
    
    if (isAudioEnabled) {
        btn.classList.remove('muted');
        status.classList.remove('muted');
        status.classList.add('active');
        status.textContent = '🎤';
    } else {
        btn.classList.add('muted');
        status.classList.add('muted');
        status.classList.remove('active');
        status.textContent = '🔇';
    }
}

// Toggle camera
function toggleCamera() {
    isVideoEnabled = !isVideoEnabled;
    
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = isVideoEnabled;
    }

    const btn = document.getElementById('toggleVideo');
    const status = document.getElementById('localVideoStatus');
    
    if (isVideoEnabled) {
        btn.classList.remove('off');
        status.classList.remove('muted');
        status.classList.add('active');
        status.textContent = '📹';
    } else {
        btn.classList.add('off');
        status.classList.add('muted');
        status.classList.remove('active');
        status.textContent = '📵';
    }
}

// Toggle screen share
async function toggleScreenShare() {
    const btn = document.getElementById('toggleScreen');
    
    if (!isScreenSharing) {
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always'
                },
                audio: false
            });

            const screenTrack = screenStream.getVideoTracks()[0];
            
            // Replace video track in all peer connections
            Object.values(peers).forEach(peer => {
                const sender = peer.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                    sender.replaceTrack(screenTrack);
                }
            });

            // Update local video
            document.getElementById('localVideo').srcObject = screenStream;

            // Handle screen share stop
            screenTrack.onended = () => {
                stopScreenShare();
            };

            isScreenSharing = true;
            btn.classList.add('sharing');
            btn.textContent = '⏹️';

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

    // Restore camera track
    const videoTrack = localStream.getVideoTracks()[0];
    Object.values(peers).forEach(peer => {
        const sender = peer.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
            sender.replaceTrack(videoTrack);
        }
    });

    document.getElementById('localVideo').srcObject = localStream;

    isScreenSharing = false;
    document.getElementById('toggleScreen').classList.remove('sharing');
    document.getElementById('toggleScreen').textContent = '🖥️';
}

// Toggle sidebar
function toggleSidebar(type) {
    const participantsSidebar = document.getElementById('participantsSidebar');
    const chatSidebar = document.getElementById('chatSidebar');
    
    if (type === 'participants') {
        chatSidebar.classList.remove('open');
        participantsSidebar.classList.toggle('open');
    } else if (type === 'chat') {
        participantsSidebar.classList.remove('open');
        chatSidebar.classList.toggle('open');
    }
}

// Close sidebar
function closeSidebar(type) {
    if (type === 'participants') {
        document.getElementById('participantsSidebar').classList.remove('open');
    } else if (type === 'chat') {
        document.getElementById('chatSidebar').classList.remove('open');
    }
}

// Load participants
async function loadParticipants() {
    try {
        const response = await fetch(`${API_BASE}/api/conferences/${conferenceId}/participants`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to load participants');
        }

        const data = await response.json();
        const participants = data.participants || [];

        renderParticipants(participants);
        updateParticipantCount();

    } catch (error) {
        console.error('Load participants error:', error);
    }
}

// Render participants list
function renderParticipants(participants) {
    const participantsList = document.getElementById('participantsList');
    
    if (participants.length === 0) {
        participantsList.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center;">No participants yet</p>';
        return;
    }

    participantsList.innerHTML = participants.map(p => {
        const initials = (p.userName || p.username || 'U').substring(0, 2).toUpperCase();
        const hostBadge = p.isHost || p.is_host ? ' 👑' : '';
        
        return `
            <div class="participant-item">
                <div class="participant-avatar">${initials}</div>
                <div class="participant-info">
                    <strong>${escapeHtml(p.userName || p.username || 'Unknown')}${hostBadge}</strong>
                    <small>Joined ${formatJoinTime(p.joinedAt || p.joined_at)}</small>
                </div>
            </div>
        `;
    }).join('');
}

// Format join time
function formatJoinTime(timestamp) {
    if (!timestamp) return 'recently';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    return `${diffHours} hours ago`;
}

// Update participant count
function updateParticipantCount() {
    const count = Object.keys(peers).length + 1; // +1 for local user
    document.getElementById('participantCount').textContent = count;
}

// Send chat message
function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Send via socket
    socket.emit('chat-message', {
        conferenceId,
        message,
        timestamp: new Date().toISOString()
    });
    
    // Clear input
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
    if (!confirm('Are you sure you want to leave this conference?')) {
        return;
    }

    try {
        // Stop timer
        if (roomTimer) {
            clearInterval(roomTimer);
        }

        // Stop all media tracks
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
        }

        // Close all peer connections
        Object.values(peers).forEach(peer => peer.close());
        peers = {};

        // Disconnect socket
        if (socket) {
            socket.emit('leave-conference', { conferenceId });
            socket.disconnect();
        }

        // Call API to leave
        await fetch(`${API_BASE}/api/conferences/${conferenceId}/leave`, {
            method: 'POST',
            credentials: 'include'
        });

        // Redirect
        window.location.href = 'conf.html';

    } catch (error) {
        console.error('Leave conference error:', error);
        // Redirect anyway
        window.location.href = 'conf.html';
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Handle page unload
window.addEventListener('beforeunload', (e) => {
    leaveConference();
});

// Make functions globally accessible
window.closeSidebar = closeSidebar;
window.sendMessage = sendMessage;