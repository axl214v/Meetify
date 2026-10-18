// Connection security panel: opens from the P2P / Group and Live badges in the room header.
// Everything shown is read from the live WebRTC connections (SDP fingerprints and getStats), nothing is invented.
// Security code = SHA-256 over the two DTLS certificate fingerprints of a connection. Both ends compute the
// same code, so reading it aloud proves that nobody swapped a certificate in between (like Signal's safety number).
(function () {
    const panel = document.getElementById('secPanel');
    const rowsEl = document.getElementById('secRows');
    const factsEl = document.getElementById('secFacts');
    const dot = document.getElementById('secDot');
    const headline = document.getElementById('secHeadline');
    const detail = document.getElementById('secDetail');
    const note = document.getElementById('secNote');
    const liveBadge = document.getElementById('liveBadge');
    let timer = null;

    const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function fingerprintOf(sdp) {
        const m = /a=fingerprint:(\S+)\s+([0-9A-Fa-f:]+)/.exec(sdp || '');
        return m ? m[2].replace(/:/g, '').toLowerCase() : null;
    }

    async function securityCode(...fps) {
        const data = new TextEncoder().encode(fps.filter(Boolean).map(f => f.toLowerCase()).sort().join('|'));
        const hash = await crypto.subtle.digest('SHA-256', data);
        const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        return hex.slice(0, 12).toUpperCase().replace(/(.{4})(?=.)/g, '$1 ');
    }

    async function transportInfo(source) {
        try {
            const stats = await source.getStats();
            const byId = {};
            stats.forEach(r => { byId[r.id] = r; });
            let transport = null;
            stats.forEach(r => { if (r.type === 'transport' && (!transport || r.selectedCandidatePairId)) transport = r; });
            let pair = transport && byId[transport.selectedCandidatePairId];
            if (!pair) stats.forEach(r => { if (r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded') pair = r; });
            const local = pair && byId[pair.localCandidateId];
            const remote = pair && byId[pair.remoteCandidateId];
            const relayed = [local, remote].some(c => c && c.candidateType === 'relay');
            return {
                dtls: transport?.dtlsState || null,
                cipher: transport?.dtlsCipher || null,
                srtp: transport?.srtpCipher || null,
                path: pair ? (relayed ? 'Relayed (TURN)' : 'Direct') : null
            };
        } catch { return {}; }
    }

    function peerName(userId) {
        return document.querySelector(`#video-${CSS.escape(String(userId))} .participant-name`)?.textContent?.trim() || `User ${userId}`;
    }

    async function render() {
        const isSfu = conferenceMode === 'sfu';
        const rows = [];
        const facts = [];
        let ok = true;
        let waiting = false;

        if (isSfu) {
            const state = sfuSendTransport?.connectionState || 'new';
            ok = state === 'connected';
            const fp = sfuServerFingerprints?.find(f => /sha-256/i.test(f.algorithm))?.value?.replace(/:/g, '');
            if (fp) rows.push({ title: 'Media server', sub: 'Certificate code, the same for everyone in the room', code: await securityCode(fp) });
            const info = sfuSendTransport ? await transportInfo(sfuSendTransport) : {};
            if (info.cipher) facts.push(['Key exchange', 'DTLS ' + info.cipher]);
            if (info.srtp) facts.push(['Media cipher', info.srtp]);
            if (info.path) facts.push(['Route', info.path]);
            headline.textContent = ok ? 'Encrypted to the media server' : 'Connecting to the media server…';
            detail.textContent = ok ? 'Audio and video are encrypted on the way to the server (DTLS-SRTP).' : 'Waiting for the secure channel.';
            note.textContent = 'Group calls pass through our media server, which forwards your stream to the others. It is not recorded or stored, but it is not end-to-end encrypted. For that, use a Private (P2P) call. To verify the server, everyone can compare the code above.';
        } else {
            const ids = Object.keys(peers);
            waiting = ids.length === 0;
            const local = [];
            for (const id of ids) {
                const pc = peers[id];
                const connected = pc.connectionState === 'connected';
                if (!connected) ok = false;
                const info = connected ? await transportInfo(pc) : {};
                if (info.dtls && info.dtls !== 'connected') ok = false;
                const mine = fingerprintOf(pc.localDescription?.sdp);
                const theirs = fingerprintOf(pc.remoteDescription?.sdp);
                rows.push({
                    title: peerName(id),
                    sub: connected ? (info.path || 'Connected') : 'Connecting…',
                    code: mine && theirs ? await securityCode(mine, theirs) : null
                });
                if (info.cipher && !facts.length) {
                    facts.push(['Key exchange', 'DTLS ' + info.cipher]);
                    if (info.srtp) facts.push(['Media cipher', info.srtp]);
                }
            }
            headline.textContent = waiting ? 'Nothing to protect yet' : ok ? 'Encrypted end to end' : 'Securing the connection…';
            detail.textContent = waiting
                ? 'Audio and video go straight between participants. Nobody else is here yet.'
                : ok ? 'Audio and video go straight between participants and are encrypted (DTLS-SRTP). Our server never sees them.'
                     : 'Some connections are still being established.';
            note.textContent = 'To verify a person, read your code to each other. If both codes match, nobody tampered with the connection. Each pair has its own code.';
        }

        dot.className = 'sec-dot' + (ok && !waiting ? '' : ' warn');
        rowsEl.innerHTML = rows.map((r, i) => `<div class="sec-row"><div><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></div>${
            r.code ? `<button type="button" class="sec-code" data-i="${i}" title="Copy code">${esc(r.code)}</button>` : ''}</div>`).join('');
        rowsEl.querySelectorAll('.sec-code').forEach(b => b.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(b.textContent); showNotification('Code copied', 'success'); } catch {}
        }));
        factsEl.innerHTML = facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
    }

    function open() {
        panel.classList.add('open');
        render();
        timer = setInterval(render, 2000);
    }
    function close() {
        panel.classList.remove('open');
        clearInterval(timer);
    }

    ['modeBadge', 'liveBadge'].forEach(id => document.getElementById(id).addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.contains('open') ? close() : open();
    }));
    document.getElementById('secClose').addEventListener('click', close);
    document.addEventListener('click', (e) => { if (!panel.contains(e.target)) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    // Live badge follows the real connection state
    function updateLive() {
        let busy;
        if (conferenceMode === 'sfu') {
            busy = !!sfuSendTransport && sfuSendTransport.connectionState !== 'connected';
        } else {
            busy = Object.values(peers).some(pc => pc.connectionState !== 'connected');
        }
        liveBadge.textContent = busy ? 'Connecting' : 'Live';
        liveBadge.className = 'rbadge ' + (busy ? 'rbadge-warning' : 'rbadge-success');
    }
    setInterval(updateLive, 1500);
})();
