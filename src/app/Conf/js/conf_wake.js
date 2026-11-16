/**
 * Keeps the screen on during a call (Screen Wake Lock API). The browser drops the lock whenever the page is
 * hidden, so it is requested again when the page comes back. Where the API is missing, nothing happens.
 */
(function () {
    'use strict';
    var wanted = false;
    var sentinel = null;
    var requests = 0;

    function supported() { return typeof navigator !== 'undefined' && !!navigator.wakeLock && typeof navigator.wakeLock.request === 'function'; }

    function acquire() {
        if (!wanted || sentinel || !supported() || document.visibilityState === 'hidden') return;
        requests++;
        navigator.wakeLock.request('screen').then(function (s) {
            if (!wanted) { try { s.release(); } catch (e) { /* gone */ } return; }
            sentinel = s;
            s.addEventListener('release', function () { if (sentinel === s) sentinel = null; });
        }).catch(function () { /* refused (battery saver, no permission): the screen may dim, nothing else */ });
    }

    function onVisible() { if (document.visibilityState === 'visible') acquire(); }

    function start() {
        if (wanted) return;
        wanted = true;
        document.addEventListener('visibilitychange', onVisible);
        acquire();
    }

    function stop() {
        wanted = false;
        document.removeEventListener('visibilitychange', onVisible);
        if (sentinel) { try { sentinel.release(); } catch (e) { /* gone */ } sentinel = null; }
    }

    window.KeepAwake = { start: start, stop: stop, active: function () { return !!sentinel; }, supported: supported, _requests: function () { return requests; } };
}());
