/*
 * SeeYou · Videos con recompensa de Google AdMob (solo apps Android/iOS).
 *   SeeYouAdMob.available()                    -> true si estamos en la app nativa y el plugin esta instalado
 *   SeeYouAdMob.mountRewarded(el, userId)      -> pinta en `el` la tarjeta "Ver un video y gana monedas" (si el admin lo ha activado)
 *
 * Flujo: el servidor da un testigo firmado (start) -> se carga el video con verificacion de servidor (SSV) ->
 * al terminar, Google avisa a nuestro servidor y este paga las monedas. La app solo espera y refresca el saldo.
 * Orden de permisos: (iOS) App Tracking Transparency -> consentimiento UMP en Europa -> SDK de anuncios.
 */
(function () {
    'use strict';
    if (window.SeeYouAdMob) return;

    var API = function () { try { return (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) || ''; } catch (e) { return ''; } };
    function T(key, fallback) {
        try { if (typeof CONFIG !== 'undefined' && typeof CONFIG.translate === 'function') return CONFIG.translate(key, fallback) || fallback; } catch (e) { }
        return fallback;
    }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function isNative() {
        try { return typeof window.Capacitor !== 'undefined' && (window.Capacitor.isNativePlatform ? window.Capacitor.isNativePlatform() : true); } catch (e) { return false; }
    }
    function platform() { try { return window.Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'; } catch (e) { return 'android'; } }
    function plugin() { try { return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob) || null; } catch (e) { return null; } }
    function available() { return isNative() && !!plugin(); }
    function authHeaders() {
        var h = { 'Content-Type': 'application/json' };
        try {
            var t = localStorage.getItem('seeYou_auth_token');
            if (t) h['Authorization'] = 'Bearer ' + t;
            h['X-Device-Fingerprint'] = localStorage.getItem('seeYou_device_fingerprint') || (navigator.userAgent + '||' + navigator.platform);
        } catch (e) { }
        return h;
    }
    function call(method, path, body) {
        return fetch(API() + path, { method: method, headers: authHeaders(), body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
            .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.__status = r.status; return j; }); });
    }

    /* ---------- SDK + permisos (una sola vez) ---------- */
    var ready = null, lastConsent = '';
    function init() {
        if (ready) return ready;
        ready = (async function () {
            var A = plugin();
            if (!A) return false;
            if (platform() === 'ios') {
                try {
                    var s = await A.trackingAuthorizationStatus();
                    if (s && s.status === 'notDetermined') await A.requestTrackingAuthorization();
                } catch (e) { /* si falla, se sigue: Google pedira el consentimiento igualmente */ }
            }
            await A.initialize({});
            var info = await A.requestConsentInfo();
            if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') info = await A.showConsentForm();
            lastConsent = info ? (info.status + '/form=' + info.isConsentFormAvailable + '/can=' + info.canRequestAds) : 'sin info';
            return Boolean(info && info.canRequestAds);
        })().catch(function (e) { console.warn('[SeeYou] AdMob no se pudo iniciar:', e && e.message); ready = null; return false; });
        return ready;
    }

    /* ---------- ver el video ---------- */
    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    async function watch(cfg, userId) {
        var ok = await init();
        // En modo pruebas se sigue aunque Google no haya dado el consentimiento (los anuncios de ejemplo no lo necesitan).
        if (!ok && !cfg.testing) { report('error', 'init/consentimiento ' + lastConsent); return { error: T('rw_consent_needed', 'Para ver anuncios necesitamos tu consentimiento de publicidad.') }; }
        var st = await call('POST', '/api/ads/rewarded/start');
        if (!st.token) return { error: st.__status === 429 ? T('rw_limit_today', 'Has llegado al límite de videos de hoy.') : T('rw_not_available', 'Ahora mismo no hay vídeos disponibles.') };
        var A = plugin(), rewarded = false, handles = [];
        try {
            handles.push(await A.addListener('onRewardedVideoAdReward', function () { rewarded = true; }));
            await A.prepareRewardVideoAd({ adId: cfg.adUnitId, isTesting: !!cfg.testing, ssv: { userId: String(userId), customData: st.token } });
            await A.showRewardVideoAd();
            rewarded = true;
            report('shown');
        } catch (e) {
            if (!rewarded) { report('error', e && (e.message || e.code || String(e))); return { error: T('rw_not_available', 'Ahora mismo no hay vídeos disponibles.') }; }
        } finally {
            handles.forEach(function (h) { try { h.remove(); } catch (e) { } });
        }
        if (!rewarded) return { error: T('rw_not_completed', 'Tienes que ver el vídeo completo para ganar la moneda.') };
        if (cfg.ssvRequired === false) await call('POST', '/api/ads/rewarded/claim', { token: st.token });
        return { rewarded: true };
    }

    function refreshBalance(userId) {
        // El pago llega cuando Google avisa al servidor: se mira el saldo unas cuantas veces.
        [1500, 4000, 9000].forEach(function (ms) {
            setTimeout(function () { try { if (window.SeeYouCoins && SeeYouCoins.checkGain) SeeYouCoins.checkGain(userId); } catch (e) { } }, ms);
        });
    }

    /* ---------- tarjeta en la hoja de monedas ---------- */
    function report(event, message) {
        try { call('POST', '/api/ads/rewarded/report', { platform: platform(), event: event, message: message || '' }).catch(function () { }); } catch (e) { }
    }
    function mountRewarded(el, userId) {
        if (!el || !userId) return;
        // App nativa SIN el plugin de anuncios = es una version vieja: se avisa al servidor para que el panel lo muestre.
        if (isNative() && !plugin()) { report('no_plugin'); return; }
        if (!available()) return;
        call('GET', '/api/ads/rewarded/config?platform=' + platform()).then(function (cfg) {
            if (!cfg || !cfg.enabled || !el.isConnected) return;
            paint(el, cfg, userId, '');
        }).catch(function () { });
    }
    function paint(el, cfg, userId, note) {
        var left = Math.max(0, Number(cfg.remaining) || 0);
        var coins = Number(cfg.coins) || 1;
        el.innerHTML = '<div class="cn-card"><h4>' + esc(T('rw_title', 'Gana monedas viendo un vídeo')) + '</h4>' +
            '<p>' + esc(T('rw_desc', '+{{n}} por cada vídeo · te quedan {{left}} hoy').replace('{{n}}', coins).replace('{{left}}', left)) + '</p>' +
            '<button type="button" class="cn-btn" data-rw="go"' + (left ? '' : ' disabled style="opacity:.55"') + '>' + esc(left ? T('rw_button', 'Ver un vídeo') : T('rw_done_today', 'Vuelve mañana')) + '</button>' +
            '<p class="rw-note" style="margin-top:8px;min-height:18px" aria-live="polite">' + esc(note || '') + '</p></div>';
        var btn = el.querySelector('[data-rw="go"]'), noteEl = el.querySelector('.rw-note');
        if (!btn || !left) return;
        btn.addEventListener('click', function () {
            btn.disabled = true; noteEl.textContent = T('rw_loading', 'Preparando el vídeo…');
            watch(cfg, userId).then(function (r) {
                if (r.rewarded) {
                    refreshBalance(userId);
                    cfg.remaining = Math.max(0, left - 1);
                    paint(el, cfg, userId, T('rw_thanks', '¡Gracias! Tus monedas llegarán en unos segundos.'));
                } else { btn.disabled = false; noteEl.textContent = r.error || ''; }
            }).catch(function () { btn.disabled = false; noteEl.textContent = T('rw_not_available', 'Ahora mismo no hay vídeos disponibles.'); });
        });
    }

    /* ---------- oferta "te faltan monedas: mira un video" ----------
     * mountOffer(el, userId, { need, onEarned })  -> pinta una tarjeta compacta en `el` si hay videos disponibles.
     * Cuando llega el pago, llama a onEarned(saldo) si el saldo ya llega a `need`. */
    function getBalance(userId) {
        return call('GET', '/api/shop/config').then(function (c) { return Number(c && c.balance) || 0; }).catch(function () { return 0; });
    }
    function waitForCoins(userId, need, onEarned, tries) {
        tries = tries || 0;
        getBalance(userId).then(function (bal) {
            if (bal >= need) { try { if (window.SeeYouCoins && SeeYouCoins.checkGain) SeeYouCoins.checkGain(userId); } catch (e) { } onEarned && onEarned(bal); return; }
            if (tries >= 8) { refreshBalance(userId); onEarned && onEarned(bal); return; }
            setTimeout(function () { waitForCoins(userId, need, onEarned, tries + 1); }, 2000);
        });
    }
    function offerStyle() {
        if (document.getElementById('rw-offer-style')) return;
        var st = document.createElement('style'); st.id = 'rw-offer-style';
        st.textContent = '.rw-offer{margin:12px 0 4px;padding:12px 14px;border-radius:16px;border:1.5px dashed rgba(47,111,221,.45);background:rgba(47,111,221,.07);display:flex;align-items:center;gap:12px;text-align:left}' +
            '.rw-offer .rw-t{flex:1;min-width:0;font:600 13.5px/1.35 system-ui,sans-serif;color:inherit}.rw-offer .rw-t small{display:block;font-weight:500;opacity:.7;margin-top:2px}' +
            '.rw-offer button{appearance:none;border:0;border-radius:999px;padding:10px 16px;font:800 14px system-ui,sans-serif;color:#fff;background:linear-gradient(135deg,#1B3A5C,#2F6FDD);cursor:pointer;white-space:nowrap}' +
            '.rw-offer button:disabled{opacity:.55}';
        document.head.appendChild(st);
    }
    function mountOffer(el, userId, opts) {
        opts = opts || {};
        if (!el || !userId || !available()) return;
        call('GET', '/api/ads/rewarded/config?platform=' + platform()).then(function (cfg) {
            if (!cfg || !cfg.enabled || !(Number(cfg.remaining) > 0) || !el.isConnected) return;
            offerStyle();
            var coins = Number(cfg.coins) || 1;
            var box = document.createElement('div'); box.className = 'rw-offer';
            box.innerHTML = '<div class="rw-t">' + esc(T('rw_offer_text', 'Te faltan monedas. Mira un vídeo y gana +{{n}}').replace('{{n}}', coins)) +
                '<small class="rw-note"></small></div><button type="button">' + esc(T('rw_button', 'Ver un vídeo')) + '</button>';
            el.appendChild(box);
            var btn = box.querySelector('button'), note = box.querySelector('.rw-note');
            btn.addEventListener('click', function () {
                btn.disabled = true; note.textContent = T('rw_loading', 'Preparando el vídeo…');
                watch(cfg, userId).then(function (r) {
                    if (!r.rewarded) { btn.disabled = false; note.textContent = r.error || ''; return; }
                    note.textContent = T('rw_thanks', '¡Gracias! Tus monedas llegarán en unos segundos.');
                    waitForCoins(userId, Number(opts.need) || 0, function (bal) {
                        if (opts.onEarned && bal >= (Number(opts.need) || 0)) opts.onEarned(bal);
                        else { btn.disabled = false; note.textContent = T('rw_more_needed', 'Aún te faltan monedas. Puedes ver otro vídeo.'); }
                    });
                }).catch(function () { btn.disabled = false; note.textContent = T('rw_not_available', 'Ahora mismo no hay vídeos disponibles.'); });
            });
        }).catch(function () { });
    }
    /* Hoja flotante con la oferta (para sitios sin hueco propio, como desbloquear un banner). */
    function offerSheet(userId, opts) {
        opts = opts || {};
        if (!available()) return false;
        offerStyle();
        var ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center';
        var card = document.createElement('div');
        card.style.cssText = 'width:100%;max-width:480px;background:#fff;color:#111827;border-radius:22px 22px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom,0px));font-family:system-ui,sans-serif';
        card.innerHTML = '<b style="font-size:16px">' + esc(opts.title || T('rw_offer_title', 'Te faltan monedas')) + '</b>' +
            '<div style="font-size:13.5px;opacity:.75;margin-top:4px">' + esc(opts.text || '') + '</div><div class="rw-slot"></div>' +
            '<button type="button" data-x style="margin-top:10px;width:100%;border:0;background:none;font:700 14px system-ui;color:#6B7280;padding:10px">' + esc(T('shop_restore_no', 'Ahora no')) + '</button>';
        ov.appendChild(card); document.body.appendChild(ov);
        function close() { ov.remove(); }
        ov.addEventListener('click', function (e) { if (e.target === ov || e.target.hasAttribute('data-x')) close(); });
        mountOffer(card.querySelector('.rw-slot'), userId, { need: opts.need, onEarned: function (bal) { close(); opts.onEarned && opts.onEarned(bal); } });
        return true;
    }

    window.SeeYouAdMob = { available: available, mountRewarded: mountRewarded, mountOffer: mountOffer, offerSheet: offerSheet, init: init };
})();
