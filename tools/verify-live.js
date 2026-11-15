#!/usr/bin/env node
/**
 * Compare a running site with the published manifest, without trusting the site's own /verify/ page.
 *
 *   node tools/verify-live.js https://meetify.cc [--manifest path/to/manifest.json]
 *
 * Exit code: 0 = every public file matches, 1 = something differs or is missing, 2 = could not check.
 * Files under /admin/ are behind a login and are skipped (their hashes are still in the manifest).
 * Needs Node 18 or newer. No dependencies.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function parse(argv) {
    const o = { base: null, manifest: path.resolve(__dirname, '../src/app/verify/manifest.json') };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--manifest') o.manifest = path.resolve(argv[++i]);
        else if (!o.base) o.base = argv[i].replace(/\/+$/, '');
        else throw new Error(`Unexpected argument: ${argv[i]}`);
    }
    return o;
}

async function verify(base, manifest, { concurrency = 6, log = () => {} } = {}) {
    const files = manifest.files.filter(f => f.access === 'public');
    const skipped = manifest.files.length - files.length;
    const problems = [];
    let next = 0;
    async function worker() {
        while (next < files.length) {
            const f = files[next++];
            let res;
            try { res = await fetch(`${base}/${f.path.split('/').map(encodeURIComponent).join('/')}`, { cache: 'no-store', redirect: 'manual' }); }
            catch (e) { problems.push({ path: f.path, kind: 'error', detail: String(e.message || e) }); continue; }
            if (res.status !== 200) { problems.push({ path: f.path, kind: 'status', detail: `HTTP ${res.status}` }); continue; }
            const buf = Buffer.from(await res.arrayBuffer());
            const got = crypto.createHash('sha256').update(buf).digest('hex');
            if (got !== f.sha256) {
                problems.push({ path: f.path, kind: 'differs', detail: `expected ${f.sha256.slice(0, 12)} (${f.size} bytes), served ${got.slice(0, 12)} (${buf.length} bytes)` });
            } else log(`ok  ${f.path}`);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
    problems.sort((a, b) => (a.path < b.path ? -1 : 1));
    return { checked: files.length, skipped, problems };
}

async function main() {
    let o;
    try { o = parse(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(2); }
    if (!o.base) { console.error('Usage: node tools/verify-live.js <site-url> [--manifest file]'); process.exit(2); }
    let manifest;
    try { manifest = JSON.parse(fs.readFileSync(o.manifest, 'utf8')); }
    catch (e) { console.error(`Cannot read the manifest ${o.manifest}: ${e.message}`); process.exit(2); }

    const { checked, skipped, problems } = await verify(o.base, manifest);
    const network = problems.filter(p => p.kind === 'error');
    for (const p of problems) console.log(`${p.kind === 'differs' ? 'DIFFERS' : p.kind === 'status' ? 'MISSING' : 'ERROR  '} ${p.path}: ${p.detail}`);
    console.log(`\nChecked ${checked} files against release ${manifest.version} (commit ${String(manifest.commit).slice(0, 7)}); ${skipped} admin files skipped.`);
    if (problems.length === 0) { console.log('All files match.'); process.exit(0); }
    console.log(`${problems.length} problem${problems.length === 1 ? '' : 's'}.`);
    process.exit(network.length === problems.length ? 2 : 1);
}

if (require.main === module) main();
module.exports = { verify };
