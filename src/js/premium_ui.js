/* SeeYou Premium - tarjeta en Configuracion, compra (web: Stripe / app: tienda via RevenueCat) y estado compartido.
   El precio de la web (3,99 EUR/mes) lo fija el servidor; en la app el precio es el que ponga la tienda (4,99 EUR/mes). */
(function () {
    'use strict';
    var P = window.SeePremium = { active: false, loaded: false, data: null, onChange: [] };
    var API = function () { try { return (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) || ''; } catch (e) { return ''; } };
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function isNative() { try { return typeof window.Capacitor !== 'undefined' && (window.Capacitor.isNativePlatform ? window.Capacitor.isNativePlatform() : true); } catch (e) { return false; } }
    function platform() { try { return window.Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'; } catch (e) { return 'android'; } }
    function T(key, fallback) {
        try { if (typeof CONFIG !== 'undefined' && typeof CONFIG.translate === 'function') return CONFIG.translate(key, fallback) || fallback; } catch (e) { }
        return fallback;
    }
    function loc() { try { return (typeof CONFIG !== 'undefined' && CONFIG.currentLanguage) || 'es'; } catch (e) { return 'es'; } }
    function toast(m) { try { if (window.showToast) window.showToast(m); } catch (e) { } }
    function euros(c) { return (c / 100).toFixed(2).replace('.', ',') + ' €'; }
    function call(method, path, body) {
        return fetch(API() + path, { method: method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
            .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, data: d || {} }; }); })
            .catch(function () { return { ok: false, status: 0, data: {} }; });
    }
    function rcPlugin() { try { return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Purchases) || null; } catch (e) { return null; } }
    var rcReady = null, storePrice = '', storeProduct = null;
    function rcInit(uid, keys) {
        if (rcReady) return rcReady;
        var pl = rcPlugin(), key = keys && keys[platform()];
        if (!pl || !key) return Promise.resolve(false);
        rcReady = pl.configure({ apiKey: key, appUserID: String(uid) }).then(function () { return true; }).catch(function () { rcReady = null; return false; });
        return rcReady;
    }

    function refresh() {
        return call('GET', '/api/premium/status').then(function (r) {
            if (!r.ok) return P.data;
            P.data = r.data; P.active = !!r.data.active; P.loaded = true;
            P.onChange.forEach(function (fn) { try { fn(P); } catch (e) { } });
            render();
            try { window.dispatchEvent(new Event('seeyou-premium')); } catch (e) { }
            if (r.data.dailyGiven) { toast(T('pm_daily_coins', '+{{n}} monedas de tu Premium').replace('{{n}}', r.data.dailyCoins)); try { var uid = localStorage.getItem('current_user_id'); if (window.SeeYouCoins && SeeYouCoins.checkGain && uid) SeeYouCoins.checkGain(uid); } catch (e) { } }
            return r.data;
        });
    }

    function render() {
        var el = document.getElementById('premium-card');
        if (!el) return;
        var d = P.data;
        var perks = '<ul class="pm-perks"><li>' + esc(T('pm_perk_banner', 'Edita la forma de tu banner (dibuja rayos, lágrimas, lo que quieras)')) + '</li><li>' + esc(T('pm_perk_coins', '2 monedas gratis cada día')) + '</li><li>' + esc(T('pm_perk_verified', 'Verificado automático')) + '</li><li>' + esc(T('pm_perk_backgrounds', 'Todos los fondos gratis, también el banner con tu imagen')) + '</li></ul>';
        if (!d) { el.innerHTML = '<div class="pm-head"><b>SeeYou Premium</b></div><p class="pm-sub">' + esc(T('pm_loading', 'Cargando…')) + '</p>'; return; }
        if (d.active) {
            var until = ''; try { until = new Date(d.expiresAt).toLocaleDateString(loc(), { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { }
            var gift = d.source === 'admin';
            var forever = false; try { forever = new Date(d.expiresAt).getFullYear() >= 2099; } catch (e) { }
            var line = gift ? (forever ? T('pm_gift_forever', 'Regalo de SeeYou: tienes todas las ventajas, sin fecha de fin.') : (until ? T('pm_gift_until', 'Regalo de SeeYou: tienes todas las ventajas hasta el {{d}}.').replace('{{d}}', esc(until)) : T('pm_gift_nodate', 'Regalo de SeeYou: tienes todas las ventajas.')))
                : (until ? T('pm_active_until', 'Tienes todas las ventajas hasta el {{d}} (se renueva solo mientras no canceles).').replace('{{d}}', esc(until)) : T('pm_active_nodate', 'Tienes todas las ventajas.'));
            el.innerHTML = '<div class="pm-head"><b>SeeYou Premium</b><span class="pm-tag on">' + esc(forever ? T('pm_forever', 'Siempre') : T('pm_active', 'Activo')) + '</span></div>' +
                '<p class="pm-sub">' + line + '</p>' + perks +
                (gift ? '' : '<button type="button" class="pm-btn ghost" id="pm-manage">' + esc(T('pm_manage', 'Gestionar suscripción')) + '</button>');
            if (gift) return;
            el.querySelector('#pm-manage').onclick = manage;
            return;
        }
        var native = isNative();
        var price = native ? (storePrice || T('pm_per_month', '{{p}} / mes').replace('{{p}}', euros(d.priceAppCents))) : T('pm_per_month', '{{p}} / mes').replace('{{p}}', euros(d.priceWebCents));
        if (native && storePrice && !/mes|month/i.test(storePrice)) price = T('pm_per_month', '{{p}} / mes').replace('{{p}}', storePrice);
        el.innerHTML = '<div class="pm-head"><b>SeeYou Premium</b><span class="pm-tag">' + esc(price) + '</span></div>' +
            '<p class="pm-sub">' + esc(T('pm_sub', 'Una suscripción mensual. Cancela cuando quieras.')) + '</p>' + perks +
            '<button type="button" class="pm-btn" id="pm-buy">' + esc(T('pm_buy', 'Hazte Premium')) + '</button>';
        el.querySelector('#pm-buy').onclick = buy;
    }

    function buy() {
        var d = P.data; if (!d) return;
        var btn = document.getElementById('pm-buy'); if (btn) btn.disabled = true;
        var done = function () { if (btn) btn.disabled = false; };
        if (!isNative()) {
            if (!d.canBuyWeb) { toast(T('pm_pay_off', 'Los pagos aún no están activados.')); return done(); }
            call('POST', '/api/premium/checkout').then(function (r) {
                if (r.ok && r.data.url) { window.location.href = r.data.url; return; }
                toast(r.data.message || T('pm_pay_fail', 'No se pudo iniciar el pago.')); done();
            });
            return;
        }
        var pl = rcPlugin();
        if (!pl || !storeProduct) { toast(T('pm_app_soon', 'La suscripción en la app estará disponible muy pronto.')); return done(); }
        pl.purchaseStoreProduct({ product: storeProduct }).then(function () {
            toast(T('pm_thanks', '¡Gracias! Activando tu Premium…'));
            [2000, 6000, 12000].forEach(function (ms) { setTimeout(refresh, ms); });
        }).catch(function (err) {
            if (!(err && (err.userCancelled || /cancel/i.test(String(err.message || ''))))) toast(T('pm_buy_fail', 'No se pudo completar la compra.'));
        }).then(done);
    }

    function manage() {
        var d = P.data || {};
        var viaStripe = /^stripe/.test(d.source || '');
        // Si se pagó por la web (Stripe), Google Play no la conoce: se gestiona en el portal de pago, también desde la app.
        if (!viaStripe && (/^revenuecat/.test(d.source || '') || isNative())) {
            var url = platform() === 'ios' ? 'https://apps.apple.com/account/subscriptions'
                // Con sku + package, Google Play abre directamente ESTA suscripción en vez de la lista general (donde salen las de otros juegos).
                : 'https://play.google.com/store/account/subscriptions?sku=' + encodeURIComponent(d.productId || 'premium_monthly') + '&package=com.seeyouonline.app';
            try { window.open(url, '_system'); } catch (e) { window.location.href = url; }
            return;
        }
        call('POST', '/api/premium/portal').then(function (r) {
            if (r.ok && r.data.url) window.location.href = r.data.url; else toast(r.data.message || T('pm_manage_fail', 'No se pudo abrir la gestión.'));
        });
    }

    // En la app: el precio sale de la tienda (RevenueCat), nunca se menciona otro precio.
    function loadStorePrice(d) {
        if (!isNative() || !d) return;
        var pl = rcPlugin(); if (!pl) return;
        var uid = d.userId || (function () { try { return localStorage.getItem('current_user_id'); } catch (e) { return ''; } })();
        call('GET', '/api/shop/config').then(function (r) {
            return rcInit(uid, r.data && r.data.rc);
        }).then(function (ok) {
            if (!ok) return;
            return pl.getProducts({ productIdentifiers: [d.productId || 'premium_monthly'], type: 'SUBSCRIPTION' }).then(function (r) {
                var p = ((r && r.products) || [])[0];
                if (p) { storeProduct = p; storePrice = p.priceString || ''; render(); }
            });
        }).catch(function () { });
    }

    // Mensaje cuando alguien sin Premium intenta usar algo Premium
    P.promptUpgrade = function (what) {
        toast(T('pm_perk_only', '{{what}} es una ventaja Premium.').replace('{{what}}', what || T('pm_this', 'Esto')));
        var el = document.getElementById('premium-card');
        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (el) { el.classList.remove('pm-flash'); void el.offsetWidth; el.classList.add('pm-flash'); }
    };
    P.refresh = refresh; P.render = render;

    try {
        var q = new URLSearchParams(location.search).get('premium');
        // Se quita ?premium=ok de la URL para que el aviso salga solo esta vez (si no, reaparecia al recargar o reabrir esa direccion).
        if (q === 'ok') { try { var u = new URL(location.href); u.searchParams.delete('premium'); history.replaceState(null, '', u.pathname + (u.search || '') + u.hash); } catch (e) { } }
        if (q === 'ok') document.addEventListener('DOMContentLoaded', function () { toast(T('pm_paid', '¡Pago recibido! Tu Premium se activa en unos segundos.')); [1500, 5000, 10000].forEach(function (ms) { setTimeout(refresh, ms); }); });
    } catch (e) { }

    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && P.loaded) setTimeout(refresh, 1500); });   // pasa la medianoche: se ingresan las 2 monedas del dia nuevo
    function start() { refresh().then(function (d) { loadStorePrice(d); }); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 600); }); else setTimeout(start, 600);
})();
