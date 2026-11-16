/**
 * Local recording. The file is made in this browser, from what this browser shows and hears, and is saved on
 * this device: nothing here talks to any server (no fetch, no upload). The room is told by the caller through
 * the socket so that everybody sees the REC mark; this module knows nothing about the room.
 *
 * Picture: the live <video> elements are painted on one canvas (a screen share is the large area, cameras are
 * a strip; otherwise a grid). Sound: every audio stream is mixed with WebAudio into one destination that is
 * never connected to the speakers (no echo). Saving: to a file picked by the person as the recording goes
 * (File System Access API, memory stays flat) or, where that does not exist, in memory and downloaded at the end.
 */
(function () {
    'use strict';

    const W = 1280, H = 720, FPS = 25, CHUNK_MS = 4000, GAP = 8;
    const MEMORY_WARN_MS = 30 * 60 * 1000;
    const BG = '#0b0f17', CARD = '#161c28', TEXT = '#e8ecf3';
    const MIMES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];

    /** Where each tile goes. Pure, so it can be tested without a browser. */
    function layout(count, hasScreen, w = W, h = H) {
        const out = { screen: null, tiles: [] };
        if (hasScreen) {
            const stripH = count > 0 ? Math.round(h * 0.2) : 0;
            out.screen = { x: 0, y: 0, w, h: h - stripH - (stripH ? GAP : 0) };
            if (count > 0) {
                const cw = Math.min(Math.round(stripH * 16 / 9), Math.floor((w - GAP * (count - 1)) / count));
                const total = cw * count + GAP * (count - 1);
                const x0 = Math.round((w - total) / 2);
                for (let i = 0; i < count; i++) out.tiles.push({ x: x0 + i * (cw + GAP), y: h - stripH, w: cw, h: stripH });
            }
            return out;
        }
        if (count === 0) return out;
        const cols = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count / cols);
        const cw = Math.floor((w - GAP * (cols - 1)) / cols), ch = Math.floor((h - GAP * (rows - 1)) / rows);
        for (let i = 0; i < count; i++) {
            const r = Math.floor(i / cols), c = i % cols;
            const inRow = r === rows - 1 ? count - r * cols : cols;        // the last row is centred
            const rowW = inRow * cw + GAP * (inRow - 1);
            const x0 = Math.round((w - rowW) / 2);
            out.tiles.push({ x: x0 + c * (cw + GAP), y: r * (ch + GAP), w: cw, h: ch });
        }
        return out;
    }

    function pickMime() {
        if (typeof MediaRecorder === 'undefined') return null;
        return MIMES.find(t => MediaRecorder.isTypeSupported(t)) || null;
    }

    function supported() {
        return typeof window !== 'undefined' && !!pickMime() &&
            !!HTMLCanvasElement.prototype.captureStream && !!(window.AudioContext || window.webkitAudioContext);
    }

    let st = null;   // the one running recording
    let lastEmpty = true;   // the recording that ended last wrote nothing

    const trackIdsOf = (stream) => stream.getAudioTracks().map(t => t.id).sort().join(',');

    function drawFit(ctx, video, r) {
        const vw = video.videoWidth, vh = video.videoHeight;
        const k = Math.min(r.w / vw, r.h / vh);
        const dw = Math.round(vw * k), dh = Math.round(vh * k);
        ctx.drawImage(video, r.x + Math.round((r.w - dw) / 2), r.y + Math.round((r.h - dh) / 2), dw, dh);
    }

    function drawTile(ctx, item, r) {
        ctx.fillStyle = CARD;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        const v = item.el;
        const live = !item.camOff && v && v.readyState >= 2 && v.videoWidth > 0;
        const size = Math.max(14, Math.round(r.h * 0.07));
        ctx.font = `600 ${size}px sans-serif`;
        ctx.textBaseline = 'middle';
        if (live) {
            try { drawFit(ctx, v, r); } catch { /* a frame that cannot be read is skipped */ }
        } else {
            ctx.fillStyle = TEXT;
            ctx.textAlign = 'center';
            ctx.fillText(item.name, r.x + r.w / 2, r.y + r.h / 2, r.w - 16);
        }
        // the name, as text on the canvas (never HTML)
        ctx.textAlign = 'left';
        const label = item.name;
        const tw = Math.min(ctx.measureText(label).width, r.w - 24);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(r.x + 8, r.y + r.h - size - 16, tw + 16, size + 10);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, r.x + 16, r.y + r.h - size / 2 - 11, r.w - 24);
    }

    function paint() {
        const { ctx } = st;
        const items = st.getSources().videos;
        const screen = items.find(i => i.screen);
        const cams = items.filter(i => !i.screen);
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, W, H);
        const L = layout(cams.length, !!screen);
        if (screen && L.screen) drawTile(ctx, screen, L.screen);
        cams.forEach((c, i) => drawTile(ctx, c, L.tiles[i]));
    }

    // Keep the mixer in step with the room: people who join or leave, a switched microphone
    function syncAudio() {
        const wanted = new Set(st.getSources().audioStreams.filter(s => s && s.getAudioTracks().length));
        for (const [stream, e] of Array.from(st.nodes)) {
            if (!wanted.has(stream) || e.ids !== trackIdsOf(stream)) {
                try { e.node.disconnect(); } catch { /* gone */ }
                st.nodes.delete(stream);
            }
        }
        for (const stream of wanted) {
            if (st.nodes.has(stream)) continue;
            try {
                const node = st.audioCtx.createMediaStreamSource(stream);
                node.connect(st.dest);           // the mixer only: not the speakers
                st.nodes.set(stream, { node, ids: trackIdsOf(stream) });
            } catch { /* a stream without a usable track is tried again on the next tick */ }
        }
    }

    function fileName(label, mime) {
        const d = new Date(), p = (n) => String(n).padStart(2, '0');
        const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
        const safe = String(label || 'room').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'room';
        return `meetify-${safe}-${stamp}.${mime.startsWith('video/mp4') ? 'mp4' : 'webm'}`;
    }

    /**
     * Start recording. Resolves true when it runs, false when the person cancelled the file dialog.
     * Rejects when the browser cannot record. opts: { getSources, label, onStop(reason), onMemoryWarning }.
     * getSources() -> { videos: [{ el, name, screen, camOff }], audioStreams: [MediaStream] }
     */
    async function start(opts) {
        if (st) return true;
        const mime = pickMime();
        if (!supported()) throw new Error('Recording is not supported in this browser');
        const name = fileName(opts.label, mime);

        // The file dialog first: it needs the click that started us, and "cancel" must start nothing.
        let writable = null;
        if (typeof window.showSaveFilePicker === 'function') {
            try {
                const base = mime.split(';')[0];
                const handle = await window.showSaveFilePicker({
                    suggestedName: name,
                    types: [{ description: 'Video', accept: { [base]: [name.slice(name.lastIndexOf('.'))] } }]
                });
                writable = await handle.createWritable();
            } catch (err) {
                if (err && err.name === 'AbortError') return false;
                writable = null;   // the dialog is not usable here: fall back to memory
            }
        }

        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d', { alpha: false });
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new Ctx();
        if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});   // the file dialog may have used up the click
        const dest = audioCtx.createMediaStreamDestination();

        st = {
            getSources: opts.getSources, onStop: opts.onStop, onMemoryWarning: opts.onMemoryWarning,
            mime, name, writable, queue: Promise.resolve(), chunks: [], failed: null, stopping: null,
            canvas, ctx, audioCtx, dest, nodes: new Map(), startedAt: Date.now(), warned: false, timers: [], bytes: 0
        };

        syncAudio();
        paint();
        const vstream = canvas.captureStream(FPS);
        st.vstream = vstream;
        const stream = new MediaStream([...vstream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
        let mr;
        try {
            mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 });
        } catch (err) {
            teardown();
            try { await writable?.abort?.(); } catch { /* ignore */ }
            throw err;
        }
        st.mr = mr;
        mr.ondataavailable = (e) => {
            if (!e.data || !e.data.size) return;
            const cur = st;
            if (!cur) return;
            // a write that fails (disk full, file removed) ends the recording: better a short file than a silent loss
            if (cur.writable) cur.queue = cur.queue.then(() => cur.writable.write(e.data)).catch(err => { if (!cur.failed) { cur.failed = err; if (st === cur) stop('error'); } });
            else cur.chunks.push(e.data);
            cur.bytes += e.data.size;
        };
        mr.onerror = () => { stop('error'); };
        mr.onstop = () => { finish(); };
        mr.start(CHUNK_MS);

        st.timers.push(setInterval(paint, 1000 / FPS));
        st.timers.push(setInterval(() => {
            syncAudio();
            if (!st.writable && !st.warned && Date.now() - st.startedAt > MEMORY_WARN_MS) {
                st.warned = true;
                if (st.onMemoryWarning) st.onMemoryWarning();
            }
        }, 2000));
        return true;
    }

    function teardown() {
        if (!st) return;
        st.timers.forEach(clearInterval);
        for (const e of st.nodes.values()) { try { e.node.disconnect(); } catch { /* gone */ } }
        try { st.audioCtx.close(); } catch { /* ignore */ }
        try { st.vstream?.getTracks().forEach(t => t.stop()); } catch { /* ignore */ }
    }

    async function finish() {
        const cur = st;
        if (!cur || cur.finishing) return;
        cur.finishing = true;
        teardown();
        await cur.queue;
        let saved = true;
        if (cur.discard) {
            try { await cur.writable?.abort?.(); } catch { /* ignore */ }
        } else if (cur.writable) {
            try { await cur.writable.close(); } catch { saved = false; }
        } else if (cur.chunks.length) {
            const url = URL.createObjectURL(new Blob(cur.chunks, { type: cur.mime.split(';')[0] }));
            const a = document.createElement('a');
            a.href = url; a.download = cur.name;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        }
        st = null;
        lastEmpty = cur.bytes === 0 || !!cur.discard;
        if (cur.onStop) cur.onStop(cur.stopReason || 'stop', saved && !cur.failed);
        if (cur.stopping) cur.stopping();
    }

    /** Stop and save what there is. Resolves when the file is written. */
    function stop(reason = 'stop', { discard = false } = {}) {
        if (!st) return Promise.resolve();
        if (st.stopPromise) return st.stopPromise;
        st.stopReason = reason;
        st.discard = discard;
        st.stopPromise = new Promise((resolve) => { st.stopping = resolve; });
        const p = st.stopPromise;
        try {
            if (st.mr.state !== 'inactive') st.mr.stop();
            else finish();
        } catch { finish(); }
        return p;
    }

    const api = {
        supported,
        start,
        stop,
        isRecording: () => !!st,
        elapsed: () => (st ? Date.now() - st.startedAt : 0),
        usesDisk: () => !!(st && st.writable),
        lastEmpty: () => lastEmpty,
        _layout: layout
    };
    if (typeof window !== 'undefined') window.Recorder = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
}());
