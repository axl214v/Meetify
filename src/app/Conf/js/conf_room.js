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

// Pin / spotlight state
const pinnedTiles = new Set();

// Camera flip/rotate state (local preview only — does not affect transmitted stream)
let flipH    = false;
let flipV    = false;
let rotated  = false;

function applyVideoFlip() {
    const vid = document.getElementById('localVideo');
    if (!vid) return;
    vid.classList.toggle('flip-h',      flipH);
    vid.classList.toggle('flip-v',      flipV);
    vid.classList.toggle('rotate-land', rotated);

    // When rotating 90°, scale up so rotated content fills the element's bounding box (no black bars)
    if (rotated) {
        const w = vid.offsetWidth  || 160;
        const h = vid.offsetHeight || 90;
        vid.style.setProperty('--rot-scale', Math.max(w / h, h / w));
    } else {
        vid.style.removeProperty('--rot-scale');
    }

    document.getElementById('flipHBtn')?.classList.toggle('active', flipH);
    document.getElementById('flipVBtn')?.classList.toggle('active', flipV);
    document.getElementById('rotateBtn')?.classList.toggle('active', rotated);
}

// Conference mode ('p2p' | 'sfu')
let conferenceMode = 'p2p';

// SFU state (only used for Group calls)
let sfuDevice        = null;
let sfuSendTransport = null;
let sfuRecvTransport = null;
const sfuProducers   = {};   // { audio, video, screen }
const sfuConsumers   = {};   // consumerId -> consumer
const sfuProdInfo    = {};   // producerId -> { userId, userName, kind }
const remoteStreams   = {};  // userId -> MediaStream

// Host / moderation state
let isHost = false;
let hostId = null;
let coHosts = new Set();
let chatBanned = new Set();
const isModerator = () => isHost || coHosts.has(currentUser?.id);

