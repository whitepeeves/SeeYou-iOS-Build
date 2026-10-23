/* Colores de la app (solo para quien los elige; se guardan en su cuenta y en el dispositivo).
   El azul de SeeYou esta escrito a mano en muchos estilos; en vez de tocarlos uno a uno, al cargar cada pagina se
   cambian los azules de las hojas de estilo por la paleta elegida. Con la paleta "Azul clasico" no se hace nada. */
(function () {
    'use strict';
    var KEY = 'seeYou_palette';
    var PRESETS = [
        { id: 'azul', name: 'Azul clásico', a: '#1B3A5C', b: '#2F6FDD' },
        { id: 'atardecer', name: 'Atardecer', a: '#EA580C', b: '#FBBF24' },
        { id: 'bosque', name: 'Bosque', a: '#047857', b: '#34D399' },
        { id: 'rosa', name: 'Rosa', a: '#BE185D', b: '#F472B6' },
        { id: 'violeta', name: 'Violeta', a: '#6D28D9', b: '#A78BFA' },
        { id: 'grafito', name: 'Grafito', a: '#1F2937', b: '#64748B' }
    ];
    function me() { try { return localStorage.getItem('current_user_id') || ''; } catch (e) { return ''; } }
    // La paleta guardada en el dispositivo lleva el id de su dueño: si otra persona inicia sesion en el mismo movil no hereda los colores.
    function load() {
        try {
            var p = JSON.parse(localStorage.getItem(KEY) || 'null');
            if (p && /^#[0-9a-f]{6}$/i.test(p.a) && /^#[0-9a-f]{6}$/i.test(p.b) && (!p.uid || p.uid === me())) return p;
        } catch (e) { }
        return null;
    }
    function saveLocal(p) {
        try {
            if (!p || p.id === 'azul') localStorage.removeItem(KEY);
            else localStorage.setItem(KEY, JSON.stringify({ id: p.id || 'custom', a: p.a, b: p.b, uid: me() }));
        } catch (e) { }
    }
    function apiBase() { try { return (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) || ''; } catch (e) { return ''; } }
    function remote(method, body) {
        var base = apiBase();
        if (!base || !me() || typeof fetch !== 'function') return Promise.resolve(null);
        var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);
        return fetch(base + '/api/me/palette', opts).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    }
    // Guarda en el dispositivo y en la cuenta; devuelve una promesa para poder esperar antes de recargar.
    function set(p) {
        saveLocal(p);
        return remote('PUT', (!p || p.id === 'azul') ? { reset: true } : { id: p.id, a: p.a, b: p.b });
    }
    // Una vez por sesion: la cuenta manda. Si cambia respecto a lo local, se guarda y se recarga una sola vez.
    function sync() {
        try { if (sessionStorage.getItem('seeYou_palette_synced') === me()) return; } catch (e) { }
        remote('GET').then(function (d) {
            if (!d) return;
            try { sessionStorage.setItem('seeYou_palette_synced', me()); } catch (e) { }
            var srv = d.palette, loc = load();
            if (!srv && loc) { remote('PUT', { id: loc.id, a: loc.a, b: loc.b }); return; }   // primera vez tras la actualizacion: se sube lo que ya tenia
            var same = (!srv && !loc) || (srv && loc && srv.a.toLowerCase() === loc.a.toLowerCase() && srv.b.toLowerCase() === loc.b.toLowerCase());
            if (same) return;
            saveLocal(srv);
            location.reload();
        });
    }
    window.SeeYouPalette = { presets: PRESETS, get: load, set: set, isActive: function () { return !!load(); } };
    document.addEventListener('DOMContentLoaded', function () { setTimeout(sync, 400); });

    var pal = load();
    if (!pal) return;

    function rgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
    function hex(c) { return '#' + c.map(function (x) { return Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0'); }).join(''); }
    function mix(h1, h2, t) { var a = rgb(h1), b = rgb(h2); return hex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
    var A = pal.a, B = pal.b, TINT = mix(B, '#ffffff', 0.86);
    function hsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, sat = 0, d = mx - mn;
        if (d) {
            sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
            if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
            h *= 60;
        }
        return [h, sat, l];
    }
    // Cualquier azul de la app se sustituye segun su luminosidad: oscuros -> color principal, medios -> mezcla, claros -> color secundario / tinte.
    // Los fondos casi negros y los grises no se tocan.
    function mapRGB(r, g, b) {
        var c = hsl(r, g, b), h = c[0], sa = c[1], l = c[2];
        if (h < 195 || h > 252 || sa < 0.30 || l < 0.16) return null;
        if (l >= 0.90) return TINT;
        if (l < 0.30) return A;
        if (l < 0.55) return mix(A, B, (l - 0.30) / 0.25);
        if (l < 0.75) return B;
        return mix(B, '#ffffff', (l - 0.75) / 0.15 * 0.55);
    }

    var RE_HEX = /#([0-9a-fA-F]{6})\b/g;
    var RE_RGBA = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/g;
    function recolor(v) {
        if (!v || (v.indexOf('#') < 0 && v.indexOf('rgb') < 0)) return v;
        v = v.replace(RE_HEX, function (m, h) {
            var t = mapRGB(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16));
            return t || m;
        });
        v = v.replace(RE_RGBA, function (m, r, g, b, al) {
            var t = mapRGB(+r, +g, +b);
            if (!t) return m;
            var c = rgb(t);
            return al !== undefined ? 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + al + ')' : 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
        });
        return v;
    }

    function doRule(rule) {
        try {
            if (rule.cssRules && !rule.style) { for (var i = 0; i < rule.cssRules.length; i++) doRule(rule.cssRules[i]); return; }
            if (!rule.style) return;
            if (rule.selectorText && /banner|pf-cover|no-palette/.test(rule.selectorText)) return;
            var st = rule.style;
            for (var j = 0; j < st.length; j++) {
                var p = st[j], val = st.getPropertyValue(p), nv = recolor(val);
                if (nv !== val) st.setProperty(p, nv, st.getPropertyPriority(p));
            }
            if (rule.cssRules) for (var k = 0; k < rule.cssRules.length; k++) doRule(rule.cssRules[k]);
        } catch (e) { }
    }
    var done = new WeakSet();
    function doSheet(sheet) {
        if (!sheet || done.has(sheet)) return;
        var rules; try { rules = sheet.cssRules; } catch (e) { return; }   // hojas de otro dominio: no se tocan
        if (!rules) return;
        done.add(sheet);
        for (var i = 0; i < rules.length; i++) doRule(rules[i]);
    }
    function doAllSheets() { for (var i = 0; i < document.styleSheets.length; i++) doSheet(document.styleSheets[i]); }

    function skipEl(el) { return el.closest && el.closest('[data-no-palette],.pf-cover,[class*="banner"]'); }
    function doEl(el) {
        if (!el || el.nodeType !== 1) return;
        var nodes = [el].concat([].slice.call(el.querySelectorAll ? el.querySelectorAll('[style*="#"],[style*="rgb"]') : []));
        nodes.forEach(function (n) {
            var s = n.getAttribute && n.getAttribute('style');
            if (!s || (s.indexOf('#') < 0 && s.indexOf('rgb') < 0) || skipEl(n)) return;
            var ns = recolor(s); if (ns !== s) n.setAttribute('style', ns);
        });
    }

    function run() { doAllSheets(); doEl(document.body); }
    doAllSheets();
    document.addEventListener('DOMContentLoaded', run);
    window.addEventListener('load', run);
    try {
        new MutationObserver(function (muts) {
            muts.forEach(function (m) {
                [].forEach.call(m.addedNodes, function (n) {
                    if (n.nodeType !== 1) return;
                    if (n.tagName === 'STYLE') setTimeout(function () { doSheet(n.sheet); }, 0);
                    else if (n.tagName === 'LINK') n.addEventListener('load', function () { doSheet(n.sheet); });
                    else doEl(n);
                });
            });
        }).observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) { }
})();
