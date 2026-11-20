// Mensajes de SeeYou (administración) con respuesta: se abre desde el aviso o con ?soporte=1.
(function () {
    'use strict';
    var panel = null, list = null, form = null, input = null, sendBtn = null, errBox = null, busy = false;

    function tr(key, fb) {
        try { return (typeof CONFIG !== 'undefined' && CONFIG.translate) ? CONFIG.translate(key, fb) : fb; } catch (e) { return fb; }
    }
    function API() { try { return (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) || ''; } catch (e) { return ''; } }
    function headers(json) {
        var h = {};
        if (json) h['Content-Type'] = 'application/json';
        try {
            var t = localStorage.getItem('seeYou_auth_token');
            if (t) h['Authorization'] = 'Bearer ' + t;
            h['X-Device-Fingerprint'] = localStorage.getItem('seeYou_device_fingerprint') || (navigator.userAgent + '||' + navigator.platform);
        } catch (e) { }
        return h;
    }
    function el(tag, text, cls) {
        var n = document.createElement(tag);
        if (text != null) n.textContent = text;
        if (cls) n.className = cls;
        return n;
    }
    function css() {
        if (document.getElementById('sp-style')) return;
        var st = el('style');
        st.id = 'sp-style';
        st.textContent =
            '.sp-panel{position:fixed;inset:0;z-index:2147483100;display:flex;flex-direction:column;background:var(--c-bg,#FEF7FF);color:var(--c-text,#1D1B20)}' +
            '.sp-panel[hidden]{display:none}' +
            '.sp-head{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 14px) 16px 12px;border-bottom:1px solid var(--c-border,#E5E7EB);background:var(--c-surface,#fff)}' +
            '.sp-head h2{margin:0;font-size:20px;flex:1}' +
            '.sp-close{width:40px;height:40px;border-radius:50%;border:0;background:var(--c-field,#F3F4F8);color:inherit;font-size:20px;cursor:pointer}' +
            '.sp-list{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:var(--c-surface,#fff)}' +
            '.sp-msg{max-width:82%;padding:10px 14px;border-radius:18px;font-size:15px;line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere}' +
            '.sp-msg small{display:block;margin-top:4px;font-size:11.5px;opacity:.65}' +
            '.sp-msg.admin{align-self:flex-start;background:var(--c-tint,#EAF2FF);border-bottom-left-radius:6px}' +
            '.sp-msg.user{align-self:flex-end;background:var(--c-navy,#1B3A5C);color:#fff;border-bottom-right-radius:6px}' +
            '.sp-empty{margin:auto;text-align:center;opacity:.7}' +
            '.sp-form{display:flex;gap:8px;align-items:flex-end;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--c-border,#E5E7EB);background:var(--c-surface,#fff)}' +
            '.sp-form textarea{flex:1;min-height:44px;max-height:120px;resize:none;border:1px solid var(--c-border,#E5E7EB);border-radius:16px;padding:10px 14px;font:inherit;font-size:15px;background:var(--c-field,#F3F4F8);color:inherit}' +
            '.sp-send{border:0;border-radius:16px;padding:12px 18px;font:inherit;font-weight:700;background:var(--c-navy,#1B3A5C);color:#fff;cursor:pointer}' +
            '.sp-send[disabled]{opacity:.6}' +
            '.sp-note{padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));text-align:center;font-size:13px;opacity:.7;background:var(--c-surface,#fff);border-top:1px solid var(--c-border,#E5E7EB)}' +
            '.sp-err{padding:0 16px 8px;color:#b3261e;font-size:13px;background:var(--c-surface,#fff)}';
        document.head.appendChild(st);
    }
    function fmt(ts) {
        try { return new Date(ts).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
    }
    function build() {
        if (panel) return;
        css();
        panel = el('div', null, 'sp-panel');
        panel.hidden = true;
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-label', tr('sp_title', 'Mensajes de SeeYou'));
        var head = el('div', null, 'sp-head');
        head.appendChild(el('h2', tr('sp_title', 'Mensajes de SeeYou')));
        var close = el('button', '✕', 'sp-close');
        close.type = 'button';
        close.setAttribute('aria-label', tr('sp_close', 'Cerrar'));
        close.addEventListener('click', hide);
        head.appendChild(close);
        list = el('div', null, 'sp-list');
        errBox = el('div', null, 'sp-err');
        form = el('form', null, 'sp-form');
        input = el('textarea');
        input.maxLength = 1000;
        input.rows = 1;
        input.placeholder = tr('sp_ph', 'Escribe tu respuesta…');
        input.setAttribute('aria-label', tr('sp_ph', 'Escribe tu respuesta…'));
        sendBtn = el('button', tr('sp_send', 'Enviar'), 'sp-send');
        sendBtn.type = 'submit';
        form.appendChild(input);
        form.appendChild(sendBtn);
        form.addEventListener('submit', function (ev) { ev.preventDefault(); send(); });
        panel.appendChild(head);
        panel.appendChild(list);
        panel.appendChild(errBox);
        panel.appendChild(form);
        document.body.appendChild(panel);
        document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && panel && !panel.hidden) hide(); });
    }
    function hide() {
        if (panel) panel.hidden = true;
        document.body.style.overflow = '';
    }
    function render(d) {
        list.textContent = '';
        if (!d.messages.length) list.appendChild(el('div', tr('sp_empty', 'No tienes mensajes de SeeYou.'), 'sp-empty'));
        d.messages.forEach(function (m) {
            var b = el('div', null, 'sp-msg ' + (m.from === 'admin' ? 'admin' : 'user'));
            b.appendChild(document.createTextNode(m.text));
            b.appendChild(el('small', (m.from === 'admin' ? 'SeeYou · ' : '') + fmt(m.ts)));
            list.appendChild(b);
        });
        form.hidden = !d.can_reply;
        var old = panel.querySelector('.sp-note');
        if (old) old.remove();
        if (!d.can_reply) panel.appendChild(el('div', tr('sp_noreply', 'Aquí solo puedes responder a mensajes de SeeYou.'), 'sp-note'));
        list.scrollTop = list.scrollHeight;
    }
    function load() {
        return fetch(API() + '/api/support/thread', { headers: headers(false), cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) { if (d) render(d); else list.textContent = tr('sp_load_err', 'No se pudieron cargar los mensajes.'); })
            .catch(function () { list.textContent = tr('sp_load_err', 'No se pudieron cargar los mensajes.'); });
    }
    function send() {
        var text = input.value.trim();
        if (!text || busy) return;
        busy = true; sendBtn.disabled = true; errBox.textContent = '';
        fetch(API() + '/api/support/reply', { method: 'POST', headers: headers(true), body: JSON.stringify({ text: text }) })
            .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
            .then(function (x) {
                if (!x.ok) { errBox.textContent = (x.d && x.d.error) || tr('sp_send_err', 'No se pudo enviar.'); return; }
                input.value = '';
                return load();
            })
            .catch(function () { errBox.textContent = tr('sp_send_err', 'No se pudo enviar.'); })
            .then(function () { busy = false; sendBtn.disabled = false; });
    }
    function open() {
        build();
        panel.hidden = false;
        document.body.style.overflow = 'hidden';
        errBox.textContent = '';
        list.textContent = '…';
        return load().then(function () { try { input.focus(); } catch (e) { } });
    }

    window.SeeYouSupport = { open: open, close: hide };

    function boot() {
        try {
            var q = new URLSearchParams(location.search);
            if (q.get('soporte') === '1' && localStorage.getItem('seeYou_auth_token')) {
                open();
                q.delete('soporte');
                var rest = q.toString();
                history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
            }
        } catch (e) { }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
