/**
 * "Install app" button. Chrome, Edge and Android browsers tell the page when it can be installed
 * (beforeinstallprompt); only then a button appears with the page's main actions (not in the narrow top bar). iOS Safari has no such
 * event: there people use Share > Add to Home Screen, so no button is shown. No service worker is involved.
 */
(function () {
    'use strict';
    var deferred = null;

    function standalone() {
        return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    }

    function remove() {
        var b = document.getElementById('installBtn');
        if (b) b.remove();
    }

    function show() {
        if (!deferred || standalone() || document.getElementById('installBtn')) return;
        var hero = document.querySelector('.hero-actions');
        var host = hero || document.querySelector('.page-actions');
        if (!host) return;
        var b = document.createElement('button');
        b.type = 'button';
        b.id = 'installBtn';
        b.className = 'btn' + (hero ? ' btn-lg' : '');
        b.setAttribute('data-static', '');
        b.textContent = t('Install app');
        b.addEventListener('click', function () {
            var ev = deferred;
            if (!ev) return;
            deferred = null;
            remove();
            try { ev.prompt(); } catch (e) { /* the browser refused: nothing to do */ }
        });
        host.appendChild(b);
    }

    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();            // we show our own button instead of the browser's mini bar
        deferred = e;
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
    });
    window.addEventListener('appinstalled', function () { deferred = null; remove(); });
}());
