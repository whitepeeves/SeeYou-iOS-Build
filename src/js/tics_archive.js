/* SeeYou · Tics recientes + archivo por fecha y lugar
 *
 * En el perfil solo se cargan los Tics mas recientes. El resto se explora en un archivo
 * (calendario por fecha / lista de ciudades) que usa un resumen ligero y miniaturas,
 * y solo descarga un Tic completo cuando se abre.
 */
(function (global) {
    'use strict';

    var RECENT_COUNT = 12;
    var RECENT_PAGE = 6;
    var MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    var MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    var DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    var PLACE_PAGE = 30;

    var CSS = '' +
        '.tarc-link{border:0;background:rgba(27,58,92,.08);color:#1B3A5C;font:inherit;font-size:13px;font-weight:700;padding:8px 14px;border-radius:999px;cursor:pointer;transition:background .15s,transform .15s}' +
        '.tarc-link:hover{background:rgba(27,58,92,.16)}.tarc-link:active{transform:scale(.97)}' +
        '.tarc-cta{display:block;width:100%;max-width:470px;margin:6px auto 4px;padding:14px 18px;border:1px solid #cfe0f7;border-radius:16px;background:linear-gradient(180deg,#fff,#f3f8ff);color:#1B3A5C;font:inherit;font-size:15px;font-weight:700;cursor:pointer;transition:transform .15s,box-shadow .2s}' +
        '.tarc-cta:hover{box-shadow:0 10px 24px -14px rgba(27,58,92,.5)}.tarc-cta:active{transform:scale(.985)}' +
        '.tarc-link[hidden],.tarc-cta[hidden]{display:none}' +
        '.tarc-note{color:#667085;text-align:center;padding:14px 8px;font-size:14px}' +
        '.tarc{position:fixed;inset:0;z-index:20000;display:flex;align-items:center;justify-content:center;padding:20px;font-family:inherit}' +
        '.tarc[hidden]{display:none}' +
        '.tarc-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.58);backdrop-filter:blur(5px)}' +
        '.tarc-panel{position:relative;z-index:1;width:min(560px,100%);height:min(720px,88vh);display:flex;flex-direction:column;overflow:hidden;background:linear-gradient(180deg,#fff 0%,#f8fbff 100%);border-radius:24px;border:1px solid rgba(148,163,184,.15);box-shadow:0 30px 80px rgba(15,23,42,.28);padding:20px 18px 0;animation:tarcIn .28s ease-out;color:#1d1b20;text-align:left}' +
        '@keyframes tarcIn{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:none}}' +
        '.tarc-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}' +
        '.tarc-title{margin:0;font-size:24px;letter-spacing:-.02em;color:#1B3A5C}' +
        '.tarc-count{font-size:14px;font-weight:600;color:#667085;margin-left:6px}' +
        '.tarc-close{flex:none;border:0;background:rgba(27,58,92,.08);color:#1B3A5C;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:26px;line-height:1;transition:all .2s}' +
        '.tarc-close:hover{background:rgba(27,58,92,.16);transform:scale(1.06)}' +
        '.tarc-tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;background:#eef2f8;border-radius:999px;margin-bottom:12px}' +
        '.tarc-tab{border:0;background:transparent;font:inherit;font-size:14px;font-weight:700;color:#667085;padding:9px 10px;border-radius:999px;cursor:pointer;transition:all .18s}' +
        '.tarc-tab.is-on{background:#fff;color:#1B3A5C;box-shadow:0 2px 8px -2px rgba(27,58,92,.25)}' +
        '.tarc-scroll{flex:1;min-height:0;overflow-y:auto;margin:0 -8px;padding:2px 8px 18px;-webkit-overflow-scrolling:touch}' +
        '.tarc-monthbar{display:flex;align-items:center;gap:8px;margin-bottom:10px}' +
        '.tarc-nav{flex:none;width:38px;height:38px;border:1px solid #dfe5ee;border-radius:50%;background:#fff;color:#1B3A5C;font-size:20px;line-height:1;cursor:pointer}' +
        '.tarc-nav:disabled{opacity:.35;cursor:default}' +
        '.tarc-monthsel{flex:1;min-width:0;height:38px;border:1px solid #dfe5ee;border-radius:999px;background:#fff;color:#1B3A5C;font:inherit;font-size:14px;font-weight:700;padding:0 14px;text-align:center;text-align-last:center}' +
        '.tarc-dow{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px}' +
        '.tarc-dow span{text-align:center;font-size:11px;font-weight:700;color:#98a2b3}' +
        '.tarc-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}' +
        '.tarc-day{position:relative;aspect-ratio:1;border:0;border-radius:10px;background:#f1f4f9;color:#98a2b3;font:inherit;font-size:11px;font-weight:700;padding:0;overflow:hidden;cursor:default}' +
        '.tarc-day.has{cursor:pointer;color:#fff;background:#1B3A5C}' +
        '.tarc-day.has img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}' +
        '.tarc-day.has::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,0) 55%)}' +
        '.tarc-day b{position:absolute;top:4px;left:5px;z-index:2;font-weight:700}' +
        '.tarc-day i{position:absolute;right:4px;bottom:4px;z-index:2;font-style:normal;font-size:10px;line-height:1;background:rgba(15,23,42,.72);color:#fff;border-radius:999px;padding:3px 6px}' +
        '.tarc-day.is-sel{outline:3px solid #3B82F6;outline-offset:1px}' +
        '.tarc-sub{margin:16px 2px 8px;font-size:13px;font-weight:700;color:#475467}' +
        '.tarc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}' +
        '.tarc-tile{position:relative;aspect-ratio:1;border:0;padding:0;border-radius:14px;overflow:hidden;background:#e8edf5;cursor:pointer;transition:transform .15s}' +
        '.tarc-tile:active{transform:scale(.97)}' +
        '.tarc-tile img{width:100%;height:100%;object-fit:cover;display:block}' +
        '.tarc-tile.is-broken img{opacity:0}' +
        '.tarc-tile-date{position:absolute;left:6px;bottom:6px;font-size:10.5px;font-weight:700;color:#fff;background:rgba(15,23,42,.62);border-radius:999px;padding:3px 8px}' +
        '.tarc-tools{display:flex;gap:8px;align-items:center;margin-bottom:10px}' +
        '.tarc-search{flex:1;min-width:0;display:flex;align-items:center;gap:8px;padding:0 14px;height:42px;border:1px solid #dfe5ee;border-radius:999px;background:#fff}' +
        '.tarc-search:focus-within{border-color:#7AA7E8;box-shadow:0 0 0 3px rgba(59,130,246,.16)}' +
        '.tarc-search svg{width:18px;height:18px;flex:none;stroke:#667085;fill:none;stroke-width:2;stroke-linecap:round}' +
        '.tarc-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:inherit;font-size:15px;color:#1d1b20}' +
        '.tarc-order{flex:none;height:42px;padding:0 14px;border:1px solid #dfe5ee;border-radius:999px;background:#fff;color:#1B3A5C;font:inherit;font-size:13px;font-weight:600;cursor:pointer}' +
        '.tarc-row{display:flex;align-items:center;gap:12px;width:100%;padding:9px 10px;border:0;border-radius:16px;background:transparent;font:inherit;text-align:left;color:inherit;cursor:pointer;transition:background .15s}' +
        '.tarc-row:hover{background:rgba(27,58,92,.06)}' +
        '.tarc-cover{flex:none;width:54px;height:54px;border-radius:14px;overflow:hidden;background:#e8edf5}' +
        '.tarc-cover img{width:100%;height:100%;object-fit:cover;display:block}' +
        '.tarc-row-text{min-width:0;flex:1}' +
        '.tarc-row-name{display:block;font-weight:700;font-size:15px;color:#1d1b20;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.tarc-row-sub{display:block;font-size:12.5px;color:#667085}' +
        '.tarc-go{flex:none;width:18px;height:18px;stroke:#9aa4b2;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
        '.tarc-back{display:inline-flex;align-items:center;gap:6px;border:0;background:rgba(27,58,92,.08);color:#1B3A5C;font:inherit;font-size:13px;font-weight:700;padding:8px 14px;border-radius:999px;cursor:pointer;margin-bottom:10px}' +
        '.tarc-more{display:block;margin:12px auto 0;border:1px solid #cfe0f7;background:#fff;color:#1B3A5C;font:inherit;font-weight:700;font-size:14px;padding:10px 18px;border-radius:999px;cursor:pointer}' +
        '.tarc-empty{padding:40px 12px;text-align:center;color:#667085;font-size:14.5px;line-height:1.5}' +
        '.tarc-viewer{position:fixed;inset:0;z-index:20100;background:rgba(15,23,42,.88);backdrop-filter:blur(4px);overflow-y:auto;padding:64px 0 32px;-webkit-overflow-scrolling:touch}' +
        '.tarc-viewer[hidden]{display:none}' +
        '.tarc-viewer-close{position:fixed;top:14px;right:14px;z-index:20101;width:42px;height:42px;border-radius:50%;border:0;background:rgba(255,255,255,.92);color:#1B3A5C;font-size:26px;line-height:1;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.25)}';

    function injectStyle() {
        if (document.getElementById('tarc-style')) return;
        var st = document.createElement('style');
        st.id = 'tarc-style';
        st.textContent = CSS;
        document.head.appendChild(st);
    }

    function apiBase() {
        try {
            if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.API_BASE_URL) return CONFIG.API_BASE_URL;
        } catch (e) { /* ignore */ }
        return '';
    }
    function esc(v) { // ver tics_ui.js: decodifica lo que el servidor ya guardo escapado antes de volver a escapar
        return String(v == null ? '' : v)
            .replace(/&(?:amp|lt|gt|quot|#0?39);/g, function (m) { return { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#039;': "'" }[m]; })
            .replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
    }
    function assetUrl(u) {
        if (!u || u === 'null' || u === 'undefined') return '';
        if (/^(https?:|data:|blob:)/i.test(u)) return u;
        return apiBase() + '/' + String(u).replace(/^\/?/, '');
    }
    // Miniatura: solo las imagenes servidas por /media aceptan ?w=
    function thumbUrl(u, w) {
        var full = assetUrl(u);
        if (!full || full.indexOf('/media/') === -1) return full;
        return full + (full.indexOf('?') === -1 ? '?' : '&') + 'w=' + w;
    }
    function norm(s) {
        return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    }
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function dayKeyOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function monthKeyOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
    function monthLabel(key) {
        var p = key.split('-');
        return MONTHS[Number(p[1]) - 1] + ' ' + p[0];
    }
    function shortDate(d) {
        return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getFullYear();
    }
    function authFetch(url) {
        return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); });
    }

    // ---------------------------------------------------------------- recientes

    var recentState = { listEl: null, opts: null, ids: [], visible: 6, hasMoreServer: false };

    function cardHtml(raw, opts) {
        return global.SocialUI.ticCardHTML(opts.toCard(raw), { eager: false });
    }

    function recentTileHtml(raw, opts) {
        var card = opts.toCard(raw);
        var src = thumbUrl(card.imgUrl, 240);
        var full = assetUrl(card.imgUrl);
        var d = card.date ? new Date(card.date) : null;
        var loc = card.location || {};
        var place = loc.name || loc.label || loc.city || '';
        if (place) place = String(place).split(',')[0].trim();
        return '<div class="tarc-tile-wrap">' +
            '<button type="button" class="tarc-tile" data-open="' + esc(card.id) + '" aria-label="Abrir Tic">' +
            (src ? '<img src="' + esc(src) + '" data-full="' + esc(full) + '" alt="" loading="lazy" decoding="async" onerror="TicsArchive._imgErr(this)">' : '') +
            (d ? '<span class="tarc-tile-date">' + esc(shortDate(d)) + '</span>' : '') +
            '</button>' +
            (place ? '<div class="tarc-tile-caption">' + esc(place) + '</div>' : '') +
            '</div>';
    }

    function bindRecentClicks(listEl) {
        if (listEl.__tarcBound) return;
        listEl.__tarcBound = true;
        listEl.addEventListener('click', function (e) {
            var moreBtn = e.target.closest('[data-more-recent]');
            if (moreBtn) {
                var st = recentState;
                if (st.visible < st.ids.length) {
                    st.visible = st.ids.length;
                    renderRecentFromIds();
                } else if (st.hasMoreServer && st.opts && st.opts.openArchive) {
                    st.opts.openArchive();
                }
                return;
            }
            var tile = e.target.closest('[data-open]');
            if (tile) openOne(tile.dataset.open, recentState.opts);
        });
    }

    function renderRecentFromIds() {
        var st = recentState;
        if (!st.listEl || !st.opts) return;
        var all = global.publicationPhotos || [];
        var shownIds = st.ids.slice(0, st.visible);
        var tilesHtml = shownIds.map(function (id) {
            var raw = all.find(function (p) { return String(p.id) === String(id); });
            return raw ? recentTileHtml(raw, st.opts) : '';
        }).join('');
        var html = '<div class="tarc-recent-grid">' + tilesHtml + '</div>';
        var more = st.visible < st.ids.length || st.hasMoreServer;
        if (more) {
            html += '<button type="button" class="tarc-cta" data-more-recent="1">Cargar más Tics</button>';
        }
        st.listEl.innerHTML = html;
        bindRecentClicks(st.listEl);
    }

    // Carga solo los Tics mas recientes (3 tarjetas). Devuelve { count, hasMore }.
    var recentInflight = { key: '', at: 0, promise: null };
    function loadRecent(listEl, opts) {
        injectStyle();
        // Si dos partes de la pagina piden lo mismo a la vez, se comparte una unica peticion.
        var flightKey = String(opts.userId);
        if (recentInflight.promise && recentInflight.key === flightKey && Date.now() - recentInflight.at < 2500) {
            recentState.listEl = listEl; recentState.opts = opts;
            return recentInflight.promise;
        }
        var run = loadRecentNow(listEl, opts);
        recentInflight = { key: flightKey, at: Date.now(), promise: run };
        return run;
    }
    function loadRecentNow(listEl, opts) {
        recentState.listEl = listEl;
        recentState.opts = opts;
        recentState.visible = RECENT_PAGE;
        listEl.innerHTML = '<div class="tarc-note">Cargando...</div>';
        var url = (opts.apiBase || apiBase()) + '/api/publicaciones/usuario/' + encodeURIComponent(opts.userId) +
            '?viewerId=' + encodeURIComponent(opts.viewerId || '') + '&limit=' + (RECENT_COUNT + 1);
        return authFetch(url).then(function (data) {
            var list = Array.isArray(data) ? data : [];
            list.sort(function (a, b) { return new Date(b.customDate || b.createdAt || b.created_at || b.date || 0) - new Date(a.customDate || a.createdAt || a.created_at || a.date || 0); });
            var hasMore = list.length > RECENT_COUNT;
            var shown = list.slice(0, RECENT_COUNT);
            if (opts.register) opts.register(shown);
            recentState.ids = shown.map(function (x) { return x.id; });
            recentState.hasMoreServer = hasMore;
            if (!shown.length) {
                listEl.innerHTML = '<div class="tarc-note">' + esc(opts.emptyText || 'Todavía no hay ningún Tic.') + '</div>';
                return { count: 0, hasMore: false };
            }
            renderRecentFromIds();
            return { count: shown.length, hasMore: hasMore };
        }).catch(function (err) {
            listEl.innerHTML = '<div class="tarc-note" style="color:#b3261e">No se pudieron cargar los Tics. Inténtalo de nuevo.</div>';
            return { count: 0, hasMore: false, error: err };
        });
    }

    // ---------------------------------------------------------------- archivo

    var summaryCache = {};
    var viewerOnClose = null;
    function loadSummary(opts) {
        var key = String(opts.userId);
        var hit = summaryCache[key];
        if (hit && Date.now() - hit.at < 30000) return hit.promise;
        var url = (opts.apiBase || apiBase()) + '/api/publicaciones/usuario/' + encodeURIComponent(opts.userId) +
            '/resumen?viewerId=' + encodeURIComponent(opts.viewerId || '');
        var promise = authFetch(url).then(function (data) { return data && Array.isArray(data.items) ? data.items : []; });
        summaryCache[key] = { at: Date.now(), promise: promise };
        promise.catch(function () { delete summaryCache[key]; });
        return promise;
    }

    function prepareItems(raw) {
        var items = raw.map(function (r) {
            var d = r.t ? new Date(r.t) : null;
            if (d && !isFinite(d.getTime())) d = null;
            return { id: r.id, d: d, img: r.img || '', city: (r.city || '').trim(), lat: typeof r.lat === 'number' ? r.lat : null, lng: typeof r.lng === 'number' ? r.lng : null, place: '' };
        });
        items.sort(function (a, b) { return (b.d ? b.d.getTime() : 0) - (a.d ? a.d.getTime() : 0); });
        assignPlaces(items);
        return items;
    }

    // Agrupa por ciudad. Los Tics antiguos sin ciudad se asignan a la ciudad cercana
    // (menos de ~15 km) o, si no hay ninguna, a una zona aproximada de ~10 km.
    function assignPlaces(items) {
        var centroids = {};
        items.forEach(function (it) {
            if (!it.city || it.lat == null) return;
            var k = norm(it.city);
            var c = centroids[k] || (centroids[k] = { name: it.city, lat: 0, lng: 0, n: 0 });
            c.lat += it.lat; c.lng += it.lng; c.n++;
        });
        var list = Object.keys(centroids).map(function (k) { var c = centroids[k]; return { key: k, name: c.name, lat: c.lat / c.n, lng: c.lng / c.n }; });
        var zones = [];
        function nearest(pool, it) {
            var best = null, bestDist = 0.15;
            pool.forEach(function (c) {
                var dx = (c.lng - it.lng) * Math.cos(it.lat * Math.PI / 180), dy = c.lat - it.lat;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < bestDist) { bestDist = dist; best = c; }
            });
            return best;
        }
        items.forEach(function (it) {
            if (it.city) { it.placeKey = norm(it.city); it.placeName = it.city; return; }
            if (it.lat == null || it.lng == null) { it.placeKey = '~none'; it.placeName = 'Sin ubicación'; return; }
            var best = nearest(list, it);
            if (best) { it.placeKey = best.key; it.placeName = best.name; return; }
            var zone = nearest(zones, it);
            if (!zone) {
                zone = { lat: it.lat, lng: it.lng, key: '~z' + zones.length, name: 'Zona ' + it.lat.toFixed(1) + ', ' + it.lng.toFixed(1) };
                zones.push(zone);
            }
            it.placeKey = zone.key; it.placeName = zone.name;
        });
    }

    var ICON_SEARCH = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
    var ICON_GO = '<svg class="tarc-go" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>';

    var arc = null; // estado del archivo abierto

    function tileHtml(it, withDate) {
        return '<button type="button" class="tarc-tile" data-open="' + esc(it.id) + '" aria-label="Abrir Tic">' +
            '<img src="' + esc(thumbUrl(it.img, 240)) + '" data-full="' + esc(assetUrl(it.img)) + '" alt="" loading="lazy" decoding="async" onerror="TicsArchive._imgErr(this)">' +
            (withDate && it.d ? '<span class="tarc-tile-date">' + esc(shortDate(it.d)) + '</span>' : '') + '</button>';
    }

    function ensureRoot() {
        if (arc.root) return;
        var root = document.createElement('div');
        root.className = 'tarc';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.innerHTML = '<div class="tarc-backdrop" data-close="1"></div><div class="tarc-panel">' +
            '<div class="tarc-top"><h2 class="tarc-title"><span data-el="title"></span><span class="tarc-count" data-el="count"></span></h2>' +
            '<button type="button" class="tarc-close" data-close="1" aria-label="Cerrar">&times;</button></div>' +
            '<div class="tarc-tabs"><button type="button" class="tarc-tab" data-tab="date">Por fecha</button><button type="button" class="tarc-tab" data-tab="place">Por lugar</button></div>' +
            '<div class="tarc-scroll" data-el="body"></div></div>';
        var viewer = document.createElement('div');
        viewer.className = 'tarc-viewer';
        viewer.hidden = true;
        viewer.innerHTML = '<button type="button" class="tarc-viewer-close" data-vclose="1" aria-label="Cerrar">&times;</button><div data-el="vbody"></div>';
        document.body.appendChild(root);
        document.body.appendChild(viewer);
        arc.root = root;
        arc.viewer = viewer;
        root.addEventListener('click', onRootClick);
        root.addEventListener('input', onRootInput);
        root.addEventListener('change', onRootChange);
        viewer.addEventListener('click', function (e) {
            if (e.target === viewer || e.target.closest('[data-vclose]')) closeViewer();
        });
    }

    function $(sel) { return arc.root.querySelector(sel); }

    function open(opts) {
        injectStyle();
        var sameUser = arc && String(arc.opts.userId) === String(opts.userId);
        if (!arc || !sameUser) {
            if (arc && arc.root) { arc.root.remove(); arc.viewer.remove(); }
            arc = { opts: opts, items: [], tab: 'date', monthKey: '', dayKey: '', placeKey: '', placeShown: PLACE_PAGE, query: '', order: 'count', root: null, viewer: null, ready: false };
        } else {
            arc.opts = opts;
        }
        ensureRoot();
        arc.root.hidden = false;
        document.documentElement.style.overflow = 'hidden';
        $('[data-el="title"]').textContent = opts.title || 'Todos los Tics';
        $('[data-el="count"]').textContent = '';
        $('[data-el="body"]').innerHTML = '<div class="tarc-empty">Cargando...</div>';
        loadSummary(opts).then(function (raw) {
            arc.items = prepareItems(raw);
            arc.ready = true;
            $('[data-el="count"]').textContent = arc.items.length ? String(arc.items.length) : '';
            var first = arc.items.find(function (i) { return i.d; });
            arc.monthKey = first ? monthKeyOf(first.d) : monthKeyOf(new Date());
            arc.dayKey = '';
            arc.placeKey = '';
            arc.tab = opts.tab || 'date';
            render();
        }).catch(function () {
            $('[data-el="body"]').innerHTML = '<div class="tarc-empty">No se pudo cargar el archivo. Inténtalo de nuevo.</div>';
        });
    }

    function close() {
        if (!arc || !arc.root) return;
        closeViewer();
        arc.root.hidden = true;
        document.documentElement.style.overflow = '';
    }

    function render() {
        if (!arc || !arc.ready) return;
        arc.root.querySelectorAll('.tarc-tab').forEach(function (b) { b.classList.toggle('is-on', b.dataset.tab === arc.tab); });
        var body = $('[data-el="body"]');
        if (!arc.items.length) {
            body.innerHTML = '<div class="tarc-empty">Todavía no hay Tics para mostrar.</div>';
            return;
        }
        if (arc.tab === 'date') renderDate(body); else renderPlaces(body);
    }

    // ---- fecha
    function monthsWithTics() {
        var seen = {}, out = [];
        arc.items.forEach(function (it) {
            if (!it.d) return;
            var k = monthKeyOf(it.d);
            if (!seen[k]) { seen[k] = true; out.push(k); }
        });
        return out; // ya vienen de mas nuevo a mas antiguo
    }
    function shiftMonth(key, delta) {
        var p = key.split('-');
        var d = new Date(Number(p[0]), Number(p[1]) - 1 + delta, 1);
        return monthKeyOf(d);
    }

    function renderDate(body) {
        var months = monthsWithTics();
        if (!months.length) { body.innerHTML = '<div class="tarc-empty">Estos Tics no tienen fecha.</div>'; return; }
        var monthKey = arc.monthKey;
        var opts = months.slice();
        if (opts.indexOf(monthKey) === -1) opts.push(monthKey);
        opts.sort().reverse();
        var newest = months[0], oldest = months[months.length - 1];

        var p = monthKey.split('-');
        var year = Number(p[0]), month = Number(p[1]) - 1;
        var firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // lunes = 0
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        var byDay = {};
        arc.items.forEach(function (it) {
            if (!it.d || monthKeyOf(it.d) !== monthKey) return;
            var k = dayKeyOf(it.d);
            (byDay[k] || (byDay[k] = [])).push(it);
        });
        if (!arc.dayKey || arc.dayKey.slice(0, 7) !== monthKey) {
            var keys = Object.keys(byDay).sort().reverse();
            arc.dayKey = keys[0] || '';
        }

        var html = '<div class="tarc-monthbar">' +
            '<button type="button" class="tarc-nav" data-month="-1" aria-label="Mes anterior"' + (monthKey <= oldest ? ' disabled' : '') + '>&lsaquo;</button>' +
            '<select class="tarc-monthsel" data-monthsel="1" aria-label="Elegir mes">' +
            opts.map(function (k) { return '<option value="' + k + '"' + (k === monthKey ? ' selected' : '') + '>' + esc(monthLabel(k)) + '</option>'; }).join('') +
            '</select>' +
            '<button type="button" class="tarc-nav" data-month="1" aria-label="Mes siguiente"' + (monthKey >= newest ? ' disabled' : '') + '>&rsaquo;</button></div>';
        html += '<div class="tarc-dow">' + DOW.map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div><div class="tarc-cal">';
        for (var i = 0; i < firstDow; i++) html += '<span></span>';
        for (var day = 1; day <= daysInMonth; day++) {
            var dk = monthKey + '-' + pad(day);
            var list = byDay[dk];
            if (list && list.length) {
                html += '<button type="button" class="tarc-day has' + (dk === arc.dayKey ? ' is-sel' : '') + '" data-day="' + dk + '" aria-label="' + day + ', ' + list.length + ' Tics">' +
                    '<img src="' + esc(thumbUrl(list[0].img, 160)) + '" data-full="' + esc(assetUrl(list[0].img)) + '" alt="" loading="lazy" decoding="async" onerror="TicsArchive._imgErr(this)">' +
                    '<b>' + day + '</b>' + (list.length > 1 ? '<i>' + list.length + '</i>' : '') + '</button>';
            } else {
                html += '<span class="tarc-day"><b>' + day + '</b></span>';
            }
        }
        html += '</div>';
        var sel = byDay[arc.dayKey];
        if (sel && sel.length) {
            var dd = sel[0].d;
            html += '<div class="tarc-sub">' + dd.getDate() + ' de ' + MONTHS[dd.getMonth()].toLowerCase() + ' de ' + dd.getFullYear() + ' &middot; ' + sel.length + (sel.length === 1 ? ' Tic' : ' Tics') + '</div>' +
                '<div class="tarc-grid">' + sel.map(function (it) { return tileHtml(it, false); }).join('') + '</div>';
        } else {
            html += '<div class="tarc-sub">Toca un día con foto para verla.</div>';
        }
        var scrollTop = body.scrollTop;
        body.innerHTML = html;
        body.scrollTop = scrollTop;
    }

    // ---- lugares
    function groupPlaces() {
        var map = {};
        arc.items.forEach(function (it) {
            var g = map[it.placeKey] || (map[it.placeKey] = { key: it.placeKey, name: it.placeName, items: [] });
            g.items.push(it);
        });
        return Object.keys(map).map(function (k) { return map[k]; });
    }

    var ORDER_LABEL = { count: 'Más Tics', recent: 'Recientes', alpha: 'A-Z' };

    function renderPlaces(body) {
        if (arc.placeKey) return renderPlaceDetail(body);
        var groups = groupPlaces();
        var q = norm(arc.query);
        if (q) groups = groups.filter(function (g) { return norm(g.name).indexOf(q) !== -1; });
        groups.sort(function (a, b) {
            if (arc.order === 'alpha') return a.name.localeCompare(b.name, 'es');
            if (arc.order === 'recent') return ((b.items[0].d || 0) - (a.items[0].d || 0));
            return b.items.length - a.items.length || a.name.localeCompare(b.name, 'es');
        });
        var html = '<div class="tarc-tools"><label class="tarc-search">' + ICON_SEARCH +
            '<input type="search" data-q="1" placeholder="Buscar ciudad o lugar" value="' + esc(arc.query) + '" autocomplete="off"></label>' +
            '<button type="button" class="tarc-order" data-order="1">' + ORDER_LABEL[arc.order] + '</button></div>';
        if (!groups.length) {
            html += '<div class="tarc-empty">No hay lugares que coincidan.</div>';
        } else {
            html += groups.map(function (g) {
                var last = g.items[0];
                return '<button type="button" class="tarc-row" data-place="' + esc(g.key) + '">' +
                    '<span class="tarc-cover"><img src="' + esc(thumbUrl(last.img, 160)) + '" data-full="' + esc(assetUrl(last.img)) + '" alt="" loading="lazy" decoding="async" onerror="TicsArchive._imgErr(this)"></span>' +
                    '<span class="tarc-row-text"><span class="tarc-row-name">' + esc(g.name) + '</span>' +
                    '<span class="tarc-row-sub">' + g.items.length + (g.items.length === 1 ? ' Tic' : ' Tics') + (last.d ? ' &middot; último ' + esc(shortDate(last.d)) : '') + '</span></span>' + ICON_GO + '</button>';
            }).join('');
        }
        var keepQuery = document.activeElement && document.activeElement.matches && document.activeElement.matches('[data-q]');
        var st = body.scrollTop;
        body.innerHTML = html;
        body.scrollTop = st;
        if (keepQuery) {
            var input = body.querySelector('[data-q]');
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }
    }

    function renderPlaceDetail(body) {
        var group = groupPlaces().find(function (g) { return g.key === arc.placeKey; });
        if (!group) { arc.placeKey = ''; return renderPlaces(body); }
        var shown = group.items.slice(0, arc.placeShown);
        var html = '<button type="button" class="tarc-back" data-back="1">&lsaquo; Lugares</button>' +
            '<div class="tarc-sub" style="margin-top:2px">' + esc(group.name) + ' &middot; ' + group.items.length + (group.items.length === 1 ? ' Tic' : ' Tics') + '</div>' +
            '<div class="tarc-grid">' + shown.map(function (it) { return tileHtml(it, true); }).join('') + '</div>';
        if (group.items.length > shown.length) html += '<button type="button" class="tarc-more" data-more="1">Mostrar más</button>';
        var st = body.scrollTop;
        body.innerHTML = html;
        body.scrollTop = st;
    }

    // ---- eventos
    function onRootClick(e) {
        var t = e.target;
        if (t.closest('[data-close]')) return close();
        var tab = t.closest('[data-tab]');
        if (tab) { arc.tab = tab.dataset.tab; if (arc.tab === 'place') arc.placeKey = ''; arc.placeShown = PLACE_PAGE; return render(); }
        var mv = t.closest('[data-month]');
        if (mv) {
            var months = monthsWithTics();
            var next = shiftMonth(arc.monthKey, Number(mv.dataset.month));
            if (next > months[0]) next = months[0];
            if (next < months[months.length - 1]) next = months[months.length - 1];
            arc.monthKey = next; arc.dayKey = '';
            return render();
        }
        var day = t.closest('[data-day]');
        if (day) { arc.dayKey = day.dataset.day; return render(); }
        var place = t.closest('[data-place]');
        if (place) { arc.placeKey = place.dataset.place; arc.placeShown = PLACE_PAGE; $('[data-el="body"]').scrollTop = 0; return render(); }
        if (t.closest('[data-back]')) { arc.placeKey = ''; return render(); }
        if (t.closest('[data-more]')) { arc.placeShown += PLACE_PAGE; return render(); }
        if (t.closest('[data-order]')) {
            arc.order = arc.order === 'count' ? 'recent' : arc.order === 'recent' ? 'alpha' : 'count';
            return render();
        }
        var tile = t.closest('[data-open]');
        if (tile) return openViewer(tile.dataset.open);
    }
    function onRootInput(e) {
        if (e.target.matches('[data-q]')) { arc.query = e.target.value; render(); }
    }
    function onRootChange(e) {
        if (e.target.matches('[data-monthsel]')) { arc.monthKey = e.target.value; arc.dayKey = ''; render(); }
    }

    // ---- visor de un Tic completo (se descarga solo al abrirlo)
    function viewerCard(raw) {
        return global.SocialUI.ticCardHTML(arc.opts.toCard(raw), { eager: true });
    }
    function openViewer(id) {
        var vbody = arc.viewer.querySelector('[data-el="vbody"]');
        vbody.innerHTML = '<div class="tarc-note" style="color:#fff">Cargando...</div>';
        arc.viewer.hidden = false;
        arc.viewer.scrollTop = 0;
        arc.viewerId = id;
        var url = (arc.opts.apiBase || apiBase()) + '/api/publicaciones/usuario/' + encodeURIComponent(arc.opts.userId) +
            '?viewerId=' + encodeURIComponent(arc.opts.viewerId || '') + '&ids=' + encodeURIComponent(id);
        authFetch(url).then(function (data) {
            var raw = Array.isArray(data) ? data[0] : null;
            if (!raw) throw new Error('missing');
            if (arc.opts.register) arc.opts.register([raw]);
            if (String(arc.viewerId) !== String(id)) return;
            vbody.innerHTML = viewerCard(raw);
            global.SocialUI.hydrate(vbody);
        }).catch(function () {
            vbody.innerHTML = '<div class="tarc-note" style="color:#fff">No se pudo abrir este Tic.</div>';
        });
    }
    function closeViewer() {
        var cb = viewerOnClose; viewerOnClose = null;
        if (arc && arc.viewer) { arc.viewer.hidden = true; arc.viewerId = null; arc.viewer.querySelector('[data-el="vbody"]').innerHTML = ''; }
        if (cb) { try { cb(); } catch (e) { } }
    }

    // Tras dar like / comentar: repinta lo abierto sin volver a pedir nada al servidor.
    function refresh() {
        try {
            renderRecentFromIds();
            if (arc && arc.viewer && !arc.viewer.hidden && arc.viewerId) {
                var raw = (global.publicationPhotos || []).find(function (p) { return String(p.id) === String(arc.viewerId); });
                if (raw) {
                    var vbody = arc.viewer.querySelector('[data-el="vbody"]');
                    vbody.innerHTML = viewerCard(raw);
                    global.SocialUI.hydrate(vbody);
                }
            }
        } catch (e) { /* ignore */ }
    }

    function invalidate() { summaryCache = {}; }

    // Abre el visor de un unico Tic (usado por la rejilla de "Tics recientes" del perfil)
    // sin mostrar detras el panel completo del archivo por fecha/lugar.
    function openOne(id, opts) {
        injectStyle();
        var sameUser = arc && String(arc.opts.userId) === String(opts.userId);
        if (!arc || !sameUser) {
            if (arc && arc.root) { arc.root.remove(); arc.viewer.remove(); }
            arc = { opts: opts, items: [], tab: 'date', monthKey: '', dayKey: '', placeKey: '', placeShown: PLACE_PAGE, query: '', order: 'count', root: null, viewer: null, ready: false };
        } else {
            arc.opts = opts;
        }
        ensureRoot();
        arc.root.hidden = true;
        viewerOnClose = typeof opts.onClose === 'function' ? opts.onClose : null;
        openViewer(id);
    }

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' || !arc) return;
        if (arc.viewer && !arc.viewer.hidden) { closeViewer(); return; }
        if (arc.root && !arc.root.hidden) close();
    });

    try { injectStyle(); } catch (e) { /* ignore */ }

    global.TicsArchive = {
        loadRecent: loadRecent,
        open: open,
        openOne: openOne,
        close: close,
        refresh: refresh,
        invalidate: invalidate,
        thumbUrl: thumbUrl,
        summary: loadSummary,
        RECENT_COUNT: RECENT_COUNT,
        _imgErr: function (img) {
            if (!img.dataset.retried && img.dataset.full && img.src !== img.dataset.full) {
                img.dataset.retried = '1';
                img.src = img.dataset.full;
                return;
            }
            var box = img.closest('.tarc-tile');
            if (box) box.classList.add('is-broken');
        }
    };
})(window);
