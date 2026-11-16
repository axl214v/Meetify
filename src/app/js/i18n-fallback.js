/* Pages that are not translated yet: shared scripts (bell, cookie notice, dialogs) call t(), which here
   just returns the English text. Replace this file with /js/i18n.js when a page is translated. */
(function (w) {
    function fill(s, v) { return v ? String(s).replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(v, k) ? String(v[k]) : m; }) : String(s); }
    w.t = w.t || function (s, v) { return fill(s, v); };
    w.tn = w.tn || function (n, one, other, v) { return fill(n === 1 ? one : other, Object.assign({ n: n }, v || {})); };
    w.I18n = w.I18n || { lang: 'en', locale: 'en-US', t: w.t, tn: w.tn, apply: function () {} };
}(window));
