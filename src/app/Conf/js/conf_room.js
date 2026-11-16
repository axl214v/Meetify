const API_BASE = window.location.origin;
const SOCKET_URL = window.location.origin;

// State
let socket = null;
let localStream = null;
let screenStream = null;
let peers = {};
// Screen share rides on its own transceiver next to the camera: sender per peer, and the first stream
// a peer sends us is its camera stream (anything else with video is its screen)
let screenSenders = {};
let camStreams = {};
// ICE candidates that arrive before the remote description is set (addIceCandidate would throw)
let pendingCandidates = {};

async function flushPendingCandidates(userId) {
    const queued = pendingCandidates[userId] || [];
    delete pendingCandidates[userId];
    for (const c of queued) {
        try { await peers[userId].addIceCandidate(new RTCIceCandidate(c)); }
        catch (e) { console.warn('addIceCandidate failed:', e); }
    }
}
let conferenceId = null;
let inviteCode = null;   // short-link code, known to the host and participants

// Guest (no account): the token from the join page lives in sessionStorage, never in a cookie
const GUEST_KEY = 'meetify-guest';
let guestSession = null;     // { token, conferenceId, userId, name } when this tab joined as a guest
let guestConference = null;  // room details from /api/guest/session
function readGuestSession() {
    try {
        const g = JSON.parse(sessionStorage.getItem(GUEST_KEY) || 'null');
        return g && g.token && String(g.conferenceId) === String(conferenceId) ? g : null;
    } catch { return null; }
}
function clearGuestSession() { try { sessionStorage.removeItem(GUEST_KEY); } catch {} }
const guestHeaders = () => ({ Authorization: `Bearer ${guestSession.token}` });
// Where to go when the call is over: guests have no conference list
const homeUrl = () => (guestSession ? '/' : 'conf.html');
// Offer collisions: both sides must pick the same loser. Numeric ids compare as numbers, guest ids as text.
function idPrecedes(a, b) {
    const na = Number(a), nb = Number(b);
    return Number.isNaN(na) || Number.isNaN(nb) ? String(a) < String(b) : na < nb;
}
let currentUser = null;
let chat = null;
let isAudioEnabled = true;
let isVideoEnabled = true;
let isScreenSharing = false;
let roomTimer = null;
let startTime = null;
let unreadMessages = 0;
let joinedConference = false;
let leaving = false;          // the person is leaving: nothing may reconnect, rebuild or retry any more
let resyncing = false;        // a room-participants answer is being applied
let resyncQueued = null;      // a newer answer that arrived meanwhile
const resilience = { offline: false, serverDown: false, sfuDown: false, stuck: false, stuckTimer: null, listening: false };
const resilienceTimers = new Set();   // retry timers (SFU rebuild, peer re-create): all cleared when leaving
const recreateTries = {};             // userId -> how many times we re-created a lost peer (99 = they left)
const roomMembers = new Set();   // String(userId) of everybody else in the room, as told by the server
const raisedHands = new Set();   // String(userId) of everybody whose hand is up (told by the server, never stored)
let lastParticipants = [];     // last list shown in the participants panel (re-rendered when hands change)
let pttActive = false;         // Space is held and the microphone is on only because of it
const REACTION_LABELS = { 'thumbs-up': t('Thumbs up'), clap: t('Clap'), heart: t('Heart'), laugh: t('Laugh'), surprise: t('Surprise'), question: t('Question') };
let redirecting = false;      // the page is being sent elsewhere (no access): do not open the lobby
let mediaReady = false;       // the lobby stream has been applied once (a socket reconnect must not reset mute)
let lobbyChoice = { audio: true, video: true };   // microphone / camera switches chosen in the lobby
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
let sfuSocket        = null;
let sfuDevice        = null;
let sfuServerFingerprints = null; // DTLS fingerprints of the media server, shown in the security panel
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
let roomLocked = false, waitingRoomOn = false;   // told by the server (the setting itself is stored, the lock is not)
let allowRecording = false;                      // host setting: members may record
const recordingUsers = new Map();                // String(userId) -> name of everybody who records right now (told by the server)
let recTimer = null, recStartCheck = null;
let waitingPeople = [];                          // people at the door, only filled for the host and co-hosts
const notifiedWaiting = new Set();               // one notice per person
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



// Initialize application when DOM is loaded
// - validate conference ID from query
// - load user and conference data
// - initialize camera/microphone and socket
// - set up UI event handlers and timer
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    conferenceId = urlParams.get('id');

    if (!conferenceId) {
        showNotification(t('No conference ID provided'), 'error');
        window.location.href = 'conf.html';
        return;
    }

    try {
        const meRes = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
        if (meRes.ok) {
            currentUser = (await meRes.json()).user;
        } else {
            // Not signed in: a guest token for this room is the only other way in
            guestSession = readGuestSession();
            if (!guestSession) { window.location.href = '/auth/Auth.html'; return; }
            const gRes = await fetch(`${API_BASE}/api/guest/session`, { headers: guestHeaders() });
            if (!gRes.ok) {
                const err = await gRes.json().catch(() => ({}));
                clearGuestSession();
                showNotification(err.message ? t(err.message) : t('Your guest session has expired.'), 'error');
                setTimeout(() => { window.location.href = '/'; }, 1500);
                return;
            }
            const gData = await gRes.json();
            guestConference = gData.conference;
            // the server adds the same "(guest)" mark to the name everyone else sees
            currentUser = { ...gData.user, username: `${gData.user.username} (guest)` };
        }

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
        if (redirecting) return;
        // Lobby: pick devices and see yourself; nothing connects until "Join now"
        await runLobby();
        // Socket first — чтобы получить roomState до инициализации медиа
        await initSocket();
        setupEventListeners();
        startRoomTimer();

    } catch (error) {
        console.error('Initialization error:', error);
        showNotification(t('Failed to join conference. Check camera/microphone permissions.'), 'error');
        window.location.href = 'conf.html';
    }
});

