const API_BASE = window.location.origin;
const SOCKET_URL = window.location.origin;

// State
let socket = null;
let localStream = null;
let screenStream = null;
let peers = {};
let conferenceId = null;
let currentUser = null;
let chat = null;
let isAudioEnabled = true;
let isVideoEnabled = true;
let isScreenSharing = false;
let roomTimer = null;
let startTime = null;
let unreadMessages = 0;
let joinedConference = false;
const remoteMediaStates = {};
const roomScreenShareState = new Set();

// Host / moderation state
let isHost = false;
let hostId = null;
let coHosts = new Set();
let chatBanned = new Set();
const isModerator = () => isHost || coHosts.has(currentUser?.id);

// WebRTC Configuration
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize application when DOM is loaded
// - validate conference ID from query
// - load user and conference data
// - initialize camera/microphone and socket
// - set up UI event handlers and timer
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    conferenceId = urlParams.get('id');

    if (!conferenceId) {
        showNotification('No conference ID provided', 'error');
        window.location.href = 'conf.html';
        return;
    }

    try {
        const meRes = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
        if (!meRes.ok) { window.location.href = '/auth/Auth.html'; return; }

        const meData = await meRes.json();
        currentUser = meData.user;

        chat = new Chat('chatMessages', 'chatInput', 'sendBtn');
        chat.setCurrentUser({
            userId: currentUser.id,
            userName: currentUser.username || currentUser.email
        });
        chat.onSend((messageData) => {
            socket?.emit('chat-message', {
                conferenceId,
                message: messageData.message,
                timestamp: messageData.timestamp
            });
        });

        await loadConferenceDetails();
        // Socket first — чтобы получить roomState до инициализации медиа
        await initSocket();
        setupEventListeners();
        startRoomTimer();

    } catch (error) {
        console.error('Initialization error:', error);
        showNotification('Failed to join conference. Check camera/microphone permissions.', 'error');
        window.location.href = 'conf.html';
    }
});

async function loadConferenceDetails() {
    try {
        const response = await fetch(`${API_BASE}/api/conferences/${conferenceId}`, {
            credentials: 'include'
        });

        if (response.status === 403) {
            const err = await response.json();
            showNotification(
                err.requiresPassword
                    ? 'Password required — join from the conference list.'
                    : 'Access denied.',
                'error'
            );
            setTimeout(() => window.location.href = 'conf.html', 1500);
            return;
        }

        if (!response.ok) throw new Error('Conference not found');

        const data = await response.json();

        isHost = data.conference.isHost || false;
        hostId = data.conference.host_id || null;

        // Прямой заход по URL без участия — редирект
        if (!data.conference.isParticipant && !data.conference.isHost) {
            showNotification('You are not a participant of this conference.', 'error');
            setTimeout(() => window.location.href = 'conf.html', 1500);
            return;
        }

        document.getElementById('conferenceName').textContent = data.conference.name;
        await loadParticipants();

    } catch (error) {
        console.error('Load conference error:', error);
        throw error;
    }
}

function updateRemoteMediaState(userId, audio, video) {
    remoteMediaStates[userId] = { audio, video };

    const micStatus = document.querySelector(`#video-${userId} .mic-status`);
    const videoStatus = document.querySelector(`#video-${userId} .video-status`);
    if (micStatus) micStatus.textContent = audio ? '🎤' : '🔇';
    if (videoStatus) videoStatus.textContent = video ? '📹' : '📵';
}

/**
 * Request camera/microphone access and attach stream to local preview.
 * We request ideal HD constraints and common audio enhancements.
 * @param {{ audio: boolean, video: boolean }} options
 */
