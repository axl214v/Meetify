#!/usr/bin/env node
/**
 * Finds translation gaps. English text is the key, so "missing" means a string used in a page or script that
 * has no entry in src/app/i18n/ru.json. Also: entries nobody uses, placeholders or tags that differ between
 * the English and the Russian text, a Russian text equal to its English one, and wording we never use.
 *   node tools/i18n-check.js          exit 1 when anything is wrong
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./i18n-lib');

const APP = path.resolve(__dirname, '..', 'src', 'app');
// Files translated so far. Round 2 pages are added here as they are done; the admin panel is never listed.
const SCOPE = {
    html: ['index.html', 'auth/Auth.html', 'auth/Reg.html', 'auth/resetpass.html', 'auth/resetpass-confirm.html', 'auth/verify-email.html', 'Conf/pages/conf_join.html', 'Conf/pages/conf_room.html'],
    js: ['js/index.js', 'js/auth.js', 'js/reg.js', 'js/resetpass.js', 'js/resetpass-confirm.js', 'js/verify-email.js', 'js/cookie-banner.js', 'Conf/js/conf_join.js', 'js/notifications.js', 'Conf/js/conf_utils.js', 'Conf/js/conf_room.js', 'Conf/js/conf_devices.js', 'Conf/js/conf_security.js', 'Conf/components/chat.js']
};
// Texts that are the same in both languages on purpose (brand words, the REC mark)
const SAME_OK = new Set(['REC · {name}']);
const FORBIDDEN = [/открыт\S* исходн/i, /open[- ]?source/i, /self-?host/i, /свой сервер/i, /на своём сервере/i, /эмодзи|emoji/i];

function read(rel) { return fs.readFileSync(path.join(APP, rel), 'utf8'); }

function collect() {
    const used = new Map();   // key -> { kind, files:Set, plural?: true }
    const add = (key, file, extra = {}) => {
        if (!key) return;
        const e = used.get(key) || { files: new Set(), ...extra };
        e.files.add(file); Object.assign(e, extra);
        used.set(key, e);
    };
    const bad = [];
    for (const f of SCOPE.html) {
        for (const k of L.htmlKeys(read(f))) {
            if (k.kind === 'bad') { bad.push(`${f}: data-i18n on an element that has child elements (use data-i18n-html): <${k.el.tag}${k.el.attrs.slice(0, 60)}>`); continue; }
            add(k.key, f, { html: k.kind === 'html' });
        }
    }
    for (const f of SCOPE.js) {
        for (const c of L.jsKeys(read(f))) {
            if (c.fn === 'tn') add(L.norm(c.keys[1]), f, { plural: true }); else add(L.norm(c.keys[0]), f, { html: /<\/?[a-z]/i.test(c.keys[0]) });
        }
    }
    let dynamic = [];
    try { dynamic = JSON.parse(read('i18n/dynamic.json')); } catch { /* none yet */ }
    for (const m of dynamic) add(m, 'i18n/dynamic.json');
    return { used, bad };
}

function check() {
    const dict = JSON.parse(read('i18n/ru.json'));
    const { used, bad } = collect();
    const problems = [...bad];
    for (const [key, e] of used) {
        if (!(key in dict)) { problems.push(`missing in ru.json: "${key.slice(0, 90)}" (${[...e.files].join(', ')})`); continue; }
        const val = dict[key];
        const vals = Array.isArray(val) ? val : [val];
        if (e.plural && !Array.isArray(val)) problems.push(`plural entry must be [one, few, many]: "${key.slice(0, 70)}"`);
        for (const v of vals) {
            if (L.placeholders(v) !== L.placeholders(key)) problems.push(`placeholders differ: "${key.slice(0, 70)}"`);
            if (e.html && L.tagsOf(v) !== L.tagsOf(key)) problems.push(`HTML tags differ: "${key.slice(0, 70)}"`);
            if (!e.html && /<\/?[a-z]/i.test(v) && !/<\/?[a-z]/i.test(key)) problems.push(`unexpected HTML in the Russian text of "${key.slice(0, 70)}"`);
        }
        if (!Array.isArray(val) && val === key && !SAME_OK.has(key)) problems.push(`Russian text equals the English one: "${key.slice(0, 70)}"`);
    }
    for (const [key, val] of Object.entries(dict)) {
        if (!used.has(key)) problems.push(`unused in ru.json: "${key.slice(0, 90)}"`);
        for (const v of [].concat(val)) for (const re of FORBIDDEN) if (re.test(v)) problems.push(`forbidden wording ${re} in: "${v.slice(0, 80)}"`);
    }
    return problems;
}

if (require.main === module) {
    const problems = check();
    problems.forEach(p => console.error(p));
    console.log(problems.length ? `${problems.length} problem(s)` : 'translations are complete');
    process.exit(problems.length ? 1 : 0);
}
module.exports = { check, collect, SCOPE };