async function loadConferenceDetails() {
    if (guestSession) {
        const c = guestConference;
        isHost         = false;
        hostId         = c.host_id || null;
        conferenceMode = c.mode || 'p2p';
        inviteCode     = c.invite_code || null;
        document.getElementById('modeBadge').textContent = conferenceMode === 'sfu' ? t('Group') : 'P2P';
        document.getElementById('roomId').textContent = `#${c.id}`;
        document.getElementById('conferenceName').textContent = c.name;
        await loadParticipants();
        return;
    }
    try {
        await rejoinAfterReload();
        const response = await fetch(`${API_BASE}/api/conferences/${conferenceId}`, {
            credentials: 'include'
        });

        if (response.status === 403) {
            const err = await response.json();
            showNotification(
                err.requiresPassword
                    ? t('Password required — opening the join page.')
                    : t('Access denied.'),
                'error'
            );
            redirecting = true;
            setTimeout(() => window.location.href = err.requiresPassword
                ? `conf_join.html?id=${encodeURIComponent(conferenceId)}` : 'conf.html', 1200);
            return;
        }

        if (!response.ok) throw new Error('Conference not found');

        const data = await response.json();

        isHost         = data.conference.isHost || false;
        hostId         = data.conference.host_id || null;
        conferenceMode = data.conference.mode || 'p2p';
        inviteCode     = data.conference.invite_code || null;
        waitingRoomOn  = !!data.conference.waiting_room;
        allowRecording = !!data.conference.allow_recording;
        document.getElementById('modeBadge').textContent = conferenceMode === 'sfu' ? t('Group') : 'P2P';
        document.getElementById('roomId').textContent = `#${data.conference.id}`;

        // Прямой заход по URL без участия — редирект
        if (!data.conference.isParticipant && !data.conference.isHost) {
            showNotification(t('Join this conference first.'), 'info');
            redirecting = true;
            setTimeout(() => window.location.href = `conf_join.html?id=${encodeURIComponent(conferenceId)}`, 800);
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

    document.getElementById(`video-${userId}`)?.classList.toggle('cam-off', !video);
    // getElementById, not a "#video-<id>" selector: guest ids contain a colon
    const tile = document.getElementById(`video-${userId}`);
    const micStatus = tile?.querySelector('.mic-status');
    const videoStatus = tile?.querySelector('.video-status');
    if (micStatus) micStatus.innerHTML = audio ? Icons.mic : Icons.micOff;
    if (videoStatus) videoStatus.innerHTML = video ? Icons.cam : Icons.camOff;
}

/**
 * Apply the stream chosen in the lobby to the room. No new permission prompt: the lobby already
 * holds the stream. Without any device the room still works for listening and chat (empty stream).
 * @param {{ audio: boolean, video: boolean }} options  wanted start state (mic / camera on)
 */
async function initLocalMedia({ audio = true, video = true } = {}) {
    if (!localStream) localStream = new MediaStream();

    // Sync state flags with the tracks that really exist
    isAudioEnabled = audio && localStream.getAudioTracks().length > 0;
    isVideoEnabled = video && localStream.getVideoTracks().length > 0;
    localStream.getAudioTracks().forEach(t => { t.enabled = isAudioEnabled; });
    localStream.getVideoTracks().forEach(t => { t.enabled = isVideoEnabled; });

    document.getElementById('localVideo').srcObject = localStream;
    updateMediaControlsUI();
    Speaking.watch('local', localStream, document.getElementById('localVideoContainer'));
    console.log('Local media initialized', { audio: isAudioEnabled, video: isVideoEnabled });
}

// ============================================================
// Lobby: check devices before joining
// ============================================================

/** Resolves when the person presses "Join now". Leaves the lobby stream in `localStream`. */
function runLobby() {
    const $ = (id) => document.getElementById(id);
    const saved = Devices.loadChoice();
    let micOn = !saved.micOff;
    let camOn = !saved.camOff;
    let stream = null;
    let meter = { stop() {}, resume() {} };
    let run = 0;   // a newer start() makes an older one drop its stream

    $('lobbyTitle').textContent = $('conferenceName').textContent || t('Ready to join?');
    $('lobbyBack').href = homeUrl();
    if (Devices.speakerSupported) $('lobbySpeakerField').hidden = false;

    const stopStream = () => { stream?.getTracks().forEach(t => t.stop()); stream = null; };
    const leavePage = () => { meter.stop(); stopStream(); };
    window.addEventListener('pagehide', leavePage);

    const reflect = () => {
        const hasMic = !!stream && stream.getAudioTracks().length > 0;
        const hasCam = !!stream && stream.getVideoTracks().length > 0;
        stream?.getAudioTracks().forEach(t => { t.enabled = micOn; });
        stream?.getVideoTracks().forEach(t => { t.enabled = camOn; });
        const micBtn = $('lobbyMicBtn'), camBtn = $('lobbyCamBtn');
        micBtn.classList.toggle('off', !micOn || !hasMic);
        camBtn.classList.toggle('off', !camOn || !hasCam);
        micBtn.innerHTML = micOn && hasMic ? Icons.mic : Icons.micOff;
        camBtn.innerHTML = camOn && hasCam ? Icons.cam : Icons.camOff;
        micBtn.disabled = !hasMic;
        camBtn.disabled = !hasCam;
        $('lobbyPreview').classList.toggle('cam-off', !camOn || !hasCam);
        $('lobbyNoCam').textContent = hasCam ? t('Camera is off') : t('No camera');
    };

    const fillLists = async () => {
        const list = await Devices.listDevices();
        const choice = Devices.loadChoice();
        Devices.fillSelect($('lobbyMic'), list.mics, Devices.trackDeviceId(stream, 'audio') || choice.micId);
        Devices.fillSelect($('lobbyCam'), list.cams, Devices.trackDeviceId(stream, 'video') || choice.camId);
        if (Devices.speakerSupported) Devices.fillSelect($('lobbySpeaker'), list.speakers, choice.speakerId);
    };

    const start = async ({ camId, micId }) => {
        const mine = ++run;
        meter.stop();
        stopStream();
        const { stream: s, error } = await Devices.getStream({ camId: camId || null, micId: micId || null });
        if (mine !== run) { s?.getTracks().forEach(t => t.stop()); return; }
        stream = s;
        $('lobbyError').textContent = Devices.errorText(error);
        $('lobbyVideo').srcObject = stream;
        meter = Devices.createLevelMeter(stream, $('lobbyMeter'));
        reflect();
        await fillLists();
        reflect();
    };

    // browsers start the level meter suspended until the page was clicked
    $('lobby').addEventListener('click', () => meter.resume());
    $('lobbyMicBtn').addEventListener('click', () => { micOn = !micOn; reflect(); });
    $('lobbyCamBtn').addEventListener('click', () => { camOn = !camOn; reflect(); });
    const restartWithSelection = () => start({ camId: $('lobbyCam').value, micId: $('lobbyMic').value });
    $('lobbyMic').addEventListener('change', restartWithSelection);
    $('lobbyCam').addEventListener('change', restartWithSelection);
    $('lobbySpeaker').addEventListener('change', () => Devices.saveChoice({ speakerId: $('lobbySpeaker').value }));
    // a headset plugged in while the lobby is open
    Devices.onChange(() => { if (document.body.classList.contains('in-lobby')) fillLists(); });

    return new Promise((resolve) => {
        $('lobbyJoin').addEventListener('click', () => {
            $('lobbyJoin').disabled = true;
            meter.stop();
            window.removeEventListener('pagehide', leavePage);
            Devices.saveChoice({
                camId: $('lobbyCam').value || null,
                micId: $('lobbyMic').value || null,
                speakerId: Devices.speakerSupported ? ($('lobbySpeaker').value || null) : null,
                micOff: !micOn,
                camOff: !camOn
            });
            lobbyChoice = { audio: micOn, video: camOn };
            localStream = stream || new MediaStream();
            stream = null;   // the room owns the tracks now
            $('lobbyVideo').srcObject = null;
            document.body.classList.remove('in-lobby');
            resolve();
        });

        // The first preview; the Join button is usable once the devices have been asked
        start({ camId: saved.camId, micId: saved.micId }).finally(() => { $('lobbyJoin').disabled = false; });
    });
}

// ============================================================
// Devices menu in the room (switch while the call is running)
// ============================================================

async function refreshDeviceMenu() {
    const $ = (id) => document.getElementById(id);
    const list = await Devices.listDevices();
    const choice = Devices.loadChoice();
    Devices.fillSelect($('devMic'), list.mics, Devices.trackDeviceId(localStream, 'audio') || choice.micId);
    Devices.fillSelect($('devCam'), list.cams, Devices.trackDeviceId(localStream, 'video') || choice.camId);
    if (Devices.speakerSupported) {
        $('devSpeakerLabel').hidden = false;
        $('devSpeaker').hidden = false;
        Devices.fillSelect($('devSpeaker'), list.speakers, choice.speakerId);
    }
    $('devSwitchCam').hidden = list.cams.length < 2;   // phones: front and back; never on a laptop with one camera
}

/** The sender of a peer connection that carries our camera / microphone (never the screen share). */
function mediaSender(pc, kind, userId) {
    const t = pc.getTransceivers().find(tr =>
        tr.currentDirection !== 'stopped' && tr.receiver?.track?.kind === kind && tr.sender !== screenSenders[userId]);
    return t ? t.sender : null;
}

/** Switch the microphone or camera to another device without renegotiation. */
async function switchDevice(kind, deviceId) {
    if (!deviceId || !localStream) return;
    let track;
    try {
        track = await Devices.getTrack(kind, deviceId);
    } catch (err) {
        showNotification(Devices.errorText(err) || t('Could not switch the device.'), 'error');
        refreshDeviceMenu();
        return;
    }

    const old = (kind === 'audio' ? localStream.getAudioTracks() : localStream.getVideoTracks())[0];
    const wasEnabled = kind === 'audio' ? isAudioEnabled : isVideoEnabled;
    track.enabled = old ? wasEnabled : true;
    if (old) { localStream.removeTrack(old); old.stop(); }
    localStream.addTrack(track);

    if (conferenceMode === 'sfu') {
        const key = kind === 'audio' ? 'audio' : 'video';
        try {
            if (sfuProducers[key]) await sfuProducers[key].replaceTrack({ track });
            else if (sfuSendTransport) sfuProducers[key] = await sfuSendTransport.produce({ track });
        } catch (err) { console.warn('[Devices] SFU replaceTrack failed:', err); }
    } else {
        for (const [userId, pc] of Object.entries(peers)) {
            try { await mediaSender(pc, kind, userId)?.replaceTrack(track); }
            catch (err) { console.warn('[Devices] replaceTrack failed for', userId, err); }
        }
    }

    document.getElementById('localVideo').srcObject = localStream;
    // first device of its kind: it starts switched on
    if (!old) { if (kind === 'audio') setMicEnabled(true); else setCameraEnabled(true); }
    updateMediaControlsUI();
    Devices.saveChoice(kind === 'audio' ? { micId: deviceId } : { camId: deviceId });
}

let speakerWarned = false;
async function applySpeaker(id) {
    if (!Devices.speakerSupported || !id) return;
    const videos = document.querySelectorAll('#videoGrid video, #filmstrip video');
    let failed = false;
    for (const v of videos) {
        if (v.id === 'localVideo') continue;
        if (!(await Devices.setSpeaker(v, id))) failed = true;
    }
    if (failed && !speakerWarned) {
        speakerWarned = true;
        showNotification(t('Could not switch the speakers. The system default is used.'), 'error');
    }
}

function setupDevicesMenu() {
    const $ = (id) => document.getElementById(id);
    // One tap from the front to the back camera (and round again)
    $('devSwitchCam').addEventListener('click', async (e) => {
        e.stopPropagation();
        const list = await Devices.listDevices();
        if (list.cams.length < 2) return;
        const current = Devices.trackDeviceId(localStream, 'video');
        const i = list.cams.findIndex(c => c.id === current);
        const next = list.cams[(i + 1) % list.cams.length];
        await switchDevice('video', next.id);
        refreshDeviceMenu();
    });
    // clicks inside the block must not close the menu
    $('devBlock').addEventListener('click', (e) => e.stopPropagation());
    $('devMic').addEventListener('change', () => switchDevice('audio', $('devMic').value));
    $('devCam').addEventListener('change', () => switchDevice('video', $('devCam').value));
    $('devSpeaker').addEventListener('change', () => {
        Devices.saveChoice({ speakerId: $('devSpeaker').value });
        applySpeaker($('devSpeaker').value);
    });
    Devices.onChange(refreshDeviceMenu);
    refreshDeviceMenu().then(() => applySpeaker(Devices.loadChoice().speakerId));
}

function updateMediaControlsUI() {
    const micBtn = document.getElementById('toggleMic');
    const videoBtn = document.getElementById('toggleVideo');
    const micStatus = document.getElementById('localMicStatus');
    const videoStatus = document.getElementById('localVideoStatus');

    micBtn?.classList.toggle('muted', !isAudioEnabled);
    videoBtn?.classList.toggle('off', !isVideoEnabled);
    document.getElementById('localVideoContainer')?.classList.toggle('cam-off', !isVideoEnabled);
    if (micStatus) micStatus.innerHTML = isAudioEnabled ? Icons.mic : Icons.micOff;
    if (videoStatus) videoStatus.innerHTML = isVideoEnabled ? Icons.cam : Icons.camOff;
}

/**
 * Initialize Socket.IO connection and configure signaling events.
 * - fetch token from API for authenticated signaling
 * - join conference after connect
 * - handle participants, offers/answers, ICE candidates, and messages
 */
function sendJoin() {
    socket.emit('join-conference', {
        conferenceId,
        userId: currentUser.id,
        userName: currentUser.username || currentUser.email
    });
}

async function initSocket() {
    let token = null;
    if (guestSession) {
        token = guestSession.token;
    } else {
        const tokenRes = await fetch(`${API_BASE}/api/auth/token`, {
            credentials: 'include'
        });
        const tokenData = await tokenRes.json();
        token = tokenData.token || null;
    }

    // The token is asked for again on every (re)connect: a user token can run out during a long call
    socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        auth: async (cb) => {
            if (guestSession) return cb({ token: guestSession.token });
            try {
                const r = await fetch(`${API_BASE}/api/auth/token`, { credentials: 'include' });
                const d = await r.json();
                if (d.token) token = d.token;
            } catch { /* keep the last one */ }
            cb({ token });
        }
    });
    startNetworkWatch();

    socket.on('connect', () => {
        console.log('Connected to signaling server');
        resilience.serverDown = false;
        updateNetBanner();
        joinedConference = true;
        sendJoin();
    });

    // Existing participants. The first answer starts the call; after a reconnect the same answer
    // is a resync (see applyRoomParticipants). Answers are applied one at a time, newest last.
    socket.on('room-participants', async (payload) => {
        if (leaving) return;
        if (resyncing) { resyncQueued = payload; return; }
        resyncing = true;
        try {
            let next = payload;
            while (next && !leaving) {
                resyncQueued = null;
                await applyRoomParticipants(next);
                next = resyncQueued;
            }
        } catch (e) {
            console.error('room-participants failed:', e);
        } finally {
            resyncing = false;
        }
    });
    // New user joined — existing user is NOT initiator, waits for offer
    socket.on('user-connected', ({ userId, userName }) => {
        delete recreateTries[userId];
        // The newcomer sends the offer; the peer connection is created once, when it arrives.
        // (Creating it here too made the offer handler close it and open a second one with a new TURN relay.)
        console.log('User connected:', userId, userName);
        roomMembers.add(String(userId));
        updateParticipantCount();
        loadParticipants();
        // We made an offer while this person's connection was down (the server kept their place), so it
        // never arrived. They are back: send it again. Their own offer loses the collision as usual.
        const pc = peers[userId];
        if (pc && pc._isInitiator && pc.signalingState === 'have-local-offer' && !pc.remoteDescription && pc.localDescription) {
            socket.emit('offer', { to: userId, offer: pc.localDescription });
        }   // guests are not in the database: the list comes from the live room
    });

    // Peer left the conference, clean up local RTCPeerConnection and UI
    socket.on('user-disconnected', ({ userId }) => {
        console.log('User disconnected:', userId);
        recreateTries[userId] = 99;   // they left: a failed connection must not be re-created
        if (recordingUsers.delete(String(userId))) renderRecording();
        if (peers[userId]) {
            clearPeerTimers(peers[userId]);
            peers[userId].close();
            delete peers[userId];
        }
        delete camStreams[userId];
        delete screenSenders[userId];
        roomScreenShareState.delete(userId);
        roomMembers.delete(String(userId));
        // the server forgets the hand of someone who left and sends no user-hand for it
        if (raisedHands.delete(String(userId))) refreshHands();
        const videoContainer = document.getElementById(`video-${userId}`);
        if (videoContainer) videoContainer.remove();
        pinnedTiles.delete(String(userId));
        removeScreenTile(userId);
        applyPinLayout();
        updateParticipantCount();
        loadParticipants();
    });

    socket.on('user-screen-share-start', ({ userId, userName }) => {
        roomScreenShareState.add(userId);
        showNotification(t('{name} started screen sharing', { name: userName }), 'info');

        const container = document.getElementById(`video-${userId}`);
        if (container) container.classList.add('screen-sharing');
    });

    socket.on('user-screen-share-stop', ({ userId }) => {
        roomScreenShareState.delete(userId);

        const container = document.getElementById(`video-${userId}`);
        if (container) container.classList.remove('screen-sharing');
        removeScreenTile(userId);
    });

    socket.on('offer', ({ userId, offer, userName }) => enqueueSignal(userId, async () => {
        console.log('Received offer from:', userId);
        const existing = peers[userId];
        let isRenegotiation = existing && (existing.remoteDescription || existing.signalingState === 'have-local-offer');
        if (isRenegotiation && existing.remoteDescription) {
            // An offer with another DTLS fingerprint comes from a connection the other side has rebuilt
            // (after a long outage): it is a new connection, not a renegotiation of this one.
            const before = sdpFingerprint(existing.remoteDescription.sdp);
            const now = sdpFingerprint(offer?.sdp);
            if (before && now && before !== now) isRenegotiation = false;
        }
        if (isRenegotiation) {
            // A screen track was added or removed. On a collision the peer with the higher id is
            // polite: it drops its own offer and answers, the other one ignores the offer.
            const collision = existing._makingOffer || existing.signalingState !== 'stable';
            if (collision && idPrecedes(currentUser.id, userId)) return;
        } else {
            await createPeerConnection(userId, false, userName);
        }
        await peers[userId].setRemoteDescription(new RTCSessionDescription(offer));
        await flushPendingCandidates(userId);
        const answer = await peers[userId].createAnswer();
        await peers[userId].setLocalDescription(answer);
        socket.emit('answer', { to: userId, answer });

        // A newcomer's offer only matches our camera and mic, so a screen we are already sharing
        // goes out in a second round
        if (!isRenegotiation && isScreenSharing && screenStream) {
            screenSenders[userId] = peers[userId].addTrack(screenStream.getVideoTracks()[0], screenStream);
            await renegotiateNow(userId);
        }
    }));

    socket.on('answer', ({ userId, answer }) => enqueueSignal(userId, async () => {
        console.log('Received answer from:', userId);
        const pc = peers[userId];
        if (pc && pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            await flushPendingCandidates(userId);
        }
    }));

    socket.on('ice-candidate', async ({ userId, candidate }) => {
        if (!candidate) return;
        const pc = peers[userId];
        if (pc && pc.remoteDescription) {
            try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
            catch (e) { console.warn('addIceCandidate failed:', e); }
        } else {
            (pendingCandidates[userId] = pendingCandidates[userId] || []).push(candidate);
        }
    });

    socket.on('chat-message', ({ userId, userName, message, timestamp }) => {
        const isOwn = userId === currentUser.id;
        chat.addMessage({ message, userName, timestamp }, isOwn);
        if (!document.getElementById('chatSidebar').classList.contains('open')) {
            updateChatBadge(chat.getUnreadCount());
        }
    });

    // Raised hands and reactions (nothing is stored; the server just relays them to the room)
    socket.on('user-hand', ({ userId, raised }) => {
        const key = String(userId);
        const had = raisedHands.has(key);
        if (raised) raisedHands.add(key); else raisedHands.delete(key);
        if (raised && !had && !isMe(userId)) {
            const name = document.getElementById(`video-${userId}`)?.querySelector('.participant-name')?.textContent || 'Someone';
            showNotification(t('{name} raised a hand', { name }), 'info', 3000);
        }
        refreshHands();
    });
    socket.on('user-reaction', ({ userId, reaction }) => showReaction(userId, reaction));

    // Keep remote media mute/camera status in sync across participants
    socket.on('user-media-state', ({ userId, audio, video }) => {
        updateRemoteMediaState(userId, audio, video);
    });

    // Handle signaling socket disconnect (network, server down etc.)
    socket.on('disconnect', (reason) => {
        console.log('Disconnected from signaling server:', reason);
        // Media between browsers keeps flowing; Socket.IO reconnects and the room answer resyncs us
        if (leaving || reason === 'io client disconnect') return;
        resilience.serverDown = true;
        updateNetBanner();
    });

    socket.on('connect_error', (err) => {
        console.warn('Signaling connect error:', err?.message);
        if (leaving) return;
        resilience.serverDown = true;
        updateNetBanner();
    });

    socket.on('error', (err) => {
        console.error('Socket error:', err);
    });

    // Forced media change by host/co-host
    socket.on('force-muted', ({ audio, video, screen }) => {
        if (audio === false) setMicEnabled(false);
        if (video === false) setCameraEnabled(false);
        if (screen === false && isScreenSharing) stopScreenShare();
        showNotification(t('Your media was muted by the host'), 'warning');
    });

    // Chat ban/unban by host/co-host
    socket.on('chat-banned', ({ banned }) => {
        chat.setEnabled(!banned);
        showNotification(
            banned ? t('You have been banned from chat') : t('Your chat access has been restored'),
            banned ? 'warning' : 'info'
        );
    });

    // Kicked from conference
    socket.on('force-disconnect', ({ message }) => {
        cleanupAndRedirect(message ? t(message) : t('You have been removed from the conference.'));
    });

    // Rejected on re-join after kick, or P2P room full
    socket.on('join-rejected', ({ reason } = {}) => {
        const msg = reason === 'full'
            ? t('This room is full.')
            : reason === 'locked'
            ? t('This room is locked. Ask the host to unlock it.')
            : reason === 'denied'
            ? t('The host did not let you in.')
            : reason === 'forbidden'
                ? t('Join this conference first (password or invite required).')
                : t('You have been kicked from this conference.');
        cleanupAndRedirect(msg);
    });

    // Waiting room: the server holds us outside until a moderator admits us
    socket.on('join-pending', ({ moderatorPresent } = {}) => showWaitRoom(moderatorPresent !== false));
    socket.on('join-admitted', () => { hideWaitRoom(); sendJoin(); });
    socket.on('waiting-list', ({ waiting } = {}) => setWaiting(waiting));
    socket.on('waiting-update', ({ waiting } = {}) => setWaiting(waiting, true));
    socket.on('room-lock', ({ locked } = {}) => setLocked(locked));
    socket.on('room-settings', ({ waitingRoom, allowRecording: rec } = {}) => {
        if (waitingRoom !== undefined) {
            waitingRoomOn = !!waitingRoom;
            if (!waitingRoomOn) setWaiting([]);
            updateModControls();
        }
        if (rec !== undefined) { allowRecording = !!rec; renderRecording(); }
    });
    socket.on('user-recording', ({ userId, userName, recording } = {}) => onUserRecording(userId, userName, recording));
    socket.on('recording-stop-forced', () => {
        if (!Recorder.isRecording()) return;
        Recorder.stop('forced');
        showNotification(t('Your recording was stopped by the host.'), 'warning');
    });

    // Another participant was kicked — update UI
    socket.on('user-kicked', ({ userId: kickedUserId, kickerName }) => {
        const el = document.getElementById(`video-${kickedUserId}`);
        if (el) el.remove();
        removeScreenTile(kickedUserId);
        pinnedTiles.delete(String(kickedUserId));
        roomMembers.delete(String(kickedUserId));
        if (recordingUsers.delete(String(kickedUserId))) renderRecording();
        if (raisedHands.delete(String(kickedUserId))) refreshHands();
        applyPinLayout();
        updateParticipantCount();
        showNotification(t('A participant was removed by {name}', { name: kickerName }), 'info');
        loadParticipants();
    });

    // Co-host role update
    socket.on('user-role-change', ({ userId: changedId, isCoHost }) => {
        if (isCoHost) coHosts.add(changedId);
        else coHosts.delete(changedId);
        if (String(changedId) === String(currentUser?.id)) { if (!isModerator()) setWaiting([]); updateModControls(); renderRecording(); }
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
 * The room's answer to our join. The first one starts the call. After a reconnect (network blip,
 * backend restart) it is a resync: connections that are still healthy are kept, only missing ones are
 * created, and the Group session is rebuilt only when it is really dead.
 */
async function applyRoomParticipants({ participants, roomState, iceServers, resumed }) {
    if (iceServers && iceServers.length > 0) rtcConfig = { iceServers };
    console.log('room-participants received:', JSON.stringify(participants), 'roomState:', roomState);

    hideWaitRoom();
    if (roomState) {
        waitingRoomOn = !!roomState.waitingRoom;
        allowRecording = !!roomState.allowRecording;
        setLocked(roomState.locked);
        setRecordingFromState(roomState.recording);
    }
    if (roomState?.coHosts) coHosts = new Set(roomState.coHosts);
    if (roomState?.chatBanned) chatBanned = new Set(roomState.chatBanned);
    if (roomState?.raisedHands) {
        raisedHands.clear();
        roomState.raisedHands.forEach(id => raisedHands.add(String(id)));
        refreshHands();
    }

    roomMembers.clear();
    participants.forEach(p => { if (!isMe(p.userId)) roomMembers.add(String(p.userId)); });

    // A re-join after the others were told we left (an outage longer than the server's grace period):
    // they closed their side, so a connection that is not working right now is dead, not recovering.
    const droppedByOthers = mediaReady && resumed === false;

    KeepAwake.start();   // the call has started: the screen stays on (asked again after a hidden tab)

    // Only the first time: after a reconnect the person's current mute state stays
    if (!mediaReady) {
        let joinAudio = lobbyChoice.audio;
        const joinVideo = lobbyChoice.video;
        if (participants.length > 5 && joinAudio) {
            joinAudio = false;
            showNotification(t('Large room detected — microphone muted on join'), 'info');
        }
        await initLocalMedia({ audio: joinAudio, video: joinVideo });
        mediaReady = true;
    }
    // Tell the others the real state (the server forgot it if we were dropped, and assumes "on" for a newcomer)
    socket.emit('media-state-change', { conferenceId, audio: isAudioEnabled, video: isVideoEnabled });
    // same for the screen: the server may hold the flag of an older window, or have lost ours
    socket.emit(isScreenSharing ? 'screen-share-start' : 'screen-share-stop', { conferenceId });

    if (conferenceMode === 'sfu') {
        if (!sfuRebuilding) {
            if (!sfuSendTransport) {
                try { await initSfu(); }
                catch (e) { console.error('[SFU] first start failed:', e); cleanupSfu(); rebuildSfu(); }
            } else if (!sfuHealthy()) {
                rebuildSfu();
            }
        }
    } else {
        for (const p of participants) {
            if (p.userId === currentUser.id) continue;
            const pc = peers[p.userId];
            const alive = pc && pc.signalingState !== 'closed' && pc.connectionState !== 'failed' && pc.connectionState !== 'closed'
                && !(droppedByOthers && pc.connectionState !== 'connected');
            if (!alive) {
                await createPeerConnection(p.userId, true, p.userName);
            } else if (pc._isInitiator && pc.signalingState === 'have-local-offer' && pc.localDescription) {
                // our offer may have been lost while we were away: send it again
                socket.emit('offer', { to: p.userId, offer: pc.localDescription });
            }
            if (p.mediaState) {
                updateRemoteMediaState(p.userId, p.mediaState.audio, p.mediaState.video);
            }
        }
        // restarts that could not be sent while the signaling connection was down
        for (const id of Object.keys(peers)) {
            if (peers[id]._restartPending) restartPeerIce(id);
        }
    }
    loadParticipants();
    startQualityMonitor();
}

/**
 * Create a new RTCPeerConnection for a remote participant.
 * @param {string} userId Peer user ID
 * @param {boolean} isInitiator True when this client starts the offer
 * @param {string} userName Display name for UI
 */
async function createPeerConnection(userId, isInitiator, userName = 'Unknown') {
    if (peers[userId]) {
        clearPeerTimers(peers[userId]);
        peers[userId].close();
    }
    delete camStreams[userId];
    delete screenSenders[userId];

    const peerConnection = new RTCPeerConnection(rtcConfig);
    peers[userId] = peerConnection;
    peerConnection._isInitiator = isInitiator;   // only this side sends an ICE-restart offer
    peerConnection._userName = userName;
    peerConnection._restarts = 0;
    // Object.keys(peers) turns ids into strings, the server looks sockets up by the original id type
    peerConnection._userId = userId;

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });
    // No camera or microphone: keep an empty send slot, so the other side still gets a tile
    // and a device chosen later can be put in with replaceTrack (no renegotiation)
    for (const kind of ['audio', 'video']) {
        if (!localStream.getTracks().some(t => t.kind === kind)) {
            peerConnection.addTransceiver(kind, { direction: 'sendrecv', streams: [localStream] });
        }
    }
    // We join while presenting (we send the offer): the screen goes out next to the camera
    if (isInitiator && isScreenSharing && screenStream) {
        screenSenders[userId] = peerConnection.addTrack(screenStream.getVideoTracks()[0], screenStream);
    }

    // When remote user publishes tracks, attach to a video tile (camera) or a screen tile (second stream)
    peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (!remoteStream) return;
        if (!camStreams[userId]) camStreams[userId] = remoteStream;
        if (remoteStream.id === camStreams[userId].id) {
            addRemoteVideo(userId, remoteStream, userName);
        } else if (event.track.kind === 'video') {
            addScreenTile(userId, remoteStream, userName);
        }
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

    peerConnection.oniceconnectionstatechange = () => {
        console.log(`ICE state with ${userId}:`, peerConnection.iceConnectionState);
    };

    peerConnection.onicecandidateerror = (e) => {
        console.warn(`ICE candidate error with ${userId}:`, e.errorCode, e.errorText, e.url);
    };

    peerConnection.onconnectionstatechange = () => {
        console.log(`Connection state with ${userId}:`, peerConnection.connectionState);
        onPeerState(userId, peerConnection, peerConnection.connectionState);
    };

    if (isInitiator) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', { to: userId, offer });
        // An offer that is never answered (the person left without us being told) leaves the connection
        // in "new" for ever: give up after a while, removePeer() tries again a couple of times.
        peerConnection._setupTimer = setTimeout(() => {
            peerConnection._setupTimer = null;
            if (!leaving && peers[userId] === peerConnection && peerConnection.connectionState !== 'connected') {
                removePeer(userId, peerConnection);
            }
        }, PEER_SETUP_MS);
    }

    return peerConnection;
}

