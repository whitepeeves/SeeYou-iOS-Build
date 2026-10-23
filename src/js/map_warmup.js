/* Precarga del mapa en segundo plano.
 * Recuerda los sitios que más miras en el mapa (y donde están tus Tics) y, con el móvil parado y con
 * conexión buena, descarga los mosaicos de esas zonas para que el service worker (sw.js) los guarde.
 * La próxima vez que abras el mapa esas zonas salen al instante, sin esperar a internet. */
(function () {
    'use strict';
    if (window.SeeYouMapWarmup) return;

    var KEY = 'seeyou_map_places_v1';
    var SERVICES = ['World_Imagery', 'World_Street_Map'];
    var ZOOMS = [5, 6, 7, 8, 9, 10, 11, 12, 13];   // 3x3 mosaicos alrededor del centro en cada nivel
    var MAX_PLACES = 6;
    var MAX_STORED = 40;
    var REWARM_MS = 14 * 24 * 3600 * 1000;
    var CONCURRENCY = 3;
    var IMAGE_TIMEOUT = 8000;

    var lastMoveAt = 0;
    var running = false;
    var timer = null;

    function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
    function save(obj) { try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch (e) { } }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    function tileXY(lat, lon, z) {
        var n = Math.pow(2, z);
        var s = clamp(Math.sin(lat * Math.PI / 180), -0.9999, 0.9999);
        return {
            x: clamp(Math.floor((lon + 180) / 360 * n), 0, n - 1),
            y: clamp(Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n), 0, n - 1),
            n: n
        };
    }

    function placeKey(lat, lon) { var t = tileXY(lat, lon, 9); return t.x + '_' + t.y; }
    function validCoord(lat, lon) { return isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 85 && Math.abs(lon) <= 180; }

    function notePlace(lat, lon, weight) {
        lat = Number(lat); lon = Number(lon);
        if (!validCoord(lat, lon)) return;
        var places = load();
        var key = placeKey(lat, lon);
        var p = places[key] || { lat: lat, lon: lon, n: 0, warmedAt: 0 };
        p.n = (p.n || 0) + (weight || 1);
        p.last = Date.now();
        places[key] = p;
        var keys = Object.keys(places);
        if (keys.length > MAX_STORED) {
            keys.sort(function (a, b) { return (places[a].n - places[b].n) || (places[a].last - places[b].last); });
            for (var i = 0; i < keys.length - MAX_STORED; i += 1) delete places[keys[i]];
        }
        save(places);
    }

    function ownTicPlaces() {
        var out = [];
        try {
            (window.ticPhotos || []).forEach(function (photo) {
                if (!photo || !photo.location || !window.isOwnUserId || !window.isOwnUserId(photo.userId)) return;
                var lat = Number(photo.location.lat !== undefined ? photo.location.lat : photo.location.latitude);
                var lon = Number(photo.location.lng !== undefined ? photo.location.lng : (photo.location.lon !== undefined ? photo.location.lon : photo.location.longitude));
                if (validCoord(lat, lon)) out.push({ lat: lat, lon: lon, n: 2, warmedAt: 0, key: placeKey(lat, lon), fromTic: true });
            });
        } catch (e) { }
        return out;
    }

    function candidates() {
        var stored = load();
        var map = {};
        Object.keys(stored).forEach(function (k) { var p = stored[k]; map[k] = { lat: p.lat, lon: p.lon, n: p.n || 1, warmedAt: p.warmedAt || 0, key: k }; });
        ownTicPlaces().forEach(function (p) {
            if (map[p.key]) map[p.key].n += 1;
            else map[p.key] = p;
        });
        return Object.keys(map).map(function (k) { return map[k]; })
            .sort(function (a, b) { return b.n - a.n; })
            .slice(0, MAX_PLACES);
    }

    function urlsFor(place) {
        var urls = [];
        ZOOMS.forEach(function (z) {
            var c = tileXY(place.lat, place.lon, z);
            for (var dx = -1; dx <= 1; dx += 1) {
                for (var dy = -1; dy <= 1; dy += 1) {
                    var x = ((c.x + dx) % c.n + c.n) % c.n;
                    var y = c.y + dy;
                    if (y < 0 || y >= c.n) continue;
                    SERVICES.forEach(function (svc) {
                        urls.push('https://services.arcgisonline.com/ArcGIS/rest/services/' + svc + '/MapServer/tile/' + z + '/' + y + '/' + x);
                    });
                }
            }
        });
        return urls;
    }

    function connectionOk() {
        var c = navigator.connection;
        if (navigator.onLine === false) return false;
        if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return false;
        return true;
    }

    function canWarm() {
        // Sin service worker controlando la página los mosaicos no se guardarían.
        return connectionOk() && !document.hidden && navigator.serviceWorker && navigator.serviceWorker.controller;
    }

    function fetchTile(url, done) {
        var img = new Image();
        var finished = false;
        function end() { if (finished) return; finished = true; clearTimeout(t); img.onload = img.onerror = null; done(); }
        var t = setTimeout(end, IMAGE_TIMEOUT);
        img.crossOrigin = 'anonymous';   // mismo modo que usa Cesium, para compartir la entrada de caché
        img.onload = end; img.onerror = end;
        img.src = url;
    }

    // Precarga inmediata (para el recorrido del mapa): baja los mosaicos de un punto en todos los niveles
    // de zoom, de más lejos a más cerca, y termina cuando están (o al agotar el tiempo). Nunca rechaza.
    function prewarm(lat, lon, opts) {
        opts = opts || {};
        lat = Number(lat); lon = Number(lon);
        return new Promise(function (resolve) {
            if (!validCoord(lat, lon) || navigator.onLine === false) return resolve(false);
            var services = opts.services || SERVICES;
            var zooms = opts.zooms || [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
            var urls = [];
            zooms.forEach(function (z) {
                var c = tileXY(lat, lon, z);
                var span = z >= 8 ? 1 : 0;
                for (var dx = -span; dx <= span; dx += 1) {
                    for (var dy = -span; dy <= span; dy += 1) {
                        var x = ((c.x + dx) % c.n + c.n) % c.n;
                        var y = c.y + dy;
                        if (y < 0 || y >= c.n) continue;
                        services.forEach(function (svc) {
                            urls.push('https://services.arcgisonline.com/ArcGIS/rest/services/' + svc + '/MapServer/tile/' + z + '/' + y + '/' + x);
                        });
                    }
                }
            });
            var index = 0, active = 0, finished = false, LIMIT = opts.concurrency || 8;
            var overall = setTimeout(function () { finish(false); }, opts.timeout || 7000);
            function finish(ok) { if (finished) return; finished = true; clearTimeout(overall); resolve(ok); }
            function pump() {
                if (finished) return;
                while (active < LIMIT && index < urls.length) {
                    active += 1;
                    fetchTile(urls[index++], function () {
                        active -= 1;
                        if (index >= urls.length && active === 0) finish(true);
                        else pump();
                    });
                }
            }
            if (!urls.length) return finish(true);
            pump();
            notePlace(lat, lon, 1);
        });
    }

    function warmPlace(place, done) {
        var urls = urlsFor(place);
        var index = 0;
        var active = 0;
        function pump() {
            if (!canWarm()) return done(false);
            if (Date.now() - lastMoveAt < 3000) return setTimeout(pump, 1500);   // no competir con el usuario
            while (active < CONCURRENCY && index < urls.length) {
                active += 1;
                fetchTile(urls[index++], function () {
                    active -= 1;
                    if (index >= urls.length && active === 0) done(true);
                    else pump();
                });
            }
        }
        pump();
    }

    function warm() {
        if (running || !canWarm()) return;
        var list = candidates().filter(function (p) { return Date.now() - (p.warmedAt || 0) > REWARM_MS; });
        if (!list.length) return;
        running = true;
        (function next() {
            var place = list.shift();
            if (!place) { running = false; return; }
            warmPlace(place, function (ok) {
                if (ok) {
                    var stored = load();
                    var key = place.key;
                    var p = stored[key] || { lat: place.lat, lon: place.lon, n: place.n, last: Date.now() };
                    p.warmedAt = Date.now();
                    stored[key] = p;
                    save(stored);
                    next();
                } else {
                    running = false;
                }
            });
        })();
    }

    function scheduleWarm(delay) {
        clearTimeout(timer);
        timer = setTimeout(function () {
            if (typeof requestIdleCallback === 'function') requestIdleCallback(warm, { timeout: 5000 });
            else warm();
        }, delay || 10000);
    }

    function attach(viewer) {
        if (!viewer || !viewer.camera || viewer.__warmupAttached) return;
        viewer.__warmupAttached = true;
        var debounce = null;
        viewer.camera.moveStart.addEventListener(function () { lastMoveAt = Date.now(); });
        viewer.camera.moveEnd.addEventListener(function () {
            lastMoveAt = Date.now();
            clearTimeout(debounce);
            debounce = setTimeout(function () {
                try {
                    var carto = viewer.camera.positionCartographic;
                    if (!carto || carto.height > 4000000) return;   // vista global: no cuenta como "sitio"
                    var canvas = viewer.scene.canvas;
                    var center = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);
                    var ray = viewer.camera.pickEllipsoid(center, viewer.scene.globe.ellipsoid);
                    var target = ray ? Cesium.Cartographic.fromCartesian(ray) : carto;
                    notePlace(Cesium.Math.toDegrees(target.latitude), Cesium.Math.toDegrees(target.longitude), 1);
                    scheduleWarm(10000);
                } catch (e) { }
            }, 1800);
        });
        scheduleWarm(12000);
    }

    window.SeeYouMapWarmup = { attach: attach, prewarm: prewarm, notePlace: notePlace, warm: warm, _urlsFor: urlsFor, _candidates: candidates };
})();
