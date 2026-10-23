/* SeeYou · Teclado
 * En iPhone el teclado ya no desplaza toda la app: el plugin nativo (@capacitor/keyboard, resize "native")
 * encoge la ventana y solo sube lo que va pegado abajo (la caja de escribir). Mientras hay un campo de texto
 * enfocado se oculta la barra de navegación inferior para que no flote encima del teclado.
 */
(function () {
    'use strict';
    var root = document.documentElement;
    try {
        var st = document.createElement('style');
        st.textContent = 'html.kb-open .bottom-nav-bar{display:none !important}';
        document.head.appendChild(st);
    } catch (e) { }
    var timer = null;
    function isField(el) {
        if (!el || !el.tagName) return false;
        var t = el.tagName;
        if (t === 'TEXTAREA') return true;
        if (el.isContentEditable) return true;
        if (t === 'INPUT') {
            var type = (el.type || 'text').toLowerCase();
            return ['button', 'checkbox', 'radio', 'range', 'color', 'file', 'submit', 'reset', 'image'].indexOf(type) < 0;
        }
        return false;
    }
    document.addEventListener('focusin', function (e) {
        if (!isField(e.target)) return;
        clearTimeout(timer);
        root.classList.add('kb-open');
        try { window.scrollTo(0, 0); } catch (err) { }
    });
    document.addEventListener('focusout', function () {
        clearTimeout(timer);
        timer = setTimeout(function () { if (!isField(document.activeElement)) root.classList.remove('kb-open'); }, 80);
    });
    // iOS puede dejar la página desplazada tras cerrar el teclado
    window.addEventListener('keyboardDidHide', function () { try { window.scrollTo(0, 0); } catch (e) { } });
})();
