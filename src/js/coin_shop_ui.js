/*
 * SeeYou · tienda de monedas (interfaz).
 *   SeeYouShop.mountShop(el)            -> paquetes de monedas + que se puede hacer con ellas (hoja de monedas)
 *   SeeYouShop.checkStreakBanner()      -> si la racha del perfil se ha roto, ofrece restaurarla con monedas
 *   SeeYouShop.chatStreakHint(friendId) -> igual, para la racha de un chat con un amigo
 * Destacar un Tic se hace desde el menu del propio Tic (tics_ui.js).
 */
(function () {
    'use strict';
    if (window.SeeYouShop) return;

    var API = function () { try { return (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) || ''; } catch (e) { return ''; } };
    function T(key, fallback) {
        try { if (typeof CONFIG !== 'undefined' && typeof CONFIG.translate === 'function') return CONFIG.translate(key, fallback) || fallback; } catch (e) { }
        return fallback;
    }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function isNative() { try { return typeof window.Capacitor !== 'undefined' && (window.Capacitor.isNativePlatform ? window.Capacitor.isNativePlatform() : true); } catch (e) { return false; } }
    function call(method, path, body) {
        return fetch(API() + path, { method: method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
            .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, data: d || {} }; }); })
            .catch(function () { return { ok: false, status: 0, data: { message: T('generic_connection_error', 'Error de conexión') } }; });
    }
    function toast(msg) {
        var t = document.createElement('div');
        t.textContent = msg;
        t.style.cssText = 'position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);max-width:88vw;background:#111827;color:#fff;padding:11px 18px;border-radius:999px;font:600 14px/1.3 system-ui,sans-serif;z-index:100000;box-shadow:0 8px 24px rgba(0,0,0,.3)';
        document.body.appendChild(t);
        setTimeout(function () { try { t.remove(); } catch (e) { } }, 3600);
    }
    function ensureStyle() {
        if (document.getElementById('shop-style')) return;
        var st = document.createElement('style'); st.id = 'shop-style';
        st.textContent = '.shop-pk{display:flex;align-items:center;gap:12px;padding:12px 4px;border-top:1px solid rgba(128,128,128,.2)}.shop-pk:first-of-type{border-top:0}' +
            '.shop-pk b{font-size:16px}.shop-pk span{display:block;font-size:12.5px;opacity:.7;margin-top:2px}.shop-pk button{margin-left:auto;border:0;border-radius:999px;padding:10px 18px;background:#1B3A5C;color:#fff;font:700 14px system-ui,sans-serif;cursor:pointer}' +
            '.shop-pk button[disabled]{opacity:.5}.shop-banner{position:fixed;left:12px;right:12px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:9000;background:#FFF7ED;color:#7C2D12;border:1px solid #FDBA74;border-radius:18px;padding:14px 16px;box-shadow:0 10px 30px rgba(0,0,0,.22);font:600 14px/1.4 system-ui,sans-serif}' +
            '.shop-banner b{font-size:15px}.shop-banner .sb-row{display:flex;gap:10px;margin-top:10px}.shop-banner button{border:0;border-radius:999px;padding:10px 16px;font:700 14px system-ui,sans-serif;cursor:pointer}' +
            '.shop-banner .go{background:#E8651A;color:#fff}.shop-banner .no{background:transparent;color:#9A3412}.shop-banner .sb-x{position:absolute;right:10px;top:6px;background:none;border:0;font-size:20px;color:#9A3412;cursor:pointer}';
        document.head.appendChild(st);
    }

    /* ---------- compras dentro de la app (Google Play / App Store, via RevenueCat) ---------- */
    var rc = { ready: null };
    function rcPlugin() { try { return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Purchases) || null; } catch (e) { return null; } }
    function rcPlatform() { try { return window.Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'; } catch (e) { return 'android'; } }
    function rcInit(cfg) {
        if (rc.ready) return rc.ready;
        var P = rcPlugin(), key = cfg.rc && cfg.rc[rcPlatform()];
        if (!P || !key) return Promise.resolve(false);
        rc.ready = P.configure({ apiKey: key, appUserID: String(cfg.userId) }).then(function () { return true; }).catch(function () { rc.ready = null; return false; });
        return rc.ready;
    }
    function mountNativeShop(el, cfg) {
        var P = rcPlugin();
        if (!P || !cfg.rc || !cfg.rc[rcPlatform()]) { el.innerHTML = '<div class="cn-card"><h4>' + esc(T('shop_title', 'Consigue más monedas')) + '</h4><p>' + esc(T('shop_native_soon', 'La compra de monedas dentro de la app llegará pronto.')) + '</p></div>' + usesHTML(cfg); return; }
        el.innerHTML = '<div class="cn-card"><h4>' + esc(T('shop_title', 'Consigue más monedas')) + '</h4><p>' + esc(T('shop_loading', 'Cargando…')) + '</p></div>' + usesHTML(cfg);
        rcInit(cfg).then(function (ok) {
            if (!ok) throw new Error('init');
            return P.getProducts({ productIdentifiers: cfg.packages.map(function (p) { return p.id; }), type: 'NON_SUBSCRIPTION' });
        }).then(function (r) {
            var products = {}; ((r && r.products) || []).forEach(function (p) { products[String(p.identifier).split(':')[0]] = p; });
            var rows = cfg.packages.filter(function (p) { return products[p.id]; }).map(function (p) {
                return '<div class="shop-pk"><div><b>' + esc(p.coins) + ' ' + esc(T('shop_coins', 'monedas')) + '</b><span>' + esc(products[p.id].priceString) + '</span></div><button type="button" data-pk="' + esc(p.id) + '">' + esc(T('shop_buy', 'Comprar')) + '</button></div>';
            }).join('');
            var card = el.querySelector('.cn-card');
            card.innerHTML = '<h4>' + esc(T('shop_title', 'Consigue más monedas')) + '</h4>' + (rows || '<p>' + esc(T('shop_native_soon', 'La compra de monedas dentro de la app llegará pronto.')) + '</p>');
            card.addEventListener('click', function (e) {
                var b = e.target.closest('[data-pk]');
                if (!b || b.disabled || !products[b.dataset.pk]) return;
                b.disabled = true;
                P.purchaseStoreProduct({ product: products[b.dataset.pk] }).then(function () {
                    toast(T('shop_paid', '¡Pago recibido! Tus monedas llegan en unos segundos.'));
                    [2500, 6000, 12000].forEach(function (ms) { setTimeout(function () { try { if (window.SeeYouCoins && SeeYouCoins.checkGain) SeeYouCoins.checkGain(cfg.userId); } catch (e) { } }, ms); });
                }).catch(function (err) {
                    if (!(err && (err.userCancelled || /cancel/i.test(String(err.message || ''))))) toast(T('shop_pay_failed', 'No se pudo completar la compra'));
                }).then(function () { b.disabled = false; });
            });
        }).catch(function () {
            var card = el.querySelector('.cn-card');
            if (card) card.innerHTML = '<h4>' + esc(T('shop_title', 'Consigue más monedas')) + '</h4><p>' + esc(T('shop_native_soon', 'La compra de monedas dentro de la app llegará pronto.')) + '</p>';
        });
    }
    function usesHTML(cfg) {
        return '<div class="cn-card"><h4>' + esc(T('shop_uses_title', 'Qué puedes hacer con ellas')) + '</h4>' +
            '<div class="cn-row"><div class="cn-ic">🚀</div><div><b>' + esc(T('shop_use_boost', 'Destacar un Tic')) + '</b><span>' + esc(T('shop_use_boost_desc', '{{c}} monedas: durante {{h}} h sale {{x}} veces más en los feeds. Desde el menú ⋯ de tu Tic.').replace('{{c}}', cfg.boost.coins).replace('{{h}}', cfg.boost.hours).replace('{{x}}', cfg.boost.multiplier)) + '</span></div></div>' +
            '<div class="cn-row"><div class="cn-ic">🔥</div><div><b>' + esc(T('shop_use_streak', 'Restaurar una racha')) + '</b><span>' + esc(T('shop_use_streak_desc', 'Si pierdes la racha (hasta {{d}} días seguidos), puedes recuperarla. Cuanto más larga, más cuesta, pero poco: una de 5 días son unas 11 monedas y una de 100, unas 41.').replace('{{d}}', cfg.restore.maxMissed)) + '</span></div></div></div>';
    }

    /* ---------- comprar monedas ---------- */
    function price(c) { return (c / 100).toFixed(2).replace('.', ',') + ' €'; }
    function mountShop(el) {
        if (!el) return;
        ensureStyle();
        call('GET', '/api/shop/config').then(function (r) {
            if (!r.ok || !el.isConnected) return;
            var cfg = r.data, native = isNative();
            if (native) return mountNativeShop(el, cfg);
            var html = '<div class="cn-card"><h4>' + esc(T('shop_title', 'Consigue más monedas')) + '</h4>';
            if (native) html += '<p>' + esc(T('shop_native_soon', 'La compra de monedas dentro de la app llegará pronto.')) + '</p>';
            else if (!cfg.canBuy) html += '<p>' + esc(T('shop_off', 'Los pagos aún no están activados.')) + '</p>';
            else html += (cfg.packages || []).map(function (p) {
                return '<div class="shop-pk"><div><b>' + esc(p.coins) + ' ' + esc(T('shop_coins', 'monedas')) + '</b><span>' + esc(price(p.amountCents)) + '</span></div><button type="button" data-pk="' + esc(p.id) + '">' + esc(T('shop_buy', 'Comprar')) + '</button></div>';
            }).join('');
            html += '</div><div class="cn-card"><h4>' + esc(T('shop_uses_title', 'Qué puedes hacer con ellas')) + '</h4>' +
                '<div class="cn-row"><div class="cn-ic">🚀</div><div><b>' + esc(T('shop_use_boost', 'Destacar un Tic')) + '</b><span>' + esc(T('shop_use_boost_desc', '{{c}} monedas: durante {{h}} h sale {{x}} veces más en los feeds. Desde el menú ⋯ de tu Tic.').replace('{{c}}', cfg.boost.coins).replace('{{h}}', cfg.boost.hours).replace('{{x}}', cfg.boost.multiplier)) + '</span></div></div>' +
                '<div class="cn-row"><div class="cn-ic">🔥</div><div><b>' + esc(T('shop_use_streak', 'Restaurar una racha')) + '</b><span>' + esc(T('shop_use_streak_desc', 'Si pierdes la racha (hasta {{d}} días seguidos), puedes recuperarla. Cuanto más larga, más cuesta, pero poco: una de 5 días son unas 11 monedas y una de 100, unas 41.').replace('{{d}}', cfg.restore.maxMissed)) + '</span></div></div></div>';
            el.innerHTML = html;
            el.addEventListener('click', function (e) {
                var b = e.target.closest('[data-pk]');
                if (!b || b.disabled) return;
                b.disabled = true;
                call('POST', '/api/shop/checkout', { packageId: b.dataset.pk }).then(function (res) {
                    if (res.ok && res.data.url) { window.location.href = res.data.url; return; }
                    b.disabled = false; toast(res.data.message || T('shop_pay_failed', 'No se pudo iniciar el pago'));
                });
            });
        });
    }

    /* ---------- restaurar racha ---------- */
    function restoreCard(info, label, onGo, dismissKey) {
        ensureStyle();
        var old = document.querySelector('.shop-banner'); if (old) old.remove();
        var b = document.createElement('div'); b.className = 'shop-banner';
        b.innerHTML = '<button class="sb-x" type="button" aria-label="Cerrar">×</button><b>🔥 ' + esc(label) + '</b><div>' + esc(T('shop_restore_text', 'Puedes recuperarla por {{c}} monedas.').replace('{{c}}', info.cost)) + '</div>' +
            '<div class="sb-row"><button class="go" type="button">' + esc(T('shop_restore_btn', 'Restaurar')) + '</button><button class="no" type="button">' + esc(T('shop_restore_no', 'Ahora no')) + '</button></div>';
        function close(remember) { if (remember) { try { sessionStorage.setItem(dismissKey, '1'); } catch (e) { } } b.remove(); }
        b.querySelector('.sb-x').onclick = function () { close(true); };
        b.querySelector('.no').onclick = function () { close(true); };
        b.querySelector('.go').onclick = function () {
            var g = b.querySelector('.go'); g.disabled = true; g.textContent = '…';
            onGo().then(function (r) {
                if (r.ok) { close(true); toast(T('shop_restore_done', '¡Racha restaurada!')); setTimeout(function () { try { window.location.reload(); } catch (e) { } }, 900); }
                else {
                    g.disabled = false; g.textContent = T('shop_restore_btn', 'Restaurar'); toast(r.data.message || T('shop_restore_fail', 'No se pudo restaurar'));
                    if (r.status === 402 && window.SeeYouAdMob && SeeYouAdMob.mountOffer && !b.querySelector('.rw-offer')) {
                        var uid = ''; try { uid = localStorage.getItem('current_user_id') || localStorage.getItem('current_user') || ''; } catch (e) { }
                        var slot = document.createElement('div'); b.insertBefore(slot, b.querySelector('.sb-row'));
                        SeeYouAdMob.mountOffer(slot, uid, { need: Number(info.cost) || 0, onEarned: function () { slot.remove(); g.click(); } });
                    }
                }
            });
        };
        document.body.appendChild(b);
    }
    function checkStreakBanner() {
        call('GET', '/api/streak/restore-info').then(function (r) {
            var i = r.data;
            if (!r.ok || !i.lost || !i.canRestore) return;
            var key = 'seeyou-restore-dismiss:' + i.days + ':' + i.missed;
            try { if (sessionStorage.getItem(key)) return; } catch (e) { }
            restoreCard(i, T('shop_restore_title', 'Has perdido tu racha de {{d}} días').replace('{{d}}', i.days), function () { return call('POST', '/api/streak/restore', {}); }, key);
        });
    }
    function chatStreakHint(friendId) {
        if (!friendId) return;
        call('GET', '/api/streak/restore-info?friendId=' + encodeURIComponent(friendId)).then(function (r) {
            var i = r.data;
            if (!r.ok || !i.lost || !i.canRestore) return;
            var key = 'seeyou-restore-dismiss:chat:' + friendId + ':' + i.days + ':' + i.missed;
            try { if (sessionStorage.getItem(key)) return; } catch (e) { }
            restoreCard(i, T('shop_restore_chat_title', 'Habéis perdido vuestra racha de {{d}} días').replace('{{d}}', i.days), function () { return call('POST', '/api/streak/restore', { friendId: friendId }); }, key);
        });
    }

    // Vuelta desde el pago (Stripe)
    try {
        var q = new URLSearchParams(location.search).get('coins');
        if (q === 'ok') { document.addEventListener('DOMContentLoaded', function () { toast(T('shop_paid', '¡Pago recibido! Tus monedas llegan en unos segundos.')); }); }
    } catch (e) { }

    window.SeeYouShop = { mountShop: mountShop, checkStreakBanner: checkStreakBanner, chatStreakHint: chatStreakHint };
})();
