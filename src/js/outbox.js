/* SeeYou · Bandeja de salida de Tics (subir sin conexión)
 *
 * Si el servidor no responde (caída, sin red, 5xx) al publicar un Tic, la foto y sus datos se guardan en el móvil
 * (IndexedDB) y se reintenta solo: al volver la red, al abrir la app y cada pocos segundos con espera creciente.
 * El servidor evita duplicados con clientRequestId, así que reintentar es seguro.
 *
 *  TicOutbox.save(formData)      guarda el envío en el móvil antes de intentarlo
 *  TicOutbox.begin(id)/end(id)   marca un envío en curso (para que el reintento automático no lo duplique)
 *  TicOutbox.remove(id)          lo borra (publicado o descartado)
 *  TicOutbox.isRetryable(result) true si el fallo es de servidor/red (no un error "de verdad" como foto inválida)
 *  TicOutbox.render()            pinta las tarjetas "Pendiente" encima de "New Tic"
 *  TicOutbox.flush()             reintenta ahora
 */
(function (global) {
    'use strict';

    var DB_NAME = 'seeyou_outbox', STORE = 'tics', DB_VER = 1;
    var active = {};            // ids que se están enviando ahora mismo
    var thumbs = {};            // id -> blob URL de la miniatura
    var running = false, timer = null, delayStep = 0;

    function uid() { try { return global.localStorage.getItem('current_user_id') || ''; } catch (e) { return ''; } }

    function openDb() {
        return new Promise(function (resolve, reject) {
            try {
                if (!global.indexedDB) return reject(new Error('sin IndexedDB'));
                var req = global.indexedDB.open(DB_NAME, DB_VER);
                req.onupgradeneeded = function () { req.result.createObjectStore(STORE, { keyPath: 'id' }); };
                req.onsuccess = function () { resolve(req.result); };
                req.onerror = function () { reject(req.error); };
            } catch (e) { reject(e); }
        });
    }

    function run(mode, fn) {
        return openDb().then(function (db) {
            return new Promise(function (resolve, reject) {
                var t = db.transaction(STORE, mode), box = {};
                try { box.req = fn(t.objectStore(STORE)); } catch (e) { db.close(); return reject(e); }
                t.oncomplete = function () { db.close(); resolve(box.req ? box.req.result : undefined); };
                t.onerror = t.onabort = function () { db.close(); reject(t.error || new Error('idb')); };
            });
        });
    }

    function serialize(formData) {
        var fields = [], image = null, fileName = 'foto.jpg';
        formData.forEach(function (value, key) {
            if (typeof value === 'string') fields.push([key, value]);
            else { image = value; fileName = value.name || fileName; }
        });
        return { fields: fields, image: image, fileName: fileName };
    }

    function build(entry) {
        var fd = new FormData();
        entry.fields.forEach(function (kv) { fd.append(kv[0], kv[1]); });
        if (entry.image) fd.append('image', entry.image, entry.fileName);
        return fd;
    }

    function save(formData) {
        var id = String(formData.get('clientRequestId') || '');
        if (!id) return Promise.resolve(false);
        var s = serialize(formData);
        if (!s.image) return Promise.resolve(false);
        var entry = { id: id, userId: String(formData.get('userId') || uid()), fields: s.fields, image: s.image, fileName: s.fileName,
            createdAt: Date.now(), attempts: 0, status: 'sending', error: '' };
        return run('readwrite', function (st) { return st.put(entry); }).then(function () { return true; }, function () { return false; });
    }

    function remove(id) {
        delete active[id];
        if (thumbs[id]) { try { URL.revokeObjectURL(thumbs[id]); } catch (e) { } delete thumbs[id]; }
        return run('readwrite', function (st) { return st.delete(id); }).then(function () { render(); }, function () { });
    }

    function patch(id, changes) {
        return run('readonly', function (st) { return st.get(id); }).then(function (entry) {
            if (!entry) return null;
            Object.keys(changes).forEach(function (k) { entry[k] = changes[k]; });
            return run('readwrite', function (st) { return st.put(entry); }).then(function () { return entry; });
        });
    }

    function list() {
        var me = uid();
        return run('readonly', function (st) { return st.getAll(); }).then(function (all) {
            return (all || []).filter(function (e) { return e.userId === me; }).sort(function (a, b) { return a.createdAt - b.createdAt; });
        }, function () { return []; });
    }

    function isRetryable(result) {
        var s = result && result.status;
        return !s || s >= 500 || s === 429 || s === 408;
    }

    function begin(id) { active[id] = true; }
    function end(id) { delete active[id]; }

    function apiBase() { return (global.CONFIG && global.CONFIG.API_BASE_URL) || ''; }

    function schedule(ms) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () { timer = null; flush(); }, ms);
    }
    function scheduleSoon() { delayStep = 0; schedule(4000); }

    function flush() {
        if (running) return Promise.resolve();
        if (!global.TicUpload) { schedule(5000); return Promise.resolve(); }
        running = true;
        return list().then(function (entries) {
            var todo = entries.filter(function (e) { return e.status !== 'error' && !active[e.id]; });
            var failedNetwork = false;
            return todo.reduce(function (chain, entry) {
                return chain.then(function () {
                    active[entry.id] = true;
                    return global.TicUpload.post(apiBase() + '/api/publicaciones', build(entry), {})
                        .catch(function () { return { status: 0, data: { message: 'Error de conexión' } }; })
                        .then(function (result) {
                            delete active[entry.id];
                            var ok = result && result.status >= 200 && result.status < 300 && (!result.data || result.data.success !== false);
                            if (ok) {
                                return remove(entry.id).then(function () {
                                    try { if (typeof global.__ticOutboxPublished === 'function') global.__ticOutboxPublished(entry, result.data || {}); } catch (e) { }
                                });
                            }
                            if (isRetryable(result)) {
                                var attempts = (entry.attempts || 0) + 1;
                                var ageMs = Date.now() - (entry.createdAt || Date.now());
                                var giveUp = attempts >= 12 || ageMs > 48 * 60 * 60 * 1000;
                                if (giveUp) {
                                    return patch(entry.id, { attempts: attempts, status: 'error', error: 'No se pudo publicar tras varios intentos. Reintenta o descártalo.' });
                                }
                                failedNetwork = true;
                                return patch(entry.id, { attempts: attempts, status: 'pending' });
                            }
                            var msg = (result.data && (result.data.message || result.data.error)) || ('Error ' + result.status);
                            return patch(entry.id, { status: 'error', error: msg });
                        });
                });
            }, Promise.resolve()).then(function () { return failedNetwork; });
        }).then(function (failedNetwork) {
            running = false;
            render();
            if (failedNetwork) { delayStep = Math.min(delayStep + 1, 5); schedule(Math.min(60000, 5000 * Math.pow(2, delayStep))); }
            else delayStep = 0;
        }, function () { running = false; });
    }

    // ─── Tarjetas encima de "New Tic" ───
    var CSS = '#ob-pending{margin:6px 16px 10px;display:flex;flex-direction:column;gap:10px}'
        + '.ob-wrap{background:#fff;border:1px solid #f0dcaa;border-radius:18px;box-shadow:0 6px 18px rgba(27,58,92,.08);overflow:hidden}'
        + '.ob-wrap.err{border-color:#f0b9b2}'
        + '.ob-top{background:#fff3d6;color:#7a5200;padding:8px 14px;font:600 12.5px system-ui,sans-serif;display:flex;gap:8px;align-items:center}'
        + '.ob-wrap.err .ob-top{background:#fde8e6;color:#8a1f12}'
        + '.ob-dot{width:9px;height:9px;border-radius:50%;background:#e8a317;flex:none}.ob-wrap.err .ob-dot{background:#d23a2a}'
        + '.ob-body{display:flex;gap:12px;align-items:center;padding:12px 14px}'
        + '.ob-th{width:58px;height:74px;border-radius:12px;background:#dde5f0 center/cover no-repeat;opacity:.85;position:relative;flex:none}'
        + '.ob-th i{position:absolute;right:-5px;bottom:-5px;width:20px;height:20px;border-radius:50%;background:#1B3A5C;border:2px solid #fff}'
        + '.ob-th i::after{content:"";position:absolute;inset:4px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:obspin 1s linear infinite}'
        + '.ob-wrap.err .ob-th i{background:#d23a2a}.ob-wrap.err .ob-th i::after{animation:none;border-color:#fff;inset:5px}'
        + '@keyframes obspin{to{transform:rotate(360deg)}}'
        + '.ob-info b{display:block;color:#1B3A5C;font:700 15px system-ui,sans-serif}'
        + '.ob-info span{display:block;font:400 12px system-ui,sans-serif;color:#6b7686;margin-top:2px}'
        + '.ob-acts{display:flex;gap:8px;margin-top:8px}'
        + '.ob-acts button{border:0;background:#eef2f8;color:#1B3A5C;font:600 12px system-ui,sans-serif;padding:7px 12px;border-radius:14px;cursor:pointer}'
        + '.ob-acts button.p{background:#1B3A5C;color:#fff}';

    function ensureStyle() {
        if (document.getElementById('ob-style')) return;
        var st = document.createElement('style'); st.id = 'ob-style'; st.textContent = CSS; document.head.appendChild(st);
    }

    function hhmm(ts) { var d = new Date(ts); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
    function tr(k, d, o) { var t = d; try { if (global.CONFIG && CONFIG.translate) t = CONFIG.translate(k, d); } catch (x) { } if (o) for (var n in o) t = t.split('{{' + n + '}}').join(o[n]); return t; }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }

    function render() {
        return list().then(function (entries) {
            var feed = document.getElementById('horizontal-feed');
            if (!feed || !feed.parentNode) return;
            ensureStyle();
            var box = document.getElementById('ob-pending');
            var visible = entries.filter(function (e) { return !(active[e.id] && e.status === 'sending'); });
            if (!visible.length) { if (box) box.remove(); return; }
            if (!box) { box = document.createElement('div'); box.id = 'ob-pending'; feed.parentNode.insertBefore(box, feed); }
            box.innerHTML = '';
            visible.forEach(function (e) {
                if (!thumbs[e.id]) { try { thumbs[e.id] = URL.createObjectURL(e.image); } catch (x) { thumbs[e.id] = ''; } }
                var err = e.status === 'error';
                var card = document.createElement('div');
                card.className = 'ob-wrap' + (err ? ' err' : '');
                card.innerHTML = (err
                    ? '<div class="ob-top"><span class="ob-dot"></span>' + esc(tr('ob_banner_error', 'No se pudo publicar este Tic')) + '</div>'
                    : '')
                    + '<div class="ob-body"><div class="ob-th" style="background-image:url(\'' + thumbs[e.id] + '\')"><i></i></div>'
                    + '<div class="ob-info"><b>' + esc(err ? tr('ob_title_problem', 'Hay un problema con tu Tic') : tr('ob_title_safe', 'Tu Tic está a salvo')) + '</b>'
                    + '<span>' + (err ? esc(e.error || tr('ob_try_other', 'Prueba con otra foto')) : esc(tr('ob_saved_at', 'Guardado en tu móvil · {{time}}', { time: hhmm(e.createdAt) })) + '<br>' + esc(tr('ob_will_publish', 'Se publicará cuando haya conexión'))) + '</span>'
                    + '<div class="ob-acts"><button type="button" class="p" data-a="retry">' + esc(err ? tr('ob_retry', 'Reintentar') : tr('ob_retry_now', 'Reintentar ahora')) + '</button>'
                    + '<button type="button" data-a="drop">' + esc(err ? tr('ob_discard', 'Descartar') : tr('ob_cancel', 'Cancelar')) + '</button></div></div></div>';
                card.querySelector('[data-a="retry"]').addEventListener('click', function () {
                    patch(e.id, { status: 'pending', error: '' }).then(function () { delayStep = 0; flush(); });
                });
                card.querySelector('[data-a="drop"]').addEventListener('click', function () {
                    var ok = true; try { ok = global.confirm(tr('ob_confirm_discard', '¿Descartar este Tic? No se publicará.')); } catch (x) { }
                    if (ok) remove(e.id);
                });
                box.appendChild(card);
            });
        });
    }

    function boot() {
        render();
        setTimeout(flush, 2500);
        global.addEventListener('online', function () { delayStep = 0; flush(); });
        document.addEventListener('visibilitychange', function () { if (!document.hidden) { delayStep = 0; flush(); } });
        setInterval(function () { list().then(function (l) { if (l.length) flush(); }); }, 30000);
    }

    global.TicOutbox = { save: save, remove: remove, begin: begin, end: end, isRetryable: isRetryable, render: render, flush: flush, scheduleSoon: scheduleSoon, list: list,
        markPending: function (id) { delete active[id]; return patch(id, { status: 'pending' }).then(function () { render(); }); } };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