async function initLocalMedia({ audio = true, video = true } = {}) {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: video
                ? { width: { ideal: 1280 }, height: { ideal: 720 } }
                : false,
            audio: audio
                ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
                : false
        });

        // Sync state flags with actual track states
        isAudioEnabled = audio && localStream.getAudioTracks().length > 0;
        isVideoEnabled = video && localStream.getVideoTracks().length > 0;

        document.getElementById('localVideo').srcObject = localStream;
        updateMediaControlsUI();
        console.log('Local media initialized', { audio: isAudioEnabled, video: isVideoEnabled });

    } catch (error) {
        console.error('Error accessing media devices:', error);
        throw error;
    }
}

function updateMediaControlsUI() {
    const micBtn = document.getElementById('toggleMic');
    const videoBtn = document.getElementById('toggleVideo');
    const micStatus = document.getElementById('localMicStatus');
    const videoStatus = document.getElementById('localVideoStatus');

    micBtn?.classList.toggle('muted', !isAudioEnabled);
    videoBtn?.classList.toggle('off', !isVideoEnabled);
    if (micStatus) micStatus.textContent = isAudioEnabled ? '🎤' : '🔇';
    if (videoStatus) videoStatus.textContent = isVideoEnabled ? '📹' : '📵';
}

/**
 * Initialize Socket.IO connection and configure signaling events.
 * - fetch token from API for authenticated signaling
 * - join conference after connect
 * - handle participants, offers/answers, ICE candidates, and messages
 */
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

    // Existing participants — new user is initiator
    socket.on('room-participants', async ({ participants, roomState }) => {
        console.log('room-participants received:', JSON.stringify(participants), 'roomState:', roomState);

        if (roomState?.coHosts) coHosts = new Set(roomState.coHosts);
        if (roomState?.chatBanned) chatBanned = new Set(roomState.chatBanned);

        let joinAudio = true;
        let joinVideo = true;

        if (roomState?.someoneIsScreenSharing) {
            joinVideo = false;
            showNotification('Someone is screen sharing — camera disabled on join', 'info');
        }

        if (participants.length > 5) {
            joinAudio = false;
            showNotification('Large room detected — microphone muted on join', 'info');
        }

        await initLocalMedia({ audio: joinAudio, video: joinVideo });

        for (const p of participants) {
            if (p.userId !== currentUser.id) {
                await createPeerConnection(p.userId, true, p.userName);
                if (p.mediaState) {
                    updateRemoteMediaState(p.userId, p.mediaState.audio, p.mediaState.video);
                }
            }
        }
    });
    // New user joined — existing user is NOT initiator, waits for offer
    socket.on('user-connected', async ({ userId, userName }) => {
        console.log('User connected:', userId, userName);
        await createPeerConnection(userId, false, userName);
    });

    // Peer left the conference, clean up local RTCPeerConnection and UI
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

    socket.on('user-screen-share-start', ({ userId, userName }) => {
        roomScreenShareState.add(userId);
        showNotification(`${userName} started screen sharing`, 'info');

        // Если есть video-контейнер этого юзера — помечаем
        const container = document.getElementById(`video-${userId}`);
        if (container) container.classList.add('screen-sharing');
    });

    socket.on('user-screen-share-stop', ({ userId }) => {
        roomScreenShareState.delete(userId);

        const container = document.getElementById(`video-${userId}`);
        if (container) container.classList.remove('screen-sharing');
    });

    socket.on('offer', async ({ userId, offer, userName }) => {
        console.log('Received offer from:', userId);
        await createPeerConnection(userId, false, userName);
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

    // Keep remote media mute/camera status in sync across participants
    socket.on('user-media-state', ({ userId, audio, video }) => {
        updateRemoteMediaState(userId, audio, video);
    });

    // Handle signaling socket disconnect (network, server down etc.)
    socket.on('disconnect', () => {
        console.log('Disconnected from signaling server');
    });

    socket.on('error', (err) => {
        console.error('Socket error:', err);
    });

    // Forced media change by host/co-host
    socket.on('force-muted', ({ audio, video, screen }) => {
        if (audio === false) setMicEnabled(false);
        if (video === false) setCameraEnabled(false);
        if (screen === false && isScreenSharing) stopScreenShare();
        showNotification('Your media was muted by the host', 'warning');
    });

    // Chat ban/unban by host/co-host
    socket.on('chat-banned', ({ banned }) => {
        chat.setEnabled(!banned);
        showNotification(
            banned ? 'You have been banned from chat' : 'Your chat access has been restored',
            banned ? 'warning' : 'info'
        );
    });

    // Kicked from conference
    socket.on('force-disconnect', ({ message }) => {
        cleanupAndRedirect(message || 'You have been removed from the conference.');
    });

    // Rejected on re-join after kick
    socket.on('join-rejected', () => {
        cleanupAndRedirect('You have been kicked from this conference.');
    });

    // Another participant was kicked — update UI
    socket.on('user-kicked', ({ userId: kickedUserId, kickerName }) => {
        const el = document.getElementById(`video-${kickedUserId}`);
        if (el) el.remove();
        updateParticipantCount();
        showNotification(`A participant was removed by ${kickerName}`, 'info');
        loadParticipants();
    });

    // Co-host role update
    socket.on('user-role-change', ({ userId: changedId, isCoHost }) => {
        if (isCoHost) coHosts.add(changedId);
        else coHosts.delete(changedId);
        loadParticipants();
    });

    // Chat ban badge update for the room
    socket.on('user-chat-banned', ({ userId: bannedId, banned }) => {
        if (banned) chatBanned.add(bannedId);
        else chatBanned.delete(bannedId);
        loadParticipants();
    });
}

/**
 * Create a new RTCPeerConnection for a remote participant.
 * @param {string} userId Peer user ID
 * @param {boolean} isInitiator True when this client starts the offer
 * @param {string} userName Display name for UI
 */
async function createPeerConnection(userId, isInitiator, userName = 'Unknown') {
    if (peers[userId]) {
        peers[userId].close();
    }

    const peerConnection = new RTCPeerConnection(rtcConfig);
    peers[userId] = peerConnection;

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // When remote user publishes tracks, attach to a new video tile
    peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        addRemoteVideo(userId, remoteStream, userName);
    };

    // Forward local ICE candidates to remote peer via signaling
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                to: userId,
                candidate: event.candidate
            });
        }
    };

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

    if (isInitiator) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', { to: userId, offer });
    }

    return peerConnection;
}