// ============================================================
// Peer connection states: a blip heals, a dead connection is restarted, then removed and re-created
// ============================================================
const PEER_GRACE_MS = 8000;      // 'disconnected' often heals by itself
const PEER_SETUP_MS = 20000;     // our first offer: no working connection after this long, remove the peer
const PEER_RESTART_MS = 12000;   // after an ICE restart: give it this long, then remove the peer

const sdpFingerprint = (sdp) => (/a=fingerprint:\S+ (\S+)/.exec(sdp || '') || [])[1] || null;

function later(fn, ms) {
    const t = setTimeout(() => { resilienceTimers.delete(t); fn(); }, ms);
    resilienceTimers.add(t);
    return t;
}

function clearPeerTimers(pc) {
    if (!pc) return;
    clearTimeout(pc._graceTimer);
    clearTimeout(pc._restartTimer);
    clearTimeout(pc._setupTimer);
    pc._graceTimer = pc._restartTimer = pc._setupTimer = null;
}

function setTileReconnecting(userId, on) {
    document.getElementById(`video-${userId}`)?.classList.toggle('reconnecting', on);
}

/** Called for every connectionState change of a peer (and by tests with a made-up state). */
function onPeerState(userId, pc, state) {
    if (leaving || peers[userId] !== pc) return;

    if (state === 'connected') {
        clearPeerTimers(pc);
        pc._restarts = 0;
        pc._restartPending = false;
        delete recreateTries[userId];
        setTileReconnecting(userId, false);
        return;
    }
    if (state === 'disconnected') {
        // keep the tile, show "Reconnecting…", wait: it often comes back
        setTileReconnecting(userId, true);
        if (!pc._graceTimer && !pc._restartTimer) {
            pc._graceTimer = setTimeout(() => {
                pc._graceTimer = null;
                if (peers[userId] === pc && pc.connectionState !== 'connected') recoverPeer(userId, pc);
            }, PEER_GRACE_MS);
        }
        return;
    }
    if (state === 'failed') {
        clearTimeout(pc._graceTimer);
        pc._graceTimer = null;
        recoverPeer(userId, pc);
    }
}

