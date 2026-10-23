/* Apartado "Notificaciones" dentro de Chats: una fila fija encima del buscador y un panel con los avisos
   (likes, comentarios, seguidores, solicitudes de amistad...). Los mensajes de chat NO llegan aqui. */
(function () {
    'use strict';
    var TYPES = { like: 1, comment: 1, new_follower: 1, friend_request: 1, friend_accepted: 1, reply_comment: 1, mention_tic: 1, mention_comment: 1, tag: 1 };
    var me = '', API = '', items = [], pending = {}, following = {}, panel = null, row = null;
    var ICON_BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>';
    var ICON_BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';

    function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function url(u) { if (!u) return ''; return /^(https?:|data:)/.test(u) ? u : API + '/' + String(u).replace(/^\/?/, ''); }
    function api(path, opts) { return fetch(API + path, opts).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
    function mine() { return items.filter(function (n) { return TYPES[n.type]; }); }
    function unreadCount() { return mine().filter(function (n) { return !n.read; }).length; }

    function dayDiff(iso) {
        if (!iso) return null;
        var d = new Date(iso), now = new Date();
        var a = new Date(d.getFullYear(), d.getMonth(), d.getDate()), b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return Math.round((b - a) / 86400000);
    }
    function ticWhen(iso) {
        var n = dayDiff(iso);
        if (n == null) return '';
        if (n <= 0) return 'hoy';
        if (n === 1) return 'ayer';
        if (n < 7) return 'hace unos días';
        if (n < 60) return 'hace unas semanas';
        if (n < 365) return 'hace unos meses';
        return 'hace unos años';
    }
    function ago(iso) {
        var m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
        if (m < 1) return 'ahora';
        if (m < 60) return 'hace ' + m + ' min';
        var h = Math.round(m / 60);
        if (h < 24) return 'hace ' + h + ' h';
        var d = Math.round(h / 24);
        if (d < 30) return 'hace ' + d + (d === 1 ? ' día' : ' días');
        var mo = Math.round(d / 30);
        if (mo < 12) return 'hace ' + mo + (mo === 1 ? ' mes' : ' meses');
        var y = Math.round(mo / 12);
        return 'hace ' + y + (y === 1 ? ' año' : ' años');
    }
    function section(iso) {
        var n = dayDiff(iso);
        if (n == null || n <= 0) return 'Hoy';
        if (n < 7) return 'Esta semana';
        if (n < 30) return 'Este mes';
        return 'Antes';
    }
    function textOf(n) {
        var who = '<b>' + esc(n.fromUserName || 'Alguien') + '</b>';
        var when = ticWhen(n.ticDate);
        var ofTic = when ? ' de <b>' + when + '</b>' : '';
        if (n.type === 'like') return who + ' ha dado like a tu Tic' + ofTic;
        if (n.type === 'comment') return who + ' ha comentado tu Tic' + ofTic;
        if (n.type === 'new_follower') return who + ' ha empezado a seguirte';
        if (n.type === 'friend_request') return who + ' te ha enviado una solicitud de amistad';
        if (n.type === 'friend_accepted') return who + ' ha aceptado tu solicitud de amistad';
        return esc(n.text || n.title || 'Nuevo aviso');
    }
    function plainText(n) { var d = document.createElement('div'); d.innerHTML = textOf(n); return d.textContent; }

    function css() {
        if (document.getElementById('ni-style')) return;
        var st = document.createElement('style'); st.id = 'ni-style';
        st.textContent =
            '.ni-row{display:flex;align-items:center;gap:12px;width:100%;margin:0 0 12px;padding:12px 14px;border:1px solid var(--c-border,#E5E7EB);border-radius:18px;background:var(--c-tint,#EAF2FF);color:var(--c-text,#1D1B20);font:inherit;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent;box-sizing:border-box}' +
            '.ni-row:active{transform:scale(.99)}' +
            '.ni-ico{flex:none;width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(135deg,#3B82F6,#1B3A5C)}.ni-ico svg{width:24px;height:24px}' +
            '.ni-mid{flex:1;min-width:0}.ni-mid b{display:block;font-size:15.5px}.ni-mid span{display:block;font-size:13px;color:var(--c-muted,#667085);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}' +
            '.ni-badge{flex:none;min-width:24px;height:24px;padding:0 7px;border-radius:12px;background:var(--c-blue,#3B82F6);color:#fff;font-size:12.5px;font-weight:700;display:flex;align-items:center;justify-content:center}.ni-badge[hidden]{display:none}' +
            '.ni-panel{position:fixed;inset:0;z-index:1300;background:var(--c-bg,#FEF7FF);display:flex;flex-direction:column;transform:translateX(100%);transition:transform .22s ease;visibility:hidden}' +
            '.ni-panel.open{transform:none;visibility:visible}' +
            '.ni-head{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 14px) 16px 12px;border-bottom:1px solid var(--c-border,#E5E7EB);background:var(--c-surface,#fff)}' +
            '.ni-back{width:40px;height:40px;border-radius:50%;border:0;background:var(--c-field,#F3F4F8);color:var(--c-text,#1D1B20);display:flex;align-items:center;justify-content:center;cursor:pointer}.ni-back svg{width:22px;height:22px}' +
            '.ni-head h2{margin:0;font-size:21px;color:var(--c-text,#1D1B20)}' +
            '.ni-body{flex:1;overflow-y:auto;background:var(--c-surface,#fff);padding-bottom:calc(30px + env(safe-area-inset-bottom,0px))}' +
            '.ni-sec{padding:16px 18px 6px;font-size:11.5px;letter-spacing:.08em;font-weight:700;color:var(--c-muted,#667085);text-transform:uppercase}' +
            '.ni-item{display:flex;align-items:center;gap:11px;padding:11px 16px;cursor:pointer;position:relative}.ni-item.new{background:var(--c-tint,#EAF2FF)}' +
            '.ni-dot{flex:none;width:8px;height:8px;border-radius:50%;background:transparent}.ni-item.new .ni-dot{background:var(--c-blue,#3B82F6)}' +
            '.ni-av{flex:none;width:28px;height:28px;border-radius:50%;object-fit:cover;background:#cbd5e1;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;overflow:hidden}.ni-av img{width:100%;height:100%;object-fit:cover}' +
            '.ni-txt{flex:1;min-width:0;font-size:14px;line-height:1.35;color:var(--c-text,#1D1B20)}.ni-txt small{display:block;color:var(--c-muted,#667085);font-size:12px;margin-top:2px}' +
            '.ni-thumb{flex:none;width:44px;height:44px;border-radius:9px;object-fit:cover;background:var(--c-field,#F3F4F8)}' +
            '.ni-acts{display:flex;gap:8px;margin-top:8px}.ni-btn{border:0;border-radius:12px;padding:8px 14px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}.ni-btn.p{background:var(--c-navy,#1B3A5C);color:#fff}.ni-btn.g{background:var(--c-field,#F3F4F8);color:var(--c-navy,#1B3A5C)}.ni-btn[disabled]{opacity:.6}' +
            '.ni-empty{padding:60px 30px;text-align:center;color:var(--c-muted,#667085);font-size:14.5px}' +
            'body[data-theme="dark"] .ni-btn.g,body[data-theme="blue"] .ni-btn.g{color:#E5E7EB}';
        document.head.appendChild(st);
    }

    function avatarHTML(n) {
        var src = url(n.fromUserAvatar);
        if (src && !/6VBx3io/.test(src)) return '<span class="ni-av"><img loading="lazy" src="' + esc(src) + '" alt=""></span>';
        return '<span class="ni-av">' + esc(String(n.fromUserName || '?').charAt(0).toUpperCase()) + '</span>';
    }
    function actionsHTML(n) {
        if (n.type === 'friend_request') {
            var rq = pending[String(n.fromUserId)];
            if (rq) return '<div class="ni-acts"><button class="ni-btn p" data-act="accept" data-id="' + esc(n.id) + '">Aceptar</button><button class="ni-btn g" data-act="reject" data-id="' + esc(n.id) + '">Rechazar</button></div>';
            return '';
        }
        if (n.type === 'new_follower') {
            var f = following[String(n.fromUserId)];
            return '<div class="ni-acts"><button class="ni-btn g" data-act="' + (f ? 'unfollow' : 'follow') + '" data-id="' + esc(n.id) + '">' + (f ? 'Siguiendo' : 'Seguir') + '</button></div>';
        }
        return '';
    }
    function itemHTML(n) {
        var thumb = n.ticThumb ? '<img class="ni-thumb" loading="lazy" src="' + esc(url(n.ticThumb)) + '" alt="">' : '';
        return '<div class="ni-item' + (n.read ? '' : ' new') + '" data-id="' + esc(n.id) + '"><span class="ni-dot"></span>' + avatarHTML(n) +
            '<div class="ni-txt">' + textOf(n) + '<small>' + esc(ago(n.createdAt)) + '</small>' + actionsHTML(n) + '</div>' + thumb + '</div>';
    }
    function renderList() {
        var body = panel.querySelector('.ni-body');
        var list = mine().slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
        if (!list.length) { body.innerHTML = '<div class="ni-empty">Aún no tienes notificaciones.<br>Aquí verás likes, seguidores y solicitudes de amistad.</div>'; return; }
        var html = '', last = '';
        list.forEach(function (n) {
            var sec = section(n.createdAt);
            if (sec !== last) { html += '<div class="ni-sec">' + sec + '</div>'; last = sec; }
            html += itemHTML(n);
        });
        body.innerHTML = html;
    }
    function updateRow() {
        if (!row) return;
        var c = unreadCount(), b = row.querySelector('.ni-badge');
        b.textContent = c > 99 ? '99+' : String(c); b.hidden = !c;
        var latest = mine().slice().sort(function (a, b2) { return new Date(b2.createdAt) - new Date(a.createdAt); })[0];
        row.querySelector('.ni-mid span').textContent = latest ? plainText(latest) : 'Likes, seguidores y solicitudes';
    }

    function load() {
        return api('/api/notificaciones/' + encodeURIComponent(me)).then(function (d) {
            if (Array.isArray(d)) items = d;
            updateRow();
            if (panel && panel.classList.contains('open')) renderList();
        });
    }
    function loadRelations() {
        return Promise.all([api('/api/friends/requests/' + encodeURIComponent(me)), api('/api/follows/' + encodeURIComponent(me))]).then(function (r) {
            pending = {}; (r[0] || []).forEach(function (q) { if (q.fromUser) pending[String(q.fromUser.id)] = q.requestId; });
            following = {}; ((r[1] && r[1].following) || []).forEach(function (u) { following[String(u.id)] = 1; });
        });
    }

    function openPanel() {
        panel.classList.add('open');
        history.pushState({ niPanel: 1 }, '');
        Promise.all([loadRelations(), load()]).then(function () {
            renderList();
            // Se marcan como leidos los avisos del panel (no los de chat); la marca "nuevo" se queda hasta cerrar.
            var unread = mine().filter(function (n) { return !n.read; }).slice(0, 60);
            unread.forEach(function (n) { api('/api/notificaciones/' + encodeURIComponent(n.id) + '/read', { method: 'PUT' }); });
        });
    }
    function closePanel(fromPop) {
        if (!panel.classList.contains('open')) return;
        panel.classList.remove('open');
        items.forEach(function (n) { if (TYPES[n.type]) n.read = true; });
        updateRow();
        if (!fromPop && history.state && history.state.niPanel) history.back();
    }

    function onClick(e) {
        var btn = e.target.closest('[data-act]');
        var it = e.target.closest('.ni-item');
        if (!it) return;
        var n = items.find(function (x) { return String(x.id) === String(it.dataset.id); });
        if (!n) return;
        if (btn) {
            e.stopPropagation();
            var act = btn.dataset.act; btn.disabled = true;
            var done;
            if (act === 'accept' || act === 'reject') {
                done = api('/api/friends/respond', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: me, requestId: pending[String(n.fromUserId)], accept: act === 'accept' }) }).then(function (r) {
                    if (!r) { btn.disabled = false; return; }
                    delete pending[String(n.fromUserId)];
                    var acts = it.querySelector('.ni-acts'); if (acts) acts.outerHTML = '<small>' + (act === 'accept' ? 'Ahora sois amigos' : 'Solicitud rechazada') + '</small>';
                });
            } else {
                done = fetch(API + '/api/follows', { method: act === 'follow' ? 'POST' : 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fromUserId: me, toUserId: n.fromUserId }) }).then(function (r) {
                    return r.json().catch(function () { return {}; }).then(function (d) {
                        var ok = r.ok || /Ya sigues/i.test(d.message || '');
                        if (!ok) { btn.disabled = false; btn.textContent = d.message ? 'No disponible' : btn.textContent; return; }
                        if (act === 'follow') { following[String(n.fromUserId)] = 1; btn.dataset.act = 'unfollow'; btn.textContent = 'Siguiendo'; }
                        else { delete following[String(n.fromUserId)]; btn.dataset.act = 'follow'; btn.textContent = 'Seguir'; }
                        btn.disabled = false;
                    });
                }).catch(function () { btn.disabled = false; });
            }
            return done;
        }
        if ((n.type === 'like' || n.type === 'comment') && n.pubId) { location.href = 'home.html?tic=' + encodeURIComponent(n.pubId); return; }
        if (n.fromUserId) location.href = 'profile.html?id=' + encodeURIComponent(n.fromUserId);
    }

    function build() {
        css();
        var anchor = document.querySelector('#chat-list-view .cl-search');
        if (!anchor || document.getElementById('ni-row')) return false;
        row = document.createElement('button');
        row.type = 'button'; row.id = 'ni-row'; row.className = 'ni-row'; row.setAttribute('aria-label', 'Notificaciones');
        row.innerHTML = '<span class="ni-ico">' + ICON_BELL + '</span><span class="ni-mid"><b>Notificaciones</b><span>Likes, seguidores y solicitudes</span></span><span class="ni-badge" hidden>0</span>';
        anchor.parentNode.insertBefore(row, anchor);
        panel = document.createElement('div'); panel.className = 'ni-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Notificaciones');
        panel.innerHTML = '<div class="ni-head"><button type="button" class="ni-back" aria-label="Volver">' + ICON_BACK + '</button><h2>Notificaciones</h2></div><div class="ni-body"></div>';
        document.body.appendChild(panel);
        row.addEventListener('click', openPanel);
        panel.querySelector('.ni-back').addEventListener('click', function () { closePanel(false); });
        panel.querySelector('.ni-body').addEventListener('click', onClick);
        window.addEventListener('popstate', function () { closePanel(true); });
        return true;
    }

    function init() {
        me = localStorage.getItem('current_user_id') || '';
        if (!me || typeof CONFIG === 'undefined') return;
        API = CONFIG.API_BASE_URL;
        if (!build()) return;
        load();
        setInterval(function () { if (!document.hidden) load(); }, 60000);
        document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
