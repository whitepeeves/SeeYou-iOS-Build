/**
 * GeoLang - Detecta el idioma del visitante según su ubicación (IP) y lo aplica.
 * No pisa una preferencia de idioma que el usuario ya haya elegido manualmente
 * (guardada en localStorage['seeyou_language']).
 *
 * Uso:
 *   GeoLang.detectAndApply(function(lang){ CONFIG.setLanguage(lang); });
 */
(function (global) {
    'use strict';

    // Códigos de país (ISO 3166-1 alpha-2) -> idioma soportado por la app.
    // Si un país no aparece aquí, se usa el idioma del navegador o 'en' por defecto.
    var COUNTRY_LANG = {
        // Español
        ES: 'es', MX: 'es', AR: 'es', CO: 'es', PE: 'es', VE: 'es', CL: 'es',
        EC: 'es', GT: 'es', CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es',
        SV: 'es', NI: 'es', CR: 'es', PA: 'es', UY: 'es', PR: 'es', GQ: 'es',
        // English
        US: 'en', GB: 'en', IE: 'en', AU: 'en', NZ: 'en', CA: 'en', ZA: 'en',
        IN: 'en', SG: 'en', PH: 'en', NG: 'en', KE: 'en', PK: 'en',
        // Italiano
        IT: 'it', SM: 'it', VA: 'it',
        // Français
        FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr', CI: 'fr', SN: 'fr', CD: 'fr', ML: 'fr', CH_FR: 'fr',
        // Deutsch
        DE: 'de', AT: 'de', LI: 'de',
        // Português
        PT: 'pt', BR: 'pt', AO: 'pt', MZ: 'pt',
        // Català (se detecta por idioma de navegador, no por país)
        // Română
        RO: 'ro', MD: 'ro',
        // Nederlands
        NL: 'nl',
        // Polski
        PL: 'pl',
        // Русский
        RU: 'ru', BY: 'ru', KZ: 'ru', KG: 'ru',
        // Українська
        UA: 'uk',
        // Türkçe
        TR: 'tr',
        // العربية
        SA: 'ar', AE: 'ar', EG: 'ar', MA: 'ar', DZ: 'ar', TN: 'ar', IQ: 'ar',
        JO: 'ar', QA: 'ar', KW: 'ar', LB: 'ar', LY: 'ar', OM: 'ar', BH: 'ar', SY: 'ar', YE: 'ar', SD: 'ar',
        // हिन्दी
        NP: 'hi',
        // 中文
        CN: 'zh', TW: 'zh', HK: 'zh', MO: 'zh',
        // 日本語
        JP: 'ja',
        // 한국어
        KR: 'ko', KP: 'ko',
        // Switzerland defaults to German (most common); handled by CH below
        CH: 'de'
    };

    var STORAGE_KEY = 'seeyou_language';
    var CACHE_KEY = 'seeyou_geo_country_cache';
    var CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

    function supportedLangs() {
        // Nota: CONFIG se declara con "const" en config.js, así que NO aparece
        // como window.CONFIG (las declaraciones const/let de nivel superior no
        // se añaden al objeto global). Por eso comprobamos el identificador
        // directamente en vez de "global.CONFIG".
        try {
            if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.LANGUAGE_OPTIONS) {
                return Object.keys(CONFIG.LANGUAGE_OPTIONS);
            }
        } catch (e) {}
        return ['es', 'en', 'it', 'fr', 'de', 'pt', 'ca', 'ro', 'nl', 'pl', 'ru', 'uk', 'tr', 'ar', 'hi', 'zh', 'ja', 'ko'];
    }

    function langFromNavigator() {
        try {
            var nav = (navigator.language || (navigator.languages && navigator.languages[0]) || '').toLowerCase();
            var base = nav.split('-')[0];
            if (supportedLangs().indexOf(base) !== -1) return base;
        } catch (e) {}
        return null;
    }

    function readCache() {
        try {
            var raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            var obj = JSON.parse(raw);
            if (!obj || !obj.country || !obj.ts) return null;
            if (Date.now() - obj.ts > CACHE_TTL_MS) return null;
            return obj.country;
        } catch (e) { return null; }
    }

    function writeCache(country) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ country: country, ts: Date.now() }));
        } catch (e) {}
    }

    function fetchWithTimeout(url, ms) {
        var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        var timer = controller ? setTimeout(function () { controller.abort(); }, ms) : null;
        return fetch(url, controller ? { signal: controller.signal } : {}).then(function (r) {
            if (timer) clearTimeout(timer);
            if (!r.ok) throw new Error('bad status ' + r.status);
            return r.json();
        }).catch(function (err) {
            if (timer) clearTimeout(timer);
            throw err;
        });
    }

    function detectCountry() {
        var cached = readCache();
        if (cached) return Promise.resolve(cached);

        // El pais lo resuelve NUESTRO servidor (cabecera del CDN); el cliente ya no envia la IP a terceros.
        var base = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) ? CONFIG.API_BASE_URL : '';
        return fetchWithTimeout(base + '/api/locale', 4000).then(function (data) {
            var cc = data && data.country;
            if (!cc) throw new Error('sin pais');
            writeCache(cc);
            return cc;
        });
    }

    /**
     * Detecta el idioma según la IP del visitante y lo aplica mediante applyFn(lang).
     * No hace nada si el usuario ya tiene un idioma guardado manualmente, salvo que
     * se pase { force: true }.
     *
     * @param {function(string)} applyFn - función que recibe el código de idioma detectado
     * @param {object} [opts]
     * @param {boolean} [opts.force] - ignora el idioma ya guardado y detecta igualmente
     */
    function detectAndApply(applyFn, opts) {
        opts = opts || {};
        var hasSaved = false;
        try { hasSaved = !!localStorage.getItem(STORAGE_KEY); } catch (e) {}

        if (hasSaved && !opts.force) {
            return Promise.resolve(null); // respeta la elección explícita del usuario
        }

        // Señal inmediata (sin red): idioma del navegador, para no bloquear el render.
        var navLang = langFromNavigator();
        if (navLang && typeof opts.onImmediate === 'function') {
            try { opts.onImmediate(navLang); } catch (e) {}
        }

        return detectCountry()
            .then(function (country) {
                var code = (country || '').toUpperCase();
                var lang = COUNTRY_LANG[code];
                if (!lang || supportedLangs().indexOf(lang) === -1) {
                    lang = navLang || 'en';
                }
                if (typeof applyFn === 'function') applyFn(lang);
                return lang;
            })
            .catch(function () {
                // Sin red / API caída: usa el idioma del navegador si existe.
                var lang = navLang;
                if (lang && typeof applyFn === 'function') applyFn(lang);
                return lang;
            });
    }

    global.GeoLang = {
        COUNTRY_LANG: COUNTRY_LANG,
        detectAndApply: detectAndApply,
        _detectCountry: detectCountry // expuesto para pruebas/depuración
    };

})(typeof window !== 'undefined' ? window : this);
