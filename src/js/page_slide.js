/* Cambio de pagina limpio (sin parpadeo):
   1) El tema oscuro/azul se aplicaba al terminar de cargar, asi que se veia un destello claro antes de pintar el oscuro.
      Ahora se aplica en cuanto existe <body>, antes del primer pintado, y el fondo del <html> ya sale del color correcto.
   2) Transicion entre documentos (View Transitions): el navegador mantiene la pantalla anterior hasta que la nueva
      esta lista, en vez de dejar un instante en blanco. En navegadores sin soporte simplemente no hace nada. */
(function () {
    'use strict';
    try {
        var th = null;
        try { th = localStorage.getItem('seeYou_theme'); } catch (e) { }
        var bg = th === 'dark' ? '#090b12' : th === 'blue' ? '#07111d' : null;
        var css = '@view-transition{navigation:auto}' +
            '::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}';
        if (bg) css += 'html{background-color:' + bg + '}';
        var st = document.createElement('style');
        st.textContent = css;
        (document.head || document.documentElement).appendChild(st);
        if (bg) {
            var apply = function () {
                if (!document.body) return false;
                if (!document.body.dataset.theme) document.body.dataset.theme = th;
                return true;
            };
            if (!apply()) {
                var mo = new MutationObserver(function () { if (apply()) mo.disconnect(); });
                mo.observe(document.documentElement, { childList: true });
            }
        }
    } catch (e) { }
})();

/* Entrada con deslizamiento al llegar de otra pestaña (Inicio / Amigos / Chat / Mapa / Perfil).
   Se carga en <head> (sin defer) para que el contenido ya arranque fuera de pantalla y no haya parpadeo.
   swipe_nav.js deja en sessionStorage la direccion del gesto: 'l' = se deslizo a la izquierda (el contenido nuevo entra por la derecha). */
(function () {
    'use strict';
    try {
        var raw = sessionStorage.getItem('seeyou_slide');
        if (!raw) return;
        sessionStorage.removeItem('seeyou_slide');
        var o = JSON.parse(raw);
        if (!o || !o.t || Date.now() - o.t > 4000) return;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        var h = document.documentElement;
        var cls = o.d === 'l' ? 'sy-in-l' : 'sy-in-r';
        var st = document.createElement('style');
        st.textContent = '@keyframes syInL{from{transform:translate3d(100%,0,0)}to{transform:translate3d(0,0,0)}}' +
            '@keyframes syInR{from{transform:translate3d(-100%,0,0)}to{transform:translate3d(0,0,0)}}' +
            '.sy-in-l .main{animation:syInL .28s cubic-bezier(.22,.8,.24,1) both}' +
            '.sy-in-r .main{animation:syInR .28s cubic-bezier(.22,.8,.24,1) both}';
        (document.head || h).appendChild(st);
        h.classList.add(cls);
        setTimeout(function () { h.classList.remove('sy-in-l', 'sy-in-r'); }, 800);
    } catch (e) { }
})();
