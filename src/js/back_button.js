/* SeeYou · Boton "atras" de Android
 * Por defecto, si no se gestiona, el boton fisico/gesto de atras del telefono cierra
 * directamente la app (sale de SeeYou) en vez de cerrar lo que esta abierto (un Tic a
 * pantalla completa, una historia, una hoja de Guardar/Enviar, un menu...) o volver a la
 * pantalla anterior. Este fichero intercepta ese boton con @capacitor/app:
 *   1) Si hay algo abierto encima (visor de Tics, historia, camara, hoja, menu, comentarios),
 *      lo cierra primero.
 *   2) Si no hay nada abierto pero se puede volver atras en el historial, vuelve atras.
 *   3) Si ya estamos en la pantalla raiz sin nada que cerrar, se sale de la app (comportamiento
 *      normal de Android en la pantalla principal).
 */
(function () {
    'use strict';

    function getApp() {
        return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) || null;
    }

    function closeTopOverlay() {
        // Visor de Tics a pantalla completa (Reels/TikTok)
        if (document.body.classList.contains('tv-open') && window.SocialTicViewer) {
            window.SocialTicViewer.close();
            return true;
        }
        // Historias
        var storyEl = document.getElementById('story-viewer-container');
        if (storyEl && storyEl.classList.contains('open')) {
            if (typeof window.closeStory === 'function') window.closeStory();
            else storyEl.classList.remove('open');
            return true;
        }
        // Camara
        var camEl = document.getElementById('camera-container');
        if (camEl && camEl.classList.contains('open')) {
            if (typeof window.closeCamera === 'function') window.closeCamera();
            else camEl.classList.remove('open');
            return true;
        }
        // Hoja inferior (Guardar en listas / Enviar) de tics_ui.js
        if (document.querySelector('.tsheet-back')) {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            return true;
        }
        // Hoja de monedas (coins_ui.js) y cualquier otro overlay que use la misma clase
        var cnOverlay = document.querySelector('.cn-overlay');
        if (cnOverlay) { cnOverlay.remove(); return true; }
        // Modal "Tema del dia"
        var themeModal = document.getElementById('daily-theme-modal');
        if (themeModal && themeModal.classList.contains('active')) {
            if (typeof window.closeDailyThemeModal === 'function') window.closeDailyThemeModal();
            else themeModal.classList.remove('active');
            return true;
        }
        // Menus / popovers abiertos de forma generica
        var openMenu = document.querySelector('.publication-actions-menu.open, .story-menu-panel.open, .color-picker-popover.open, .popover.open');
        if (openMenu) { openMenu.classList.remove('open'); return true; }
        // Comentarios abiertos dentro de una tarjeta de Tic
        var openComments = document.querySelector('.tic-comments');
        if (openComments && getComputedStyle(openComments).display !== 'none' && openComments.style.display === 'block') {
            openComments.style.display = 'none';
            return true;
        }
        return false;
    }

    function handleBack(ev) {
        try {
            if (closeTopOverlay()) return;
        } catch (e) { /* si algo falla al cerrar, seguimos con el comportamiento normal */ }
        var App = getApp();
        // En la pantalla de Inicio, "atras" sale de la app (si se esta en otra seccion de Inicio, primero vuelve a Inicio).
        // Antes se usaba history.length, que nunca baja al retroceder: una vez navegado un poco, la app ya no se podia cerrar con el gesto.
        if (/\/home\.html$/i.test(window.location.pathname)) {
            var inicio = document.getElementById('inicio-section');
            if (inicio && inicio.offsetParent === null && typeof window.navigate === 'function') { window.navigate('inicio'); return; }
            if (App && App.exitApp) { App.exitApp(); return; }
        }
        var canGoBack = ev && typeof ev.canGoBack === 'boolean' ? ev.canGoBack : window.history.length > 1;
        if (canGoBack) {
            window.history.back();
            return;
        }
        if (App && App.exitApp) App.exitApp();
    }

    var listening = false;
    function init() {
        if (listening) return;
        var App = getApp();
        if (App && App.addListener) {
            listening = true;
            App.addListener('backButton', handleBack);
        }
    }

    // El puente nativo de Capacitor (window.Capacitor.Plugins.App) a veces aun no esta listo
    // en el momento exacto en que se ejecuta este script (va justo despues de config.js, muy
    // pronto en el <head>). Si entonces no esta disponible, nos quedariamos sin enganchar el
    // boton atras para siempre y Android haria su comportamiento por defecto: cerrar la app
    // directamente en vez de pasar por nuestra logica. Reintentamos durante unos segundos y,
    // ademas, nos enganchamos tambien a "deviceready" (evento estandar de Capacitor/Cordova
    // que se dispara cuando el puente nativo ya esta listo del todo).
    if (document.readyState === 'complete' || document.readyState === 'interactive') init();
    else document.addEventListener('DOMContentLoaded', init);
    document.addEventListener('deviceready', init);
    var tries = 0;
    var retryTimer = setInterval(function () {
        tries += 1;
        init();
        if (listening || tries >= 20) clearInterval(retryTimer);
    }, 250);
})();
