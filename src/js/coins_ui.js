/*
 * SeeYou - monedas (interfaz).
 *   SeeYouCoins.mountPill(el, { userId })      -> pastilla con el saldo (arriba a la derecha del perfil)
 *   SeeYouCoins.openSheet(userId, 'invite')    -> hoja con resumen, invitar amigos (enlace + QR) e historial
 *   SeeYouCoins.coinSvg(size)                  -> la moneda dorada con el logo de SeeYou
 * Avisa con "+N monedas" cuando el saldo sube.
 */
(function () {
    'use strict';
    if (window.SeeYouCoins) return;

    function T(key, fallback) {
        try {
            if (typeof CONFIG !== 'undefined' && typeof CONFIG.translate === 'function') return CONFIG.translate(key, fallback) || fallback;
        } catch (e) { }
        return fallback;
    }

    var seq = 0;
    function BADGE_NAMES_MAP() { return { tics: T('coin_badge_tics', 'Cazatics'), streak: T('coin_badge_streak', 'Llama viva'), age: T('coin_badge_age', 'Veterano'), friends: T('coin_badge_friends', 'Sociable'), invites: T('coin_badge_invites', 'Embajador'), songs: T('coin_badge_songs', 'Melómano'), chatdays: T('coin_badge_chatdays', 'Siempre conectado'), messages: T('coin_badge_messages', 'Mensajero') }; }
    function TIER_NAMES_LIST() { return [T('bdg_tier_bronze', 'Bronce'), T('bdg_tier_silver', 'Plata'), T('bdg_tier_gold', 'Oro'), T('bdg_tier_diamond', 'Diamante')]; }
    var pills = [];
    // OJO: CONFIG se declara con "const CONFIG = {...}" en config.js, y un const de nivel
    // superior NO cuelga de window (a diferencia de var). "window.CONFIG" es siempre
    // undefined, tanto en la web como en la app. Antes esta funcion comprobaba
    // "window.CONFIG" y, al fallar siempre, devolvia '' -> las peticiones usaban una URL
    // relativa ("/api/coins/..."). En la web eso cae sin querer en el propio origen
    // (seeyouonline.net) y "funciona", pero en la app nativa el origen de la pagina es
    // "https://localhost" (el servidor local de Capacitor que sirve los ficheros de la
    // app), asi que la peticion no salia a internet: el propio telefono la respondia con
    // su copia local de index.html (por eso llegaba HTML donde se esperaba JSON).
    var API = function () { try { return (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) || ''; } catch (e) { return ''; } };

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function getJson(url) { return fetch(API() + url, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
    // Igual que getJson, pero sin tragarse el motivo del fallo: para la hoja principal de
    // monedas, que es la que mas veces nos ha dado "no se pudo cargar" sin pista de por que.
    function getJsonDebug(url) {
        return fetch(API() + url, { cache: 'no-store' }).then(function (r) {
            // En la app nativa (plugin CapacitorHttp) la respuesta de fetch() viaja por el
            // puente nativo en vez de por el motor del navegador: su .json() suele ser fiable
            // (el puente ya trae los datos parseados), pero su .text() a veces no reconstruye
            // bien el texto original (puede devolver basura tipo "[object Object]"). Por eso
            // probamos primero .json() y solo si falla recurrimos a .text() para diagnostico.
            var clone = r.clone ? r.clone() : r;
            return r.json().then(function (data) {
                return { ok: r.ok, status: r.status, data: r.ok ? data : null, raw: '', serverMsg: (data && data.message) || '' };
            }).catch(function () {
                return clone.text().then(function (txt) {
                    var data = null;
                    try { data = JSON.parse(txt); } catch (e) { }
                    return { ok: r.ok, status: r.status, data: r.ok ? data : null, raw: txt.slice(0, 300), serverMsg: (data && data.message) || '' };
                });
            });
        }).catch(function (err) {
            return { ok: false, status: 0, data: null, raw: '', serverMsg: '', networkError: (err && err.message) || String(err) };
        });
    }
    function fmt(n) { return Number(n || 0).toLocaleString('es-ES'); }

    /* ---------- la moneda: dorada, con los dos aros entrelazados del logo ---------- */
    function coinSvg(size) {
        var id = 'cn' + (++seq);
        var ring = function (cx, stroke, extra) { return '<circle cx="' + cx + '" cy="32" r="9.4" fill="none" stroke="' + stroke + '" stroke-width="' + (extra || 4) + '"/>'; };
        // Aros entrelazados como en el logo: arriba pasa el derecho por encima, abajo el izquierdo (con un pequeno hueco entre ambos).
        var emblem = function (color, dx) {
            return '<g transform="translate(' + dx + ' ' + dx + ')">' +
                '<g mask="url(#' + id + 'a)">' + ring(26.2, color) + '</g><g mask="url(#' + id + 'b)">' + ring(37.8, color) + '</g>' +
                '<g clip-path="url(#' + id + 'c)">' + ring(26.2, color) + '</g></g>';
        };
        return '<svg viewBox="0 0 64 64" width="' + (size || 24) + '" height="' + (size || 24) + '" role="img" aria-hidden="true" class="cn-coin">' +
            '<defs><linearGradient id="' + id + 'r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF0A8"/><stop offset=".5" stop-color="#F5B82E"/><stop offset="1" stop-color="#B87400"/></linearGradient>' +
            '<radialGradient id="' + id + 'f" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#FFE98F"/><stop offset=".6" stop-color="#F7C23B"/><stop offset="1" stop-color="#D9921A"/></radialGradient>' +
            '<clipPath id="' + id + 't"><rect x="27" y="18" width="10" height="13"/></clipPath>' +
            '<clipPath id="' + id + 'c"><rect x="27" y="33" width="10" height="14"/></clipPath>' +
            '<mask id="' + id + 'a" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><g clip-path="url(#' + id + 't)">' + ring(37.8, '#000', 7) + '</g></mask>' +
            '<mask id="' + id + 'b" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><g clip-path="url(#' + id + 'c)">' + ring(26.2, '#000', 7) + '</g></mask></defs>' +
            '<circle cx="32" cy="32" r="30.5" fill="url(#' + id + 'r)" stroke="#9C6200" stroke-width="1.2"/>' +
            '<circle cx="32" cy="32" r="26.4" fill="url(#' + id + 'f)" stroke="#FFF6C9" stroke-opacity=".75" stroke-width="1.3"/>' +
            '<circle cx="32" cy="32" r="28.3" fill="none" stroke="#9C6200" stroke-opacity=".35" stroke-width=".8" stroke-dasharray="1.6 2.2"/>' +
            emblem('#FFF8D6', 0.9) + emblem('#8A5600', 0) +
            '<path d="M14 21a20 20 0 0 1 14-11" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2.4" stroke-linecap="round"/></svg>';
    }

    function injectCss() {
        if (document.getElementById('cn-css')) return;
        var st = document.createElement('style');
        st.id = 'cn-css';
        st.textContent =
            '.cn-root{--cn-surface:#fff;--cn-text:#1D1B20;--cn-muted:#667085;--cn-border:#E8EAF0;--cn-track:#E8ECF3;--cn-accent:#2F6FDD;--cn-soft:#F5F7FB}' +
            'body[data-theme="dark"] .cn-root,body[data-theme="blue"] .cn-root{--cn-surface:#1B2130;--cn-text:#F2F4F8;--cn-muted:#A5AEBF;--cn-border:#2A3346;--cn-track:#2A3346;--cn-accent:#7EBCFF;--cn-soft:#232B3D}' +
            '.cn-bar{position:sticky;top:0;z-index:25;height:0;display:flex;justify-content:flex-end;pointer-events:none}' +
            '.cn-pill{pointer-events:auto;appearance:none;border:1px solid rgba(214,150,20,.45);background:linear-gradient(180deg,#FFF9E1,#FFEDB0);color:#7A4E00;border-radius:999px;padding:5px 13px 5px 6px;display:inline-flex;align-items:center;gap:7px;font:800 15px system-ui,-apple-system,sans-serif;cursor:pointer;box-shadow:0 8px 18px -10px rgba(180,120,0,.75);-webkit-tap-highlight-color:transparent;margin-top:2px;height:38px;box-sizing:border-box}' +
            '.cn-pill:active{transform:scale(.96)}.cn-pill .cn-coin{width:28px;height:28px;flex:none}' +
            '.cn-pill.is-gain{animation:cnGain .9s ease}' +
            '@keyframes cnGain{0%{transform:scale(1)}30%{transform:scale(1.18)}100%{transform:scale(1)}}' +
            '.cn-overlay{position:fixed;inset:0;z-index:2147482900;display:flex;align-items:flex-end;justify-content:center;background:rgba(10,16,30,.6);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);animation:cnFade .2s ease both}' +
            '@media(min-height:700px) and (min-width:560px){.cn-overlay{align-items:center}}' +
            '.cn-sheet{position:relative;width:100%;max-width:440px;max-height:92vh;overflow:auto;background:var(--cn-surface);color:var(--cn-text);border-radius:26px 26px 0 0;padding:18px 18px calc(22px + env(safe-area-inset-bottom,0px));box-shadow:0 -20px 60px -20px rgba(0,0,0,.5);animation:cnUp .35s cubic-bezier(.2,.9,.25,1.05) both;font-family:system-ui,-apple-system,sans-serif;box-sizing:border-box}' +
            '.cn-sheet{scrollbar-width:none;-ms-overflow-style:none}.cn-sheet::-webkit-scrollbar{display:none;width:0;height:0}' +
            '.cn-sheet:before{content:"";position:absolute;top:0;left:0;right:0;height:110px;border-radius:26px 26px 0 0;background:linear-gradient(180deg,rgba(247,194,59,.16),rgba(247,194,59,0));pointer-events:none;z-index:-1}' +
            '@media(min-height:700px) and (min-width:560px){.cn-sheet{border-radius:26px}}' +
            '.cn-grab{width:44px;height:5px;border-radius:99px;background:var(--cn-border);margin:0 auto 12px}' +
            '.cn-hero{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;padding:14px 0 10px;isolation:isolate}' +
            '.cn-hero:before{content:"";position:absolute;top:-10px;left:50%;width:220px;height:220px;margin-left:-110px;background:radial-gradient(circle,rgba(247,194,59,.35),rgba(247,194,59,0) 70%);z-index:-1;animation:cnGlow 3.2s ease-in-out infinite}' +
            '.cn-hero .cn-coin{width:88px;height:88px;filter:drop-shadow(0 10px 18px rgba(180,120,0,.45));animation:cnSpin .9s cubic-bezier(.2,.9,.25,1.2) both}' +
            '.cn-balance{font-size:40px;font-weight:900;letter-spacing:-.02em;margin-top:8px;line-height:1;background:linear-gradient(180deg,#8A5600,#B7791F);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}' +
            'body[data-theme="dark"] .cn-balance,body[data-theme="blue"] .cn-balance{background:linear-gradient(180deg,#FFE07A,#F5B82E);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}' +
            '.cn-label{font-size:12.5px;color:var(--cn-muted);font-weight:700;margin-top:4px;text-transform:uppercase;letter-spacing:.05em}' +
            '@keyframes cnGlow{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}' +
            '.cn-tabs{display:flex;gap:6px;background:var(--cn-soft);border-radius:999px;padding:4px;margin:10px 0 14px}' +
            '.cn-tab{flex:1;appearance:none;border:0;background:transparent;color:var(--cn-muted);font:700 13.5px system-ui,sans-serif;padding:9px 6px;border-radius:999px;cursor:pointer}' +
            '.cn-tab[aria-selected="true"]{background:var(--cn-surface);color:var(--cn-text);box-shadow:0 2px 8px rgba(20,30,50,.12);font-weight:800}' +
            '.cn-card{border:1px solid var(--cn-border);border-radius:18px;padding:14px;margin-bottom:12px;background:var(--cn-surface);box-shadow:0 2px 10px -6px rgba(20,30,50,.12)}' +
            '.cn-card h4{margin:0 0 6px;font-size:15px;font-weight:800;display:flex;align-items:center;gap:8px}' +
            '.cn-card p{margin:0;font-size:13.5px;line-height:1.45;color:var(--cn-muted)}' +
            '.cn-bar2{height:8px;border-radius:99px;background:var(--cn-track);overflow:hidden;margin:10px 0 6px}' +
            '.cn-bar2 i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#F5B82E,#FFE07A)}' +
            '.cn-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--cn-border)}.cn-row:first-of-type{border-top:0}' +
            '.cn-row b{display:block;font-size:14px}.cn-row span{font-size:12.5px;color:var(--cn-muted)}' +
            '.cn-amt{margin-left:auto;font-weight:900;color:#B7791F;white-space:nowrap;display:inline-flex;align-items:center;gap:4px}.cn-amt .cn-coin{width:16px;height:16px}' +
            '.cn-ic{width:38px;height:38px;border-radius:13px;background:var(--cn-soft);display:grid;place-items:center;flex:none;font-size:19px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.04)}' +
            '.cn-ic.gold{background:linear-gradient(135deg,#FFF3D6,#FDE68A)}.cn-ic.blue{background:linear-gradient(135deg,#DBEAFE,#BFDBFE)}.cn-ic.pink{background:linear-gradient(135deg,#FCE7F3,#FBCFE8)}.cn-ic.green{background:linear-gradient(135deg,#DCFCE7,#BBF7D0)}' +
            '.cn-qr{display:flex;justify-content:center;margin:6px 0 12px}.cn-qr svg{width:210px;height:210px;border-radius:14px;border:1px solid var(--cn-border);box-shadow:0 10px 24px -14px rgba(20,30,50,.5)}' +
            '.cn-code{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--cn-soft);border-radius:14px;padding:10px 12px;margin-bottom:8px}' +
            '.cn-code code{font:800 16px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.06em;word-break:break-all}' +
            '.cn-mini{appearance:none;border:1px solid var(--cn-border);background:var(--cn-surface);color:var(--cn-accent);font:700 12.5px system-ui,sans-serif;border-radius:999px;padding:7px 12px;cursor:pointer;white-space:nowrap}' +
            '.cn-btn{appearance:none;border:0;width:100%;border-radius:999px;padding:13px 18px;font:800 15px system-ui,sans-serif;cursor:pointer;color:#fff;background:linear-gradient(135deg,#1B3A5C,#2F6FDD);box-shadow:0 10px 22px -10px rgba(27,58,92,.7);margin-top:4px}' +
            '.cn-sg{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0 4px}' +
            '.cn-so{appearance:none;border:1px solid var(--cn-border);background:var(--cn-soft);color:var(--cn-text);border-radius:14px;padding:11px 2px;font:700 11.5px system-ui,sans-serif;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:7px;text-decoration:none}' +
            '.cn-so i{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-style:normal}' +
            '.cn-so:active{transform:scale(.97)}' +
            '.cn-btn.ghost{background:transparent;color:var(--cn-accent);box-shadow:none;border:1.5px solid rgba(47,111,221,.3);margin-top:8px}' +
            '.cn-btn:active{transform:scale(.98)}' +
            '.cn-empty{padding:16px;text-align:center;color:var(--cn-muted);font-size:14px}' +
            '.cn-av{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#1B3A5C,#3B82F6);color:#fff;display:grid;place-items:center;font-weight:800;flex:none;overflow:hidden}.cn-av img{width:100%;height:100%;object-fit:cover}' +
            '.cn-toast{position:fixed;left:50%;top:calc(16px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:2147483001;background:linear-gradient(180deg,#FFF9E1,#FFEDB0);color:#7A4E00;border:1px solid rgba(214,150,20,.5);padding:8px 16px 8px 8px;border-radius:999px;font:800 15px system-ui,sans-serif;display:flex;align-items:center;gap:8px;box-shadow:0 14px 30px -12px rgba(120,80,0,.6);animation:cnToast 3.2s ease both}.cn-toast .cn-coin{width:26px;height:26px}' +
            '@keyframes cnToast{0%{opacity:0;transform:translate(-50%,-14px)}10%,85%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-10px)}}' +
            '@keyframes cnFade{from{opacity:0}to{opacity:1}}@keyframes cnUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}' +
            '@keyframes cnSpin{0%{transform:rotateY(180deg) scale(.4);opacity:0}100%{transform:none;opacity:1}}' +
            '.cn-gift{display:flex;align-items:center;gap:10px;background:linear-gradient(135deg,#FFF3D6,#FFE4A8);border:1px solid rgba(214,150,20,.4);border-radius:18px;padding:10px 12px;margin:2px 0 14px;animation:cnGiftIn .4s ease both}' +
            '.cn-gift-info{display:flex;align-items:center;gap:10px;flex:1;min-width:0}' +
            '.cn-gift b{display:block;font-size:13.5px;color:#7A4E00}.cn-gift span{font-size:11.5px;color:#9A6B00}' +
            '.cn-gift-btn{appearance:none;border:0;border-radius:999px;padding:9px 16px;background:#E8651A;color:#fff;font:800 13px system-ui,sans-serif;cursor:pointer;flex:none;box-shadow:0 8px 16px -8px rgba(180,80,0,.5)}' +
            '.cn-gift-btn:active{transform:scale(.95)}.cn-gift-btn[disabled]{opacity:.6}' +
            '.cn-gift.is-done{background:var(--cn-soft);border-color:var(--cn-border)}.cn-gift.is-done b,.cn-gift.is-done span{color:var(--cn-muted)}' +
            '@keyframes cnGiftIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}' +
            '@media(prefers-reduced-motion:reduce){.cn-sheet,.cn-hero .cn-coin,.cn-overlay,.cn-toast,.cn-pill.is-gain,.cn-gift{animation:none}}';
        document.head.appendChild(st);
    }

    /* ---------- pastilla del saldo ---------- */
    function paintPill(btn, balance) { btn.querySelector('.cn-num').textContent = fmt(balance); }
    function mountPill(el, opts) {
        if (!el || !opts || !opts.userId) return;
        injectCss();
        el.classList.add('cn-root');
        if (!el.querySelector('.cn-pill')) {
            el.innerHTML = '<button type="button" class="cn-pill" aria-label="' + esc(T('coin_my_coins', 'Mis monedas')) + '">' + coinSvg(28) + '<span class="cn-num">0</span></button>';
            el.querySelector('.cn-pill').addEventListener('click', function () { openSheet(opts.userId); });
        }
        var btn = el.querySelector('.cn-pill');
        if (pills.indexOf(btn) < 0) pills.push(btn);

        function fetchBalance(retriesLeft) {
            return getJson('/api/coins/' + encodeURIComponent(opts.userId) + '?limit=0').then(function (data) {
                if (data) { paintPill(btn, data.balance); rememberBalance(opts.userId, data.balance); return; }
                // El servidor puede tardar en estar listo (sobre todo en la app nativa):
                // reintentamos un par de veces antes de rendirnos, en vez de dejar el
                // saldo sin pintar para siempre.
                if (retriesLeft > 0) {
                    return new Promise(function (resolve) { setTimeout(resolve, 1500); }).then(function () {
                        return fetchBalance(retriesLeft - 1);
                    });
                }
            });
        }

        var ready = window.serverInitialization
            ? Promise.race([window.serverInitialization.catch(function () { }), new Promise(function (resolve) { setTimeout(resolve, 4000); })])
            : Promise.resolve();
        return ready.then(function () { return fetchBalance(2); });
    }

    /* ---------- avisos "+N monedas" ---------- */
    function lastKey(uid) { return 'seeyou_coins_last_' + uid; }
    function rememberBalance(uid, balance) { try { localStorage.setItem(lastKey(uid), String(balance)); } catch (e) { } }
    function toast(n) {
        injectCss();
        var t = document.createElement('div');
        t.className = 'cn-toast cn-root';
        t.innerHTML = coinSvg(26) + '<span>' + esc(T(n === 1 ? 'coin_toast_one' : 'coin_toast_many', '+{{n}} monedas').replace('{{n}}', fmt(n))) + '</span>';
        document.body.appendChild(t);
        setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3300);
    }
    function checkGain(uid) {
        return getJson('/api/coins/' + encodeURIComponent(uid) + '?limit=0').then(function (data) {
            if (!data) return;
            var last = null;
            try { last = localStorage.getItem(lastKey(uid)); } catch (e) { }
            var prev = last === null ? null : Number(last);
            rememberBalance(uid, data.balance);
            pills.forEach(function (b) { if (b.isConnected) { paintPill(b, data.balance); if (prev !== null && data.balance > prev) { b.classList.remove('is-gain'); void b.offsetWidth; b.classList.add('is-gain'); } } });
            if (prev !== null && data.balance > prev) toast(data.balance - prev);
        });
    }

    /* ---------- hoja de monedas ---------- */
    var REASON = {
        ad_reward: function () { return [T('coin_reason_ad_reward_title', 'Vídeo con recompensa'), T('coin_reason_ad_reward_sub', 'Por ver un vídeo completo')]; },
        activity: function () { return [T('coin_reason_activity_title', 'Actividad en SeeYou'), T('coin_reason_activity_sub', 'Por ver Tics con calma')]; },
        badge: function (m) { return [T('coin_reason_badge_title', 'Insignia {{badge}}').replace('{{badge}}', (BADGE_NAMES_MAP()[m.badge] || '')), T('coin_reason_badge_level', 'Nivel {{tier}}').replace('{{tier}}', (TIER_NAMES_LIST()[(m.tier || 1) - 1] || ''))]; },
        invite_first: function () { return [T('coin_reason_invite_first_title', 'Tu invitado subió su primer Tic'), T('coin_reason_invite_first_sub', 'Bono de invitación')]; },
        invite_days: function (m) { return [T('coin_reason_invite_days_title', 'Tu invitado lleva {{n}} días activo').replace('{{n}}', m.days), T('coin_reason_invite_days_sub', 'Hito de invitación')]; },
        invited_bonus: function () { return [T('coin_reason_invited_bonus_title', 'Bono de bienvenida'), T('coin_reason_invited_bonus_sub', 'Por unirte con una invitación')]; },
        rebalance: function () { return [T('coin_reason_rebalance_title', 'Ajuste de la economía'), T('coin_reason_rebalance_sub', 'Las recompensas se han reequilibrado')]; },
        premium_daily: function () { return [T('coin_reason_premium_daily_title', 'Premium'), T('coin_reason_premium_daily_sub', 'Tus 2 monedas diarias')]; },
        daily_gift: function () { return [T('coin_reason_daily_gift_title', 'Regalo diario'), T('coin_reason_daily_gift_sub', 'Monedas gratis del día')]; },
        admin_grant: function () { return [T('coin_reason_admin_grant_title', 'Regalo de SeeYou'), T('coin_reason_admin_grant_sub', 'Monedas añadidas por el equipo')]; },
        banner_image: function () { return [T('coin_reason_banner_image_title', 'Banner con imagen'), T('coin_reason_banner_image_sub', 'Cobro diario')]; },
        banner_unlock: function () { return [T('coin_reason_banner_unlock_title', 'Banner desbloqueado'), '']; },
        refund: function () { return [T('coin_reason_refund_title', 'Devolución'), '']; },
        admin_take: function () { return [T('coin_reason_admin_take_title', 'Ajuste de SeeYou'), T('coin_reason_admin_take_sub', 'Monedas retiradas por el equipo')]; }
    };
    /* ---------- regalo diario (lo activa el administrador cada dia; si hoy no hay nada, no se muestra nada) ---------- */
    function mountDailyGift(el, userId) {
        if (!el) return;
        getJson('/api/coins/daily-gift').then(function (d) {
            if (!d || !d.amount) { el.innerHTML = ''; return; } // 0 monedas hoy = no se enseña nada
            if (d.claimed) {
                el.innerHTML = '<div class="cn-gift is-done">' + coinSvg(30) + '<div><b>' + esc(T('coin_daily_gift_claimed_title', '¡Ya tienes tu regalo de hoy!')) + '</b><span>' + esc(T('coin_daily_gift_claimed_sub', 'Vuelve mañana a por más')) + '</span></div></div>';
                return;
            }
            el.innerHTML = '<div class="cn-gift"><div class="cn-gift-info">' + coinSvg(34) + '<div><b>' + esc(T('coin_daily_gift_title', '¡Regalo de hoy: {{n}} monedas!').replace('{{n}}', fmt(d.amount))) + '</b><span>' + esc(T('coin_daily_gift_sub', 'Cortesía de SeeYou, solo por hoy')) + '</span></div></div><button type="button" class="cn-gift-btn">' + esc(T('coin_daily_gift_claim', 'Reclamar')) + '</button></div>';
            var btn = el.querySelector('.cn-gift-btn');
            if (btn) btn.addEventListener('click', function () {
                btn.disabled = true; btn.textContent = '…';
                fetch(API() + '/api/coins/daily-gift', { method: 'POST', headers: { 'Content-Type': 'application/json' } }).then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); }).then(function (res) {
                    if (res.ok) {
                        toast(res.data.amount || d.amount);
                        if (typeof res.data.balance === 'number') { pills.forEach(function (b) { if (b.isConnected) paintPill(b, res.data.balance); }); rememberBalance(userId, res.data.balance); }
                        mountDailyGift(el, userId);
                    } else {
                        btn.disabled = false; btn.textContent = T('coin_daily_gift_claim', 'Reclamar');
                        if (window.showToast) showToast((res.data && res.data.message) || T('coin_daily_gift_failed', 'No se pudo reclamar el regalo'));
                    }
                }).catch(function () { btn.disabled = false; btn.textContent = T('coin_daily_gift_claim', 'Reclamar'); });
            });
        }).catch(function () { el.innerHTML = ''; });
    }
    function dateShort(iso) { try { return new Date(iso).toLocaleDateString((typeof CONFIG !== 'undefined' && CONFIG.currentLanguage) || 'es-ES', { day: 'numeric', month: 'short' }); } catch (e) { return ''; } }
    function overlayEl(inner) {
        var o = document.createElement('div');
        o.className = 'cn-overlay cn-root';
        o.innerHTML = '<div class="cn-sheet" role="dialog" aria-modal="true"><div class="cn-grab"></div>' + inner + '</div>';
        o.addEventListener('click', function (e) { if (e.target === o) o.remove(); });
        document.body.appendChild(o);
        wireSwipeDown(o);
        return o;
    }

    /* Deslizar la hoja hacia abajo la cierra (el tiron visual del "cn-grab" lo prometia, pero
       no hacia nada). Se puede arrastrar desde cualquier punto de la hoja que no sea un control
       interactivo (boton, pestaña...), como en cualquier hoja inferior nativa. */
    function wireSwipeDown(o) {
        var sheet = o.querySelector('.cn-sheet');
        if (!sheet) return;
        var startY = null, dy = 0, dragging = false;
        sheet.addEventListener('touchstart', function (e) {
            if (e.touches.length !== 1) return;
            var t = e.target;
            if (t.closest && t.closest('button, a, input, textarea, select, [role="tab"]') && !t.closest('.cn-grab')) return;
            if (sheet.scrollTop > 2) return; // si hay contenido scrolleado, el gesto es para hacer scroll, no para cerrar
            startY = e.touches[0].clientY; dy = 0; dragging = true;
            sheet.style.transition = 'none';
        }, { passive: true });
        sheet.addEventListener('touchmove', function (e) {
            if (!dragging || startY == null) return;
            dy = e.touches[0].clientY - startY;
            if (dy < 0) dy = 0;
            if (dy > 0) sheet.style.transform = 'translateY(' + dy + 'px)';
        }, { passive: true });
        function end() {
            if (!dragging) return;
            dragging = false;
            sheet.style.transition = '';
            if (dy > 90) { o.remove(); return; }
            sheet.style.transform = '';
            startY = null; dy = 0;
        }
        sheet.addEventListener('touchend', end);
        sheet.addEventListener('touchcancel', end);
    }

    function renderSummary(c) {
        var a = c.activity, r = c.rules;
        var pct = Math.min(100, Math.round((a.progress / a.unitsPerCoin) * 100));
        var invite = r.invite;
        var last = invite.milestones[invite.milestones.length - 1];
        return '<div id="cn-rewarded"></div><div id="cn-shop"></div><div class="cn-card"><h4>📺 ' + esc(T('coin_summary_ads_title', 'Tus anuncios de hoy')) + '</h4>' +
            '<div class="cn-bar2"><i style="width:' + pct + '%"></i></div>' +
            '<p>' + esc(T('coin_summary_ads_progress', '{{progress}} / {{units}} anuncios para la siguiente moneda · hoy llevas {{today}} de {{cap}} monedas.').replace('{{progress}}', a.progress).replace('{{units}}', a.unitsPerCoin).replace('{{today}}', a.todayCoins).replace('{{cap}}', a.dailyCap)) + '</p>' +
            '<p style="margin-top:6px">' + esc(T('coin_summary_ads_hint', 'Cada anuncio patrocinado que ves con calma ({{s}} s o más) suma un punto. Si pasas de largo, no cuenta.').replace('{{s}}', a.minSeconds)) + '</p></div>' +
            '<div class="cn-card"><h4>✨ ' + esc(T('coin_summary_how_title', 'Cómo conseguir monedas')) + '</h4>' +
            '<div class="cn-row"><div class="cn-ic gold">🏅</div><div><b>' + esc(T('bdg_title', 'Insignias')) + '</b><span>' + r.badgeCoins.map(function (x, i) { return TIER_NAMES_LIST()[i] + ' +' + x; }).join(' · ') + '</span></div></div>' +
            '<div class="cn-row"><div class="cn-ic blue">👀</div><div><b>' + esc(T('coin_summary_watch_ads', 'Ver anuncios')) + '</b><span>' + esc(T('coin_summary_watch_ads_desc', '1 moneda cada {{n}} anuncios vistos (máx. {{max}} al día)').replace('{{n}}', a.unitsPerCoin).replace('{{max}}', a.dailyCap)) + '</span></div></div>' +
            '<div class="cn-row"><div class="cn-ic pink">🎁</div><div><b>' + esc(T('bdg_invite_friends_short', 'Invitar amigos')) + '</b><span>' + esc(T('coin_summary_invite_desc', '+{{n}} cuando suban su primer Tic y hasta +{{m}} por cada hito de días activos').replace('{{n}}', invite.firstTic).replace('{{m}}', last.coins)) + '</span></div></div>' +
            '<div class="cn-row"><div class="cn-ic green">🎨</div><div><b>' + esc(T('coin_summary_personalize', 'Personaliza tu perfil')) + '</b><span>' + esc(T('coin_summary_personalize_desc', 'Desbloquea banners de color o sube tu propia foto de banner desde Configuración')) + '</span></div></div></div>';
    }
    function renderHistory(c) {
        if (!c.history.length) return '<div class="cn-empty">' + esc(T('coin_history_empty', 'Todavía no tienes movimientos. ¡Sube un Tic o consigue tu primera insignia!')) + '</div>';
        return '<div class="cn-card" style="padding:4px 14px">' + c.history.map(function (h) {
            var f = REASON[h.reason] ? REASON[h.reason](h.meta || {}) : [h.reason, ''];
            return '<div class="cn-row"><div><b>' + esc(f[0]) + '</b><span>' + esc(f[1]) + (h.at ? ' · ' + esc(dateShort(h.at)) : '') + '</span></div><div class="cn-amt">' + (h.amount < 0 ? '\u2212' : '+') + fmt(Math.abs(h.amount)) + coinSvg(16) + '</div></div>';
        }).join('') + '</div>';
    }
    function renderInvite(inv) {
        if (!inv) return '<div class="cn-empty">' + esc(T('coin_invite_load_failed', 'No se pudo cargar tu invitación. Inténtalo de nuevo en un momento.')) + '</div>';
        var qr = '';
        try { qr = window.SeeYouQR ? SeeYouQR.svg(inv.link, { size: 210, margin: 2, fg: '#0B1F3A', bg: '#ffffff' }) : ''; } catch (e) { qr = ''; }
        var list = inv.invitees.length ? inv.invitees.map(function (p) {
            var av = p.avatar && !/6VBx3io/.test(p.avatar) ? '<img src="' + esc(/^https?:|^data:/.test(p.avatar) ? p.avatar : API() + '/' + p.avatar.replace(/^\/?/, '')) + '" alt="">' : esc((p.name || '?').charAt(0).toUpperCase());
            var next = p.nextMilestone ? T('coin_invite_next_milestone', 'Siguiente: {{days}} días (+{{coins}})').replace('{{days}}', p.nextMilestone.days).replace('{{coins}}', p.nextMilestone.coins) : T('coin_invite_all_milestones', 'Todos los hitos conseguidos');
            return '<div class="cn-row"><div class="cn-av">' + av + '</div><div><b>' + esc(p.name) + '</b><span>' + p.activeDays + ' días activo · ' + esc(next) + '</span></div><div class="cn-amt">+' + fmt(p.coinsEarned) + coinSvg(16) + '</div></div>';
        }).join('') : '<div class="cn-empty">' + esc(T('coin_invite_none_yet', 'Aún no has invitado a nadie. Comparte tu enlace o enséñales el QR.')) + '</div>';
        return '<div class="cn-card"><h4>' + esc(T('coin_invite_title', 'Invita a tus amigos')) + '</h4><p>' + esc(T('coin_invite_desc', 'Quien se registre con tu enlace o QR será amigo tuyo desde el primer momento y quedará vinculado a ti para siempre, aunque luego dejéis de ser amigos. Ganas <b>{{n}} monedas</b> cuando suba su primer Tic y más a medida que pase tiempo activo en SeeYou (hitos de {{days}} días). Tu amigo también recibe {{bonus}}.').replace('{{n}}', inv.rewards.firstTic).replace('{{days}}', inv.rewards.milestones.map(function (m) { return m.days; }).join(', ')).replace('{{bonus}}', inv.rewards.invitedBonus)) + '</p></div>' +
            '<div class="cn-qr">' + qr + '</div>' +
            '<div class="cn-code"><div><div style="font-size:11.5px;color:var(--cn-muted);font-weight:700">' + esc(T('coin_your_code', 'TU CÓDIGO')) + '</div><code>' + esc(inv.code.slice(0, 5) + '-' + inv.code.slice(5)) + '</code></div><button type="button" class="cn-mini" data-act="copycode">' + esc(T('coin_copy', 'Copiar')) + '</button></div>' +
            '<div class="cn-code"><code style="font-size:12.5px;letter-spacing:0;font-weight:700">' + esc(inv.link) + '</code><button type="button" class="cn-mini" data-act="copylink">' + esc(T('coin_copy', 'Copiar')) + '</button></div>' +
            '<button type="button" class="cn-btn" data-act="share">' + esc(T('coin_share_invitation', 'Compartir invitación')) + '</button>' +
            '<h4 style="margin:18px 2px 6px;font-size:15px">' + esc(T('coin_your_invitees', 'Tus invitados ({{n}})').replace('{{n}}', inv.count)) + '</h4><div class="cn-card" style="padding:4px 14px">' + list + '</div>';
    }

    // Iconos de marca (Simple Icons, CC0) y de Material Design (Apache 2.0).
    var ICONS = {"wa":{"vb":"0 0 24 24","d":"M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52s.198-.298.298-.497c.099-.198.05-.371-.025-.52s-.669-1.612-.916-2.207c-.242-.579-.487-.5-.669-.51a13 13 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074s2.096 3.2 5.077 4.487c.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413s.248-1.289.173-1.413c-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.82 11.82 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.9 11.9 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 0 0-3.48-8.413"},"tg":{"vb":"0 0 24 24","d":"M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm4.962 7.224c.1-.002.321.023.465.14a.5.5 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024q-.159.037-5.061 3.345-.72.495-1.302.48c-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789q.04-.324.893-.663 5.247-2.286 6.998-3.014c3.332-1.386 4.025-1.627 4.476-1.635"},"gmail":{"vb":"0 0 24 24","d":"M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457"},"x":{"vb":"0 0 24 24","d":"M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"},"fb":{"vb":"0 0 24 24","d":"M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a9 9 0 0 1 1.141.195v3.325a9 9 0 0 0-.653-.036 27 27 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.7 1.7 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647"},"rd":{"vb":"0 0 24 24","d":"M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286A.72.72 0 0 0 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0m4.388 3.199a1.999 1.999 0 1 1-1.947 2.46v.002a2.37 2.37 0 0 0-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363a2.802 2.802 0 1 1 2.908 4.753c-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87a2.8 2.8 0 0 1 1.189-5.34c.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01a3.23 3.23 0 0 1 2.88-3.207 2 2 0 0 1 1.959-1.595m-8.085 8.376c-.784 0-1.459.78-1.506 1.797s.64 1.429 1.426 1.429 1.371-.369 1.418-1.385-.553-1.841-1.338-1.841m7.406 0c-.786 0-1.385.824-1.338 1.841s.634 1.385 1.418 1.385c.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797m-3.703 4.013c-.974 0-1.907.048-2.77.135a.222.222 0 0 0-.183.305 3.2 3.2 0 0 0 2.953 1.964 3.2 3.2 0 0 0 2.953-1.964.222.222 0 0 0-.184-.305 28 28 0 0 0-2.769-.135"},"li":{"vb":"0 0 448 512","d":"M416 32H31.9C14.3 32 0 46.5 0 64.3v383.4C0 465.5 14.3 480 31.9 480H416c17.6 0 32-14.5 32-32.3V64.3c0-17.8-14.4-32.3-32-32.3M135.4 416H69V202.2h66.5V416zM102.2 96a38.5 38.5 0 1 1 0 77 38.5 38.5 0 1 1 0-77m282.1 320h-66.4V312c0-24.8-.5-56.7-34.5-56.7-34.6 0-39.9 27-39.9 54.9V416h-66.4V202.2h63.7v29.2h.9c8.9-16.8 30.6-34.5 62.9-34.5 67.2 0 79.7 44.3 79.7 101.9z"},"sms":{"vb":"0 0 24 24","d":"M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2M6 9h12v2H6m8 3H6v-2h8m4-4H6V6h12"},"link":{"vb":"0 0 24 24","d":"M10.59 13.41c.41.39.41 1.03 0 1.42-.39.39-1.03.39-1.42 0a5.003 5.003 0 0 1 0-7.07l3.54-3.54a5.003 5.003 0 0 1 7.07 0 5.003 5.003 0 0 1 0 7.07l-1.49 1.49c.01-.82-.12-1.64-.4-2.42l.47-.48a2.98 2.98 0 0 0 0-4.24 2.98 2.98 0 0 0-4.24 0l-3.53 3.53a2.98 2.98 0 0 0 0 4.24m2.82-4.24c.39-.39 1.03-.39 1.42 0a5.003 5.003 0 0 1 0 7.07l-3.54 3.54a5.003 5.003 0 0 1-7.07 0 5.003 5.003 0 0 1 0-7.07l1.49-1.49c-.01.82.12 1.64.4 2.43l-.47.47a2.98 2.98 0 0 0 0 4.24 2.98 2.98 0 0 0 4.24 0l3.53-3.53a2.98 2.98 0 0 0 0-4.24.973.973 0 0 1 0-1.42"},"mail":{"vb":"0 0 24 24","d":"m20 8-8 5-8-5V6l8 5 8-5m0-2H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2"},"pound":{"vb":"0 0 24 24","d":"m5.41 21 .71-4h-4l.35-2h4l1.06-6h-4l.35-2h4l.71-4h2l-.71 4h6l.71-4h2l-.71 4h4l-.35 2h-4l-1.06 6h4l-.35 2h-4l-.71 4h-2l.71-4h-6l-.71 4zM9.53 9l-1.06 6h6l1.06-6z"},"user":{"vb":"0 0 24 24","d":"M12 4a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4m0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4"}};
    function ico(k) {
        var i = ICONS[k];
        return '<svg viewBox="' + i.vb + '" width="22" height="22" fill="#fff" aria-hidden="true"><path d="' + i.d + '"/></svg>';
    }
    function shareOptions(inv) {
        var text = shareText(inv), t = encodeURIComponent(text), u = encodeURIComponent(inv.link);
        var title = T('coin_share_message', 'Únete a SeeYou con mi invitación y seremos amigos desde el primer momento');
        return [
            { k: 'wa', n: 'WhatsApp', c: '#25D366', i: 'wa', href: 'https://wa.me/?text=' + t },
            { k: 'tg', n: 'Telegram', c: '#26A5E4', i: 'tg', href: 'https://t.me/share/url?url=' + u + '&text=' + encodeURIComponent(title) },
            { k: 'gmail', n: 'Gmail', c: '#EA4335', i: 'gmail', href: 'https://mail.google.com/mail/?view=cm&fs=1&su=' + encodeURIComponent(T('coin_invite_subject', 'Te invito a SeeYou')) + '&body=' + t },
            { k: 'mail', n: T('coin_network_mail', 'Correo'), c: '#5F6B7A', i: 'mail', href: 'mailto:?subject=' + encodeURIComponent(T('coin_invite_subject', 'Te invito a SeeYou')) + '&body=' + t },
            { k: 'x', n: 'X', c: '#111111', i: 'x', href: 'https://twitter.com/intent/tweet?text=' + t },
            { k: 'fb', n: 'Facebook', c: '#1877F2', i: 'fb', href: 'https://www.facebook.com/sharer/sharer.php?u=' + u + '&quote=' + encodeURIComponent(title) },
            { k: 'li', n: 'LinkedIn', c: '#0A66C2', i: 'li', href: 'https://www.linkedin.com/sharing/share-offsite/?url=' + u },
            { k: 'rd', n: 'Reddit', c: '#FF4500', i: 'rd', href: 'https://www.reddit.com/submit?url=' + u + '&title=' + encodeURIComponent(title) },
            { k: 'sms', n: 'SMS', c: '#34A853', i: 'sms', href: 'sms:?&body=' + t }
        ];
    }
    // Ventana con todas las formas de compartir (en la web no existe el menú nativo de compartir, así que se ofrecen las redes directamente).
    function openShare(inv) {
        injectCss();
        var native = typeof navigator.share === 'function';
        var html = '<h4 style="margin:2px 2px 4px;font-size:17px">' + esc(T('coin_share_invitation', 'Compartir invitación')) + '</h4><p style="margin:0 2px 6px;font-size:13.5px;color:var(--cn-muted)">' + esc(T('coin_share_sub', 'Quien se registre con tu enlace será amigo tuyo desde el primer momento.')) + '</p>' +
            (native ? '<button type="button" class="cn-btn" data-share="native" style="margin-top:8px">' + esc(T('coin_share_native', 'Compartir con…')) + '</button>' : '') +
            '<div class="cn-sg">' + shareOptions(inv).map(function (o) {
                return '<a class="cn-so" data-share="' + o.k + '" href="' + esc(o.href) + '" target="_blank" rel="noopener noreferrer"><i style="background:' + o.c + '">' + ico(o.i) + '</i>' + esc(o.n) + '</a>';
            }).join('') +
            '<button type="button" class="cn-so" data-share="link"><i style="background:#2F6FDD">' + ico('link') + '</i>' + esc(T('coin_copy_link', 'Copiar enlace')) + '</button>' +
            '<button type="button" class="cn-so" data-share="code"><i style="background:#9C6200">' + ico('pound') + '</i>' + esc(T('coin_copy_code', 'Copiar código')) + '</button>' +
            '<button type="button" class="cn-so" data-share="id"><i style="background:#7A4FD8">' + ico('user') + '</i>' + esc(T('coin_copy_id', 'Copiar mi ID')) + '</button></div>' +
            '<button type="button" class="cn-btn ghost" data-share="close">' + esc(T('tic_close', 'Cerrar')) + '</button>';
        var o = overlayEl(html);
        o.addEventListener('click', function (e) {
            var b = e.target.closest('[data-share]');
            if (!b) return;
            var k = b.dataset.share;
            if (k === 'close') o.remove();
            else if (k === 'native') { navigator.share({ title: 'SeeYou', text: shareText(inv), url: inv.link }).then(function () { o.remove(); }).catch(function () { }); }
            else if (k === 'link') copy(inv.link, T('coin_link_copied', 'Enlace copiado'));
            else if (k === 'code') copy(inv.code.slice(0, 5) + '-' + inv.code.slice(5), T('coin_code_copied', 'Código copiado'));
            else if (k === 'id') { var id = ''; try { id = localStorage.getItem('current_user') || ''; } catch (er) { } copy(id, T('coin_id_copied', 'ID copiado')); }
            else o.remove(); // los enlaces de redes se abren en otra pestaña
        });
    }
    function shareInvite(userId) {
        getJson('/api/invite/' + encodeURIComponent(userId)).then(function (inv) {
            if (inv && inv.link) openShare(inv); else smallToast(T('coin_invite_load_failed_toast', 'No se pudo cargar tu invitación'));
        });
    }

    function shareText(inv) { return 'Únete a SeeYou con mi invitación y seremos amigos desde el primer momento: ' + inv.link; }
    function copy(text, msg) {
        var done = function () { smallToast(msg); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(done);
        else done();
    }
    function smallToast(msg) {
        var t = document.createElement('div');
        t.textContent = msg;
        t.style.cssText = 'position:fixed;left:50%;bottom:calc(40px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:rgba(20,26,40,.94);color:#fff;padding:11px 18px;border-radius:999px;font:600 14px system-ui,sans-serif;z-index:2147483002;max-width:88vw;text-align:center';
        document.body.appendChild(t);
        setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2000);
    }

    function openSheet(userId, tab) {
        injectCss();
        var o = overlayEl('<div class="cn-empty">' + esc(T('tic_loading', 'Cargando…')) + '</div>');
        Promise.all([getJsonDebug('/api/coins/' + encodeURIComponent(userId) + '?limit=40'), getJson('/api/invite/' + encodeURIComponent(userId))]).then(function (res) {
            var cRes = res[0], inv = res[1];
            var c = cRes && cRes.ok ? cRes.data : null;
            if (!c) {
                var why = !userId ? 'sin userId'
                    : (cRes && cRes.networkError) ? ('red: ' + cRes.networkError)
                    : (cRes && cRes.ok && !cRes.data) ? ('HTTP 200 pero no es JSON valido: ' + (cRes.raw || '(vacio)'))
                    : (cRes ? ('HTTP ' + cRes.status + (cRes.serverMsg ? ' – ' + cRes.serverMsg : (cRes.raw ? ' – ' + cRes.raw : ''))) : 'desconocido');
                o.querySelector('.cn-sheet').innerHTML = '<div class="cn-grab"></div><div class="cn-empty">' + esc(T('coin_load_failed', 'No se pudieron cargar tus monedas.')) + '<br><span style="font-size:11px;opacity:.65;word-break:break-all">' + esc(why) + '</span></div>';
                return;
            }
            rememberBalance(userId, c.balance);
            pills.forEach(function (b) { if (b.isConnected) paintPill(b, c.balance); });
            var sheet = o.querySelector('.cn-sheet');
            sheet.innerHTML = '<div class="cn-grab"></div><div class="cn-hero">' + coinSvg(84) + '<div class="cn-balance">' + fmt(c.balance) + '</div><div class="cn-label">' + esc(T('coin_label', 'monedas SeeYou')) + '</div></div>' +
                '<div id="cn-daily-gift"></div>' +
                '<div class="cn-tabs" role="tablist"><button class="cn-tab" role="tab" data-tab="sum">' + esc(T('coin_tab_summary', 'Resumen')) + '</button><button class="cn-tab" role="tab" data-tab="invite">' + esc(T('coin_tab_invite', 'Invitar')) + '</button><button class="cn-tab" role="tab" data-tab="hist">' + esc(T('coin_tab_history', 'Historial')) + '</button></div>' +
                '<div id="cn-panel"></div><button type="button" class="cn-btn ghost" data-act="close">' + esc(T('tic_close', 'Cerrar')) + '</button>';
            mountDailyGift(sheet.querySelector('#cn-daily-gift'), userId);
            var panel = sheet.querySelector('#cn-panel');
            function show(name) {
                sheet.querySelectorAll('.cn-tab').forEach(function (t) { t.setAttribute('aria-selected', t.dataset.tab === name ? 'true' : 'false'); });
                panel.innerHTML = name === 'invite' ? renderInvite(inv) : (name === 'hist' ? renderHistory(c) : renderSummary(c));
                if (name !== 'invite' && name !== 'hist' && window.SeeYouShop) { try { SeeYouShop.mountShop(panel.querySelector('#cn-shop')); } catch (e) { } }
                if (name !== 'invite' && name !== 'hist' && window.SeeYouAdMob) { try { SeeYouAdMob.mountRewarded(panel.querySelector('#cn-rewarded'), userId); } catch (e) { } }
            }
            show(tab === 'invite' ? 'invite' : (tab === 'hist' ? 'hist' : 'sum'));
            sheet.addEventListener('click', function (e) {
                var t = e.target.closest('.cn-tab');
                if (t) { show(t.dataset.tab); return; }
                var act = e.target.closest('[data-act]');
                if (!act) return;
                if (act.dataset.act === 'close') o.remove();
                else if (act.dataset.act === 'copycode' && inv) copy(inv.code.slice(0, 5) + '-' + inv.code.slice(5), T('coin_code_copied', 'Código copiado'));
                else if (act.dataset.act === 'copylink' && inv) copy(inv.link, T('coin_link_copied', 'Enlace copiado'));
                else if (act.dataset.act === 'share' && inv) {
                    openShare(inv);
                }
            });
        });
    }

    window.SeeYouCoins = { mountPill: mountPill, openSheet: openSheet, shareInvite: shareInvite, coinSvg: coinSvg, checkGain: checkGain };

    /* ---------- comprobacion automatica ---------- */
    var me = '';
    try { me = localStorage.getItem('current_user_id') || ''; } catch (e) { }
    if (me) {
        var lastRun = 0;
        var run = function () { if (Date.now() - lastRun < 40000) return; lastRun = Date.now(); checkGain(me); };
        setTimeout(run, 6000);
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') setTimeout(run, 2500); });
        setInterval(run, 5 * 60 * 1000);
    }
})();
