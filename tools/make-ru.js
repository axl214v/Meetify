#!/usr/bin/env node
/**
 * Writes src/app/ru/index.html: the landing page in Russian, for search engines and for people without
 * JavaScript. Plain string work (no HTML parser): the keys are the English texts of the page itself.
 *   node tools/make-ru.js           write the page
 *   node tools/make-ru.js --check   exit 1 if it is out of date, or a marked text has no translation
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./i18n-lib');

const APP = path.resolve(__dirname, '..', 'src', 'app');
const SRC = path.join(APP, 'index.html');
const OUT = path.join(APP, 'ru', 'index.html');
const META_KEYS = ['og:title', 'og:description', 'twitter:title', 'twitter:description', 'description'];

function lookup(dict, key, problems) {
    const v = dict[key];
    if (typeof v !== 'string') { problems.push(`no Russian text for: "${key.slice(0, 80)}"`); return null; }
    return v;
}

function setAttr(tag, name, value) {
    return tag.replace(new RegExp('((?:^|\\s)' + name + '\\s*=\\s*)(?:"[^"]*"|\'[^\']*\')'), (m, p) => p + '"' + L.escapeAttr(value) + '"');
}

function translate(html, dict) {
    const problems = [];
    const edits = [];   // [start, end, text]
    for (const k of L.htmlKeys(html)) {
        if (k.kind === 'bad') { problems.push('data-i18n on an element with children'); continue; }
        const v = lookup(dict, k.key, problems);
        if (v === null) continue;
        if (k.kind === 'html') edits.push([k.el.innerStart, k.el.innerEnd, v]);
        else if (k.kind === 'text' || (k.kind === 'head' && !k.attr)) {
            if (k.el.children.length) { const r = L.ownTextRange(html, k.el); if (r) { const lead = r.text.match(/^\s*/)[0], trail = r.text.match(/\s*$/)[0]; edits.push([r.start, r.end, lead + L.escapeText(v) + trail]); } }
            else edits.push([k.el.innerStart, k.el.innerEnd, L.escapeText(v)]);
        } else {
            const tag = html.slice(k.el.openStart, k.el.openEnd);
            edits.push([k.el.openStart, k.el.openEnd, setAttr(tag, k.attr, v)]);
        }
    }
    // social and search texts repeat the title and description: same dictionary entries
    for (const el of L.parse(html)) {
        if (el.tag !== 'meta') continue;
        const name = L.attrOf(el, 'property') || L.attrOf(el, 'name');
        const content = L.attrOf(el, 'content');
        if (!META_KEYS.includes(name) || content === null) continue;
        const key = L.norm(L.unescapeHtml(content));
        if (typeof dict[key] !== 'string') continue;
        const tag = html.slice(el.openStart, el.openEnd);
        const already = edits.find(e => e[0] === el.openStart);
        if (already) continue;
        edits.push([el.openStart, el.openEnd, setAttr(tag, 'content', dict[key])]);
    }
    edits.sort((a, b) => b[0] - a[0]);
    let out = html;
    for (const [s, e, t] of edits) out = out.slice(0, s) + t + out.slice(e);

    out = out.replace('<html lang="en"', '<html lang="ru"')
        .replace('<link rel="canonical" href="https://meetify.cc/">', '<link rel="canonical" href="https://meetify.cc/ru/">')
        .replace('<meta property="og:url" content="https://meetify.cc/">', '<meta property="og:url" content="https://meetify.cc/ru/">')
        .replace(/(<meta property="og:site_name"[^>]*>)/, '$1\n    <meta property="og:locale" content="ru_RU">');
    return { out, problems };
}

function build() {
    const dict = JSON.parse(fs.readFileSync(path.join(APP, 'i18n', 'ru.json'), 'utf8'));
    return translate(fs.readFileSync(SRC, 'utf8'), dict);
}

if (require.main === module) {
    const { out, problems } = build();
    problems.forEach(p => console.error(p));
    if (problems.length) process.exit(1);
    if (process.argv.includes('--check')) {
        const have = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
        if (have !== out) { console.error('ru/index.html is out of date: run node tools/make-ru.js'); process.exit(1); }
        console.log('ru/index.html is current');
    } else {
        fs.mkdirSync(path.dirname(OUT), { recursive: true });
        fs.writeFileSync(OUT, out);
        console.log('wrote', path.relative(process.cwd(), OUT));
    }
}
module.exports = { translate, build };
