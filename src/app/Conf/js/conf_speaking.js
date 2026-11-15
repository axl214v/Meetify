/**
 * Active speaker highlight. For every watched stream a level meter (AnalyserNode) runs; the tile of
 * someone who is talking gets the class "speaking". Client only: no socket events, nothing is sent.
 * The analysers are never connected to the speakers, so this adds no sound and no echo.
 */
(function () {
    'use strict';

    const TICK_MS = 50;            // each reading looks at a window of about 20 ms, so read often
    const RMS_THRESHOLD = 0.012;   // speech is well above this, a quiet room well below
    const ON_AFTER_MS = 100;       // loud for this long (gaps shorter than GAP_MS between syllables count): speaking
    const GAP_MS = 150;            // a pause shorter than this does not restart the count
    const OFF_AFTER_MS = 600;      // quiet for this long: not speaking

    let ctx = null;
    let timer = null;
    const entries = new Map();     // key -> { stream, tile, trackIds, source, analyser, buf, above, below, speaking }

    const trackIdsOf = (stream) => stream.getAudioTracks().map(t => t.id).sort().join(',');

    function context() {
        if (ctx) return ctx;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        try { ctx = new Ctx(); } catch { ctx = null; }
        return ctx;
    }

    function connect(entry) {
        try { entry.source?.disconnect(); } catch { /* already gone */ }
        entry.source = null;
        entry.analyser = null;
        entry.trackIds = trackIdsOf(entry.stream);
        const c = context();
        if (!c || !entry.trackIds) return;   // no audio (yet): checked again on the next tick
        try {
            entry.source = c.createMediaStreamSource(entry.stream);
            entry.analyser = c.createAnalyser();
            entry.analyser.fftSize = 1024;
            entry.buf = new Float32Array(entry.analyser.fftSize);
            entry.source.connect(entry.analyser);   // analyser only: NOT connected to ctx.destination
        } catch { entry.source = null; entry.analyser = null; }
    }

    function drop(key) {
        const e = entries.get(key);
        if (!e) return;
        try { e.source?.disconnect(); } catch { /* ignore */ }
        e.tile?.classList.remove('speaking');
        entries.delete(key);
        if (entries.size === 0 && timer) { clearInterval(timer); timer = null; }
    }

    function tick() {
        if (document.hidden) return;
        if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch { /* needs a gesture */ } }
        for (const [key, e] of entries) {
            if (!e.tile || !document.contains(e.tile)) { drop(key); continue; }
            // a track arrived later (Group call) or was replaced (device switch): listen to the new one
            if (trackIdsOf(e.stream) !== e.trackIds) connect(e);
            let loud = false;
            if (e.analyser) {
                e.analyser.getFloatTimeDomainData(e.buf);
                let sum = 0;
                for (let i = 0; i < e.buf.length; i++) sum += e.buf[i] * e.buf[i];
                loud = Math.sqrt(sum / e.buf.length) > RMS_THRESHOLD;
            }
            if (loud) { e.above += TICK_MS; e.below = 0; }
            else { e.below += TICK_MS; if (e.below > GAP_MS) e.above = 0; }
            if (!e.speaking && e.above >= ON_AFTER_MS) { e.speaking = true; e.tile.classList.add('speaking'); }
            else if (e.speaking && e.below >= OFF_AFTER_MS) { e.speaking = false; e.tile.classList.remove('speaking'); }
        }
    }

    /** Start (or refresh) watching a stream; `tile` is the element that gets the class. Safe to call again. */
    function watch(key, stream, tile) {
        if (!stream || !tile) return;
        key = String(key);
        const old = entries.get(key);
        if (old && old.stream === stream) { old.tile = tile; if (old.speaking) tile.classList.add('speaking'); return; }
        if (old) drop(key);
        const e = { stream, tile, trackIds: '', source: null, analyser: null, buf: null, above: 0, below: 0, speaking: false };
        entries.set(key, e);
        connect(e);
        if (!timer) timer = setInterval(tick, TICK_MS);
    }

    function stopAll() {
        for (const key of Array.from(entries.keys())) drop(key);
        if (timer) { clearInterval(timer); timer = null; }
        if (ctx) { try { ctx.close(); } catch { /* ignore */ } ctx = null; }
    }

    // for tests and debugging only
    function debug() {
        return { state: ctx && ctx.state, entries: Array.from(entries, ([key, e]) => {
            let rms = null;
            if (e.analyser) { e.analyser.getFloatTimeDomainData(e.buf); let sum = 0; for (let i = 0; i < e.buf.length; i++) sum += e.buf[i] * e.buf[i]; rms = Math.sqrt(sum / e.buf.length); }
            return { key, tracks: e.trackIds, hasAnalyser: !!e.analyser, rms, speaking: e.speaking, above: e.above, below: e.below };
        }) };
    }

    window.Speaking = { watch, unwatch: (key) => drop(String(key)), stopAll, _count: () => entries.size, _debug: debug };
})();