/** First trouble: ICE restart. Second trouble: remove the peer (and try a fresh connection later). */
function recoverPeer(userId, pc) {
    if (pc._restarts >= 1) { removePeer(userId, pc); return; }
    pc._restarts++;
    setTileReconnecting(userId, true);
    restartPeerIce(userId);
    clearTimeout(pc._restartTimer);
    pc._restartTimer = setTimeout(() => {
        pc._restartTimer = null;
        if (peers[userId] === pc && pc.connectionState !== 'connected') removePeer(userId, pc);
    }, PEER_RESTART_MS);
}

/** Only the side that made the first offer sends the restart offer; the other answers it. */
function restartPeerIce(userId) {
    const pc = peers[userId];
    if (!pc || !pc._isInitiator) return;
    if (!socket?.connected) { pc._restartPending = true; return; }   // offers cannot get through now
    pc._restartPending = false;
    try { pc.restartIce(); } catch (e) { console.warn('restartIce failed:', e); }
    renegotiate(userId);
}

function removePeer(userId, pc) {
    clearPeerTimers(pc);
    if (peers[userId] === pc) delete peers[userId];
    try { pc.close(); } catch { /* already closed */ }
    delete camStreams[userId];
    delete screenSenders[userId];
    document.getElementById(`video-${userId}`)?.remove();
    pinnedTiles.delete(String(userId));
    removeScreenTile(userId);
    applyPinLayout();
    updateParticipantCount();
    scheduleRecreate(userId, pc._userName);
}

/** The person is still in the room (nobody told us they left): try a fresh connection, a couple of times. */
function scheduleRecreate(userId, userName) {
    if (leaving || (recreateTries[userId] || 0) >= 2) return;
    recreateTries[userId] = (recreateTries[userId] || 0) + 1;
    // both sides lost each other: the lower id goes first, the other waits (no offer collision)
    const delay = idPrecedes(currentUser.id, userId) ? 1500 : 4500;
    later(async () => {
        if (leaving || peers[userId] || !socket?.connected || (recreateTries[userId] || 0) >= 99) return;
        try { await createPeerConnection(userId, true, userName); }
        catch (e) { console.warn('re-create failed:', e); }
    }, delay);
}

// Signaling for one peer runs one step at a time: an answer must be applied before the next offer
const signalQueues = {};
function enqueueSignal(userId, fn) {
    const run = (signalQueues[userId] || Promise.resolve()).then(fn).catch(e => console.warn('signaling failed:', e));
    signalQueues[userId] = run;
    return run;
}

// New offer on a live connection after a local track was added or removed
function renegotiate(userId) {
    return enqueueSignal(userId, () => renegotiateNow(userId));
}

async function renegotiateNow(userId) {
    const pc = peers[userId];
    if (!pc) return;
    try {
        pc._makingOffer = true;
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);
        socket.emit('offer', { to: pc._userId, offer: pc.localDescription });
    } catch (e) {
        console.warn('renegotiate failed:', e);
    } finally {
        pc._makingOffer = false;
    }
}

// One tile per shared screen, next to the sharer's camera tile. A remote screen is spotlighted for us.
function addScreenTile(userId, stream, userName = 'Unknown', { local = false } = {}) {
    const key = `screen-${userId}`;
    document.getElementById(key)?.remove();

    const tile = document.createElement('div');
    tile.id = key;
    tile.className = 'video-container screen-tile';
    tile.dataset.userId = key;

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.srcObject = stream;

    const overlay = document.createElement('div');
    overlay.className = 'video-overlay';
    const left = document.createElement('div');
    left.className = 'overlay-left';
    const nameEl = document.createElement('span');
    nameEl.className = 'participant-name';
    nameEl.textContent = local ? t('Your screen') : t('{name} · screen', { name: userName });
    left.appendChild(nameEl);
    const right = document.createElement('div');
    right.className = 'overlay-right';
    const pinBtn = document.createElement('button');
    pinBtn.className = 'pin-btn';
    pinBtn.title = t('Pin (spotlight)');
    pinBtn.innerHTML = Icons.pin;
    pinBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePin(key); });
    right.appendChild(pinBtn);
    overlay.appendChild(left);
    overlay.appendChild(right);

    tile.appendChild(video);
    tile.appendChild(overlay);
    document.getElementById(pinnedTiles.size > 0 ? 'filmstrip' : 'videoGrid').appendChild(tile);

    if (!local) pinnedTiles.add(key);
    applyPinLayout();
    updateParticipantCount();
}

function removeScreenTile(userId) {
    const key = `screen-${userId}`;
    const tile = document.getElementById(key);
    if (!tile) return;
    tile.remove();
    pinnedTiles.delete(key);
    applyPinLayout();
    updateParticipantCount();
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
    video.playsInline = true;
    video.srcObject = stream;
    Devices.setSpeaker(video, Devices.loadChoice().speakerId);

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
    const handEl = document.createElement('span');
    handEl.className = 'hand-badge';
    handEl.hidden = true;
    handEl.setAttribute('aria-label', t('Hand raised'));
    handEl.innerHTML = Icons.handSmall;
    overlayLeft.appendChild(handEl);

    const overlayRight = document.createElement('div');
    overlayRight.className = 'overlay-right';
    const micPill = document.createElement('div');
    micPill.className = 'status-pill mic-status';
    micPill.innerHTML = Icons.mic;
    const videoPill = document.createElement('div');
    videoPill.className = 'status-pill video-status';
    videoPill.innerHTML = Icons.cam;
    const pinBtn = document.createElement('button');
    pinBtn.className = 'pin-btn';
    pinBtn.title = t('Pin (spotlight)');
    pinBtn.innerHTML = Icons.pin;
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
        micPill.innerHTML = audio ? Icons.mic : Icons.micOff;
        videoPill.innerHTML = videoEnabled ? Icons.cam : Icons.camOff;
        videoContainer.classList.toggle('cam-off', !videoEnabled);
    }

    if (pinnedTiles.has(String(userId))) applyPinLayout();
    updateParticipantCount();
    refreshHands();
    Speaking.watch(String(userId), stream, videoContainer);
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
        if (toggleBtn) toggleBtn.textContent = t('Hide');
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
            btn.title = isPinned ? t('Unpin') : t('Pin (spotlight)');
            btn.innerHTML = isPinned ? Icons.pinOn : Icons.pin;
        }
    });
}

function updateFilmstripLabel() {
    const count = document.querySelectorAll('#filmstrip .video-container').length;
    const label = document.getElementById('filmstripLabel');
    if (label) label.textContent = tn(count, '{n} other', '{n} others');
}

function toggleStrip() {
    const section = document.getElementById('filmstripSection');
    const btn = document.getElementById('filmstripToggleBtn');
    const collapsed = section.classList.toggle('strip-collapsed');
    btn.textContent = collapsed ? t('Show') : t('Hide');
}

// Invite link points at the join page; it never carries the room password.
async function copyInviteLink() {
    const link = buildInviteLink({ id: conferenceId, invite_code: inviteCode });
    try {
        await navigator.clipboard.writeText(link);
        showNotification(t('Invite link copied'), 'success');
    } catch {
        window.prompt('Copy the invite link:', link);
    }
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
    document.getElementById('inviteBtn').addEventListener('click', copyInviteLink);

    document.getElementById('localPinBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        togglePin('local');
    });

    setupDevicesMenu();
    setupReactions();
    setupWaitingRoom();
    setupRecording();
    setupPip();
    setupShortcuts();

    const videoMenuBtn = document.getElementById('videoMenuBtn');
    const videoMenu    = document.getElementById('videoMenu');

    videoMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeReactMenu();
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
    if (status) status.innerHTML = isAudioEnabled ? Icons.mic : Icons.micOff;

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
    document.getElementById('localVideoContainer')?.classList.toggle('cam-off', !isVideoEnabled);
    if (status) status.innerHTML = isVideoEnabled ? Icons.cam : Icons.camOff;

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
            screenTrack.contentHint = 'detail';
            isScreenSharing = true;
            // Announce first so receivers know the next offer / producer is a screen
            socket?.emit('screen-share-start', { conferenceId });

            if (conferenceMode === 'sfu') {
                // SFU: the screen is a second video producer, the camera keeps running
                sfuProducers.screen = await sfuSendTransport.produce({
                    track: screenTrack,
                    appData: { share: true }
                });
            } else {
                // P2P: add the screen as an extra track on every connection and renegotiate
                for (const userId of Object.keys(peers)) {
                    screenSenders[userId] = peers[userId].addTrack(screenTrack, screenStream);
                    await renegotiate(userId);
                }
            }

            addScreenTile('local', screenStream, 'You', { local: true });
            screenTrack.onended = () => stopScreenShare();
            btn.classList.add('sharing');
            btn.innerHTML = Icons.screenStop;

        } catch (error) {
            console.error('Screen share error:', error);
            if (isScreenSharing) await stopScreenShare();
            else showNotification(t('Failed to share screen'), 'error');
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
        if (sfuProducers.screen) {
            sfuSocket?.emit('sfu:close-producer', { producerId: sfuProducers.screen.id });
            sfuProducers.screen.close();
            delete sfuProducers.screen;
        }
    } else {
        for (const [userId, sender] of Object.entries(screenSenders)) {
            try { peers[userId]?.removeTrack(sender); } catch (_) {}
            delete screenSenders[userId];
            await renegotiate(userId);
        }
    }

    removeScreenTile('local');
    isScreenSharing = false;
    document.getElementById('toggleScreen').classList.remove('sharing');
    document.getElementById('toggleScreen').innerHTML = Icons.screen;
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
    refreshHands();
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
        const response = guestSession
            ? await fetch(`${API_BASE}/api/guest/participants`, { headers: guestHeaders() })
            : await fetch(`${API_BASE}/api/conferences/${conferenceId}/participants`, { credentials: 'include' });

        if (!response.ok) throw new Error('Failed to load participants');

        const data = await response.json();
        lastParticipants = data.participants || [];
        renderParticipants(lastParticipants);
        updateParticipantCount();

    } catch (error) {
        console.error('Load participants error:', error);
    }
}

