/* SeeYou · Sonda de rendimiento (solo app nativa Android/iOS).
 * Una vez por pagina, unos segundos despues de cargar, manda al servidor un resumen de tiempos: carga de la pagina, tareas largas
 * del hilo principal y las llamadas /api y /media mas lentas. NO envia ids de usuario, tokens ni contenido; las rutas van sin ids. */
(function () {
    'use strict';
    try {
        if (typeof window.Capacitor === 'undefined' || window.__seeYouPerfProbe) return;
        window.__seeYouPerfProbe = true;
        var longTasks = [];
        try {
            new PerformanceObserver(function (list) {
                list.getEntries().forEach(function (e) { longTasks.push(Math.round(e.duration)); });
            }).observe({ entryTypes: ['longtask'] });
        } catch (e) { }

        function clean(name) {
            try {
                var u = new URL(name, location.href);
                var p = u.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id').replace(/\d{5,}/g, ':n').replace(/(\/media\/).+/, '$1…');
                return (u.origin === location.origin ? '' : u.host) + p;
            } catch (e) { return String(name).slice(0, 60); }
        }
        function send() {
            try {
                var api = ''; try { api = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) || ''; } catch (e) { }
                if (!api) return;
                var nav = (performance.getEntriesByType('navigation') || [])[0] || {};
                var res = performance.getEntriesByType('resource') || [];
                var calls = res.filter(function (r) { return /\/api\/|\/media\//.test(r.name); });
                var slow = calls.slice().sort(function (a, b) { return b.duration - a.duration; }).slice(0, 12).map(function (r) {
                    return { p: clean(r.name), ms: Math.round(r.duration), ttfb: Math.round(Math.max(0, r.responseStart - r.requestStart)), kb: Math.round((r.transferSize || 0) / 1024) };
                });
                var scripts = res.filter(function (r) { return r.initiatorType === 'script' || /\.js(\?|$)/.test(r.name); })
                    .sort(function (a, b) { return b.duration - a.duration; }).slice(0, 5)
                    .map(function (r) { return { p: clean(r.name), ms: Math.round(r.duration) }; });
                var body = {
                    page: location.pathname.split('/').pop() || 'index',
                    platform: (window.Capacitor.getPlatform && window.Capacitor.getPlatform()) || 'native',
                    ua: (navigator.userAgent.match(/Chrome\/[\d.]+/) || [''])[0],
                    dcl: Math.round(nav.domContentLoadedEventEnd || 0), load: Math.round(nav.loadEventEnd || 0),
                    apiCalls: calls.filter(function (r) { return /\/api\//.test(r.name); }).length,
                    mediaCalls: calls.filter(function (r) { return /\/media\//.test(r.name); }).length,
                    longTasks: longTasks.length, longTaskMax: longTasks.reduce(function (m, x) { return Math.max(m, x); }, 0),
                    longTaskSum: longTasks.reduce(function (s, x) { return s + x; }, 0),
                    conn: (navigator.connection && navigator.connection.effectiveType) || '',
                    rtt: (navigator.connection && navigator.connection.rtt) || 0,
                    slow: slow, scripts: scripts
                };
                fetch(api + '/api/perf-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(function () { });
            } catch (e) { }
        }
        window.addEventListener('load', function () { setTimeout(send, 9000); });
    } catch (e) { }
})();
