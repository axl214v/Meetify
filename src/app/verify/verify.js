// /verify/: download the manifest and every public frontend file from this origin, hash them
// in the browser and compare. Only our own origin is contacted (see the CSP).
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const card = $('vCard');
    const REPO_COMMIT_URL = 'https://github.com/axl214v/meetify/commit/';
    const CONCURRENCY = 6;

    const hex = (buf) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    const sha256 = async (buf) => hex(await crypto.subtle.digest('SHA-256', buf));
    const fmtSize = (n) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);
    const urlOf = (p) => '/' + p.split('/').map(encodeURIComponent).join('/');

    function setState(state, headline) {
        card.dataset.state = state;
        card.setAttribute('aria-busy', state === 'loading' || state === 'checking' ? 'true' : 'false');
        $('vHeadline').textContent = headline;
    }

    function setDetail(manifest, manifestHash) {
        const d = $('vDetail');
        d.textContent = '';
        const add = (label, node) => {
            const line = document.createElement('div');
            line.appendChild(document.createTextNode(label + ' '));
            line.appendChild(node);
            d.appendChild(line);
        };
        const code = (t) => { const c = document.createElement('code'); c.textContent = t; return c; };
        add('Release', code(manifest.version));
        const link = document.createElement('a');
        link.href = REPO_COMMIT_URL + encodeURIComponent(manifest.commit);
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = String(manifest.commit).slice(0, 12);
        add('Commit', link);
        add('Manifest SHA-256', code(manifestHash));
    }

    function showProblems(problems) {
        const ul = $('vProblems');
        ul.textContent = '';
        for (const p of problems) {
            const li = document.createElement('li');
            const name = document.createElement('strong');
            name.textContent = p.path;
            li.appendChild(name);
            li.appendChild(document.createTextNode(' — ' + p.detail));
            ul.appendChild(li);
        }
        ul.hidden = problems.length === 0;
    }

    function showRows(files, results) {
        const body = $('vRows');
        body.textContent = '';
        for (const f of files) {
            const tr = document.createElement('tr');
            const td1 = document.createElement('td'); td1.textContent = f.path;
            const td2 = document.createElement('td'); td2.textContent = fmtSize(f.size);
            const td3 = document.createElement('td');
            const r = results.get(f.path);
            td3.textContent = r && r.ok ? 'matches' : 'differs';
            td3.className = r && r.ok ? 'r-ok' : 'r-bad';
            tr.append(td1, td2, td3);
            body.appendChild(tr);
        }
        $('vAllSummary').textContent = `All ${files.length} files`;
        $('vAll').hidden = false;
    }

    async function run() {
        $('vRun').hidden = true;
        $('vProblems').hidden = true;
        $('vAll').hidden = true;
        $('vAdminNote').hidden = true;
        $('vBar').hidden = true;
        $('vDetail').textContent = '';
        setState('loading', 'Loading the list of files…');

        let manifest, manifestHash;
        try {
            const res = await fetch('/verify/manifest.json', { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const raw = await res.arrayBuffer();
            manifestHash = await sha256(raw);
            manifest = JSON.parse(new TextDecoder().decode(raw));
            if (!manifest || !Array.isArray(manifest.files)) throw new Error('not a manifest');
        } catch (e) {
            setState('error', 'The list of files could not be loaded.');
            $('vDetail').textContent = `Reason: ${e.message}. Check your connection and try again.`;
            $('vRun').hidden = false;
            return;
        }
        if (!(window.crypto && crypto.subtle)) {
            setState('error', 'Your browser cannot compute hashes here.');
            $('vDetail').textContent = 'This page needs a secure connection (https) and a current browser. You can use the script described below instead.';
            return;
        }

        setDetail(manifest, manifestHash);
        const files = manifest.files.filter(f => f.access === 'public');
        const adminCount = manifest.files.length - files.length;
        const results = new Map();
        const problems = [];
        let done = 0, next = 0;
        $('vBar').hidden = false;
        setState('checking', `Checking 0 of ${files.length} files…`);

        async function worker() {
            while (next < files.length) {
                const f = files[next++];
                try {
                    const res = await fetch(urlOf(f.path), { cache: 'no-store', redirect: 'manual' });
                    if (res.status !== 200) {
                        results.set(f.path, { ok: false });
                        problems.push({ path: f.path, detail: `the site answered HTTP ${res.status || 'redirect'} instead of the file` });
                    } else {
                        const buf = await res.arrayBuffer();
                        const got = await sha256(buf);
                        const ok = got === f.sha256;
                        results.set(f.path, { ok });
                        if (!ok) {
                            const sizeNote = buf.byteLength !== f.size
                                ? `size ${buf.byteLength} B, expected ${f.size} B (something may rewrite files on the way)`
                                : 'same size, different content';
                            problems.push({ path: f.path, detail: `${sizeNote}; hash ${got.slice(0, 12)}…, expected ${f.sha256.slice(0, 12)}…` });
                        }
                    }
                } catch (e) {
                    results.set(f.path, { ok: false });
                    problems.push({ path: f.path, detail: `could not be downloaded (${e.message})` });
                }
                done++;
                $('vBarFill').style.width = `${Math.round((done / files.length) * 100)}%`;
                $('vHeadline').textContent = `Checking ${done} of ${files.length} files…`;
            }
        }
        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));
        problems.sort((a, b) => (a.path < b.path ? -1 : 1));

        $('vBar').hidden = true;
        showProblems(problems);
        showRows(files, results);
        if (adminCount > 0) {
            $('vAdminNote').textContent = `${adminCount} files of the admin area are behind a login and are not checked here. Their hashes are in the list.`;
            $('vAdminNote').hidden = false;
        }
        if (problems.length === 0) {
            setState('ok', `All ${files.length} files match release ${manifest.version}.`);
        } else {
            setState('bad', `${problems.length} of ${files.length} files differ from the published list.`);
            $('vAll').open = false;
        }
        $('vRun').hidden = false;
    }

    $('vRun').addEventListener('click', run);
    run();
})();
