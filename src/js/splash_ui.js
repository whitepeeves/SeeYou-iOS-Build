/* Pantalla de carga de SeeYou: logo animado, barra de progreso con porcentaje y mensaje tranquilizador.
 * Se activa sola sobre el elemento #initial-splash (basta con incluir este script justo después). */
(function () {
    'use strict';
    if (window.SeeYouSplash) return;

    var CSS = [
        '#initial-splash.splash-screen{background:radial-gradient(120% 75% at 50% 0%,#24507f 0%,#1B3A5C 42%,#0b1a2b 100%);padding:24px;box-sizing:border-box;text-align:center;overflow:hidden}',
        '#initial-splash.splash-screen::before{content:"";position:absolute;width:420px;height:420px;left:50%;top:38%;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(0,163,255,.22) 0%,rgba(0,163,255,0) 68%);pointer-events:none}',
        '#initial-splash .splash-logo-container{position:relative;width:132px;height:80px;margin:0 0 18px;filter:drop-shadow(0 10px 26px rgba(0,163,255,.35))}',
        '#initial-splash .splash-logo-container svg{width:100%;height:100%;overflow:visible}',
        '#initial-splash .splash-logo-container{height:112px;width:112px}',
        '#initial-splash .splash-logo-img{width:112px;height:112px;display:block;border-radius:26px;box-shadow:0 10px 30px rgba(0,0,0,.35)}',
        '#initial-splash .splash-logo-container circle{transform-box:fill-box;transform-origin:center;animation:sy-pulse 2.4s infinite ease-in-out}',
        '#initial-splash .splash-logo-container circle:nth-of-type(2){animation-delay:-1.2s}',
        '@keyframes sy-pulse{0%,100%{transform:scale(.92);opacity:.55}50%{transform:scale(1.08);opacity:1}}',
        '#initial-splash .sy-brand{position:relative;color:#fff;font-size:30px;font-weight:800;letter-spacing:.4px;margin-bottom:6px}',
        '#initial-splash .splash-text{position:relative;color:rgba(255,255,255,.86);font-size:14px;font-weight:500;letter-spacing:.2px;margin:0 0 22px;opacity:1;animation:none}',
        '#initial-splash .sy-progress{position:relative;width:min(280px,72vw)}',
        '#initial-splash .sy-bar{height:8px;border-radius:999px;background:rgba(255,255,255,.14);overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.25)}',
        '#initial-splash .sy-fill{position:relative;height:100%;width:0;border-radius:999px;background:linear-gradient(90deg,#00A3FF 0%,#5CC8FF 100%);box-shadow:0 0 12px rgba(0,163,255,.7);transition:width .25s ease-out;overflow:hidden}',
        '#initial-splash .sy-fill::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 0%,rgba(255,255,255,.55) 50%,transparent 100%);transform:translateX(-100%);animation:sy-shine 1.4s infinite ease-in-out}',
        '@keyframes sy-shine{to{transform:translateX(100%)}}',
        '#initial-splash .sy-pct{margin-top:10px;font-size:13px;font-weight:700;color:#bfe6ff;font-variant-numeric:tabular-nums;letter-spacing:.4px}',
        '#initial-splash .sy-hint{margin-top:14px;font-size:12px;line-height:1.4;color:rgba(255,255,255,.62);opacity:0;transition:opacity .5s ease;min-height:17px}',
        '#initial-splash .sy-hint.show{opacity:1}',
        '#initial-splash .btn-splash-config,#initial-splash .btn-splash-reset{position:relative;margin-top:18px;padding:10px 22px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.28);color:#fff;border-radius:999px;font-size:13px;font-weight:600;cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}',
        '#initial-splash .btn-splash-reset{display:none;margin-top:10px;background:transparent;border-color:rgba(255,255,255,.2);color:rgba(255,255,255,.72);font-weight:500}',
        '#initial-splash.sy-slow .btn-splash-reset{display:inline-block}',
        '@media (prefers-reduced-motion:reduce){#initial-splash .splash-logo-container circle,#initial-splash .sy-fill::after{animation:none}}'
    ].join('\n');

    var state = { pct: 0, timer: null, startedAt: Date.now(), done: false, fill: null, label: null, hint: null };

    function translate(key, fallback) {
        try {
            if (typeof CONFIG !== 'undefined' && typeof CONFIG.translate === 'function') return CONFIG.translate(key, fallback) || fallback;
        } catch (e) { }
        return fallback;
    }

    function paint() {
        if (state.fill) state.fill.style.width = state.pct + '%';
        if (state.label) state.label.textContent = Math.round(state.pct) + ' %';
    }

    function setProgress(value) {
        var next = Math.max(state.pct, Math.min(100, value));
        state.pct = next;
        paint();
    }

    function tick() {
        if (state.done) return;
        var elapsed = Date.now() - state.startedAt;
        // Avanza de forma suave y nunca llega al 100 % por sí sola: ese último tramo lo da finish().
        setProgress(94 * (1 - Math.exp(-elapsed / 3800)));
        if (elapsed > 4500 && state.hint && !state.hint.classList.contains('show')) state.hint.classList.add('show');
        if (elapsed > 5000) {
            var splash = document.getElementById('initial-splash');
            if (splash) splash.classList.add('sy-slow');
        }
    }

    function finish() {
        if (state.done) return;
        state.done = true;
        if (state.timer) clearInterval(state.timer);
        state.pct = 100;
        paint();
    }

    function build() {
        var splash = document.getElementById('initial-splash');
        if (!splash || splash.getAttribute('data-sy') === '1') return;
        splash.setAttribute('data-sy', '1');

        if (!document.getElementById('seeyou-splash-style')) {
            var style = document.createElement('style');
            style.id = 'seeyou-splash-style';
            style.textContent = CSS;
            document.head.appendChild(style);
        }

        var status = document.getElementById('splash-status');
        var brand = document.createElement('div');
        brand.className = 'sy-brand';
        brand.textContent = 'SeeYou';
        var logo = splash.querySelector('.splash-logo-container');
        if (logo && logo.parentNode) logo.parentNode.insertBefore(brand, logo.nextSibling);

        var progress = document.createElement('div');
        progress.className = 'sy-progress';
        progress.setAttribute('role', 'progressbar');
        progress.setAttribute('aria-valuemin', '0');
        progress.setAttribute('aria-valuemax', '100');
        progress.innerHTML = '<div class="sy-bar"><div class="sy-fill"></div></div>' +
            '<div class="sy-pct">0 %</div>' +
            '<div class="sy-hint"></div>';
        if (status && status.parentNode) status.parentNode.insertBefore(progress, status.nextSibling);
        else splash.appendChild(progress);

        state.fill = progress.querySelector('.sy-fill');
        state.label = progress.querySelector('.sy-pct');
        state.hint = progress.querySelector('.sy-hint');
        state.hint.textContent = translate('splash_hint', 'Puede tardar unos segundos. No cierres la aplicación.');

        // El resto de scripts ocultan el splash añadiendo la clase "hidden": completar la barra en ese momento.
        try {
            new MutationObserver(function () {
                if (splash.classList.contains('hidden')) finish();
            }).observe(splash, { attributes: true, attributeFilter: ['class'] });
        } catch (e) { }

        state.timer = setInterval(tick, 90);
        tick();
    }

    window.SeeYouSplash = { setProgress: setProgress, finish: finish };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
    else build();
    build();
})();
