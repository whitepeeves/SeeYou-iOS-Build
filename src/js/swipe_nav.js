/* Deslizar para cambiar de pestaña: Inicio <-> Amigos <-> Chat <-> Mapa <-> Perfil.
   Reutiliza los botones de la barra inferior (.bottom-nav-bar), así que la animación y el cambio de
   pantalla son exactamente los mismos que al pulsarlos. Se ignora el gesto si empieza sobre algo
   que ya usa el deslizamiento horizontal (carruseles, mapa, campos de texto, ventanas, visores...). */
(function () {
    'use strict';
    if (window.__seeSwipeNav) return;
    window.__seeSwipeNav = true;

    var MIN_DX = 70, MAX_MS = 700, RATIO = 1.6;
    var sx = 0, sy = 0, st = 0, ok = false;

    function navButtons() {
        var nav = document.querySelector('.bottom-nav-bar');
        if (!nav || !nav.getClientRects().length || getComputedStyle(nav).visibility === 'hidden') return null;           // sin barra visible (p. ej. dentro de una conversación): sin gesto
        var b = Array.prototype.slice.call(nav.querySelectorAll('.nav-btn'));
        return b.length >= 5 ? b : null;
    }

    function blocked(el) {
        for (var n = el; n && n.nodeType === 1 && n !== document.documentElement; n = n.parentElement) {
            var tag = n.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'CANVAS' || tag === 'VIDEO' || tag === 'IFRAME') return true;
            if (n.isContentEditable || n.hasAttribute('data-noswipe')) return true;
            if (n.classList && n.classList.contains('bottom-nav-bar')) return true;
            var cs = getComputedStyle(n);
            if (cs.position === 'fixed' && !(n.classList && n.classList.contains('bottom-nav-bar'))) return true;   // ventanas, visores, paneles
            if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 4) return true;   // carruseles
        }
        return false;
    }

    function overlayOpen() {
        var b = document.body;
        if (!b) return false;
        if (b.style.overflow === 'hidden' || document.documentElement.style.overflow === 'hidden') return true;
        return false;
    }

    document.addEventListener('touchstart', function (e) {
        ok = false;
        if (!e.touches || e.touches.length !== 1) return;
        if (window.getSelection && String(window.getSelection()).length) return;
        var t = e.touches[0];
        if (t.clientX < 24 || t.clientX > window.innerWidth - 24) return;     // bordes: gesto "atrás" del sistema
        if (!navButtons() || overlayOpen() || blocked(e.target)) return;
        sx = t.clientX; sy = t.clientY; st = Date.now(); ok = true;
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
        if (!ok || !e.touches || e.touches.length !== 1) { ok = false; }
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
        if (!ok) return;
        ok = false;
        var t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        var dx = t.clientX - sx, dy = t.clientY - sy;
        if (Date.now() - st > MAX_MS || Math.abs(dx) < MIN_DX || Math.abs(dx) < Math.abs(dy) * RATIO) return;
        var btns = navButtons();
        if (!btns) return;
        var cur = -1;
        for (var i = 0; i < btns.length; i++) if (btns[i].classList.contains('active')) { cur = i; break; }
        if (cur < 0) return;
        var next = cur + (dx < 0 ? 1 : -1);       // deslizar a la izquierda = pestaña siguiente
        if (next < 0 || next >= btns.length) return;
        btns[next].click();
    }, { passive: true });
})();
