/* SeeYou · Cabecera de Inicio: muestra tu racha (llama + dias) a la derecha.
 * Lee la racha de la misma cache que usa el perfil y, si no esta, la pide al servidor una vez. */
(function () {
    'use strict';
    var pill, num;
    function apiBase() { try { return (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) || ''; } catch (e) { return ''; } }
    function me() { try { return localStorage.getItem('current_user_id') || ''; } catch (e) { return ''; } }
    function show(n) {
        n = Math.max(0, Math.floor(Number(n) || 0));
        if (!pill) return;
        num.textContent = String(n);
        pill.hidden = false;
    }
    function fromCache(uid) {
        try {
            var c = JSON.parse(localStorage.getItem('seeyou-profile-streak:' + uid) || 'null');
            if (c && c.data && Number.isFinite(Number(c.data.streak_days))) return Number(c.data.streak_days);
        } catch (e) { }
        return null;
    }
    function load() {
        var uid = me();
        if (!uid) return;
        var cached = fromCache(uid);
        if (cached != null && cached > 0) show(cached);
        fetch(apiBase() + '/api/users/' + encodeURIComponent(uid), { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (u) { if (u && u.streak_days != null) show(u.streak_days); })
            .catch(function () { });
    }
    function init() {
        pill = document.getElementById('home-streak');
        num = document.getElementById('home-streak-days');
        if (!pill || !num) return;
        // Cuando el perfil actualiza su racha (al subir un Tic), la cabecera la sigue.
        var src = document.getElementById('profile-streak-days');
        if (src && window.MutationObserver) new MutationObserver(function () { var v = parseInt(src.textContent, 10); if (v > 0) show(v); }).observe(src, { childList: true, characterData: true, subtree: true });
        load();
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') load(); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