// ---- Local recording ---------------------------------------------------------
// The file is made and saved in this browser (conf_recorder.js). The server only keeps the "REC" mark so that
// everybody in the room can see who records.

const mayRecord = () => !guestSession && Recorder.supported() && (isModerator() || allowRecording);

function recorderSources() {
    const videos = [];
    const seen = new Set();
    document.querySelectorAll('#videoGrid .video-container, #filmstrip .video-container').forEach(tile => {
        const el = tile.querySelector('video');
        if (!el || seen.has(tile)) return;
        seen.add(tile);
        const own = tile.id === 'localVideoContainer';
        videos.push({
            el,
            name: own ? (currentUser?.username || 'You') : (tile.querySelector('.participant-name')?.textContent || 'Participant'),
            screen: tile.classList.contains('screen-tile'),
            camOff: tile.classList.contains('cam-off')
        });
    });
    return { videos, audioStreams: [localStream, ...Object.values(remoteStreams)].filter(Boolean) };
}

const clock = (ms) => {
    const s = Math.floor(ms / 1000), p = (n) => String(n).padStart(2, '0');
    return `${p(Math.floor(s / 60))}:${p(s % 60)}`;
};

function renderRecording(refreshList = true) {
    const chip = document.getElementById('recChip');
    const names = Array.from(recordingUsers.values());
    chip.hidden = names.length === 0;
    document.getElementById('recChipText').textContent =
        names.length === 1 ? t('REC · {name}', { name: names[0] }) : tn(names.length, 'REC · {n} person', 'REC · {n} people');
    chip.title = names.length ? t('Recording on their own device: {names}', { names: names.join(', ') }) : '';
    const btn = document.getElementById('recBtn');
    btn.hidden = !(mayRecord() || Recorder.isRecording());
    document.getElementById('recBtnText').textContent =
        Recorder.isRecording() ? t('Stop recording ({time})', { time: clock(Recorder.elapsed()) }) : t('Record on this device');
    if (refreshList && lastParticipants.length) renderParticipants(lastParticipants);
}

function onUserRecording(userId, userName, recording) {
    const id = String(userId);
    const mine = id === String(currentUser?.id);
    if (recording) {
        recordingUsers.set(id, userName);
        if (!mine) showNotification(t('{name} started recording on their device', { name: userName }), 'warning');
    } else if (recordingUsers.delete(id) && !mine) {
        showNotification(t('{name} stopped recording', { name: userName }), 'info');
    }
    if (mine && recStartCheck) { clearTimeout(recStartCheck); recStartCheck = null; }
    renderRecording();
}

// After a (re)join the server's list is the truth. Our own recording, if any, is put right: a reload lost it
// (mark removed), a restarted backend forgot it (mark sent again).
function setRecordingFromState(list) {
    recordingUsers.clear();
    for (const r of Array.isArray(list) ? list : []) recordingUsers.set(String(r.userId), r.userName);
    const me = String(currentUser?.id);
    if (recordingUsers.has(me) && !Recorder.isRecording()) socket?.emit('recording-stop');
    else if (!recordingUsers.has(me) && Recorder.isRecording()) socket?.emit('recording-start');
    renderRecording();
}

function onRecorderStop(reason, saved) {
    clearInterval(recTimer); recTimer = null;
    if (recStartCheck) { clearTimeout(recStartCheck); recStartCheck = null; }
    socket?.emit('recording-stop');
    renderRecording();
    if (reason === 'refused') return;
    showNotification(saved ? t('Recording saved on your device.') : t('The recording could not be saved completely.'), saved ? 'info' : 'error');
}

async function startRecording() {
    if (!mayRecord() || Recorder.isRecording()) return;
    const ok = await showConfirm(t('Everyone in the room will see that you are recording. The file is saved on your device and is never sent to Meetify.'), t('Record'), 'primary');
    if (!ok) return;
    let started;
    try {
        started = await Recorder.start({
            getSources: recorderSources,
            label: `room${conferenceId}`,
            onStop: onRecorderStop,
            onMemoryWarning: () => showNotification(t('This long recording is kept in memory. Stop and save it soon.'), 'warning')
        });
    } catch (err) {
        console.warn('Recording failed to start:', err);
        showNotification(t('Recording is not available in this browser.'), 'error');
        return;
    }
    if (!started) return;   // the file dialog was cancelled
    socket?.emit('recording-start');
    // The server may refuse (the host switched it off a moment ago): then nothing stays recording
    recStartCheck = setTimeout(() => {
        recStartCheck = null;
        if (Recorder.isRecording() && !recordingUsers.has(String(currentUser?.id))) {
            Recorder.stop('refused', { discard: true });
            showNotification(t('You are not allowed to record in this room.'), 'error');
        }
    }, 3000);
    recTimer = setInterval(() => renderRecording(false), 1000);
    showNotification(t('Recording. The file is saved on your device.'), 'info');
    renderRecording();
}

function setupRecording() {
    document.getElementById('recBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        closeReactMenu();
        if (Recorder.isRecording()) Recorder.stop('stop');
        else startRecording();
    });
    renderRecording();
}

// ---- Picture-in-picture --------------------------------------------------------
// The picture of one person in a small floating window, so the call stays visible while another tab or app is
// in front. The click on the menu item is the user gesture the browser asks for.

const pipSupported = () => !!document.pictureInPictureEnabled && typeof HTMLVideoElement.prototype.requestPictureInPicture === 'function';

/** The pinned person, else the one who is talking, else the first with a live picture. Never yourself. */
function pickPipVideo() {
    const tiles = Array.from(document.querySelectorAll('#videoGrid .video-container, #filmstrip .video-container'))
        .filter(t => t.id !== 'localVideoContainer' && !t.classList.contains('screen-tile'));
    const live = (t) => { const v = t.querySelector('video'); return v && v.readyState >= 2 && v.videoWidth > 0 && !t.classList.contains('cam-off') ? v : null; };
    for (const pick of [t => t.classList.contains('pinned'), t => t.classList.contains('speaking'), () => true]) {
        const hit = tiles.filter(pick).map(live).find(Boolean);
        if (hit) return hit;
    }
    return null;
}

function renderPip() {
    const btn = document.getElementById('pipBtn');
    btn.hidden = !pipSupported();
    document.getElementById('pipBtnIcon').innerHTML = Icons.pip;
    document.getElementById('pipBtnText').textContent = document.pictureInPictureElement ? t('Close picture-in-picture') : t('Picture-in-picture');
}

async function togglePip() {
    try {
        if (document.pictureInPictureElement) { await document.exitPictureInPicture(); return; }
        const video = pickPipVideo();
        if (!video) { showNotification(t('Nobody to show yet'), 'info'); return; }
        await video.requestPictureInPicture();
    } catch (err) {
        console.warn('Picture-in-picture failed:', err);
    }
    renderPip();
}

function setupPip() {
    document.getElementById('pipBtn').addEventListener('click', (e) => { e.stopPropagation(); closeReactMenu(); togglePip(); });
    document.addEventListener('enterpictureinpicture', renderPip, true);
    document.addEventListener('leavepictureinpicture', renderPip, true);
    renderPip();
}

// ---- Lock and waiting room -------------------------------------------------

function showWaitRoom(moderatorPresent) {
    const video = document.getElementById('waitVideo');
    if (video && localStream && video.srcObject !== localStream) video.srcObject = localStream;
    document.getElementById('waitText').textContent = moderatorPresent
        ? t('You will join as soon as you are admitted. Nothing is sent until then.')
        : t('Nobody who can let you in is here yet. You will join as soon as the host arrives.');
    document.body.classList.add('waiting');
}

function hideWaitRoom() {
    if (!document.body.classList.contains('waiting')) return;
    document.body.classList.remove('waiting');
    const video = document.getElementById('waitVideo');
    if (video) video.srcObject = null;
}

function setLocked(locked) {
    roomLocked = locked === true;
    const mark = document.getElementById('lockMark');
    if (mark) { mark.innerHTML = Icons.lock; mark.hidden = !roomLocked; }
    updateModControls();
}

function setWaiting(list, notify) {
    waitingPeople = isModerator() && Array.isArray(list) ? list : [];
    const ids = new Set(waitingPeople.map(w => String(w.userId)));
    for (const id of Array.from(notifiedWaiting)) if (!ids.has(id)) notifiedWaiting.delete(id);
    for (const w of waitingPeople) {
        if (notifiedWaiting.has(String(w.userId))) continue;
        notifiedWaiting.add(String(w.userId));
        if (notify) showNotification(t('{name} is waiting to join', { name: w.userName }), 'info');
    }
    renderWaiting();
}

function renderWaiting() {
    const block = document.getElementById('waitingBlock');
    if (!block) return;
    block.hidden = waitingPeople.length === 0;
    block.replaceChildren();
    if (waitingPeople.length) {
        const head = document.createElement('div');
        head.className = 'waiting-head';
        const title = document.createElement('span');
        title.textContent = t('Waiting ({n})', { n: waitingPeople.length });
        head.appendChild(title);
        if (waitingPeople.length > 1) head.appendChild(waitButton(t('Admit all'), 'admit-all', '', true));
        block.appendChild(head);
        for (const w of waitingPeople) {
            const row = document.createElement('div');
            row.className = 'waiting-item';
            const name = document.createElement('span');
            name.className = 'wname';
            name.textContent = w.userName;
            row.append(name, waitButton(t('Admit'), 'admit', w.userId, true), waitButton(t('Deny'), 'deny', w.userId, false));
            block.appendChild(row);
        }
    }
    refreshHands();
}

function waitButton(label, action, uid, primary) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'wait-btn' + (primary ? ' primary' : '');
    b.dataset.wait = action;
    if (uid !== '') b.dataset.uid = String(uid);
    b.textContent = label;
    return b;
}

function updateModControls() {
    const box = document.getElementById('modControls');
    if (!box) return;
    box.hidden = !isModerator();
    const lock = document.getElementById('lockSwitch');
    lock.setAttribute('aria-checked', String(roomLocked));
    const ws = document.getElementById('waitingSwitch');
    ws.hidden = !isHost;
    ws.setAttribute('aria-checked', String(waitingRoomOn));
}

async function setWaitingRoomSetting(on) {
    try {
        const res = await fetch(`${API_BASE}/api/conferences/${conferenceId}`, {
            method: 'PUT', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ waitingRoom: on })
        });
        if (!res.ok) throw new Error('failed');
    } catch {
        showNotification(t('Could not change the waiting room setting.'), 'error');
    }
}

