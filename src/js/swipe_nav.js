/* Deslizar para cambiar de pestaña: Inicio <-> Amigos <-> Chat <-> Mapa <-> Perfil.
   El contenido (.main) sigue al dedo; al soltar, sale hacia un lado y el de la otra pestaña entra desde el otro
   (en Amigos/Chat, que son otras paginas, entra al cargar: ver page_slide.js). La barra inferior no se mueve.
   Reutiliza los botones de .bottom-nav-bar, asi que el cambio de pantalla es el mismo que al pulsarlos.
   Se ignora el gesto si empieza sobre algo que ya usa el deslizamiento horizontal (carruseles, campos, visores...). */
(function () {
    'use strict';
    if (window.__seeSwipeNav) return;
    window.__seeSwipeNav = true;

    var LOCK_PX = 10;            // movimiento minimo para decidir si es horizontal o vertical
    var RATIO = 1.2;             // el movimiento horizontal debe superar al vertical en esta proporcion
    var EXIT_MS = 190;
    var tracking = false, locked = false, sx = 0, sy = 0, st = 0, dx = 0, lx = 0, lt = 0, vx = 0;
    var main = null, busy = false, unloading = false;

    window.addEventListener('pagehide', function () { unloading = true; });
    window.addEventListener('pageshow', function () {            // al volver con "atras" la pagina puede quedar a medio deslizar
        unloading = false; busy = false;
        var m = document.querySelector('.main');
        if (m) { m.style.transition = ''; m.style.transform = ''; m.style.willChange = ''; }
    });

    function reduced() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

    function navButtons() {
        var nav = document.querySelector('.bottom-nav-bar');
        if (!nav || !nav.getClientRects().length || getComputedStyle(nav).visibility === 'hidden') return null;   // sin barra visible (p. ej. dentro de una conversacion): sin gesto
        var b = Array.prototype.slice.call(nav.querySelectorAll('.nav-btn'));
        return b.length >= 5 ? b : null;
    }
    function currentIndex(btns) {
        for (var i = 0; i < btns.length; i++) if (btns[i].classList.contains('active')) return i;
        return -1;
    }

    function blocked(el) {
        for (var n = el; n && n.nodeType === 1 && n !== document.documentElement; n = n.parentElement) {
            var tag = n.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'CANVAS' || tag === 'VIDEO' || tag === 'IFRAME') return true;
            if (n.isContentEditable || n.hasAttribute('data-noswipe')) return true;
            if (n.classList && n.classList.contains('bottom-nav-bar')) return true;
            var cs = getComputedStyle(n);
            if (cs.position === 'fixed') return true;                                   // ventanas, visores, paneles
            // Carruseles: desplazan en horizontal y NO son el contenedor que desplaza la pantalla en vertical
            if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && cs.overflowY !== 'auto' && cs.overflowY !== 'scroll' && n.scrollWidth > n.clientWidth + 4) return true;
        }
        return false;
    }

    function overlayOpen() {
        var b = document.body;
        if (!b) return false;
        return b.style.overflow === 'hidden' || document.documentElement.style.overflow === 'hidden';
    }

    function setX(px, ms) {
        if (!main) return;
        main.style.transition = ms ? 'transform ' + ms + 'ms cubic-bezier(.22,.8,.24,1)' : 'none';
        main.style.transform = px ? 'translate3d(' + px + 'px,0,0)' : 'translate3d(0,0,0)';
    }
    function clearX() {
        if (!main) return;
        main.style.transition = ''; main.style.transform = ''; main.style.willChange = '';
    }

    function onStart(e) {
        tracking = false; locked = false;
        if (busy || !e.touches || e.touches.length !== 1) return;
        if (window.getSelection && String(window.getSelection()).length) return;
        var t = e.touches[0];
        if (t.clientX < 24 || t.clientX > window.innerWidth - 24) return;           // bordes: gesto "atras" del sistema
        if (!navButtons() || overlayOpen() || blocked(e.target)) return;
        main = document.querySelector('.main');
        sx = lx = t.clientX; sy = t.clientY; st = lt = Date.now(); dx = 0; vx = 0;
        tracking = true;
    }

    function onMove(e) {
        if (!tracking) return;
        if (!e.touches || e.touches.length !== 1) { cancel(); return; }
        var t = e.touches[0];
        var mx = t.clientX - sx, my = t.clientY - sy;
        if (!locked) {
            if (Math.abs(mx) < LOCK_PX && Math.abs(my) < LOCK_PX) return;
            if (Math.abs(mx) > Math.abs(my) * RATIO) { locked = true; if (main) main.style.willChange = 'transform'; }
            else { tracking = false; return; }                                       // vertical: es scroll normal
        }
        if (e.cancelable) e.preventDefault();                                        // horizontal: evita el scroll/rebote de iOS mientras se arrastra
        var now = Date.now();
        if (now > lt) vx = (t.clientX - lx) / (now - lt);
        lx = t.clientX; lt = now; dx = mx;
        var btns = navButtons(), cur = btns ? currentIndex(btns) : -1;
        var next = cur + (dx < 0 ? 1 : -1);
        var edge = !btns || cur < 0 || next < 0 || next >= btns.length;
        setX(edge ? dx * 0.25 : dx, 0);                                              // en el primer/ultimo apartado se resiste
    }

    function cancel() {
        tracking = false;
        if (locked) setX(0, 200);
        locked = false;
    }

    function onEnd(e) {
        if (!tracking) return;
        tracking = false;
        if (!locked) return;
        locked = false;
        var btns = navButtons(), cur = btns ? currentIndex(btns) : -1;
        var W = window.innerWidth || 360;
        var fast = Math.abs(vx) > 0.5 && Math.abs(dx) > 40;
        var far = Math.abs(dx) > W * 0.28;
        var next = cur + (dx < 0 ? 1 : -1);
        if (!btns || cur < 0 || next < 0 || next >= btns.length || !(far || fast)) { setX(0, 220); return; }
        go(btns[next], dx < 0 ? 'l' : 'r', W);
    }

    // Sale el contenido actual, cambia de pestaña y entra el nuevo (en la misma pagina o al cargar la siguiente).
    function go(btn, dir, W) {
        busy = true;
        var sign = dir === 'l' ? -1 : 1;
        var ms = reduced() ? 0 : EXIT_MS;
        try { sessionStorage.setItem('seeyou_slide', JSON.stringify({ d: dir, t: Date.now() })); } catch (e) { }
        setX(sign * W, ms);
        setTimeout(function () {
            btn.click();
            setTimeout(function () {
                if (unloading) return;                                              // se esta cargando otra pagina: ahi entra el contenido nuevo
                try { sessionStorage.removeItem('seeyou_slide'); } catch (e) { }
                enterSamePage(sign * -1 * W);
            }, 90);
        }, ms);
    }

    // Cambio de apartado dentro de la misma pagina (Inicio, Mapa, Perfil): el nuevo entra desde el lado contrario.
    function enterSamePage(fromPx) {
        main = document.querySelector('.main');
        if (!main) { busy = false; return; }
        if (reduced()) { clearX(); busy = false; return; }
        setX(fromPx, 0);
        void main.offsetWidth;
        setX(0, 260);
        setTimeout(function () { clearX(); busy = false; }, 300);
    }

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', cancel, { passive: true });
})();
