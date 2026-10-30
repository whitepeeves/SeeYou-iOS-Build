/* SeeYou - monetizacion apagada desde administracion.
   Marca <html class="sy-no-money"> y oculta todo lo de Premium, anuncios por monedas, etc. El servidor ya rechaza esas peticiones;
   esto solo quita lo que se veria. Se recuerda el ultimo estado para que no parpadee al abrir la app. */
(function () {
    'use strict';
    var KEY = 'seeYou_no_money';
    function set(off) {
        try { document.documentElement.classList.toggle('sy-no-money', !!off); } catch (e) { }
        try { if (off) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch (e) { }
    }
    window.SyNoMoney = { set: set };
    try {
        var st = document.createElement('style');
        st.textContent = 'html.sy-no-money #premium-card,html.sy-no-money .cfg-pm-tag,html.sy-no-money #profile-banner-hint,html.sy-no-money .cfg-fx-row:has(#banner-mask-edit-btn),html.sy-no-money .cn-ads-card,html.sy-no-money .cn-ads-row,html.sy-no-money #cn-rewarded,html.sy-no-money #cn-shop{display:none!important}';
        (document.head || document.documentElement).appendChild(st);
        if (localStorage.getItem(KEY) === '1') document.documentElement.classList.add('sy-no-money');
    } catch (e) { }
    try {
        var base = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.API_BASE_URL) || '';
        var go = function () {
            base = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.API_BASE_URL) || base;
            fetch(base + '/api/public-settings', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
                .then(function (d) { if (d && typeof d.monetization_enabled === 'boolean') set(!d.monetization_enabled); }).catch(function () { });
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(go, 200); }); else setTimeout(go, 200);
    } catch (e) { }
})();
