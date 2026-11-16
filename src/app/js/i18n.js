/**
 * Tiny translation layer (no library, no build step in the browser, no request to anybody).
 * The English text itself is the key: pages and scripts keep their English, and a Russian dictionary
 * (/i18n/ru.js, made from i18n/ru.json) is used when the language is Russian. A missing entry shows the
 * English text, never a raw key.
 *
 *   HTML   data-i18n               the element's own text is the key
 *          data-i18n-html          the inner HTML is the key (texts with <strong> or links)
 *          data-i18n-attr="title,aria-label,placeholder"   the English attribute values are the keys
 *   JS     t('Leave this conference?')      t('{name} is waiting', { name })
 *          tn(n, '1 person', '{n} people')  plural forms (Russian entry is an array [one, few, many])
 *
 * Language: a /ru/ page is Russian; else the saved choice (localStorage 'meetify-lang'); else the browser
 * language; else English. Loaded synchronously in <head>, so a Russian page is not painted in English first.
 */
(function (root) {
    'use strict';

    var KEY = 'meetify-lang';

    // Whitespace in source files is layout, not text
    function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }

    function fill(text, vars) {
        if (!vars) return text;
        return text.replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m; });
    }

    function pluralRu(n) {
        var a = Math.abs(n) % 100, b = a % 10;
        if (a > 10 && a < 20) return 2;
        if (b === 1) return 0;
        if (b >= 2 && b <= 4) return 1;
        return 2;
    }

    var api = { norm: norm, fill: fill, pluralRu: pluralRu };

    if (typeof document === 'undefined') {            // node: the tools use norm() and fill()
        if (typeof module !== 'undefined') module.exports = api;
        return;
    }

    var de = document.documentElement;
    var lang = 'en';
    try {
        var saved = localStorage.getItem(KEY);
        if (location.pathname.indexOf('/ru/') === 0) lang = 'ru';
        else if (saved === 'ru' || saved === 'en') lang = saved;
        else if ((navigator.languages && navigator.languages[0] || navigator.language || '').toLowerCase().indexOf('ru') === 0) lang = 'ru';
    } catch (e) {
        if (location.pathname.indexOf('/ru/') === 0) lang = 'ru';
    }
    de.setAttribute('lang', lang);

    if (lang === 'ru') {
        // Hide the body until the page is translated (a safety net shows it after 1.5 s whatever happens),
        // and load the dictionary synchronously: no fetch, no flash of English.
        de.classList.add('i18n-wait');
        document.write('<style>html.i18n-wait body{visibility:hidden}</style>');
        document.write('<link rel="preload" href="/assets/fonts/geist-cyrillic.woff2" as="font" type="font/woff2" crossorigin>');
        document.write('<script src="/i18n/ru.js"><\/script>');
        setTimeout(function () { de.classList.remove('i18n-wait'); }, 1500);
    }

    function dict() { return (lang === 'ru' && root.__RU) || null; }

    function t(text, vars) {
        var d = dict(), out = text;
        if (d && typeof text === 'string') {
            var hit = d[text];
            if (hit === undefined) hit = d[norm(text)];
            if (typeof hit === 'string') out = hit;
        }
        return fill(String(out), vars);
    }

    // tn(3, '1 person', '{n} people'): English picks one/other; Russian takes [one, few, many] under the "other" text
    function tn(n, one, other, vars) {
        var v = Object.assign({ n: n }, vars || {});
        var d = dict();
        if (d && Array.isArray(d[other])) return fill(d[other][pluralRu(n)], v);
        if (d && typeof d[other] === 'string') return fill(d[other], v);
        return fill(n === 1 ? one : other, v);
    }

    function setText(el, key) {
        var value = t(key);
        var kids = el.children.length;
        if (!kids) { el.textContent = value; return; }
        for (var i = 0; i < el.childNodes.length; i++) {       // an icon plus a text: the first real text node
            var n = el.childNodes[i];
            if (n.nodeType === 3 && n.nodeValue.trim()) { n.nodeValue = value; return; }
        }
    }

    function textKey(el) {
        if (!el.children.length) return norm(el.textContent);
        for (var i = 0; i < el.childNodes.length; i++) {
            var n = el.childNodes[i];
            if (n.nodeType === 3 && n.nodeValue.trim()) return norm(n.nodeValue);
        }
        return '';
    }

    function apply(scope) {
        scope = scope || document;
        if (lang !== 'ru') return;
        scope.querySelectorAll('[data-i18n]').forEach(function (el) {
            if (!el.hasAttribute('data-i18n-key')) el.setAttribute('data-i18n-key', textKey(el));
            var key = el.getAttribute('data-i18n-key');
            if (key) setText(el, key);
        });
        scope.querySelectorAll('[data-i18n-html]').forEach(function (el) {
            if (!el.hasAttribute('data-i18n-key')) el.setAttribute('data-i18n-key', norm(el.innerHTML));
            var key = el.getAttribute('data-i18n-key');
            var d = dict();
            var hit = d && (d[key]);
            if (typeof hit === 'string') el.innerHTML = hit;       // our own dictionary, never user text
        });
        scope.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
            el.getAttribute('data-i18n-attr').split(',').forEach(function (name) {
                name = name.trim();
                if (!name || !el.hasAttribute(name)) return;
                var store = 'data-i18n-orig-' + name;
                if (!el.hasAttribute(store)) el.setAttribute(store, el.getAttribute(name));
                el.setAttribute(name, t(el.getAttribute(store)));
            });
        });
    }

    function translateHead() {
        if (lang !== 'ru') return;
        document.title = t(document.title);
        var m = document.querySelector('meta[name="description"]');
        if (m) m.setAttribute('content', t(m.getAttribute('content')));
    }

    function setLang(next) {
        try { localStorage.setItem(KEY, next); } catch (e) { /* storage blocked */ }
        var p = location.pathname;
        var onLanding = p === '/' || p === '/index.html';
        if (next === 'ru' && onLanding) location.href = '/ru/' + location.hash;
        else if (next === 'en' && p.indexOf('/ru/') === 0) location.href = '/' + location.hash;
        else location.reload();
    }

    // A small button: it shows the OTHER language ("RU" while English is on)
    function mountSwitch() {
        if (document.getElementById('langSwitchBtn')) return;
        var slot = document.getElementById('langSlot');
        var theme = document.getElementById('themeToggleBtn');
        if (!slot && !theme) return;
        var b = document.createElement('button');
        var next = lang === 'ru' ? 'en' : 'ru';
        b.type = 'button';
        b.id = 'langSwitchBtn';
        b.className = 'btn btn-ghost btn-sm';
        b.setAttribute('data-static', '');
        b.setAttribute('lang', next);
        b.textContent = next === 'ru' ? 'RU' : 'EN';
        b.setAttribute('aria-label', lang === 'ru' ? 'Сменить язык' : 'Switch language');
        b.title = b.getAttribute('aria-label');
        b.addEventListener('click', function () { setLang(next); });
        if (slot) slot.appendChild(b); else theme.parentNode.insertBefore(b, theme);
    }

    function ready() {
        translateHead();
        apply(document);
        mountSwitch();
        de.classList.remove('i18n-wait');
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();

    api.t = t; api.tn = tn; api.apply = apply; api.setLang = setLang; api.mountSwitch = mountSwitch;
    Object.defineProperty(api, 'lang', { get: function () { return lang; } });
    Object.defineProperty(api, 'locale', { get: function () { return lang === 'ru' ? 'ru-RU' : 'en-US'; } });
    root.I18n = api;
    root.t = t;
    root.tn = tn;
}(typeof window !== 'undefined' ? window : globalThis));