// WebRTC Configuration — populated from server on join
let rtcConfig = { iceServers: [] };

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

        isHost         = data.conference.isHost || false;
        hostId         = data.conference.host_id || null;
        conferenceMode = data.conference.mode || 'p2p';

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
    socket.on('room-participants', async ({ participants, roomState, iceServers }) => {
        if (iceServers && iceServers.length > 0) rtcConfig = { iceServers };
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

        if (conferenceMode === 'sfu') {
            await initSfu();
        } else {
            for (const p of participants) {
                if (p.userId !== currentUser.id) {
                    await createPeerConnection(p.userId, true, p.userName);
                    if (p.mediaState) {
                        updateRemoteMediaState(p.userId, p.mediaState.audio, p.mediaState.video);
                    }
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
        pinnedTiles.delete(String(userId));
        applyPinLayout();
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

    // Rejected on re-join after kick, or P2P room full
    socket.on('join-rejected', ({ reason } = {}) => {
        const msg = reason === 'full'
            ? 'This Private call is full (max 8 participants).'
            : 'You have been kicked from this conference.';
        cleanupAndRedirect(msg);
    });

    // Another participant was kicked — update UI
    socket.on('user-kicked', ({ userId: kickedUserId, kickerName }) => {
        const el = document.getElementById(`video-${kickedUserId}`);
        if (el) el.remove();
        pinnedTiles.delete(String(kickedUserId));
        applyPinLayout();
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
            pinnedTiles.delete(String(userId));
            applyPinLayout();
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
    videoContainer.dataset.userId = String(userId);

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsinline = true;
    video.srcObject = stream;

    const placeholder = document.createElement('div');
    placeholder.className = 'video-placeholder';
    const placeholderAvatar = document.createElement('div');
    placeholderAvatar.className = 'placeholder-avatar';
    placeholderAvatar.textContent = getInitials(userName);
    placeholder.appendChild(placeholderAvatar);

    const overlay = document.createElement('div');
    overlay.className = 'video-overlay';

    const overlayLeft = document.createElement('div');
    overlayLeft.className = 'overlay-left';
    const avatarEl = document.createElement('div');
    avatarEl.className = 'overlay-avatar-initials';
    avatarEl.style.background = stringToColor(userName);
    avatarEl.textContent = getInitials(userName);
    const nameEl = document.createElement('span');
    nameEl.className = 'participant-name';
    nameEl.textContent = userName;
    overlayLeft.appendChild(avatarEl);
    overlayLeft.appendChild(nameEl);

    const overlayRight = document.createElement('div');
    overlayRight.className = 'overlay-right';
    const micPill = document.createElement('div');
    micPill.className = 'status-pill mic-status';
    micPill.textContent = '🎤';
    const videoPill = document.createElement('div');
    videoPill.className = 'status-pill video-status';
    videoPill.textContent = '📹';
    const pinBtn = document.createElement('button');
    pinBtn.className = 'pin-btn';
    pinBtn.title = 'Pin (spotlight)';
    pinBtn.textContent = '📍';
    pinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePin(String(userId));
    });
    overlayRight.appendChild(micPill);
    overlayRight.appendChild(videoPill);
    overlayRight.appendChild(pinBtn);

    overlay.appendChild(overlayLeft);
    overlay.appendChild(overlayRight);

    videoContainer.appendChild(video);
    videoContainer.appendChild(placeholder);
    videoContainer.appendChild(overlay);

    // In spotlight mode new remote participants go to filmstrip
    if (pinnedTiles.size > 0) {
        document.getElementById('filmstrip').appendChild(videoContainer);
        updateFilmstripLabel();
    } else {
        document.getElementById('videoGrid').appendChild(videoContainer);
    }

    if (remoteMediaStates[userId]) {
        const { audio, video: videoEnabled } = remoteMediaStates[userId];
        micPill.textContent = audio ? '🎤' : '🔇';
        videoPill.textContent = videoEnabled ? '📹' : '📵';
    }

    updateParticipantCount();
}

function togglePin(userId) {
    if (pinnedTiles.has(userId)) {
        pinnedTiles.delete(userId);
    } else {
        pinnedTiles.add(userId);
    }
    applyPinLayout();
}

function applyPinLayout() {
    const grid = document.getElementById('videoGrid');
    const filmstrip = document.getElementById('filmstrip');
    const filmstripSection = document.getElementById('filmstripSection');

    const allContainers = [
        ...document.querySelectorAll('#videoGrid .video-container'),
        ...document.querySelectorAll('#filmstrip .video-container')
    ];

    if (pinnedTiles.size === 0) {
        allContainers.forEach(c => grid.appendChild(c));
        filmstripSection.classList.add('hidden');
        // Reset strip-collapsed so it opens fresh next time
        filmstripSection.classList.remove('strip-collapsed');
        const toggleBtn = document.getElementById('filmstripToggleBtn');
        if (toggleBtn) toggleBtn.textContent = 'Hide';
    } else {
        allContainers.forEach(c => {
            const uid = c.dataset.userId;
            if (pinnedTiles.has(uid)) {
                grid.appendChild(c);
            } else {
                filmstrip.appendChild(c);
            }
        });
        filmstripSection.classList.remove('hidden');
        updateFilmstripLabel();
    }

    // Sync pin button appearance
    allContainers.forEach(c => {
        const uid = c.dataset.userId;
        const isPinned = pinnedTiles.has(uid);
        c.classList.toggle('pinned', isPinned);
        const btn = c.querySelector('.pin-btn');
        if (btn) {
            btn.title = isPinned ? 'Unpin' : 'Pin (spotlight)';
            btn.textContent = isPinned ? '📌' : '📍';
        }
    });
}

function updateFilmstripLabel() {
    const count = document.querySelectorAll('#filmstrip .video-container').length;
    const label = document.getElementById('filmstripLabel');
    if (label) label.textContent = `${count} other${count !== 1 ? 's' : ''}`;
}

function toggleStrip() {
    const section = document.getElementById('filmstripSection');
    const btn = document.getElementById('filmstripToggleBtn');
    const collapsed = section.classList.toggle('strip-collapsed');
    btn.textContent = collapsed ? 'Show' : 'Hide';
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

    document.getElementById('localPinBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        togglePin('local');
    });

    const videoMenuBtn = document.getElementById('videoMenuBtn');
    const videoMenu    = document.getElementById('videoMenu');

    videoMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        videoMenu.classList.toggle('open');
    });

    // Close dropdown when clicking anywhere else
    document.addEventListener('click', () => videoMenu.classList.remove('open'));

    document.getElementById('flipHBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        flipH = !flipH;
        applyVideoFlip();
    });

    document.getElementById('flipVBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        flipV = !flipV;
        applyVideoFlip();
    });

    document.getElementById('rotateBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        rotated = !rotated;
        applyVideoFlip();
    });
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

            if (conferenceMode === 'sfu') {
                // SFU: close camera producer, produce screen track
                if (sfuProducers.video) {
                    socket.emit('sfu:close-producer', { producerId: sfuProducers.video.id });
                    sfuProducers.video.close();
                    delete sfuProducers.video;
                }
                sfuProducers.screen = await sfuSendTransport.produce({
                    track: screenTrack,
                    appData: { share: true }
                });
            } else {
                // P2P: replaceTrack on every peer connection
                Object.values(peers).forEach(peer => {
                    const sender = peer.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) sender.replaceTrack(screenTrack);
                });
            }

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
        await stopScreenShare();
    }
}

