// make-manifest.js and verify-live.js: same bytes on every run, the right files in the list, and a
// live check that names exactly the file that was changed. Runs on a throwaway folder, no git, no network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const { isExcluded, buildManifest, serialize, walk } = require('../tools/make-manifest');
const { verify } = require('../tools/verify-live');

const FIXED = { version: '9.9.9-test', commit: 'a'.repeat(40), committedAt: '2026-01-01T00:00:00+00:00' };

function makeTree() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meetify-manifest-'));
    const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
    put('index.html', '<h1>hi</h1>');
    put('js/app.js', 'console.log(1)');
    put('styles/a.css', 'body{}');
    put('admin/admin.js', 'secret panel');
    // none of these are served
    put('Dockerfile', 'FROM x'); put('nginx.conf', 'server {}'); put('nginx.prod.conf', 'server {}');
    put('.dockerignore', 'x'); put('readme.md', '# x'); put('package.json', '{}'); put('js/package-lock.json', '{}');
    put('js/node_modules/pkg/index.js', 'x'); put('assets/logo_small.png', 'png'); put('verify/manifest.json', '{}'); put('.DS_Store', 'x');
    return dir;
}
const manifestOf = (dir) => buildManifest({ appDir: dir, files: walk(dir), ...FIXED });

test('the manifest lists exactly the served files and nothing else', () => {
    const dir = makeTree();
    const paths = manifestOf(dir).files.map(f => f.path);
    assert.deepEqual(paths, ['admin/admin.js', 'index.html', 'js/app.js', 'styles/a.css']);
    for (const bad of ['Dockerfile', 'nginx.conf', 'nginx.prod.conf', '.dockerignore', 'readme.md', 'package.json', 'js/package-lock.json',
        'js/node_modules/pkg/index.js', 'assets/logo_small.png', 'verify/manifest.json', '.DS_Store']) {
        assert.equal(isExcluded(bad), true, bad);
    }
    assert.equal(isExcluded('js/theme.js'), false);
    assert.equal(isExcluded('.well-known/security.txt'), false);
});

test('two runs give the same bytes, with no clock inside', () => {
    const dir = makeTree();
    assert.equal(serialize(manifestOf(dir)), serialize(manifestOf(dir)));
    assert.ok(!/generatedAt/.test(serialize(manifestOf(dir))));
});

test('admin files are marked and public ones are not', () => {
    const m = manifestOf(makeTree());
    assert.equal(m.files.find(f => f.path === 'admin/admin.js').access, 'admin');
    assert.equal(m.files.find(f => f.path === 'index.html').access, 'public');
});

test('--check passes on a fresh manifest and fails when one file changes', () => {
    const dir = makeTree();
    const out = path.join(dir, 'verify', 'manifest.json');
    const tool = path.join(__dirname, '..', 'tools', 'make-manifest.js');
    const base = ['--app', dir, '--walk', '--out', out, '--version', FIXED.version, '--commit', FIXED.commit, '--committed-at', FIXED.committedAt];
    execFileSync('node', [tool, ...base]);
    execFileSync('node', [tool, ...base, '--check']);                       // exit 0
    fs.appendFileSync(path.join(dir, 'js/app.js'), '\n// changed');
    assert.throws(() => execFileSync('node', [tool, ...base, '--check'], { stdio: 'pipe' }), (e) => /changed since the manifest: js\/app\.js/.test(String(e.stderr)));
});

async function serve(dir, { hide = [] } = {}) {
    const server = http.createServer((req, res) => {
        const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html';
        const file = path.join(dir, rel);
        if (hide.includes(rel) || !file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('no'); }
        res.end(fs.readFileSync(file));
    });
    await new Promise(r => server.listen(0, r));
    return { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(r => server.close(r)) };
}

test('verify-live: all match, then exactly the changed or missing file is named, admin files are skipped', async () => {
    const dir = makeTree();
    const m = manifestOf(dir);

    let s = await serve(dir);
    let r = await verify(s.base, m);
    await s.close();
    assert.deepEqual(r.problems, []);
    assert.equal(r.checked, 3);
    assert.equal(r.skipped, 1);

    fs.appendFileSync(path.join(dir, 'styles/a.css'), ' ');                 // one byte more
    s = await serve(dir);
    r = await verify(s.base, m);
    await s.close();
    assert.deepEqual(r.problems.map(p => [p.path, p.kind]), [['styles/a.css', 'differs']]);

    s = await serve(dir, { hide: ['js/app.js'] });
    r = await verify(s.base, m);
    await s.close();
    assert.deepEqual(r.problems.map(p => [p.path, p.kind]).sort(), [['js/app.js', 'status'], ['styles/a.css', 'differs']]);
});
