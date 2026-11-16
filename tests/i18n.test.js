// The translation layer: the pure helpers, the scanner, the Russian landing page and the completeness of the
// dictionary for every translated page. No browser, no network.
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const path = require('path');
const I = require('../src/app/js/i18n.js');
const L = require('../tools/i18n-lib');
const { check } = require('../tools/i18n-check');
const { translate } = require('../tools/make-ru');

test('helpers: whitespace, placeholders, Russian plural forms', () => {
    assert.equal(I.norm('  a \n  b '), 'a b');
    assert.equal(I.fill('{x} and {y}', { x: 1 }), '1 and {y}');
    assert.deepEqual([1, 2, 5, 11, 21, 22, 25].map(I.pluralRu), [0, 1, 2, 2, 0, 1, 2]);
});

test('scanner: markers, attributes, svg children and t() calls', () => {
    const html = '<title>T</title><p data-i18n>  Hello\n world </p><a data-i18n href="#"><svg><path d="M0"/></svg>Go</a>' +
        '<h3 data-i18n-html>A <b>b</b></h3><button data-i18n-attr="title,aria-label" title="Mic" aria-label="Mute">x</button>';
    const keys = L.htmlKeys(html).map(k => k.kind + ':' + k.key);
    assert.deepEqual(keys, ['head:T', 'text:Hello world', 'text:Go', 'html:A <b>b</b>', 'attr:Mic', 'attr:Mute']);
    const calls = L.jsKeys("t('It\\'s {n}', {n}); tn(n, '1 person', '{n} people'); x.t('no'); t(`two ${a}`)");
    assert.deepEqual(calls.map(c => c.keys), [["It's {n}"], ['1 person', '{n} people']]);
});

test('make-ru: texts, attributes and head are replaced; a missing entry is reported', () => {
    const html = '<html lang="en"><head><title>T</title></head><body><p data-i18n>Hello</p><i data-i18n-attr="title" title="Mic">x</i><p data-i18n>Nope</p></body></html>';
    const { out, problems } = translate(html, { T: 'Т', Hello: 'Привет', Mic: 'Микрофон' });
    assert.match(out, /lang="ru"/);
    assert.match(out, /<title>Т<\/title>/);
    assert.match(out, />Привет</);
    assert.match(out, /title="Микрофон"/);
    assert.deepEqual(problems, ['no Russian text for: "Nope"']);
});

test('every translated page and script is complete in ru.json (and nothing in it is unused or forbidden)', () => {
    assert.deepEqual(check(), []);
});

test('the generated files are current: i18n/ru.js and ru/index.html', () => {
    const run = (f) => execFileSync('node', [path.join(__dirname, '..', 'tools', f), '--check'], { encoding: 'utf8' });
    assert.match(run('make-i18n.js'), /current/);
    assert.match(run('make-ru.js'), /current/);
});
