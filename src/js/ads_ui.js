/*
 * SeeYou - anuncios propios (patrocinadores) en el feed.
 *   SeeYouAds.load()                       -> Promise con los anuncios activos
 *   SeeYouAds.interleave(cardsHtml, ads)   -> mete un anuncio cada 5 Tics (el primero tras el 4.o)
 *   SeeYouAds.observe(root)                -> mide cuanto tiempo se queda la persona en cada anuncio
 * Una vista solo se registra tras permanecer el tiempo minimo con el anuncio visible; pasar de largo no cuenta.
 */
(function () {
    'use strict';
    if (window.SeeYouAds) return;

    // CONFIG es un const de nivel superior en config.js: no cuelga de window.CONFIG (por eso
    // antes esto devolvia siempre '' en la app nativa, y las peticiones de anuncios/monedas
    // acababan pidiendo una URL relativa que el servidor local de la app respondia con su
    // propio index.html en vez de llegar al servidor real).
    var API = function () { try { return (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) || ''; } catch (e) { return ''; } };
    var minMs = 5000;
    var loaded = { at: 0, ads: [] };
    var io = null, ticker = null;
    var states = new Map();

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function imgUrl(u) { if (!u) return ''; return /^https?:|^data:/.test(u) ? u : API() + '/' + String(u).replace(/^\/?/, ''); }
    function safeLink(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }
    function lang() { try { return (typeof CONFIG !== 'undefined' && CONFIG.currentLanguage) || document.documentElement.lang || 'es'; } catch (e) { return 'es'; } }
    function me() { try { return localStorage.getItem('current_user_id') || ''; } catch (e) { return ''; } }

    function injectCss() {
        if (document.getElementById('sy-ad-css')) return;
        var st = document.createElement('style');
        st.id = 'sy-ad-css';
        st.textContent =
            '.sy-ad{--ad-surface:var(--app-surface,#fff);--ad-text:var(--app-text,#1D1B20);--ad-muted:var(--app-muted,#667085);--ad-border:var(--app-border,#E8EAF0);position:relative;text-align:left;width:92%;max-width:470px;margin:0 auto 22px;background:var(--ad-surface);color:var(--ad-text);border:1px solid var(--ad-border);border-radius:24px;box-shadow:0 1px 2px rgba(15,23,42,.04),0 14px 34px -16px rgba(27,58,92,.32);overflow:hidden;box-sizing:border-box}' +
            '.sy-ad-head{display:flex;align-items:center;gap:10px;padding:12px 16px 10px}' +
            '.sy-ad-logo{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#1B3A5C,#3B82F6);color:#fff;display:grid;place-items:center;font-weight:800;font-size:14px;flex:none}' +
            '.sy-ad-who{min-width:0;flex:1}.sy-ad-who b{display:block;font-size:14.5px;line-height:1.2;word-break:break-word}' +
            '.sy-ad-tag{display:inline-block;margin-top:2px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ad-muted)}' +
            '.sy-ad-img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;background:#E9EEF5}' +
            '.sy-ad-body{padding:12px 16px 4px}.sy-ad-body h4{margin:0 0 4px;font-size:16px;line-height:1.25}.sy-ad-body p{margin:0;font-size:14px;line-height:1.45;color:var(--ad-muted);word-break:break-word}' +
            '.sy-ad-foot{display:flex;align-items:center;gap:10px;padding:10px 16px 14px}' +
            '.sy-ad-cta{flex:1;text-align:center;text-decoration:none;font:800 14.5px system-ui,sans-serif;color:#fff;background:linear-gradient(135deg,#1B3A5C,#2F6FDD);border-radius:999px;padding:11px 16px}' +
            '.sy-ad-cta:active{transform:scale(.97)}' +
            '.sy-ad-state{font:700 12px system-ui,sans-serif;color:var(--ad-muted);white-space:nowrap;min-width:64px;text-align:right}' +
            '.sy-ad-state.ok{color:#15803D}' +
            '.sy-ad-bar{position:absolute;left:0;right:0;bottom:0;height:4px;background:transparent}' +
            '.sy-ad-bar i{display:block;height:100%;width:calc(var(--p,0) * 100%);background:linear-gradient(90deg,#F5B82E,#FFE07A);transition:width .25s linear}' +
            '.sy-ad.is-done .sy-ad-bar i{background:#22C55E}';
        document.head.appendChild(st);
    }

    function load() {
        if (Date.now() - loaded.at < 60000) return Promise.resolve(loaded.ads);
        var ctl = typeof AbortController === 'function' ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 2500);
        return fetch(API() + '/api/ads/feed?limit=4&lang=' + encodeURIComponent(lang()), { cache: 'no-store', signal: ctl ? ctl.signal : undefined })
            .then(function (r) { return r.ok ? r.json() : { ads: [] }; })
            .then(function (d) {
                clearTimeout(timer);
                if (d && d.minSeconds) minMs = Math.max(1000, d.minSeconds * 1000);
                loaded = { at: Date.now(), ads: buildList(d) };
                return loaded.ads;
            })
            .catch(function () { clearTimeout(timer); return []; });
    }

    function isNative() {
        try { return typeof window.Capacitor !== 'undefined' && (window.Capacitor.isNativePlatform ? window.Capacitor.isNativePlatform() : true); } catch (e) { return false; }
    }
    // Campañas de pago + tarjeta "Invita a tus amigos" (si el admin la tiene activada) + bloque de Google AdSense (solo web, si esta configurado).
    function buildList(d) {
        var list = ((d && d.ads) || []).slice();
        var promo = (d && d.promo) || {};
        if (promo.invite && me()) list.splice(Math.min(1, list.length), 0, { kind: 'house', id: 'house-invite' });
        if (promo.adsense && promo.adsense.slot && !isNative()) list.push({ kind: 'adsense', id: 'adsense', client: promo.adsense.client, slot: promo.adsense.slot });
        return list;
    }
    function houseHTML() {
        return '<article class="sy-ad sy-house" aria-label="Invita a tus amigos">' +
            '<div class="sy-ad-head"><div class="sy-ad-logo">S</div><div class="sy-ad-who"><b>SeeYou</b><span class="sy-ad-tag">Recomendado</span></div></div>' +
            '<div class="sy-ad-body"><h4>Invita a tus amigos y gana monedas</h4><p>Cada amigo que se una con tu enlace o QR será amigo tuyo desde el primer momento y te suma monedas mientras siga activo.</p></div>' +
            '<div class="sy-ad-foot"><button type="button" class="sy-ad-cta" data-house="invite" style="border:0;cursor:pointer">Invitar amigos</button></div></article>';
    }
    function adsenseHTML(ad) {
        return '<article class="sy-ad sy-adsense" aria-label="Publicidad"><div class="sy-ad-head" style="padding-bottom:4px"><span class="sy-ad-tag" style="margin:0">Publicidad</span></div>' +
            '<div style="padding:0 8px 10px;min-height:120px"><ins class="adsbygoogle" style="display:block" data-ad-client="' + esc(ad.client) + '" data-ad-slot="' + esc(ad.slot) + '" data-ad-format="auto" data-full-width-responsive="true"></ins></div></article>';
    }
    function initAdsense(root) {
        try {
            root.querySelectorAll('ins.adsbygoogle:not([data-sy-done])').forEach(function (ins) {
                ins.setAttribute('data-sy-done', '1');
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            });
        } catch (e) { /* si Google no carga, el hueco simplemente queda vacio */ }
    }

    function cardHTML(ad) {
        if (ad.kind === 'house') return houseHTML();
        if (ad.kind === 'adsense') return adsenseHTML(ad);
        var link = safeLink(ad.link_url);
        var img = imgUrl(ad.image_url);
        return '<article class="sy-ad" data-ad-id="' + esc(ad.id) + '" aria-label="Anuncio patrocinado">' +
            '<div class="sy-ad-head"><div class="sy-ad-logo">' + esc((ad.sponsor || ad.title || '?').charAt(0).toUpperCase()) + '</div>' +
            '<div class="sy-ad-who"><b>' + esc(ad.sponsor || 'Patrocinador') + '</b><span class="sy-ad-tag">Patrocinado</span></div></div>' +
            (img ? '<img class="sy-ad-img" src="' + esc(img) + '" alt="" loading="lazy" decoding="async">' : '') +
            ((ad.title || ad.body) ? '<div class="sy-ad-body">' + (ad.title ? '<h4>' + esc(ad.title) + '</h4>' : '') + (ad.body ? '<p>' + esc(ad.body) + '</p>' : '') + '</div>' : '') +
            '<div class="sy-ad-foot">' + (link ? '<a class="sy-ad-cta" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer sponsored" data-ad-click="1">' + esc(ad.cta || 'Saber más') + '</a>' : '<span style="flex:1"></span>') +
            '<span class="sy-ad-state" aria-live="polite"></span></div>' +
            '<div class="sy-ad-bar"><i></i></div></article>';
    }

    // Un anuncio tras el 4.o Tic y luego cada 5 (en feeds cortos, al final). Cada anuncio se usa una vez por carga.
    function interleave(cards, ads) {
        if (!ads || !ads.length) return cards.join('');
        injectCss();
        var out = [], next = 0;
        cards.forEach(function (html, i) {
            out.push(html);
            var pos = i + 1;
            if (pos >= 4 && (pos - 4) % 5 === 0 && next < ads.length && pos < cards.length) out.push(cardHTML(ads[next++]));
        });
        // Feeds cortos (pocos amigos): el primer anuncio va al final para que se vea igualmente.
        if (next === 0) out.push(cardHTML(ads[0]));
        return out.join('');
    }

    function send(el, st) {
        var uid = me();
        if (!uid) return;
        fetch(API() + '/api/ads/view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: uid, adId: st.id, ms: Math.round(st.ms) }) })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                var label = el.querySelector('.sy-ad-state');
                if (d && d.counted) {
                    label.textContent = d.awarded ? '+1 moneda' : '✓ Visto';
                    label.classList.add('ok');
                    if (window.SeeYouCoins && SeeYouCoins.checkGain) setTimeout(function () { SeeYouCoins.checkGain(uid); }, 600);
                } else {
                    label.textContent = d && d.reason === 'repetido' ? 'Ya visto' : (d && d.capped ? 'Límite de hoy' : '');
                }
            }).catch(function () { st.sent = false; });
    }

    // La tarjeta se ha visto en pantalla (aunque la persona pase de largo): cuenta como impresion.
    function impression(adId) {
        var uid = me();
        if (!uid) return;
        try { fetch(API() + '/api/ads/impression', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: uid, adId: adId }) }).catch(function () { }); } catch (e) { }
    }

    function tick() {
        var now = Date.now(), any = false;
        states.forEach(function (st, el) {
            if (!el.isConnected) { states.delete(el); return; }
            if (!st.visible || st.sent) { st.last = now; return; }
            any = true;
            if (document.visibilityState === 'visible') st.ms += Math.min(now - st.last, 600);
            st.last = now;
            var p = Math.min(1, st.ms / minMs);
            el.style.setProperty('--p', p);
            var label = el.querySelector('.sy-ad-state');
            if (p < 1 && label) label.textContent = Math.ceil((minMs - st.ms) / 1000) + ' s';
            if (st.ms >= minMs) { st.sent = true; el.classList.add('is-done'); if (label) label.textContent = ''; send(el, st); }
        });
        if (!any && ticker) { clearInterval(ticker); ticker = null; }
    }

    function observe(root) {
        if (!root) return;
        initAdsense(root);
        if (!root.dataset.houseBound) {
            root.dataset.houseBound = '1';
            root.addEventListener('click', function (e) {
                var b = e.target.closest('[data-house="invite"]');
                if (!b) return;
                var uid = me();
                if (window.SeeYouCoins && uid) SeeYouCoins.openSheet(uid, 'invite');
            });
        }
        if (!('IntersectionObserver' in window)) return;
        if (io) io.disconnect();
        states.clear();
        io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                var st = states.get(en.target);
                if (!st) return;
                st.visible = en.isIntersecting && en.intersectionRatio >= 0.6;
                if (st.visible && !st.impressed) { st.impressed = true; impression(st.id); }
                st.last = Date.now();
                if (st.visible && !ticker) ticker = setInterval(tick, 250);
            });
        }, { threshold: [0, 0.6, 1] });
        root.querySelectorAll('.sy-ad[data-ad-id]').forEach(function (el) {
            states.set(el, { id: el.dataset.adId, ms: 0, visible: false, sent: false, last: Date.now() });
            io.observe(el);
        });
        if (root.dataset.adClickBound) return;
        root.dataset.adClickBound = '1';
        root.addEventListener('click', function (e) {
            var a = e.target.closest('[data-ad-click]');
            var card = a && a.closest('.sy-ad');
            if (!card) return;
            try { fetch(API() + '/api/ads/click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adId: card.dataset.adId }), keepalive: true }); } catch (err) { }
        });
    }

    window.SeeYouAds = { load: load, interleave: interleave, observe: observe, cardHTML: cardHTML };
})();
