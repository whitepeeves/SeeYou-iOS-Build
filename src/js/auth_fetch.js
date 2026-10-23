/* SeeYou · Envía la sesión (token) y la huella del dispositivo en TODAS las llamadas a la API propia.
 * Se carga en las páginas que no tienen su propio envoltorio de fetch (chat, amigos, perfil, música).
 * Nunca añade el token a otras webs (iTunes, OpenStreetMap, etc.). */
(function () {
    'use strict';
    if (window.__seeYouAuthFetch) return;
    window.__seeYouAuthFetch = true;
    if (typeof window.fetch !== 'function') return;
    var nativeFetch = window.fetch.bind(window);

    function apiBase() {
        // CONFIG es un const de config.js: no cuelga de window.CONFIG.
        try { return (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) || ''; } catch (e) { return ''; }
    }
    function isApiUrl(url) {
        if (!url || url.indexOf('/api/') === -1) return false;
        if (/^https?:\/\//i.test(url)) {
            var base = apiBase();
            // Se compara el ORIGEN completo: con indexOf, "https://seeyouonline.net.evil.com/api/x" tambien empezaria por la base
            // y el token iria a un dominio ajeno.
            try {
                var origin = new URL(url).origin;
                return (base && origin === new URL(base).origin) || origin === location.origin;
            } catch (e) { return false; }
        }
        return true; // ruta relativa: es nuestro servidor
    }
    window.SeeYouAuth = {
        isApiUrl: isApiUrl,
        headers: function () {
            var h = {};
            try {
                var t = localStorage.getItem('seeYou_auth_token');
                if (t) h['Authorization'] = 'Bearer ' + t;
                h['X-Device-Fingerprint'] = localStorage.getItem('seeYou_device_fingerprint') || (navigator.userAgent + '||' + navigator.platform);
            } catch (e) { }
            return h;
        }
    };

    window.fetch = function (input, init) {
        try {
            var url = typeof input === 'string' ? input : (input && input.url) || '';
            if (isApiUrl(url)) {
                init = init || {};
                var headers = new Headers(init.headers || (typeof input !== 'string' && input && input.headers) || {});
                var extra = window.SeeYouAuth.headers();
                Object.keys(extra).forEach(function (k) { if (!headers.has(k)) headers.set(k, extra[k]); });
                init.headers = headers;
            }
        } catch (e) { }
        return nativeFetch(input, init);
    };
})();
