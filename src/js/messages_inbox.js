/* Apartado "Mensajes" dentro de Chats: avisos del sistema (p. ej. Premium regalado). Al pulsar uno se abre entero
   con su desglose (por que te lo han dado). Se coloca justo debajo de "Notificaciones". */
(function () {
    'use strict';
    var me = '', API = '', items = [], panel = null, row = null, shownToast = {}, firstLoad = true, openId = '';
    var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 8l9 6 9-6"/></svg>';
    var ICON_BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';

    function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function tr(k, d, o) {
        var s = (typeof CONFIG !== 'undefined' && CONFIG.translate) ? CONFIG.translate(k, d) : d;
        s = String(s || d || '');
        if (o) Object.keys(o).forEach(function (n) { s = s.split('{{' + n + '}}').join(o[n]); });
        return s;
    }
    function api(path, opts) { return fetch(API + path, opts).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
    function fdate(iso, withTime) {
        try { return new Date(iso).toLocaleDateString(undefined, withTime ? { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; }
    }
    function ago(iso) {
        var m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
        if (m < 1) return '·';
        if (m < 60) return m + ' min';
        var h = Math.round(m / 60); if (h < 24) return h + ' h';
        var d = Math.round(h / 24); if (d < 30) return d + ' d';
        return fdate(iso);
    }
    function titleOf(m) {
        var x = m.meta || {};
        if (m.kind === 'premium_grant') {
            if (x.forever) return tr('msg_grant_forever', m.title);
            return x.days === 1 ? tr('msg_grant_day', m.title) : tr('msg_grant_days', m.title, { days: x.days });
        }
        if (m.kind === 'premium_revoked') return tr('msg_revoked', m.title);
        return m.title;
    }
    function bodyOf(m) {
        var x = m.meta || {}, b = m.body;
        if (m.kind === 'premium_grant') b = x.forever ? tr('msg_body_forever', b) : tr('msg_body_days', b, { days: x.days });
        else if (m.kind === 'premium_revoked') b = tr('msg_body_revoked', b);
        else return b;
        return b;
    }
    function unreadCount() { return items.filter(function (m) { return !m.read; }).length; }

    function css() {
        if (document.getElementById('mi-style')) return;
        var st = document.createElement('style'); st.id = 'mi-style';
        st.textContent =
            '.mi-row .ni-ico{background:linear-gradient(135deg,#F59E0B,#EF4444)}' +
            '.mi-item{padding:14px 16px;border-bottom:1px solid var(--c-border,#E5E7EB);cursor:pointer;display:flex;gap:10px;align-items:flex-start}.mi-item.new{background:var(--c-tint,#EAF2FF)}' +
            '.mi-item b{display:block;font-size:15px;color:var(--c-text,#1D1B20)}.mi-item p{margin:3px 0 0;font-size:13.5px;color:var(--c-muted,#667085);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
            '.mi-item small{flex:none;font-size:11.5px;color:var(--c-muted,#667085)}.mi-mid{flex:1;min-width:0}' +
            '.mi-detail{padding:20px 18px}.mi-detail h3{margin:0 0 6px;font-size:21px;color:var(--c-text,#1D1B20)}.mi-detail .mi-when{font-size:12.5px;color:var(--c-muted,#667085);margin-bottom:14px}' +
            '.mi-detail .mi-text{font-size:15px;line-height:1.5;color:var(--c-text,#1D1B20);white-space:pre-wrap;margin-bottom:18px}' +
            '.mi-box{border:1px solid var(--c-border,#E5E7EB);border-radius:16px;overflow:hidden;background:var(--c-surface,#fff)}.mi-box h4{margin:0;padding:11px 14px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--c-muted,#667085);background:var(--c-field,#F3F4F8)}' +
            '.mi-kv{display:flex;justify-content:space-between;gap:14px;padding:11px 14px;border-top:1px solid var(--c-border,#E5E7EB);font-size:14px;color:var(--c-text,#1D1B20)}.mi-kv span:first-child{color:var(--c-muted,#667085);flex:none}.mi-kv span:last-child{text-align:right}' +
            '.mi-perks{margin:0;padding:6px 14px 12px 32px;font-size:14px;line-height:1.7;color:var(--c-text,#1D1B20)}' +
            '.mi-toast{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 14px);transform:translateX(-50%);z-index:1400;max-width:88vw;background:var(--c-navy,#1B3A5C);color:#fff;padding:12px 16px;border-radius:14px;font-size:14px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.25);cursor:pointer}';
        document.head.appendChild(st);
    }

    function updateRow() {
        if (!row) return;
        var c = unreadCount(), b = row.querySelector('.ni-badge');
        b.textContent = c > 99 ? '99+' : String(c); b.hidden = !c;
        row.querySelector('.ni-mid span').textContent = items.length ? titleOf(items[0]) : tr('msg_row_sub', 'Avisos del equipo de SeeYou');
    }
    function renderList() {
        var body = panel.querySelector('.ni-body');
        panel.querySelector('h2').textContent = tr('msg_row_title', 'Mensajes');
        openId = '';
        if (!items.length) { body.innerHTML = '<div class="ni-empty">' + esc(tr('msg_empty', 'Aún no tienes mensajes.')) + '</div>'; return; }
        body.innerHTML = items.map(function (m) {
            return '<div class="mi-item' + (m.read ? '' : ' new') + '" data-id="' + esc(m.id) + '"><span class="ni-dot" style="margin-top:6px"></span><div class="mi-mid"><b>' + esc(titleOf(m)) + '</b><p>' + esc(bodyOf(m)) + '</p></div><small>' + esc(ago(m.createdAt)) + '</small></div>';
        }).join('');
    }
    function kv(k, v) { return '<div class="mi-kv"><span>' + esc(k) + '</span><span>' + esc(v) + '</span></div>'; }
    function renderDetail(m) {
        var x = m.meta || {}, body = panel.querySelector('.ni-body');
        openId = m.id;
        panel.querySelector('h2').textContent = titleOf(m);
        var rows = '';
        if (m.kind === 'premium_grant') {
            rows += kv(tr('msg_concession', 'Concesión'), x.forever ? tr('msg_forever_label', 'Sin fecha de fin') : tr('msg_type_days', 'Días de Premium: {{days}}', { days: x.days }));
            if (!x.forever && x.validUntil) rows += kv(tr('msg_valid_until', 'Válido hasta'), fdate(x.validUntil));
        }
        rows += kv(tr('msg_given_by', 'Concedido por'), tr('msg_team', 'Equipo SeeYou'));
        rows += kv(tr('msg_date', 'Fecha'), fdate(x.date || m.createdAt, true));
        if (x.note) rows += kv(tr('msg_reason', 'Motivo'), x.note);
        var perks = '';
        if (m.kind === 'premium_grant') {
            var list = tr('msg_perks_list', 'Gotas en el banner|2 monedas gratis al día|Verificado automático|Todos los fondos gratis').split('|');
            perks = '<div class="mi-box" style="margin-top:14px"><h4>' + esc(tr('msg_perks', 'Qué incluye')) + '</h4><ul class="mi-perks">' + list.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>';
        }
        body.innerHTML = '<div class="mi-detail"><h3>' + esc(titleOf(m)) + '</h3><div class="mi-when">' + esc(fdate(m.createdAt, true)) + '</div><div class="mi-text">' + esc(bodyOf(m)) + '</div>' +
            '<div class="mi-box"><h4>' + esc(tr('msg_breakdown', 'Desglose')) + '</h4>' + rows + '</div>' + perks + '</div>';
        body.scrollTop = 0;
        if (!m.read) { m.read = true; updateRow(); api('/api/messages/' + encodeURIComponent(m.id) + '/read', { method: 'PUT' }); }
    }

    function toast(m) {
        var t = document.createElement('div'); t.className = 'mi-toast';
        t.textContent = titleOf(m) || tr('msg_toast_new', 'Tienes un mensaje nuevo');
        t.onclick = function () { t.remove(); openPanel(m.id); };
        document.body.appendChild(t);
        setTimeout(function () { try { t.remove(); } catch (e) { } }, 6500);
    }
    function load() {
        return api('/api/messages/' + encodeURIComponent(me)).then(function (d) {
            if (!d || !Array.isArray(d.messages)) return;
            items = d.messages;
            updateRow();
            if (panel && panel.classList.contains('open') && !openId) renderList();
            // Aviso emergente de los mensajes nuevos (no la primera vez que se abre la app con mensajes viejos sin leer: solo los de hace < 2 min o los que lleguen mientras estás aquí).
            items.forEach(function (m) {
                if (m.read || shownToast[m.id]) return;
                shownToast[m.id] = 1;
                if (!firstLoad || Date.now() - new Date(m.createdAt).getTime() < 120000) toast(m);
            });
            firstLoad = false;
        });
    }
    function openPanel(id) {
        panel.classList.add('open');
        history.pushState({ miPanel: 1 }, '');
        load().then(function () {
            var m = id && items.find(function (x) { return x.id === id; });
            if (m) renderDetail(m); else renderList();
        });
    }
    function closePanel(fromPop) {
        if (!panel.classList.contains('open')) return;
        panel.classList.remove('open'); openId = '';
        if (!fromPop && history.state && history.state.miPanel) history.back();
    }
    function onBack() { if (openId) renderList(); else closePanel(false); }

    function build() {
        css();
        var anchor = document.getElementById('ni-row');
        if (!anchor || document.getElementById('mi-row')) return false;
        row = document.createElement('button');
        row.type = 'button'; row.id = 'mi-row'; row.className = 'ni-row mi-row'; row.setAttribute('aria-label', tr('msg_row_title', 'Mensajes'));
        row.innerHTML = '<span class="ni-ico">' + ICON + '</span><span class="ni-mid"><b>' + esc(tr('msg_row_title', 'Mensajes')) + '</b><span>' + esc(tr('msg_row_sub', 'Avisos del equipo de SeeYou')) + '</span></span><span class="ni-badge" hidden>0</span>';
        anchor.parentNode.insertBefore(row, anchor.nextSibling);
        panel = document.createElement('div'); panel.className = 'ni-panel'; panel.setAttribute('role', 'dialog');
        panel.innerHTML = '<div class="ni-head"><button type="button" class="ni-back" aria-label="Volver">' + ICON_BACK + '</button><h2></h2></div><div class="ni-body"></div>';
        document.body.appendChild(panel);
        row.addEventListener('click', function () { openPanel(); });
        panel.querySelector('.ni-back').addEventListener('click', onBack);
        panel.querySelector('.ni-body').addEventListener('click', function (e) {
            var it = e.target.closest('.mi-item'); if (!it) return;
            var m = items.find(function (x) { return x.id === it.dataset.id; }); if (m) renderDetail(m);
        });
        window.addEventListener('popstate', function () { closePanel(true); });
        return true;
    }
    function init() {
        me = localStorage.getItem('current_user_id') || '';
        if (!me || typeof CONFIG === 'undefined') return;
        API = CONFIG.API_BASE_URL;
        var tries = 0;
        (function wait() {
            if (build()) {
                load();
                setInterval(function () { if (!document.hidden) load(); }, 60000);
                document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
                if (/[?&]messages=1/.test(location.search)) openPanel();
            } else if (++tries < 40) setTimeout(wait, 150);
        })();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
