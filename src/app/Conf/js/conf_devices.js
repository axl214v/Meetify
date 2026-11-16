/**
 * Camera, microphone and speaker choice for the room (lobby before joining + "Devices" menu in the call).
 * Only device ids are remembered, in localStorage of this browser; nothing is sent anywhere.
 */
(function () {
    const KEY = 'meetify-devices';

    const AUDIO_BASE = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    const VIDEO_BASE = { width: { ideal: 1280 }, height: { ideal: 720 } };

    function loadChoice() {
        try {
            const c = JSON.parse(localStorage.getItem(KEY) || '{}');
            return c && typeof c === 'object' ? c : {};
        } catch { return {}; }
    }

    function saveChoice(patch) {
        try { localStorage.setItem(KEY, JSON.stringify({ ...loadChoice(), ...patch })); } catch { /* private window */ }
    }

    const speakerSupported = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;

    function audioConstraints(micId) {
        return micId ? { ...AUDIO_BASE, deviceId: { exact: micId } } : { ...AUDIO_BASE };
    }
    function videoConstraints(camId) {
        return camId ? { ...VIDEO_BASE, deviceId: { exact: camId } } : { ...VIDEO_BASE };
    }

    /** One getUserMedia call; a saved device that is gone (unplugged) is retried once with the default. */
    async function tryGet({ audio, video, camId, micId }) {
        const attempt = (cam, mic) => navigator.mediaDevices.getUserMedia({
            audio: audio ? audioConstraints(mic) : false,
            video: video ? videoConstraints(cam) : false
        });
        try {
            return await attempt(camId, micId);
        } catch (err) {
            const gone = err && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError');
            if (gone && (camId || micId)) return attempt(null, null);
            throw err;
        }
    }

    /**
     * Get a stream for the wanted devices. Falls back audio+video -> audio only -> video only -> nothing,
     * so a missing or blocked camera never keeps someone out of the room.
     * @returns {Promise<{stream: MediaStream|null, error: Error|null}>} `error` is the first real problem (for the message)
     */
    async function getStream({ camId = null, micId = null, audio = true, video = true } = {}) {
        if (!navigator.mediaDevices?.getUserMedia) {
            return { stream: null, error: Object.assign(new Error('unsupported'), { name: 'NotSupportedError' }) };
        }
        let firstError = null;
        const ladder = [];
        if (audio && video) ladder.push([true, true]);
        if (audio) ladder.push([true, false]);
        if (video) ladder.push([false, true]);
        for (const [a, v] of ladder) {
            try {
                const stream = await tryGet({ audio: a, video: v, camId, micId });
                return { stream, error: firstError };
            } catch (err) {
                if (!firstError) firstError = err;
                // blocked by the user: the other kinds will be blocked too, stop asking
                if (err && err.name === 'NotAllowedError') break;
            }
        }
        return { stream: null, error: firstError };
    }

    /** One track of one kind from a chosen device (used when switching during the call). */
    async function getTrack(kind, deviceId) {
        const stream = await navigator.mediaDevices.getUserMedia(kind === 'audio'
            ? { audio: audioConstraints(deviceId), video: false }
            : { audio: false, video: videoConstraints(deviceId) });
        return stream.getTracks()[0];
    }

    /** Devices grouped by kind. Labels are empty until the user has given permission, so they get numbered names. */
    async function listDevices() {
        const out = { cams: [], mics: [], speakers: [] };
        if (!navigator.mediaDevices?.enumerateDevices) return out;
        let all = [];
        try { all = await navigator.mediaDevices.enumerateDevices(); } catch { return out; }
        for (const d of all) {
            if (d.kind === 'videoinput') out.cams.push({ id: d.deviceId, label: d.label || `Camera ${out.cams.length + 1}` });
            else if (d.kind === 'audioinput') out.mics.push({ id: d.deviceId, label: d.label || `Microphone ${out.mics.length + 1}` });
            else if (d.kind === 'audiooutput') out.speakers.push({ id: d.deviceId, label: d.label || `Speakers ${out.speakers.length + 1}` });
        }
        return out;
    }

    /** Fill a <select> with a device list (textContent only). Selects `selectedId` when it is in the list. */
    function fillSelect(select, list, selectedId) {
        if (!select) return;
        select.textContent = '';
        for (const d of list) {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = d.label;
            select.appendChild(opt);
        }
        if (selectedId && list.some(d => d.id === selectedId)) select.value = selectedId;
        select.disabled = list.length === 0;
        if (list.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = t('Not found');
            select.appendChild(opt);
        }
    }

    /** The device id a live track is using, to preselect it in the lists. */
    function trackDeviceId(stream, kind) {
        const t = kind === 'audio' ? stream?.getAudioTracks()[0] : stream?.getVideoTracks()[0];
        return t?.getSettings?.().deviceId || null;
    }

    /** Plain-words text for a getUserMedia error. */
    function errorText(err) {
        switch (err && err.name) {
            case 'NotAllowedError':
            case 'SecurityError':
                return t('Camera and microphone are blocked. Click the lock or camera icon in the address bar, allow them, then reload the page. You can still join to listen and chat.');
            case 'NotFoundError':
            case 'OverconstrainedError':
                return t('No camera or microphone was found. You can still join to listen and chat.');
            case 'NotReadableError':
            case 'AbortError':
                return t('The camera or microphone is used by another app. Close that app and choose the device again, or join without it.');
            case 'NotSupportedError':
                return t('This browser cannot use a camera or microphone here. You can still join to listen and chat.');
            default:
                return err ? t('The camera or microphone could not be started. You can still join to listen and chat.') : '';
        }
    }

    /**
     * Microphone level bar. `barEl` gets its width set from the loudness (0..100%).
     * @returns {{ stop: () => void, resume: () => void }}
     */
    function createLevelMeter(stream, barEl) {
        const noop = { stop() {}, resume() {} };
        if (!barEl || !stream || stream.getAudioTracks().length === 0) return noop;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return noop;
        let ctx, raf = 0, stopped = false;
        try {
            ctx = new Ctx();
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            source.connect(analyser);
            const data = new Uint8Array(analyser.fftSize);
            const tick = () => {
                if (stopped) return;
                analyser.getByteTimeDomainData(data);
                let peak = 0;
                for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128));
                // 0..128 -> a bar that reacts to normal speech
                barEl.style.width = `${Math.min(100, Math.round((peak / 128) * 160))}%`;
                raf = requestAnimationFrame(tick);
            };
            tick();
        } catch { return noop; }
        return {
            stop() {
                stopped = true;
                cancelAnimationFrame(raf);
                try { ctx.close(); } catch { /* already closed */ }
                barEl.style.width = '0%';
            },
            resume() { try { if (ctx.state === 'suspended') ctx.resume(); } catch { /* ignore */ } }
        };
    }

    function onChange(cb) {
        try { navigator.mediaDevices?.addEventListener('devicechange', cb); } catch { /* old browser */ }
    }

    /** Send the sound of a media element to the chosen speakers; a failure is not fatal. */
    async function setSpeaker(el, id) {
        if (!speakerSupported || !id || typeof el.setSinkId !== 'function') return true;
        try { await el.setSinkId(id); return true; } catch { return false; }
    }

    window.Devices = {
        loadChoice, saveChoice, speakerSupported, getStream, getTrack, listDevices,
        fillSelect, trackDeviceId, errorText, createLevelMeter, onChange, setSpeaker
    };
})();
