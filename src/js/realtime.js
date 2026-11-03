/*
 * SeeYou · tiempo real (Socket.IO).
 *   SeeYouRT.on(evento, fn)        -> escucha un evento del servidor (chat:message, chat:typing, presence:update...)
 *   SeeYouRT.emit(evento, datos, ack)
 * Mientras la app esta abierta y visible hay una conexion: eso es lo que significa "en linea".
 * Si no hay sesion o el servidor no responde, todo sigue funcionando con las consultas de siempre.
 */
(function () {
    'use strict';
    if (window.SeeYouRT) return;
    var handlers = {};     // evento -> [fn]
    var sock = null, loading = false, hideTimer = null;

    function base() { try { return (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) || ''; } catch (e) { return ''; } }
    function token() { try { return localStorage.getItem('seeYou_auth_token') || ''; } catch (e) { return ''; } }

    function bindAll() {
        if (!sock) return;
        Object.keys(handlers).forEach(function (ev) { bindOne(ev); });
    }
    var bound = {};
    function bindOne(ev) {
        if (!sock || bound[ev] === sock) return;
        bound[ev] = sock;
        sock.on(ev, function (data) { (handlers[ev] || []).slice().forEach(function (fn) { try { fn(data); } catch (e) { } }); });
    }
    function connect() {
        if (sock || loading || !token()) return;
        if (document.visibilityState === 'hidden') return;
        function start() {
            loading = false;
            if (typeof window.io !== 'function') return;
            try {
                sock = window.io(base(), { auth: { token: token() }, transports: ['websocket', 'polling'], reconnection: true, reconnectionDelayMax: 15000 });
                bound = {};
                bindAll();
                sock.on('connect', function () { (handlers['connect'] || []).slice().forEach(function (fn) { try { fn(); } catch (e) { } }); });
                sock.on('connect_error', function () { /* se reintenta solo; sin sesion valida simplemente no hay tiempo real */ });
            } catch (e) { sock = null; }
        }
        if (typeof window.io === 'function') return start();
        loading = true;
        var s = document.createElement('script');
        s.src = base() + '/socket.io/socket.io.js';
        s.async = true;
        s.onload = start;
        s.onerror = function () { loading = false; };
        document.head.appendChild(s);
    }
    function disconnect() { if (sock) { try { sock.disconnect(); } catch (e) { } sock = null; bound = {}; } }

    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            clearTimeout(hideTimer);
            hideTimer = setTimeout(disconnect, 90000);   // en segundo plano mas de 90 s: ya no cuenta como "en linea"
        } else {
            clearTimeout(hideTimer);
            if (!sock) connect(); else if (!sock.connected) { try { sock.connect(); } catch (e) { } }
        }
    });

    window.SeeYouRT = {
        on: function (ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); bindOne(ev); },
        off: function (ev, fn) { handlers[ev] = (handlers[ev] || []).filter(function (f) { return f !== fn; }); },
        emit: function (ev, data, ack) { if (sock && sock.connected) { try { sock.emit(ev, data, ack); } catch (e) { } return true; } return false; },
        connected: function () { return !!(sock && sock.connected); },
        connect: connect
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', connect); else setTimeout(connect, 0);
})();