function setupWaitingRoom() {
    document.getElementById('lockSwitch').addEventListener('click', () => {
        socket?.emit('host:lock', { locked: !roomLocked });
    });
    document.getElementById('waitingSwitch').addEventListener('click', () => setWaitingRoomSetting(!waitingRoomOn));
    document.getElementById('waitingBlock').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-wait]');
        if (!btn) return;
        if (btn.dataset.wait === 'admit-all') socket?.emit('host:admit', { all: true });
        else if (btn.dataset.wait === 'admit') socket?.emit('host:admit', { userId: btn.dataset.uid });
        else if (btn.dataset.wait === 'deny') socket?.emit('host:deny', { userId: btn.dataset.uid });
    });
    document.getElementById('waitLeave').addEventListener('click', () => {
        leaving = true;
        socket?.emit('leave-conference');
        if (socket) socket.disconnect();
        if (localStream) localStream.getTracks().forEach(t => t.stop());
        window.location.href = homeUrl();
    });
}

function renderParticipants(participants) {
    const participantsList = document.getElementById('participantsList');

    if (participants.length === 0) {
        participantsList.innerHTML = '<p style="color:var(--room-muted);text-align:center;padding:2rem;font-size:0.88rem;">' + t('No participants yet') + '</p>';
        return;
    }

    // raised hands first (the order of everybody else stays)
    const handUp = (p) => raisedHands.has(String(p.user_id || p.userId));
    participants = participants.slice().sort((a, b) => Number(handUp(b)) - Number(handUp(a)));

    participantsList.innerHTML = participants.map(p => {
        const uid = p.user_id || p.userId;
        const isHandUp = raisedHands.has(String(uid));
        const name = p.username || p.userName || t('Unknown');
        const initials = getInitials(name);
        const isParticipantHost = !!(p.is_host || p.isHost);
        const isCoHost = coHosts.has(uid);
        const isChatBanned = chatBanned.has(uid);
        const isSelf = uid === currentUser?.id;
        const canActOn = isModerator() && !isSelf && !isParticipantHost && (isHost || !isCoHost);
        const canManageCoHost = isHost && !isSelf && !isParticipantHost && !p.guest;

        const badges = [
            isParticipantHost ? `<span class="pbadge" title="${t('Host')}">${Icons.crown}</span>` : '',
            isCoHost && !isParticipantHost ? `<span class="pbadge" title="${t('Co-host')}">${Icons.shield}</span>` : '',
            isChatBanned ? `<span class="pbadge pbadge-text" title="${t('Muted in chat')}">${t('chat off')}</span>` : '',
            isHandUp ? `<span class="pbadge" title="${t('Hand raised')}">${Icons.handSmall}</span>` : ''
        ].filter(Boolean).join('');

        const avatarHtml = p.avatar_url
            ? `<img class="participant-avatar-img" src="${escapeHtml(p.avatar_url)}" alt="${escapeHtml(name)}">`
            : `<div class="participant-avatar-initials" style="background:${stringToColor(name)}">${escapeHtml(initials)}</div>`;

        // No inline handlers: names and ids travel in data attributes, one listener on the list acts on them
        const idAttr = escapeHtml(String(uid));
        const actionMenu = canActOn ? `
            <div class="mod-menu-wrap">
                <button class="mod-menu-btn" data-mod="menu" data-uid="${idAttr}" title="${t('Moderation options')}" aria-label="${t('Moderation options')}">${Icons.more}</button>
                <div class="mod-menu" id="mod-menu-${idAttr}">
                    ${isHandUp ? `<button data-lower-hand="${idAttr}">${t('Lower hand')}</button>` : ''}
                    ${recordingUsers.has(String(uid)) ? `<button data-mod="stop-rec" data-uid="${idAttr}">${t('Stop their recording')}</button>` : ''}
                    <button data-mod="audio" data-uid="${idAttr}">${t('Mute mic')}</button>
                    <button data-mod="video" data-uid="${idAttr}">${t('Turn off camera')}</button>
                    <button data-mod="screen" data-uid="${idAttr}">${t('Stop screen share')}</button>
                    <button data-mod="${isChatBanned ? 'chat-unban' : 'chat-ban'}" data-uid="${idAttr}">${isChatBanned ? t('Unban chat') : t('Ban from chat')}</button>
                    ${canManageCoHost ? `<button data-mod="${isCoHost ? 'demote' : 'promote'}" data-uid="${idAttr}">${isCoHost ? t('Remove co-host') : t('Make co-host')}</button>` : ''}
                    <button class="danger" data-mod="kick" data-uid="${idAttr}" data-name="${escapeHtml(name)}">${t('Remove from room')}</button>
                </div>
            </div>
        ` : '';

        return `
            <div class="participant-item${isHandUp ? ' hand-up' : ''}">
                <div class="participant-avatar">${avatarHtml}</div>
                <div class="participant-info">
                    <strong>${escapeHtml(name)} ${badges}</strong>
                    <small>${t('Joined {time}', { time: formatJoinTime(p.joined_at || p.joinedAt) })}</small>
                </div>
                ${actionMenu}
            </div>
        `;
    }).join('');
}

function formatJoinTime(timestamp) {
    if (!timestamp) return t('recently');
    const date = new Date(timestamp);
    const diffMins = Math.floor((Date.now() - date) / 60000);
    if (diffMins < 1) return t('just now');
    if (diffMins < 60) return tn(diffMins, '1 minute ago', '{n} minutes ago');
    const diffHours = Math.floor(diffMins / 60);
    return tn(diffHours, '1 hour ago', '{n} hours ago');
}

function updateParticipantCount() {
    // the server's list, not the peer connections: a Group call has none, and a guest without devices has no tile
    const count = roomMembers.size + 1;
    document.getElementById('participantCount').textContent = count;
    const label = document.getElementById('participantLabel');
    if (label) label.textContent = tn(count, 'participant', 'participants');
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

let sfuRebuilding = false;

function sfuHealthy() {
    const bad = (t) => !t || t.connectionState === 'failed' || t.connectionState === 'closed';
    return !!sfuSocket?.connected && !bad(sfuSendTransport) && !bad(sfuRecvTransport);
}

function watchSfuTransport(transport) {
    transport.on('connectionstatechange', (state) => {
        if (leaving || (transport !== sfuSendTransport && transport !== sfuRecvTransport)) return;
        if (state === 'failed') {
            rebuildSfu();
        } else if (state === 'disconnected') {
            // often heals by itself; if it does not, start over
            later(() => {
                if (transport.connectionState === 'disconnected' &&
                    (transport === sfuSendTransport || transport === sfuRecvTransport)) rebuildSfu();
            }, 10000);
        }
    });
}

/** The Group session is dead (SFU restarted, transport failed, network gone): drop it and start a new one. */
async function rebuildSfu() {
    if (leaving || sfuRebuilding || conferenceMode !== 'sfu') return;
    sfuRebuilding = true;
    resilience.sfuDown = true;
    updateNetBanner();
    try {
        // Everything of the dead session goes; consume() brings the tiles back
        cleanupSfu();
        for (const k of Object.keys(sfuProducers)) delete sfuProducers[k];
        for (const k of Object.keys(sfuConsumers)) delete sfuConsumers[k];
        for (const k of Object.keys(sfuProdInfo)) delete sfuProdInfo[k];
        sfuConsuming.clear();
        for (const id of Object.keys(remoteStreams)) {
            document.getElementById(`video-${id}`)?.remove();
            pinnedTiles.delete(String(id));
            delete remoteStreams[id];
        }
        document.querySelectorAll('.screen-tile').forEach(t => {
            if (t.id !== 'screen-local') { pinnedTiles.delete(t.id); t.remove(); }
        });
        applyPinLayout();
        updateParticipantCount();

        const waits = [0, 2000, 5000, 10000, 20000];
        let ok = false;
        for (const wait of waits) {
            if (leaving) return;
            if (wait) await new Promise(resolve => later(resolve, wait));
            // sfu:get-server-config goes through the signaling socket; when it is back its answer starts us again
            if (!socket?.connected) break;
            try {
                await initSfu();
                ok = sfuHealthy();
            } catch (e) {
                console.warn('[SFU] rebuild attempt failed:', e);
            }
            if (ok) break;
            cleanupSfu();
        }
        if (ok) {
            resilience.sfuDown = false;
            // a screen we were sharing goes out again
            const track = screenStream?.getVideoTracks()[0];
            if (isScreenSharing && track && track.readyState === 'live') {
                socket.emit('screen-share-start', { conferenceId });
                sfuProducers.screen = await sfuSendTransport.produce({ track, appData: { share: true } });
            }
        } else if (socket?.connected) {
            resilience.stuck = true;   // all attempts used: the banner offers a reload
        }
    } finally {
        sfuRebuilding = false;
        updateNetBanner();
    }
}

function cleanupSfu() {
    Object.values(sfuProducers).forEach(p => { try { p?.close(); } catch {} });
    Object.values(sfuConsumers).forEach(c => { try { c?.close(); } catch {} });
    try { sfuSendTransport?.close(); } catch {}
    try { sfuRecvTransport?.close(); } catch {}
    try { sfuSocket?.disconnect(); } catch {}
    sfuSocket = null;
}

function cleanupAndRedirect(reason) {
    Recorder.stop('leave');
    teardownResilience();
    if (roomTimer) clearInterval(roomTimer);
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (screenStream) screenStream.getTracks().forEach(t => t.stop());
    Object.values(peers).forEach(p => p.close());
    peers = {};
    cleanupSfu();
    stopQualityMonitor();
    if (socket) socket.disconnect();
    alert(reason);
    window.location.href = homeUrl();
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
    // Optimistic update — confirmed via user-chat-banned broadcast.
    // The menu passes the id as text; user ids are numbers, guest ids ("g:...") stay text.
    const id = String(targetUserId).startsWith('g:') ? targetUserId : Number(targetUserId);
    if (banned) chatBanned.add(id);
    else chatBanned.delete(id);
    loadParticipants();
}

async function hostKick(targetUserId, targetName) {
    closeAllModMenus();
    const confirmed = await showConfirm(t('Kick {name} from the conference?', { name: targetName }), t('Kick'), 'danger');
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
    const confirmed = await showConfirm(t('Leave this conference?'), t('Leave'), 'danger');
    if (!confirmed) return;

    await Recorder.stop('leave');   // the file is written before the tracks go
    teardownResilience();
    if (roomTimer) clearInterval(roomTimer);
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    if (screenStream) screenStream.getTracks().forEach(track => track.stop());

    Object.values(peers).forEach(peer => peer.close());
    peers = {};
    cleanupSfu();
    stopQualityMonitor();

    if (socket) {
        socket.emit('leave-conference', { conferenceId });
        socket.disconnect();
    }

    if (guestSession) {
        clearGuestSession();   // nothing to tell the REST side: guests are not members
    } else {
        await fetch(`${API_BASE}/api/conferences/${conferenceId}/leave`, {
            method: 'POST',
            credentials: 'include'
        }).catch(() => {});
    }

    window.location.href = homeUrl();
}

// A reload of the room page must not lock a member out. Closing the page tells the server "I left" (below),
// and an unlisted room lets nobody back in without the invite code. The code the page already holds is kept
// for this tab for one minute, so the reloaded page can join again. Never the password: a room with a
// password asks for it again, as before.
const REJOIN_KEY = 'meetify-rejoin';
function rememberForReload() {
    if (guestSession || !inviteCode) return;
    try { sessionStorage.setItem(REJOIN_KEY, JSON.stringify({ id: String(conferenceId), code: inviteCode, t: Date.now() })); } catch { /* private window */ }
}
async function rejoinAfterReload() {
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(REJOIN_KEY) || 'null'); sessionStorage.removeItem(REJOIN_KEY); } catch { /* ignore */ }
    if (!saved || saved.id !== String(conferenceId) || Date.now() - saved.t > 60000) return;
    await new Promise(r => setTimeout(r, 400));   // let the "I left" of the old page arrive first
    await fetch(`${API_BASE}/api/conferences/${encodeURIComponent(conferenceId)}/join`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: saved.code })
    }).catch(() => {});
}

let reloading = false;   // the Reload button of the network banner: the person is not leaving
function onPageGone() {
    if (leaving) return;
    KeepAwake.stop();
    Recorder.stop('leave');
    leaving = true;   // closing the page: no reconnect attempts while it goes away
    if (joinedConference && conferenceId && !guestSession && !reloading) {
        rememberForReload();
        navigator.sendBeacon(`${API_BASE}/api/conferences/${conferenceId}/leave`);
    }
    if (socket) socket.disconnect();
}
window.addEventListener('beforeunload', onPageGone);
// phones do not always fire beforeunload; a page kept in the back/forward cache is not gone
window.addEventListener('pagehide', (e) => { if (!e.persisted) onPageGone(); });