async function stopScreenShare() {
    if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
        screenStream = null;
    }

    if (conferenceMode === 'sfu') {
        // SFU: close screen producer, re-produce camera
        if (sfuProducers.screen) {
            socket.emit('sfu:close-producer', { producerId: sfuProducers.screen.id });
            sfuProducers.screen.close();
            delete sfuProducers.screen;
        }
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack && sfuSendTransport) {
            sfuProducers.video = await sfuSendTransport.produce({ track: videoTrack });
        }
    } else {
        // P2P: replaceTrack back to camera
        const videoTrack = localStream.getVideoTracks()[0];
        Object.values(peers).forEach(peer => {
            const sender = peer.getSenders().find(s => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(videoTrack);
        });
    }

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

function cleanupSfu() {
    Object.values(sfuProducers).forEach(p => { try { p?.close(); } catch {} });
    Object.values(sfuConsumers).forEach(c => { try { c?.close(); } catch {} });
    try { sfuSendTransport?.close(); } catch {}
    try { sfuRecvTransport?.close(); } catch {}
}

function cleanupAndRedirect(reason) {
    if (roomTimer) clearInterval(roomTimer);
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (screenStream) screenStream.getTracks().forEach(t => t.stop());
    Object.values(peers).forEach(p => p.close());
    peers = {};
    cleanupSfu();
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
    cleanupSfu();

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

// ============================================================
// SFU (mediasoup) — Group call implementation
// ============================================================

// Flag set when mediasoup-ready fires (whether Device loaded or not).
// Prevents waitForMediasoup() hanging if the event already fired.
let _msoupReadyFired = false;
window.addEventListener('mediasoup-ready', () => { _msoupReadyFired = true; }, { once: true });

function socketAck(event, data) {
    return new Promise(resolve => socket.emit(event, data, resolve));
}

function waitForMediasoup(timeout = 8000) {
    // Already ready (loaded or failed)
    if (window.MediasoupDevice || _msoupReadyFired) return Promise.resolve();
    return new Promise(resolve => {
        const t = setTimeout(resolve, timeout);
        window.addEventListener('mediasoup-ready', () => { clearTimeout(t); resolve(); }, { once: true });
    });
}

async function initSfu() {
    await waitForMediasoup();
    if (!window.MediasoupDevice) {
        showNotification('mediasoup-client failed to load — Group call unavailable', 'error');
        return;
    }

    sfuDevice = new window.MediasoupDevice();

    // 1. Get router RTP capabilities and load device
    const { rtpCapabilities, error: capErr } = await socketAck('sfu:get-rtp-capabilities', { conferenceId });
    if (capErr) throw new Error(capErr);
    await sfuDevice.load({ routerRtpCapabilities: rtpCapabilities });

    // 2. Create send transport and wire its events before producing
    const sendParams = await socketAck('sfu:create-transport', { conferenceId });
    if (sendParams.error) throw new Error(sendParams.error);

    sfuSendTransport = sfuDevice.createSendTransport(sendParams);
    sfuSendTransport.on('connect', ({ dtlsParameters }, cb, eb) => {
        socketAck('sfu:connect-transport', { transportId: sfuSendTransport.id, dtlsParameters })
            .then(() => cb()).catch(eb);
    });
    sfuSendTransport.on('produce', async ({ kind, rtpParameters, appData }, cb, eb) => {
        const { id, error } = await socketAck('sfu:produce', {
            transportId: sfuSendTransport.id, kind, rtpParameters, appData
        });
        if (error) return eb(new Error(error));
        cb({ id });
    });

    // 3. Produce local audio and video
    const audioTrack = localStream.getAudioTracks()[0];
    const videoTrack = localStream.getVideoTracks()[0];
    if (audioTrack) sfuProducers.audio = await sfuSendTransport.produce({ track: audioTrack });
    if (videoTrack) sfuProducers.video = await sfuSendTransport.produce({ track: videoTrack });

    // 4. Create recv transport and wire connect event before consuming
    const recvParams = await socketAck('sfu:create-transport', { conferenceId });
    if (recvParams.error) throw new Error(recvParams.error);

    sfuRecvTransport = sfuDevice.createRecvTransport(recvParams);
    sfuRecvTransport.on('connect', ({ dtlsParameters }, cb, eb) => {
        socketAck('sfu:connect-transport', { transportId: sfuRecvTransport.id, dtlsParameters })
            .then(() => cb()).catch(eb);
    });

    // 5. Consume all existing producers in the room
    const { producers } = await socketAck('sfu:get-producers', { conferenceId });
    for (const info of producers) await sfuConsume(info);

    // 6. React to new producers (others who join later or start screen share)
    socket.on('sfu:new-producer', async info => { await sfuConsume(info); });

    // 7. Handle producers closed remotely (user left or stopped screen share).
    //    sfuProdInfo stores consumerId so we can find and remove the exact track.
    socket.on('sfu:producer-closed', ({ producerId }) => {
        const info = sfuProdInfo[producerId];
        if (!info) return;

        const { userId, consumerId } = info;
        delete sfuProdInfo[producerId];

        // Remove the specific track from the user's stream
        const consumer = sfuConsumers[consumerId];
        const stream   = remoteStreams[userId];
        if (consumer && stream && consumer.track) {
            stream.removeTrack(consumer.track);
        }
        if (consumer) { consumer.close(); delete sfuConsumers[consumerId]; }

        // Remove tile only if the user has no remaining producers
        const stillHasProducer = Object.values(sfuProdInfo).some(pi => pi.userId === userId);
        if (!stillHasProducer) {
            document.getElementById(`video-${userId}`)?.remove();
            pinnedTiles.delete(String(userId));
            applyPinLayout();
            updateParticipantCount();
            delete remoteStreams[userId];
        }
    });

    // 8. Handle consumer closed server-side (e.g. producer paused then transport closed)
    socket.on('sfu:consumer-closed', ({ consumerId }) => {
        const consumer = sfuConsumers[consumerId];
        if (!consumer) return;
        // Find which producer this consumer belonged to and clean up its track
        const prodEntry = Object.entries(sfuProdInfo).find(([, i]) => i.consumerId === consumerId);
        if (prodEntry) {
            const [producerId, info] = prodEntry;
            const stream = remoteStreams[info.userId];
            if (stream && consumer.track) stream.removeTrack(consumer.track);
            delete sfuProdInfo[producerId];
        }
        consumer.close();
        delete sfuConsumers[consumerId];
    });
}

async function sfuConsume({ producerId, userId, userName, kind }) {
    if (!sfuDevice.canConsume({ producerId, rtpCapabilities: sfuDevice.rtpCapabilities })) return;

    const params = await socketAck('sfu:consume', {
        transportId:     sfuRecvTransport.id,
        producerId,
        rtpCapabilities: sfuDevice.rtpCapabilities,
        conferenceId
    });
    if (params.error) { console.error('[SFU] consume error:', params.error); return; }

    const consumer = await sfuRecvTransport.consume(params);
    sfuConsumers[consumer.id] = consumer;
    // Store consumerId so we can find the exact track when the producer closes
    sfuProdInfo[producerId] = { userId, userName, kind, consumerId: consumer.id };

    // Resume (server starts consumers paused)
    await socketAck('sfu:resume-consumer', { consumerId: consumer.id });

    // Group audio+video into one MediaStream per user, then render (or update) their tile
    if (!remoteStreams[userId]) remoteStreams[userId] = new MediaStream();
    remoteStreams[userId].addTrack(consumer.track);
    addRemoteVideo(userId, remoteStreams[userId], userName);
}

window.closeSidebar = closeSidebar;
window.sendMessage = sendMessage;
window.toggleModMenu = toggleModMenu;
window.hostForceMute = hostForceMute;
window.hostChatBan = hostChatBan;
window.hostKick = hostKick;
window.hostPromoteCoHost = hostPromoteCoHost;
window.hostDemoteCoHost = hostDemoteCoHost;
window.togglePin = togglePin;
window.toggleStrip = toggleStrip;