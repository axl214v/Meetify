// The web app manifest, the icons, the page heads and the promise that there is no service worker.
// No browser, no network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const APP = path.resolve(__dirname, '..', 'src', 'app');
const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8');

function walk(dir, out = []) {
    for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) { if (name !== 'node_modules') walk(p, out); } else out.push(p);
    }
    return out;
}
const rel = (p) => path.relative(APP, p).split(path.sep).join('/');
const pngSize = (file) => { const b = fs.readFileSync(file); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };

test('the manifest is valid and its icons exist at the sizes they claim', () => {
    const m = JSON.parse(read('manifest.webmanifest'));
    assert.equal(m.name, 'Meetify');
    assert.equal(m.display, 'standalone');
    assert.match(m.start_url, /^\//);
    assert.match(m.theme_color, /^#[0-9a-f]{6}$/i);
    const sizes = new Set();
    for (const icon of m.icons) {
        const file = path.join(APP, icon.src);
        assert.ok(fs.existsSync(file), `${icon.src} exists`);
        const { w, h } = pngSize(file);
        assert.equal(`${w}x${h}`, icon.sizes, `${icon.src} is ${icon.sizes}`);
        sizes.add(`${icon.sizes}:${icon.purpose}`);
    }
    for (const need of ['192x192:any', '512x512:any', '512x512:maskable']) assert.ok(sizes.has(need), `an icon ${need}`);
    const apple = pngSize(path.join(APP, 'assets/icons/apple-touch-icon.png'));
    assert.deepEqual(apple, { w: 180, h: 180 });
});

test('every public page links the manifest, has a theme colour and the apple icon; the admin panel has none', () => {
    const pages = walk(APP).filter(p => p.endsWith('.html')).map(rel);
    assert.ok(pages.length > 15);
    for (const page of pages) {
        const html = read(page);
        if (page.startsWith('admin/')) { assert.ok(!html.includes('rel="manifest"'), `${page} stays out`); continue; }
        assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest">/, `${page}: manifest`);
        assert.match(html, /<meta name="theme-color" content="#06080d">/, `${page}: theme-color`);
        assert.match(html, /rel="apple-touch-icon"/, `${page}: apple icon`);
    }
});

test('the theme colour follows the theme and nginx serves the manifest with its own type', () => {
    const theme = read('js/theme.js');
    assert.match(theme, /#06080d/);
    assert.match(theme, /#f3f6fb/);
    const conf = read('nginx.conf');
    assert.match(conf, /location = \/manifest\.webmanifest \{[^}]*application\/manifest\+json/);
});

test('there is no service worker: nothing the app serves can go stale', () => {
    for (const file of walk(APP)) {
        if (!/\.(js|html)$/.test(file) || /qrcode\.js$|manifest\.json$/.test(file)) continue;
        assert.ok(!/serviceWorker\s*\.\s*register|navigator\.serviceWorker/.test(fs.readFileSync(file, 'utf8')), `${rel(file)} does not register a service worker`);
    }
    assert.ok(!fs.readdirSync(APP).some(n => /^(sw|service-worker)\.js$/.test(n)));
});