// ============================================================
// Raised hands, reactions, keyboard shortcuts
// ============================================================

const isMe = (userId) => String(userId) === String(currentUser?.id);

/** Show the hand badges on the tiles, the button state and the count on the participants button. */
function refreshHands() {
    document.querySelectorAll('.video-container .hand-badge').forEach(badge => {
        const tile = badge.closest('.video-container');
        const uid = tile.id === 'localVideoContainer' ? String(currentUser?.id) : tile.dataset.userId;
        badge.hidden = !raisedHands.has(String(uid));
    });
    const mine = raisedHands.has(String(currentUser?.id));
    const text = document.getElementById('handBtnText');
    if (text) text.textContent = mine ? t('Lower hand (H)') : t('Raise hand (H)');
    document.getElementById('reactBtn')?.classList.toggle('active', mine);

    const count = document.getElementById('handCount');
    if (count) {
        const panelOpen = document.getElementById('participantsSidebar')?.classList.contains('open');
        const n = raisedHands.size + waitingPeople.length;
        count.textContent = String(n);
        count.title = waitingPeople.length ? t('Raised hands and people waiting') : t('Raised hands');
        count.style.display = n > 0 && !panelOpen ? 'flex' : 'none';
    }
    if (lastParticipants.length) renderParticipants(lastParticipants);
}

function toggleHand() {
    if (!socket) return;
    socket.emit(raisedHands.has(String(currentUser?.id)) ? 'hand-lower' : 'hand-raise');
}

/** A reaction floats over the sender's tile for 3 seconds (at most 3 at once per tile). */
function showReaction(userId, reaction) {
    if (!REACTION_LABELS[reaction]) return;
    const tile = isMe(userId) ? document.getElementById('localVideoContainer') : document.getElementById(`video-${userId}`);
    if (!tile) return;
    const floats = tile.querySelectorAll('.reaction-float');
    if (floats.length >= 3) floats[0].remove();
    const el = document.createElement('div');
    el.className = 'reaction-float';
    el.dataset.kind = reaction;
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', REACTION_LABELS[reaction]);
    el.innerHTML = Icons.reaction(reaction, 26);
    tile.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

function closeReactMenu() {
    const menu = document.getElementById('reactMenu');
    if (!menu || !menu.classList.contains('open')) return;
    menu.classList.remove('open');
    document.getElementById('reactBtn')?.setAttribute('aria-expanded', 'false');
}

function toggleReactMenu(forceOpen) {
    const menu = document.getElementById('reactMenu');
    const open = forceOpen === undefined ? !menu.classList.contains('open') : forceOpen;
    document.getElementById('videoMenu')?.classList.remove('open');
    menu.classList.toggle('open', open);
    document.getElementById('reactBtn').setAttribute('aria-expanded', String(open));
    if (open) document.getElementById('handBtn').focus();
}

function setupReactions() {
    const $ = (id) => document.getElementById(id);
    $('reactBtn').innerHTML = Icons.reaction('laugh', 20);
    $('handBtnIcon').innerHTML = Icons.hand;
    $('localHandBadge').innerHTML = Icons.handSmall;

    const grid = $('reactGrid');
    for (const kind of Object.keys(REACTION_LABELS)) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'react-btn';
        b.setAttribute('role', 'menuitem');
        b.setAttribute('aria-label', REACTION_LABELS[kind]);
        b.title = REACTION_LABELS[kind];
        b.innerHTML = Icons.reaction(kind, 22);
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            socket?.emit('reaction', { reaction: kind });
            closeReactMenu();
        });
        grid.appendChild(b);
    }
    $('handBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleHand(); closeReactMenu(); });
    $('reactBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleReactMenu(); });
    $('reactMenu').addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', closeReactMenu);

    // a moderator lowers somebody's hand from the participants list (no inline handler)
    $('participantsList').addEventListener('click', (e) => {
        const lower = e.target.closest('[data-lower-hand]');
        if (lower) {
            closeAllModMenus();
            socket?.emit('hand-lower', { targetUserId: lower.dataset.lowerHand });
            return;
        }
        const btn = e.target.closest('[data-mod]');
        if (!btn) return;
        const uid = btn.dataset.uid;
        switch (btn.dataset.mod) {
            case 'menu': toggleModMenu(btn, uid); break;
            case 'audio': case 'video': case 'screen': hostForceMute(uid, btn.dataset.mod); break;
            case 'chat-ban': hostChatBan(uid, true); break;
            case 'chat-unban': hostChatBan(uid, false); break;
            case 'promote': hostPromoteCoHost(uid); break;
            case 'demote': hostDemoteCoHost(uid); break;
            case 'stop-rec': closeAllModMenus(); socket?.emit('host:stop-recording', { targetUserId: uid }); break;
            case 'kick': hostKick(uid, btn.dataset.name || 'this person'); break;
        }
    });
}

// ---- Keyboard shortcuts ----------------------------------------------------

let shortcutsReturnFocus = null;

function openShortcuts() {
    shortcutsReturnFocus = document.activeElement;
    closeReactMenu();
    document.getElementById('videoMenu')?.classList.remove('open');
    document.getElementById('shortcutsPanel').hidden = false;
    document.getElementById('shortcutsClose').focus();
}

function closeShortcuts() {
    const panel = document.getElementById('shortcutsPanel');
    if (panel.hidden) return;
    panel.hidden = true;
    if (shortcutsReturnFocus && document.contains(shortcutsReturnFocus)) shortcutsReturnFocus.focus();
    shortcutsReturnFocus = null;
}

function releasePushToTalk() {
    if (!pttActive) return;
    pttActive = false;
    setMicEnabled(false);
}

function setupShortcuts() {
    const closeBtn = document.getElementById('shortcutsClose');
    closeBtn.innerHTML = Icons.close;
    closeBtn.addEventListener('click', closeShortcuts);
    document.getElementById('shortcutsPanel').addEventListener('click', (e) => {
        if (e.target.id === 'shortcutsPanel') closeShortcuts();
    });

    const typing = (el) => !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
    const dialogOpen = () => !!document.querySelector('.mf-backdrop') ||
        document.getElementById('secPanel')?.classList.contains('open');

    document.addEventListener('keydown', (e) => {
        if (leaving || document.body.classList.contains('in-lobby') || document.body.classList.contains('waiting')) return;
        if (e.key === 'Escape') {
            closeShortcuts();
            closeReactMenu();
            document.getElementById('videoMenu')?.classList.remove('open');
            return;
        }
        // Space held for push-to-talk repeats: it must not scroll the page or reach anything else
        if (e.repeat && pttActive && (e.key === ' ' || e.key === 'Spacebar')) { e.preventDefault(); return; }
        if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || typing(e.target) || dialogOpen()) return;

        const panelOpen = !document.getElementById('shortcutsPanel').hidden;
        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

        if (panelOpen) {                       // while the list is open only "?" (close) works
            if (key === '?') { e.preventDefault(); closeShortcuts(); }
            return;
        }
        if (key === ' ' || key === 'Spacebar') {
            // push-to-talk; a focused button or link keeps its own Space behaviour
            if (/^(BUTTON|A|SUMMARY)$/.test(e.target.tagName) || e.target.getAttribute?.('role') === 'button') return;
            if (!isAudioEnabled && localStream?.getAudioTracks().length) {
                e.preventDefault();
                pttActive = true;
                setMicEnabled(true);
            }
            return;
        }
        const run = {
            m: () => toggleMicrophone(),
            v: () => toggleCamera(),
            s: () => toggleScreenShare(),
            c: () => document.getElementById('toggleChat').click(),
            p: () => document.getElementById('toggleParticipants').click(),
            h: () => toggleHand(),
            r: () => toggleReactMenu(),
            '?': () => openShortcuts()
        }[key];
        if (run) { e.preventDefault(); run(); }
    });

    document.addEventListener('keyup', (e) => {
        if ((e.key === ' ' || e.key === 'Spacebar') && pttActive) { e.preventDefault(); releasePushToTalk(); }
    });
    window.addEventListener('blur', releasePushToTalk);
    document.addEventListener('visibilitychange', () => { if (document.hidden) releasePushToTalk(); });
}

// ============================================================
// Network banner and browser online/offline events
// ============================================================

function updateNetBanner() {
    const el = document.getElementById('netBanner');
    if (!el) return;
    let text = '';
    if (resilience.offline) text = t('You are offline. The call comes back when the network does.');
    else if (resilience.serverDown) text = t('Connection to the server lost. Reconnecting…');
    else if (resilience.sfuDown) text = t('Reconnecting to the group call…');

    if (text && !resilience.stuckTimer && !resilience.stuck) {
        // still down after a minute: offer a reload
        resilience.stuckTimer = setTimeout(() => { resilience.stuck = true; updateNetBanner(); }, 60000);
    }
    if (!text) {
        clearTimeout(resilience.stuckTimer);
        resilience.stuckTimer = null;
        resilience.stuck = false;
    }
    document.getElementById('netBannerText').textContent = text;
    document.getElementById('netBannerReload').hidden = !(text && resilience.stuck);
    el.hidden = !text;
}

function onBrowserOffline() {
    resilience.offline = true;
    updateNetBanner();
}

function onBrowserOnline() {
    resilience.offline = false;
    updateNetBanner();
    if (leaving) return;
    // The signaling connection may be dead without the browser knowing: close it so it reconnects
    // now instead of after the ping timeout (the server keeps our place during its grace period)
    if (socket?.connected) { try { socket.io.engine.close(); } catch { /* already closing */ } }
    // already known to be down: do not wait for the next retry (they are up to 5 s apart)
    else if (socket) { try { socket.disconnect(); socket.connect(); } catch { /* next retry will do */ } }
    if (conferenceMode === 'sfu' && sfuSendTransport && !sfuHealthy()) rebuildSfu();
}

function startNetworkWatch() {
    if (resilience.listening) return;
    resilience.listening = true;
    window.addEventListener('offline', onBrowserOffline);
    window.addEventListener('online', onBrowserOnline);
    document.getElementById('netBannerReload')?.addEventListener('click', () => { reloading = true; window.location.reload(); });
    if (!navigator.onLine) onBrowserOffline();
}

/** Stop every retry, timer and listener: the person is leaving (or was removed). */
function teardownResilience() {
    KeepAwake.stop();
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
    leaving = true;
    window.removeEventListener('offline', onBrowserOffline);
    window.removeEventListener('online', onBrowserOnline);
    resilience.listening = false;
    resilienceTimers.forEach(clearTimeout);
    resilienceTimers.clear();
    Speaking.stopAll();
    clearTimeout(resilience.stuckTimer);
    resilience.stuckTimer = null;
    Object.values(peers).forEach(clearPeerTimers);
    const banner = document.getElementById('netBanner');
    if (banner) banner.hidden = true;
}

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

