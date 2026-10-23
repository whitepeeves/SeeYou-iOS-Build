// SeeYou · Sesión "Recordarme"
// - Con "Recordarme" activado la sesión (token de 30 días) se conserva en el dispositivo.
// - Sin "Recordarme" la sesión solo dura mientras el navegador siga abierto: al cerrarlo se pierde
//   la cookie de sesión "seeYou_alive" y este script limpia la sesión guardada en la siguiente visita.
// Nunca se guarda la contraseña; solo el token que ya emite el servidor.
(function () {
    var SESSION_KEYS = [
        'seeYou_auth_token', 'seeYou_session_persistent', 'seeYou_remember',
        'current_user', 'current_user_name', 'current_user_id', 'current_user_phone',
        'current_user_verified', 'current_user_foto'
    ];

    function isNativeApp() {
        try {
            return typeof window.Capacitor !== 'undefined' &&
                (window.Capacitor.isNativePlatform ? window.Capacitor.isNativePlatform() : true);
        } catch (e) { return false; }
    }

    function browserSessionAlive() {
        return document.cookie.split(';').some(function (c) { return c.trim() === 'seeYou_alive=1'; });
    }

    function clearSession() {
        try { SESSION_KEYS.forEach(function (k) { localStorage.removeItem(k); }); } catch (e) { }
    }

    // Marca cómo se inició la sesión (se llama justo tras un login/registro correcto)
    function start(remember) {
        try {
            localStorage.setItem('seeYou_remember', remember ? '1' : '0');
            if (remember) {
                document.cookie = 'seeYou_alive=; path=/; max-age=0';
            } else {
                // Cookie de sesión (sin caducidad): desaparece al cerrar el navegador
                document.cookie = 'seeYou_alive=1; path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
            }
        } catch (e) { }
    }

    // Al cargar: si la sesión era "sin recordar" y el navegador se cerró, se descarta
    try {
        if (localStorage.getItem('seeYou_remember') === '0' && !isNativeApp() && !browserSessionAlive()) {
            clearSession();
        }
    } catch (e) { }

    // Si el servidor rechaza el token (caducado, sesion cerrada o invalido) la app seguia mostrando pantallas vacias
    // y errores sin parar: se limpia la sesion y se vuelve al inicio de sesion (una sola vez).
    (function watchExpiredSession() {
        try {
            if (typeof window.fetch !== 'function') return;
            var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
            if (page === 'index.html' || page === 'register.html' || page === 'landing.html' || page === '') return;
            var nativeFetch = window.fetch.bind(window);
            var handled = false;
            window.fetch = function (input, init) {
                return nativeFetch(input, init).then(function (res) {
                    try {
                        // Cuenta suspendida o baneada: se avisa y se vuelve al inicio de sesion.
                        if (res && res.status === 403 && !handled) {
                            var url403 = typeof input === 'string' ? input : (input && input.url) || '';
                            if (url403.indexOf('/api/') !== -1 && url403.indexOf('/api/admin') === -1 && localStorage.getItem('seeYou_auth_token')) {
                                res.clone().json().then(function (d) {
                                    if (!handled && d && /^account_(suspended|banned)$/.test(d.code || '')) {
                                        handled = true;
                                        clearSession();
                                        try { sessionStorage.setItem('sy_account_msg', d.message || 'Tu cuenta no está disponible.'); } catch (e) { }
                                        location.replace('index.html');
                                    }
                                }).catch(function () { });
                            }
                        }
                        if (res && res.status === 401 && !handled) {
                            var url = typeof input === 'string' ? input : (input && input.url) || '';
                            if (url.indexOf('/api/') !== -1 && url.indexOf('/api/admin') === -1 && url.indexOf('/api/login') === -1 && url.indexOf('/password') === -1 && localStorage.getItem('seeYou_auth_token')) {
                                res.clone().json().then(function (d) {
                                    var m = d && d.message;
                                    if (!handled && (m === 'Sesión cerrada' || m === 'Token inválido')) {
                                        handled = true;
                                        clearSession();
                                        location.replace('index.html');
                                    }
                                }).catch(function () { });
                            }
                        }
                    } catch (e) { }
                    return res;
                });
            };
        } catch (e) { }
    })();

    // En la pantalla de inicio de sesion: se muestra el motivo si nos han echado por una sancion.
    try {
        var msg = sessionStorage.getItem('sy_account_msg');
        if (msg) {
            sessionStorage.removeItem('sy_account_msg');
            window.addEventListener('load', function () { setTimeout(function () { alert(msg); }, 300); });
        }
    } catch (e) { }

    window.SeeYouSession = { start: start, clear: clearSession };
})();
