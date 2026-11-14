/* SeeYou · Analítica propia y anónima.
 * Solo envía si el usuario marcó "Analíticas" en la configuración de cookies (clave seeyou_cookie_consent).
 * Manda únicamente un nombre de evento y la página (p. ej. "home"). Sin ids de usuario, sin tokens, sin contenido.
 * Uso desde otros scripts: SeeYouAnalytics.track('coins_open') */
(function () {
    'use strict';
    if (window.SeeYouAnalytics) return;

    function allowed() {
        try {
            var c = JSON.parse(localStorage.getItem('seeyou_cookie_consent') || 'null');
            return !!(c && c.analytics === true);
        } catch (e) { return false; }
    }

    function pageName() {
        var p = String(location.pathname || '/').split('/').pop().replace(/\.html$/i, '').toLowerCase();
        return p === '' ? 'index' : p;
    }

    function track(name, page) {
        try {
            if (!allowed()) return;
            var api = '';
            try { api = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) || ''; } catch (e) { }
            var body = JSON.stringify({ name: String(name), page: String(page || pageName()) });
            fetch(api + '/api/analytics-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body,
                keepalive: true
            }).catch(function () { });
        } catch (e) { }
    }

    window.SeeYouAnalytics = { track: track };
    window.addEventListener('load', function () { setTimeout(function () { track('page_view'); }, 300); });
})();