function sfuSocketAck(event, data) {
    return new Promise(resolve => sfuSocket.emit(event, data, resolve));
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
        showNotification(t('mediasoup-client failed to load — Group call unavailable'), 'error');
        return;
    }

    // 0. Get SFU server address + short-lived token from main backend
    const { url: sfuUrl, token: sfuToken, error: cfgErr } =
        await socketAck('sfu:get-server-config', { conferenceId });
    if (cfgErr) throw new Error(`SFU config error: ${cfgErr}`);

    // Connect directly to the SFU server
    sfuSocket = window.io(sfuUrl, {
        auth:       { token: sfuToken },
        transports: ['websocket'],
        path:       '/sfu/',
        // a dropped SFU connection lost its server-side session: rebuildSfu() starts a new one with a fresh token
        reconnection: false
    });
    const thisSfuSocket = sfuSocket;
    sfuSocket.on('disconnect', (reason) => {
        if (leaving || sfuSocket !== thisSfuSocket || reason === 'io client disconnect') return;
        rebuildSfu();
    });
    await new Promise((resolve, reject) => {
        sfuSocket.once('connect', resolve);
        sfuSocket.once('connect_error', err => reject(new Error(`SFU connect failed: ${err.message}`)));
    });

    sfuDevice = new window.MediasoupDevice();

    // 1. Get router RTP capabilities and load device
    const { rtpCapabilities, error: capErr } = await sfuSocketAck('sfu:get-rtp-capabilities', { conferenceId });
    if (capErr) throw new Error(capErr);
    await sfuDevice.load({ routerRtpCapabilities: rtpCapabilities });

    // 2. Create send transport and wire its events before producing
    const sendParams = await sfuSocketAck('sfu:create-transport', { conferenceId });
    if (sendParams.error) throw new Error(sendParams.error);

    sfuServerFingerprints = sendParams.dtlsParameters?.fingerprints || null;
    sfuSendTransport = sfuDevice.createSendTransport(sendParams);
    watchSfuTransport(sfuSendTransport);
    sfuSendTransport.on('connect', ({ dtlsParameters }, cb, eb) => {
        sfuSocketAck('sfu:connect-transport', { transportId: sfuSendTransport.id, dtlsParameters })
            .then(() => cb()).catch(eb);
    });
    sfuSendTransport.on('produce', async ({ kind, rtpParameters, appData }, cb, eb) => {
        const { id, error } = await sfuSocketAck('sfu:produce', {
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
    const recvParams = await sfuSocketAck('sfu:create-transport', { conferenceId });
    if (recvParams.error) throw new Error(recvParams.error);

    sfuRecvTransport = sfuDevice.createRecvTransport(recvParams);
    watchSfuTransport(sfuRecvTransport);
    sfuRecvTransport.on('connect', ({ dtlsParameters }, cb, eb) => {
        sfuSocketAck('sfu:connect-transport', { transportId: sfuRecvTransport.id, dtlsParameters })
            .then(() => cb()).catch(eb);
    });

    // 5. React to new producers (others who join later or start screen share).
    //    Subscribed before get-producers so nothing announced in between is lost.
    sfuSocket.on('sfu:new-producer', info => { sfuConsume(info); });

    // 6. Consume all existing producers in the room
    const { producers } = await sfuSocketAck('sfu:get-producers', { conferenceId });
    for (const info of producers) await sfuConsume(info);

    // 7. Handle producers closed remotely (user left or stopped screen share)
    sfuSocket.on('sfu:producer-closed', ({ producerId }) => {
        const info = sfuProdInfo[producerId];
        if (!info) return;

        const { userId, consumerId, isScreen } = info;
        delete sfuProdInfo[producerId];

        const consumer = sfuConsumers[consumerId];
        const stream   = remoteStreams[userId];
        if (consumer && stream && consumer.track && !isScreen) {
            stream.removeTrack(consumer.track);
        }
        if (consumer) { consumer.close(); delete sfuConsumers[consumerId]; }
        if (isScreen) { removeScreenTile(userId); return; }

        const stillHasProducer = Object.values(sfuProdInfo).some(pi => pi.userId === userId && !pi.isScreen);
        if (!stillHasProducer) {
            document.getElementById(`video-${userId}`)?.remove();
            pinnedTiles.delete(String(userId));
            applyPinLayout();
            updateParticipantCount();
            delete remoteStreams[userId];
        }
    });

    // 8. Handle consumer closed server-side
    sfuSocket.on('sfu:consumer-closed', ({ consumerId }) => {
        const consumer = sfuConsumers[consumerId];
        if (!consumer) return;
        const prodEntry = Object.entries(sfuProdInfo).find(([, i]) => i.consumerId === consumerId);
        if (prodEntry) {
            const [producerId, info] = prodEntry;
            const stream = remoteStreams[info.userId];
            if (stream && consumer.track && !info.isScreen) stream.removeTrack(consumer.track);
            if (info.isScreen) removeScreenTile(info.userId);
            delete sfuProdInfo[producerId];
        }
        consumer.close();
        delete sfuConsumers[consumerId];
    });
}

const sfuConsuming = new Set(); // producerIds being consumed right now

async function sfuConsume({ producerId, userId, userName, kind, appData }) {
    // The same producer can arrive from get-producers and from sfu:new-producer
    if (sfuProdInfo[producerId] || sfuConsuming.has(producerId)) return;
    sfuConsuming.add(producerId);
    try {
        // The server checks router.canConsume() and answers with an error if it fails
        const params = await sfuSocketAck('sfu:consume', {
            transportId:     sfuRecvTransport.id,
            producerId,
            rtpCapabilities: sfuDevice.rtpCapabilities,
            conferenceId
        });
        if (params.error) { console.error('[SFU] consume error:', params.error); return; }

        const consumer = await sfuRecvTransport.consume(params);
        sfuConsumers[consumer.id] = consumer;
        // A screen is the sender's second video (or its only one while the camera is off and a share was announced)
        const hasCamera = Object.values(sfuProdInfo).some(i => i.userId === userId && i.kind === 'video' && !i.isScreen);
        const isScreen = kind === 'video' &&
            !!(appData?.share || params.appData?.share || hasCamera || roomScreenShareState.has(userId));
        sfuProdInfo[producerId] = { userId, userName, kind, isScreen, consumerId: consumer.id };

        await sfuSocketAck('sfu:resume-consumer', { consumerId: consumer.id });

        if (isScreen) {
            addScreenTile(userId, new MediaStream([consumer.track]), userName);
            return;
        }

        // Group audio+video into one MediaStream per user, then render (or update) their tile
        if (!remoteStreams[userId]) remoteStreams[userId] = new MediaStream();
        remoteStreams[userId].addTrack(consumer.track);
        addRemoteVideo(userId, remoteStreams[userId], userName);
    } catch (err) {
        console.error('[SFU] consume failed:', err);
    } finally {
        sfuConsuming.delete(producerId);
    }
}

// ============================================================
// Adaptive quality monitor — 4 tiers: excellent / good / degraded / poor
// Polls WebRTC stats every 5 s via getStats(). Requires 2 consecutive
// matching polls before switching tiers (prevents flapping).
// VP9 is preferred in mediasoup; audio goes mono on weak links.
// ============================================================

// Video resolution + framerate per tier
const QUALITY_PRESETS = {
    excellent: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
    good:      { width: { ideal: 1280 }, height: { ideal: 720  }, frameRate: { ideal: 30 } },
    degraded:  { width: { ideal: 640  }, height: { ideal: 360  }, frameRate: { ideal: 20 } },
    poor:      { width: { ideal: 320  }, height: { ideal: 180  }, frameRate: { ideal: 15 } },
};

// Max bitrate per tier (P2P RTCRtpSender.setParameters)
const BITRATE_CAP = { excellent: 4_000_000, good: 2_000_000, degraded: 500_000, poor: 200_000 };

// Audio constraints per tier — mono on weak links, stereo (ideal) on strong links
const AUDIO_PRESETS = {
    excellent: { channelCount: { ideal: 2 } },
    good:      { channelCount: { ideal: 2 } },
    degraded:  { channelCount: 1 },
    poor:      { channelCount: 1 },
};

// Tier rank for comparing improvement vs regression
const TIER_RANK = { excellent: 3, good: 2, degraded: 1, poor: 0 };

let _qualityTier  = 'good';   // currently applied tier
let _streakTier   = null;     // tier seen in last poll
let _streakCount  = 0;        // consecutive polls for _streakTier
let _qualityInterval = null;

async function _pollNetworkStats() {
    const samples = [];

    const readStats = async (statsPromise) => {
        let rtt = 0, loss = 0;
        (await statsPromise).forEach(r => {
            if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.currentRoundTripTime)
                rtt = Math.max(rtt, r.currentRoundTripTime * 1000);
            if (r.type === 'remote-inbound-rtp' && r.kind === 'video' && r.fractionLost != null)
                loss = Math.max(loss, r.fractionLost);
        });
        return { rtt, loss };
    };

    for (const pc of Object.values(peers)) {
        try { samples.push(await readStats(pc.getStats())); } catch (_) {}
    }

    if (conferenceMode === 'sfu' && sfuSendTransport) {
        const pc = sfuSendTransport._handler?._pc;
        if (pc) {
            try { samples.push(await readStats(pc.getStats())); } catch (_) {}
        }
    }

    if (!samples.length) return null;
    return {
        rtt:  samples.reduce((a, s) => a + s.rtt,  0) / samples.length,
        loss: samples.reduce((a, s) => a + s.loss, 0) / samples.length,
    };
}

function _classifyTier({ rtt, loss }) {
    if (loss > 0.08 || rtt > 400)                            return 'poor';
    if (loss > 0.02 || rtt > 150)                            return 'degraded';
    if (loss < 0.005 && rtt > 0 && rtt < 50)                return 'excellent';
    return 'good';
}

async function _applyQualityTier(tier) {
    const videoTrack = localStream?.getVideoTracks()[0];
    if (videoTrack) {
        try { await videoTrack.applyConstraints(QUALITY_PRESETS[tier]); } catch (_) {}
    }

    const audioTrack = localStream?.getAudioTracks()[0];
    if (audioTrack) {
        try { await audioTrack.applyConstraints(AUDIO_PRESETS[tier]); } catch (_) {}
    }

    if (conferenceMode === 'p2p') {
        const maxBitrate = BITRATE_CAP[tier];
        for (const pc of Object.values(peers)) {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (!sender) continue;
            try {
                const params = sender.getParameters();
                if (!params.encodings?.length) params.encodings = [{}];
                params.encodings[0].maxBitrate = maxBitrate;
                await sender.setParameters(params);
            } catch (_) {}
        }
    }
}

function _showQualityNotification(prev, next) {
    const improved = TIER_RANK[next] > TIER_RANK[prev];
    if (improved) {
        const msg = next === 'excellent'
            ? t('Excellent connection — HD 1080p enabled')
            : t('Connection stable — quality restored');
        showNotification(msg, 'success', 3000);
    } else {
        const msgs = {
            poor:     t('Poor connection — quality reduced for stability'),
            degraded: t('Slow connection detected — quality reduced'),
            good:     t('Connection slowed — HD mode paused'),
        };
        showNotification(msgs[next] || t('Quality reduced'), 'warning', 6000);
    }
}

const NET_LEVEL = { poor: 1, degraded: 2, good: 3, excellent: 4 };
const NET_TEXT = { poor: t('Your connection: poor'), degraded: t('Your connection: slow'), good: t('Your connection: good'), excellent: t('Your connection: excellent') };
/** Four bars on your own tile: when something looks bad, you can see whether it is your network. */
function setNetBars(tier) {
    const el = document.getElementById('localNetBars');
    if (!el) return;
    el.hidden = false;
    el.dataset.level = String(NET_LEVEL[tier] || 3);
    el.title = NET_TEXT[tier] || NET_TEXT.good;
}

async function _qualityTick() {
    const net = await _pollNetworkStats();
    if (!net) return;

    const targetTier = _classifyTier(net);
    setNetBars(targetTier);

    if (targetTier === _streakTier) {
        _streakCount++;
    } else {
        _streakTier  = targetTier;
        _streakCount = 1;
    }

    if (_streakCount < 2 || targetTier === _qualityTier) return;

    const prev    = _qualityTier;
    _qualityTier  = targetTier;
    await _applyQualityTier(targetTier);
    _showQualityNotification(prev, targetTier);
}

function startQualityMonitor() {
    if (_qualityInterval) return;
    _qualityTier = 'good';
    _streakTier  = null;
    _streakCount = 0;
    _qualityInterval = setInterval(_qualityTick, 5000);
}

function stopQualityMonitor() {
    clearInterval(_qualityInterval);
    _qualityInterval = null;
}

window.closeSidebar = closeSidebar;
window.sendMessage = sendMessage;
window.togglePin = togglePin;
window.toggleStrip = toggleStrip;

// CSS lays the grid out by tile count
(() => {
    const grid = document.getElementById('videoGrid');
    if (!grid) return;
    const sync = () => { grid.dataset.count = String(grid.querySelectorAll(':scope > .video-container').length); };
    new MutationObserver(sync).observe(grid, { childList: true });
    sync();
})();
