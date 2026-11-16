'use strict';
/**
 * Shared helpers for the translation tools. The page markup is regular, so a small scanner is enough
 * (no HTML parser dependency): it finds elements, their inner ranges and the data-i18n* markers, and the
 * t('…') / tn('…') calls in scripts.
 */
const { norm } = require('../src/app/js/i18n.js');

const VOID = new Set(['meta', 'link', 'img', 'input', 'br', 'hr', 'source', 'area', 'base', 'col', 'embed', 'track', 'wbr']);
const OPAQUE = new Set(['script', 'style']);

/** Elements with their ranges: { tag, attrs, openStart, openEnd, innerStart, innerEnd, closeEnd, parent, children } */
function parse(html) {
    const re = /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1>|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
    const root = { tag: '#root', children: [] };
    const stack = [root];
    const all = [];
    let m;
    while ((m = re.exec(html))) {
        if (m[0].startsWith('<!--')) continue;
        if (m[1]) {                                  // script / style: opaque
            const open = m[0].match(/^<[^>]*>/)[0];
            const el = { tag: m[1], attrs: open.slice(m[1].length + 1, -1), openStart: m.index, openEnd: m.index + open.length,
                innerStart: m.index + open.length, innerEnd: m.index + m[0].length - (m[1].length + 3), closeEnd: m.index + m[0].length, children: [], parent: stack[stack.length - 1], opaque: true };
            el.parent.children.push(el); all.push(el);
            continue;
        }
        if (m[2]) {                                  // closing tag
            const tag = m[2].toLowerCase();
            for (let i = stack.length - 1; i > 0; i--) {
                if (stack[i].tag === tag) {
                    stack[i].innerEnd = m.index; stack[i].closeEnd = m.index + m[0].length;
                    stack.length = i;
                    break;
                }
            }
            continue;
        }
        const tag = m[3].toLowerCase();
        const selfClosing = VOID.has(tag) || /\/\s*$/.test(m[4]);
        const el = { tag, attrs: m[4], openStart: m.index, openEnd: m.index + m[0].length, innerStart: m.index + m[0].length, children: [], parent: stack[stack.length - 1] };
        el.parent.children.push(el); all.push(el);
        if (selfClosing) { el.innerEnd = el.innerStart; el.closeEnd = el.openEnd; }
        else stack.push(el);
    }
    return all;
}

function attrOf(el, name) {
    const m = new RegExp('(?:^|\\s)' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')').exec(el.attrs);
    return m ? (m[2] !== undefined ? m[2] : m[3]) : null;
}
const hasAttr = (el, name) => new RegExp('(?:^|\\s)' + name + '(?=[\\s=/]|$)').test(el.attrs);

const unescapeHtml = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const escapeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** Text of an element that has no children except svg: its first non-blank text segment (range inside the page) */
function ownTextRange(html, el) {
    const inner = html.slice(el.innerStart, el.innerEnd);
    const re = /<svg\b[\s\S]*?<\/svg>|<[^>]+>|([^<]+)/g;
    let m;
    while ((m = re.exec(inner))) {
        if (m[1] && m[1].trim()) return { start: el.innerStart + m.index, end: el.innerStart + m.index + m[0].length, text: m[1] };
    }
    return null;
}

/** Every translatable string a page marks: [{ kind: 'text'|'html'|'attr'|'head', key, el, attr? }] */
function htmlKeys(html) {
    const out = [];
    for (const el of parse(html)) {
        if (hasAttr(el, 'data-i18n-html')) {
            out.push({ kind: 'html', key: norm(html.slice(el.innerStart, el.innerEnd)), el });
        } else if (hasAttr(el, 'data-i18n')) {
            const hasKids = el.children.some(c => c.tag !== 'svg');
            if (hasKids) { out.push({ kind: 'bad', key: '', el }); continue; }
            const r = el.children.length ? ownTextRange(html, el) : { text: html.slice(el.innerStart, el.innerEnd) };
            out.push({ kind: 'text', key: norm(unescapeHtml(r ? r.text : '')), el });
        }
        const list = attrOf(el, 'data-i18n-attr');
        if (list) for (const name of list.split(',').map(s => s.trim()).filter(Boolean)) {
            const v = attrOf(el, name);
            if (v !== null) out.push({ kind: 'attr', key: norm(unescapeHtml(v)), el, attr: name });
        }
        if (el.tag === 'title') out.push({ kind: 'head', key: norm(unescapeHtml(html.slice(el.innerStart, el.innerEnd))), el });
        if (el.tag === 'meta' && /name\s*=\s*"description"/.test(el.attrs)) out.push({ kind: 'head', key: norm(unescapeHtml(attrOf(el, 'content') || '')), el, attr: 'content' });
    }
    return out;
}

function unescapeJs(s) {
    return s.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (m, c) => {
        if (c[0] === 'u' && c.length === 5) return String.fromCharCode(parseInt(c.slice(1), 16));
        return { n: '\n', t: '\t', r: '\r' }[c] || c;
    });
}

/** t('…') and tn(n, '…', '…') calls in a script: [{ fn, keys: [string...] }] (template strings with ${} are skipped) */
function jsKeys(src) {
    const out = [];
    const str = "(?:'((?:[^'\\\\\\n]|\\\\.)*)'|\"((?:[^\"\\\\\\n]|\\\\.)*)\"|`((?:[^`\\\\$]|\\\\.)*)`)";
    const take = (m, i) => unescapeJs(m[i] !== undefined ? m[i] : m[i + 1] !== undefined ? m[i + 1] : m[i + 2]);
    const reT = new RegExp('(?<![\\w.$])t\\(\\s*' + str, 'g');
    let m;
    while ((m = reT.exec(src))) out.push({ fn: 't', keys: [take(m, 1)], index: m.index });
    const reN = new RegExp('(?<![\\w.$])tn\\(\\s*[^,]+,\\s*' + str + '\\s*,\\s*' + str, 'g');
    while ((m = reN.exec(src))) out.push({ fn: 'tn', keys: [unescapeJs(m[1] ?? m[2] ?? m[3]), unescapeJs(m[4] ?? m[5] ?? m[6])], index: m.index });
    return out;
}

const placeholders = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',');
const tagsOf = (s) => (String(s).match(/<\/?[a-zA-Z][^>]*>/g) || []).map(t => t.replace(/\s+/g, ' ')).sort().join('');

module.exports = { parse, attrOf, hasAttr, htmlKeys, jsKeys, ownTextRange, norm, unescapeHtml, escapeText, escapeAttr, placeholders, tagsOf, VOID, OPAQUE };