function addRemoteVideo(userId, stream, userName = 'Unknown') {
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
        <span class="participant-name">${escapeHtml(userName)}</span>
        <div class="participant-status">
            <span class="status-icon active mic-status">🎤</span>
            <span class="status-icon active video-status">📹</span>
        </div>
    `;

    videoContainer.appendChild(video);
    videoContainer.appendChild(overlay);
    document.getElementById('videoGrid').appendChild(videoContainer);

    if (remoteMediaStates[userId]) {
        const { audio, video: videoEnabled } = remoteMediaStates[userId];
        const micStatus = videoContainer.querySelector('.mic-status');
        const videoStatus = videoContainer.querySelector('.video-status');
        if (micStatus) micStatus.textContent = audio ? '🎤' : '🔇';
        if (videoStatus) videoStatus.textContent = videoEnabled ? '📹' : '📵';
    }

    updateParticipantCount();
}

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
}

function setMicEnabled(enabled, { emit = true } = {}) {
    isAudioEnabled = enabled;
    const audioTrack = localStream?.getAudioTracks()[0];
    if (audioTrack) audioTrack.enabled = isAudioEnabled;

    const btn = document.getElementById('toggleMic');
    const status = document.getElementById('localMicStatus');
    btn?.classList.toggle('muted', !isAudioEnabled);
    if (status) status.textContent = isAudioEnabled ? '🎤' : '🔇';

    if (emit) {
        socket?.emit('media-state-change', { conferenceId, audio: isAudioEnabled, video: isVideoEnabled });
    }
}

function toggleMicrophone() {
    setMicEnabled(!isAudioEnabled);
}

function setCameraEnabled(enabled, { emit = true } = {}) {
    isVideoEnabled = enabled;
    const videoTrack = localStream?.getVideoTracks()[0];
    if (videoTrack) videoTrack.enabled = isVideoEnabled;

    const btn = document.getElementById('toggleVideo');
    const status = document.getElementById('localVideoStatus');
    btn?.classList.toggle('off', !isVideoEnabled);
    if (status) status.textContent = isVideoEnabled ? '📹' : '📵';

    if (emit) {
        socket?.emit('media-state-change', { conferenceId, audio: isAudioEnabled, video: isVideoEnabled });
    }
}

function toggleCamera() {
    setCameraEnabled(!isVideoEnabled);
}

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
            showNotification('Failed to share screen', 'error');
        }
    } else {
        stopScreenShare();
    }
}

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

function closeSidebar(type) {
    if (type === 'participants') {
        document.getElementById('participantsSidebar').classList.remove('open');
    } else {
        document.getElementById('chatSidebar').classList.remove('open');
    }
}

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

function renderParticipants(participants) {
    const participantsList = document.getElementById('participantsList');

    if (participants.length === 0) {
        participantsList.innerHTML = '<p style="color:var(--room-muted);text-align:center;padding:2rem;font-size:0.88rem;">No participants yet</p>';
        return;
    }

    participantsList.innerHTML = participants.map(p => {
        const uid = p.user_id || p.userId;
        const name = p.username || p.userName || 'Unknown';
        const initials = getInitials(name);
        const isParticipantHost = !!(p.is_host || p.isHost);
        const isCoHost = coHosts.has(uid);
        const isChatBanned = chatBanned.has(uid);
        const isSelf = uid === currentUser?.id;
        const canActOn = isModerator() && !isSelf && !isParticipantHost;
        const canManageCoHost = isHost && !isSelf && !isParticipantHost;

        const badges = [
            isParticipantHost ? '👑' : '',
            isCoHost && !isParticipantHost ? '🛡️' : '',
            isChatBanned ? '🔇' : ''
        ].filter(Boolean).join(' ');

        const avatarHtml = p.avatar_url
            ? `<img class="participant-avatar-img" src="${p.avatar_url}" alt="${escapeHtml(name)}">`
            : `<div class="participant-avatar-initials" style="background:${stringToColor(name)}">${initials}</div>`;

        const actionMenu = canActOn ? `
            <div class="mod-menu-wrap">
                <button class="mod-menu-btn" onclick="toggleModMenu(this, ${uid})" title="Moderation options">⋮</button>
                <div class="mod-menu" id="mod-menu-${uid}">
                    <button onclick="hostForceMute(${uid}, 'audio')">🔇 Mute mic</button>
                    <button onclick="hostForceMute(${uid}, 'video')">📵 Turn off camera</button>
                    <button onclick="hostForceMute(${uid}, 'screen')">🖥️ Stop screen share</button>
                    <button onclick="hostChatBan(${uid}, ${!isChatBanned})">${isChatBanned ? '💬 Unban chat' : '🚫 Ban from chat'}</button>
                    ${canManageCoHost ? `<button onclick="${isCoHost ? 'hostDemoteCoHost' : 'hostPromoteCoHost'}(${uid})">${isCoHost ? '🛡️ Remove co-host' : '🛡️ Make co-host'}</button>` : ''}
                    <button class="danger" onclick="hostKick(${uid}, '${escapeHtml(name).replace(/'/g, "\\'")}')">❌ Kick</button>
                </div>
            </div>
        ` : '';

        return `
            <div class="participant-item">
                <div class="participant-avatar">${avatarHtml}</div>
                <div class="participant-info">
                    <strong>${escapeHtml(name)} ${badges}</strong>
                    <small>Joined ${formatJoinTime(p.joined_at || p.joinedAt)}</small>
                </div>
                <div class="participant-media">
                    <div class="media-icon">🎤</div>
                    <div class="media-icon">📹</div>
                </div>
                ${actionMenu}
            </div>
        `;
    }).join('');
}

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

function updateParticipantCount() {
    const count = Object.keys(peers).length + 1;
    document.getElementById('participantCount').textContent = count;
}

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

function updateChatBadge(count) {
    const badge = document.getElementById('chatBadge');
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

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

function cleanupAndRedirect(reason) {
    if (roomTimer) clearInterval(roomTimer);
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (screenStream) screenStream.getTracks().forEach(t => t.stop());
    Object.values(peers).forEach(p => p.close());
    peers = {};
    if (socket) socket.disconnect();
    alert(reason);
    window.location.href = 'conf.html';
}

// ============================================================
// Moderation actions (called from participant list HTML)
// ============================================================

function toggleModMenu(btn, targetUserId) {
    document.querySelectorAll('.mod-menu').forEach(m => {
        if (m.id !== `mod-menu-${targetUserId}`) m.style.display = 'none';
    });
    const menu = document.getElementById(`mod-menu-${targetUserId}`);
    if (!menu) return;
    const isOpen = menu.style.display === 'block';
    menu.style.display = isOpen ? 'none' : 'block';

    if (!isOpen) {
        const closeOutside = (e) => {
            if (!btn.closest('.mod-menu-wrap').contains(e.target)) {
                menu.style.display = 'none';
                document.removeEventListener('click', closeOutside);
            }
        };
        setTimeout(() => document.addEventListener('click', closeOutside), 0);
    }
}

function closeAllModMenus() {
    document.querySelectorAll('.mod-menu').forEach(m => m.style.display = 'none');
}

function hostForceMute(targetUserId, type) {
    closeAllModMenus();
    const payload = { conferenceId, targetUserId };
    if (type === 'audio') payload.audio = false;
    else if (type === 'video') payload.video = false;
    else if (type === 'screen') payload.screen = false;
    socket?.emit('host:force-media', payload);
}

function hostChatBan(targetUserId, banned) {
    closeAllModMenus();
    socket?.emit('host:chat-ban', { conferenceId, targetUserId, banned });
    // Optimistic update — confirmed via user-chat-banned broadcast
    if (banned) chatBanned.add(targetUserId);
    else chatBanned.delete(targetUserId);
    loadParticipants();
}

async function hostKick(targetUserId, targetName) {
    closeAllModMenus();
    const confirmed = await showConfirm(`Kick ${targetName} from the conference?`, 'Kick', 'danger');
    if (!confirmed) return;
    socket?.emit('host:kick', { conferenceId, targetUserId });
}

function hostPromoteCoHost(targetUserId) {
    closeAllModMenus();
    socket?.emit('host:promote-co-host', { conferenceId, targetUserId });
}

function hostDemoteCoHost(targetUserId) {
    closeAllModMenus();
    socket?.emit('host:demote-co-host', { conferenceId, targetUserId });
}

async function leaveConference() {
    const confirmed = await showConfirm('Leave this conference?', 'Leave', 'danger');
    if (!confirmed) return;

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

window.addEventListener('beforeunload', () => {
    if (joinedConference && conferenceId) {
        navigator.sendBeacon(`${API_BASE}/api/conferences/${conferenceId}/leave`);
    }
    if (socket) socket.disconnect();
});

window.closeSidebar = closeSidebar;
window.sendMessage = sendMessage;
window.toggleModMenu = toggleModMenu;
window.hostForceMute = hostForceMute;
window.hostChatBan = hostChatBan;
window.hostKick = hostKick;
window.hostPromoteCoHost = hostPromoteCoHost;
window.hostDemoteCoHost = hostDemoteCoHost;