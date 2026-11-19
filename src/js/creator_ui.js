// Cuenta de creador en el perfil: pedir la cuenta y, si está aprobada, ver el informe.
(function () {
    'use strict';
    var box = null;

    function API() {
        return (window.CONFIG && window.CONFIG.API_BASE_URL) || '';
    }

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

    function tr(key, fb) {
        try { return (window.CONFIG && CONFIG.translate) ? CONFIG.translate(key, fb) : fb; } catch (e) { return fb; }
    }

    function el(tag, text, cls) {
        var n = document.createElement(tag);
        if (text != null) n.textContent = text;
        if (cls) n.className = cls;
        return n;
    }

    function button(label, onClick) {
        var b = el('button', label, 'creator-btn');
        b.type = 'button';
        b.addEventListener('click', onClick);
        return b;
    }

    function draw(status, reason) {
        box.textContent = '';
        var title = el('div', tr('cr_title', 'Cuenta de creador'), 'creator-title');
        box.appendChild(title);

        if (status === 'approved') {
            box.appendChild(el('p', tr('cr_approved', 'Tu cuenta de creador está aprobada.'), 'creator-text'));
            loadReport();
            return;
        }
        if (status === 'pending') {
            box.appendChild(el('p', tr('cr_pending', 'Solicitud enviada. Administración la revisará.'), 'creator-text'));
            return;
        }
        var text = status === 'rejected'
            ? tr('cr_rejected', 'Tu solicitud anterior no fue aprobada. Puedes volver a pedirla.')
            : tr('cr_intro', 'Si creas contenido y traes gente a SeeYou, puedes pedir una cuenta de creador para ver tu alcance en detalle.');
        box.appendChild(el('p', text, 'creator-text'));
        if (status === 'rejected' && reason) box.appendChild(el('p', tr('cr_reason', 'Motivo') + ': ' + String(reason).slice(0, 300), 'creator-text'));
        box.appendChild(button(tr('cr_request_btn', 'Solicitar cuenta de creador'), function () {
            fetch(API() + '/api/creator/request', { method: 'POST', headers: headers(true), cache: 'no-store' })
                .then(function (r) { return r.json(); })
                .then(function (d) { draw(d.status || 'pending'); })
                .catch(function () { box.appendChild(el('p', tr('cr_request_err', 'No se pudo enviar la solicitud. Inténtalo más tarde.'), 'creator-text')); });
        }));
    }

    function loadReport() {
        fetch(API() + '/api/creator/me/report', { headers: headers(false), cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (!d || d.error) return;
                var grid = el('div', null, 'creator-grid');
                [
                    [tr('cr_stat_invited', 'Invitados'), d.invitados],
                    [tr('cr_stat_active', 'Con actividad'), d.invitados_con_actividad],
                    [tr('cr_stat_days', 'Días activos (media)'), d.dias_activos_medios],
                    [tr('cr_stat_coins', 'Monedas por invitados'), d.monedas_ganadas_por_invitados]
                ].forEach(function (kv) {
                    var c = el('div', null, 'creator-stat');
                    c.appendChild(el('strong', String(kv[1] == null ? 0 : kv[1])));
                    c.appendChild(el('span', kv[0]));
                    grid.appendChild(c);
                });
                box.appendChild(grid);
                if (d.link) {
                    var link = el('p', tr('cr_link', 'Tu enlace') + ': ' + d.link, 'creator-text creator-link');
                    box.appendChild(link);
                }
                var list = el('ul', null, 'creator-list');
                (d.lista || []).slice(0, 50).forEach(function (i) {
                    list.appendChild(el('li', (i.name || i.username || tr('pf_user', 'Usuario')) + ' · ' + tr('cr_days_active', '{{n}} días activos').replace('{{n}}', String(i.activeDays || 0))));
                });
                if (list.childNodes.length) box.appendChild(list);
            })
            .catch(function () { /* el panel se queda con el texto de estado */ });
    }

    function init() {
        box = document.getElementById('creator-box');
        if (!box) return;
        fetch(API() + '/api/creator/status', { headers: headers(false), cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : { status: 'none' }; })
            .then(function (d) { draw(d.status || 'none', d.reason); })
            .catch(function () { draw('none'); });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
