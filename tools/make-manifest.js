#!/usr/bin/env node
/**
 * Writes src/app/verify/manifest.json: the SHA-256 of every frontend file the site serves,
 * with the version and the commit. The page /verify/ and tools/verify-live.js compare the
 * live site against it.
 *
 *   node tools/make-manifest.js            write the manifest
 *   node tools/make-manifest.js --check    fail (exit 1) if the committed manifest is out of date
 *   --app <dir>   the frontend folder (default: src/app)      --out <file>  where to write
 *   --walk        list files by walking the folder instead of `git ls-files` (tests)
 *   --version <v> --commit <hash> --committed-at <iso>   override (tests)
 *
 * No wall-clock time is written, so the same commit always gives the same bytes.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const MANIFEST_REL = 'verify/manifest.json';

// What the image does NOT serve. Keep in sync with src/app/.dockerignore and src/app/Dockerfile
// (which removes nginx.conf and Dockerfile). tests/manifest.test.js and the check against the running
// container (docs: Verify the frontend) catch a drift.
function isExcluded(rel) {
    const parts = rel.split('/');
    const base = parts[parts.length - 1];
    if (rel === MANIFEST_REL) return true;                              // the manifest does not list itself
    if (parts.some(p => p === 'node_modules' || p === '.git')) return true;
    if (base.startsWith('.')) return true;                              // .dockerignore, .DS_Store, ...
    if (/\.md$/i.test(base) || /\.log$/i.test(base)) return true;
    if (base === 'Dockerfile' || base === 'package.json' || base === 'package-lock.json') return true;
    if (rel === 'nginx.conf' || rel === 'nginx.prod.conf') return true;
    if (rel === 'assets/logo_small.png') return true;
    return false;
}

const accessOf = (rel) => (rel.startsWith('admin/') ? 'admin' : 'public');   // /admin/ is behind auth_request

function listTracked(appDir) {
    const out = execFileSync('git', ['-C', appDir, 'ls-files', '-z', '--', '.'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return out.split('\0').filter(Boolean);
}

function walk(dir, base = dir, acc = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.git') walk(full, base, acc); }
        else if (e.isFile()) acc.push(path.relative(base, full).split(path.sep).join('/'));
    }
    return acc;
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function buildManifest({ appDir, files, version, commit, committedAt }) {
    const list = files
        .filter(rel => !isExcluded(rel))
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        .map(rel => {
            const buf = fs.readFileSync(path.join(appDir, rel));
            return { path: rel, sha256: sha256(buf), size: buf.length, access: accessOf(rel) };
        });
    return { schema: 1, version, commit, committedAt, files: list };
}

const serialize = (m) => JSON.stringify(m, null, 2) + '\n';

function git(args) { return execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8' }).trim(); }

function parseArgs(argv) {
    const o = { check: false, walk: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--check') o.check = true;
        else if (a === '--walk') o.walk = true;
        else if (['--app', '--out', '--version', '--commit', '--committed-at'].includes(a)) o[a.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = argv[++i];
        else throw new Error(`Unknown argument: ${a}`);
    }
    return o;
}

function main() {
    const o = parseArgs(process.argv.slice(2));
    const appDir = path.resolve(o.app || path.join(REPO, 'src/app'));
    const outFile = path.resolve(o.out || path.join(appDir, MANIFEST_REL));
    const version = o.version || fs.readFileSync(path.join(REPO, 'version.txt'), 'utf8').trim();
    const commit = o.commit || git(['rev-parse', 'HEAD']);
    const committedAt = o.committedAt || git(['log', '-1', '--format=%cI', 'HEAD']);
    const files = o.walk ? walk(appDir) : listTracked(appDir);

    const manifest = buildManifest({ appDir, files, version, commit, committedAt });
    const text = serialize(manifest);

    if (o.check) {
        let current;
        try { current = JSON.parse(fs.readFileSync(outFile, 'utf8')); }
        catch { console.error(`No readable manifest at ${outFile}. Run: node tools/make-manifest.js`); process.exit(1); }
        // the commit moves with every commit; what must match is the content of the files
        const have = new Map(current.files.map(f => [f.path, f]));
        const want = new Map(manifest.files.map(f => [f.path, f]));
        const problems = [];
        for (const [p, f] of want) {
            if (!have.has(p)) problems.push(`not in the manifest: ${p}`);
            else if (have.get(p).sha256 !== f.sha256) problems.push(`changed since the manifest: ${p}`);
        }
        for (const p of have.keys()) if (!want.has(p)) problems.push(`in the manifest but no longer a served file: ${p}`);
        if (current.version !== version) problems.push(`version in the manifest is ${current.version}, version.txt says ${version}`);
        if (problems.length) { console.error(problems.join('\n')); console.error('\nManifest is out of date. Run: node tools/make-manifest.js'); process.exit(1); }
        console.log(`Manifest is current: ${manifest.files.length} files, version ${version}.`);
        return;
    }

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, text);
    const pub = manifest.files.filter(f => f.access === 'public').length;
    console.log(`Wrote ${path.relative(process.cwd(), outFile)}: ${manifest.files.length} files (${pub} public), version ${version}, commit ${commit.slice(0, 7)}.`);
    console.log(`Manifest SHA-256: ${sha256(Buffer.from(text))}`);
}

if (require.main === module) main();
module.exports = { isExcluded, accessOf, buildManifest, serialize, walk, sha256 };
