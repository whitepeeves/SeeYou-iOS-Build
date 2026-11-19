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
