/* SeeYou · Ayudante para pintar datos en HTML sin abrir la puerta a XSS.
 *  SeeYouHTML.esc(v)  → texto seguro dentro de HTML o de un atributo entre comillas
 *  SeeYouHTML.url(v)  → URL segura para src/href (solo http(s), blob:, data:image o rutas del propio servidor); si no, ''
 * Los nombres, pies de foto y comentarios ya llegan escapados del servidor: NO se vuelven a escapar (saldría "&amp;amp;").
 * Esto es para lo que NO escapa el servidor: datos de terceros (iTunes, OpenStreetMap), IPs, User-Agent y URLs. */
(function (global) {
    'use strict';
    var MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
    function esc(v) {
        return String(v == null ? '' : v).replace(/[&<>"'`]/g, function (c) { return MAP[c]; });
    }
    function url(v) {
        var s = String(v == null ? '' : v).trim();
        if (!s || /[\u0000-\u001f\u007f]/.test(s)) return '';
        if (/^https?:\/\//i.test(s) || /^blob:/i.test(s) || /^data:image\/(png|jpe?g|gif|webp|avif|heic|heif);base64,[A-Za-z0-9+\/=]+$/i.test(s)) return esc(s);
        if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return '';      // javascript:, vbscript:, data:text/html…
        return esc(s);                                        // ruta relativa
    }
    // Decodifica las entidades que el servidor guarda (O&#039;Brien -> O'Brien) para usarlo con textContent / .value.
    function dec(v) {
        var s = String(v == null ? '' : v);
        if (s.indexOf('&') < 0) return s;
        try { return new DOMParser().parseFromString(s, 'text/html').documentElement.textContent || ''; } catch (e) { return s; }
    }
    global.SeeYouHTML = { esc: esc, url: url, dec: dec };
})(window);
