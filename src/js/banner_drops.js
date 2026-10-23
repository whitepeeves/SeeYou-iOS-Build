/* Efecto "gotas" del banner del perfil.
   El banner se duplica hacia abajo: la mitad de arriba es el banner de siempre y la de abajo (un reflejo suyo, para que continue sin saltos)
   queda oculta. Del borde de arriba cuelgan gotas de agua: se acumulan, se estiran y caen despacio dejando un chorro; al caer
   descubren la mitad oculta con su forma. Todo se corta donde acaba el banner (entre el nombre y la descripcion).
   Se recorta con clip-path: path(), que funciona en Android, iOS y navegadores. Respeta "reducir movimiento" y se apaga solo si va lento. */
(function () {
    'use strict';
    var ease = function (u) { return u * u * (3 - 2 * u); };
    var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
    var seed = function (n) { var x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
    var f1 = function (v) { return (Math.round(v * 10) / 10).toString(); };
    var G = 900;
    var DROPS = [
        { x: .17, r: 19, tg: 4.6, ts: 1.1, rest: .8, ph: 0 },
        { x: .43, r: 14, tg: 3.6, ts: .9, rest: 1.0, ph: 1.9 },
        { x: .67, r: 22, tg: 5.4, ts: 1.2, rest: .5, ph: .7 },
        { x: .87, r: 16, tg: 4.0, ts: 1.0, rest: .9, ph: 2.8 }
    ];

    function rrect(x, y, w, h, tl, tr, br, bl) {
        return 'M' + f1(x + tl) + ',' + f1(y) + ' H' + f1(x + w - tr) + (tr ? ' A' + tr + ',' + tr + ' 0 0 1 ' + f1(x + w) + ',' + f1(y + tr) : '') +
            ' V' + f1(y + h - br) + (br ? ' A' + br + ',' + br + ' 0 0 1 ' + f1(x + w - br) + ',' + f1(y + h) : '') +
            ' H' + f1(x + bl) + (bl ? ' A' + bl + ',' + bl + ' 0 0 1 ' + f1(x) + ',' + f1(y + h - bl) : '') +
            ' V' + f1(y + tl) + (tl ? ' A' + tl + ',' + tl + ' 0 0 1 ' + f1(x + tl) + ',' + f1(y) : '') + ' Z ';
    }
    var smax = function (a, b, k) { return Math.max(a, b) + Math.pow(Math.max(k - Math.abs(a - b), 0), 2) / (4 * k); };
    // Gota colgando del borde: lamina de agua extendida (Wf,Tf) + cabeza redonda (r, centro a profundidad c) + cuello (n,f)
    function hang(x, base, p) {
        var B = Math.max(p.Wf, p.r + p.f, p.n + p.f) + 2, pts = [], dx, a, h, t, q;
        for (dx = B; dx >= -B; dx -= 2) {
            a = Math.abs(dx); h = 0;
            if (p.Tf > 0.05 && a < p.Wf) { q = 1 - (a / p.Wf) * (a / p.Wf); h = p.Tf * q * q; }
            if (p.r > 0.3 && a < p.r) h = smax(h, p.c + Math.sqrt(p.r * p.r - a * a), p.r * .5);
            if (p.n > 0.6) { t = clamp((p.n + p.f - a) / p.f, 0, 1); h = smax(h, p.c * t * t * (3 - 2 * t), p.r * .4); }
            pts.push(f1(x + dx) + ',' + f1(base + h));
        }
        return 'M' + f1(x - B) + ',' + f1(base - 1) + ' L' + f1(x + B) + ',' + f1(base - 1) + ' L' + pts.join(' L') + ' Z ';
    }
    function freeDrop(x, y, r, L) {
        var tip = y - L;
        return 'M' + f1(x) + ',' + f1(tip) + ' C' + f1(x + r * .15) + ',' + f1(tip + L * .5) + ' ' + f1(x + r) + ',' + f1(y - r * .8) + ' ' + f1(x + r) + ',' + f1(y) +
            ' A' + f1(r) + ',' + f1(r) + ' 0 1 1 ' + f1(x - r) + ',' + f1(y) + ' C' + f1(x - r) + ',' + f1(y - r * .8) + ' ' + f1(x - r * .15) + ',' + f1(tip + L * .5) + ' ' + f1(x) + ',' + f1(tip) + ' Z ';
    }

    // Camino completo del recorte para el instante t
    function buildPath(t, g, noTop) {
        var W = g.W, TOP = g.TOP, TOT = g.TOT, s = g.s, RB = g.RB, RT = g.RT;
        var d = noTop ? '' : rrect(0, 0, W, TOP, RT, RT, RB, RB);
        DROPS.forEach(function (o) {
            var rmBase = o.r * s;
            var Pbase = o.tg + o.ts + 4 + o.rest, tt = t + o.ph * 1.7, cyc = Math.floor(tt / Pbase), u0 = tt - cyc * Pbase;
            var x = o.x * W + (seed(cyc + o.x * 100) - .5) * 6 * s, rm = rmBase * (.85 + .3 * seed(cyc * 3 + o.x * 100));
            var cMax = rm * .9, yRest = rm * .55;
            var yDet = TOP + cMax + rm * 2.4 + rm * .9;                  // donde se suelta
            var A = G * .45, v0 = rm * 4, dist = Math.max(10, TOT + rm * 2.6 - yDet);
            var fall = (-v0 + Math.sqrt(v0 * v0 + 2 * A * dist)) / A;     // lo que tarda en llegar al final del banner
            var u = u0;
            if (u < o.tg) {
                var k = u / o.tg, spread = ease(clamp(k / .55, 0, 1)), gather = ease(clamp((k - .35) / .65, 0, 1));
                var Wf = rm * (1.2 + 2.4 * (1 - gather) * (.4 + .6 * spread)), Tf = rm * (.05 + .5 * spread + .5 * gather);
                var r = rm * (.05 + .95 * gather * gather), c = cMax * gather * (.6 + .4 * gather);
                d += hang(x, TOP, { Wf: Wf, Tf: Tf, r: r, c: c, n: r * .9, f: r * .9 });
                return;
            }
            u -= o.tg;
            if (u < o.ts) {
                var k2 = u / o.ts, kk = k2 * k2, r2 = rm * (1 - .08 * k2);
                d += hang(x, TOP, { Wf: rm * 1.2 * (1 - k2), Tf: rm * .5 * (1 - k2), r: r2, c: cMax + kk * rm * 2.4, n: Math.max(.4, r2 * .75 * Math.pow(1 - k2, 2.2)), f: r2 * .7 * (1 - .6 * k2) });
                return;
            }
            u -= o.ts;
            if (u < fall) {                                              // cae despacio dejando un chorro pegado al banner
                var y = yDet + v0 * u + .5 * A * u * u, rr = rm * .9, wTrail = rm * .55 * (1 - .35 * (u / fall));
                d += rrect(x - wTrail / 2, TOP - 1, wTrail, Math.max(2, y - TOP), wTrail / 2, wTrail / 2, wTrail / 2, wTrail / 2);
                if (y - rr < TOT + 4) d += freeDrop(x, y, rr, Math.min(rm * 3, rm * 1.2 + (v0 + A * u) * .03));
                var rk = Math.max(0, 1 - u / .5); if (rk > 0) d += hang(x, TOP, { Wf: rm * 1.1 * rk, Tf: rm * .28 * rk, r: 0, c: 0, n: 0, f: 1 });
                return;
            }
            u -= fall;
            if (u < .9) {                                                // el chorro se recoge hacia arriba
                var kr = ease(u / .9), top = TOP + (TOT - TOP) * kr, wT = rm * .55 * (1 - .35) * (1 - kr * .6);
                if (TOT - top > 2) d += rrect(x - wT / 2, top, wT, TOT - top + 2, wT / 2, wT / 2, 0, 0);
            }
        });
        return d;
    }

    function Fx(cover, endEl) {
        var self = this;
        this.cover = cover; this.endEl = endEl; this.host = cover.parentNode;
        this.running = false; this.visible = true; this.t0 = performance.now(); this.slow = 0; this.frames = 0;
        var layer = this.layer = document.createElement('div');
        layer.className = 'bd-layer bd-banner-layer';
        layer.style.cssText = 'position:absolute;z-index:0;pointer-events:none;';
        var top = this.top = document.createElement('div'), bot = this.bot = document.createElement('div');
        top.className = 'bd-banner-top'; bot.className = 'bd-banner-bot';
        top.style.cssText = 'position:absolute;left:0;top:0;width:100%;';
        bot.style.cssText = 'position:absolute;left:0;top:0;width:100%;transform:scaleY(-1);';
        var bw = this.bw = document.createElement('div');
        bw.style.cssText = 'position:absolute;left:0;width:100%;will-change:clip-path;';
        bw.appendChild(bot); layer.appendChild(top); layer.appendChild(bw);
        this.host.style.position = this.host.style.position || 'relative';
        this.host.classList.add('bd-host');
        this.host.insertBefore(layer, this.host.firstChild);
        this.ro = (typeof ResizeObserver === 'function') ? new ResizeObserver(function () { self.layout(); }) : null;
        if (this.ro) { this.ro.observe(this.host); if (endEl) this.ro.observe(endEl); }
        this.io = (typeof IntersectionObserver === 'function') ? new IntersectionObserver(function (es) { self.visible = es[0].isIntersecting; self.kick(); }) : null;
        if (this.io) this.io.observe(layer);
        this.layout();
        this.reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.onVis = function () { self.kick(); }; document.addEventListener('visibilitychange', this.onVis);
        if (!this.reduce) this.kick(); else this.freeze();
    }
    Fx.prototype.layout = function () {
        var c = this.cover, cs = getComputedStyle(c);
        var W = c.offsetWidth, TOP = c.offsetHeight;
        if (!W || !TOP) return;                                           // seccion oculta: se mide cuando se vea
        var end = this.endEl ? (this.endEl.offsetTop + this.endEl.offsetHeight + 8) : TOP * 2;
        var TOT = Math.max(TOP + 40, end - c.offsetTop);
        var RAD = parseFloat(cs.borderTopLeftRadius) || 0, RADB = parseFloat(cs.borderBottomLeftRadius) || 0;
        this.g = { W: W, TOP: TOP, TOT: TOT, s: clamp(W / 350, .7, 1.3), RT: RAD, RB: RADB };
        var L = this.layer, T = this.top, B = this.bot;
        L.style.left = c.offsetLeft + 'px'; L.style.top = c.offsetTop + 'px'; L.style.width = W + 'px'; L.style.height = TOT + 'px';
        [T, B].forEach(function (el) { el.style.backgroundImage = cs.backgroundImage; el.style.backgroundSize = cs.backgroundSize; el.style.backgroundPosition = cs.backgroundPosition; el.style.backgroundRepeat = cs.backgroundRepeat; el.style.backgroundColor = cs.backgroundColor; });
        T.style.height = TOP + 'px';
        T.style.overflow = 'hidden'; T.style.borderRadius = RAD + 'px ' + RAD + 'px ' + RADB + 'px ' + RADB + 'px';
        this.bw.style.top = (TOP - 3) + 'px'; this.bw.style.height = Math.max(0, TOT - TOP + 3) + 'px'; this.bot.style.top = '3px'; this.g2 = { W: W, TOP: 3, TOT: TOT - TOP + 3, s: this.g.s, RB: 0, RT: 0 };   // 3px de solape con la mitad de arriba para que no haya costura
        B.style.height = Math.max(0, TOT - TOP) + 'px';
        B.style.backgroundPosition = 'center bottom';                    // reflejo: la fila de abajo del banner queda junto al borde, sin salto de color
        c.style.visibility = 'hidden';
        if (this.reduce) this.freeze(); else this.kick();
    };
    Fx.prototype.freeze = function () { this.bw.style.clipPath = 'path("M0,0 Z")'; this.bw.style.willChange = 'auto'; };
    Fx.prototype.staticPath = function () { var g = this.g; return g ? rrect(0, 0, g.W, g.TOP, g.RT, g.RT, g.RB, g.RB) : 'M0,0 Z'; };
    Fx.prototype.kick = function () {
        var self = this;
        if (this.reduce || this.running || document.hidden || !this.visible || !this.g) return;
        this.running = true; var last = 0;
        var loop = function (now) {
            if (!self.running) return;
            if (document.hidden || !self.visible) { self.running = false; return; }
            if (now - last >= 32) {                                      // ~30 imagenes por segundo
                var t0 = performance.now();
                var p = 'path("' + buildPath((now - self.t0) / 1000 + 6, self.g2, true) + '")';
                if (p !== self.lastP) { self.bw.style.clipPath = p; self.lastP = p; }
                var cost = performance.now() - t0 + (now - last > 100 && last ? 1 : 0);
                if (last && now - last > 70) self.slow++; else self.slow = Math.max(0, self.slow - 1);
                if (self.slow > 45) { self.reduce = true; self.running = false; self.freeze(); return; }   // va lento: se queda quieto
                last = now;
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    };
    Fx.prototype.destroy = function () {
        this.running = false;
        if (this.ro) this.ro.disconnect(); if (this.io) this.io.disconnect();
        document.removeEventListener('visibilitychange', this.onVis);
        if (this.layer.parentNode) this.layer.parentNode.removeChild(this.layer);
        this.cover.style.visibility = '';
        this.host.classList.remove('bd-host');
    };

    var css = document.createElement('style');
    css.textContent = '.bd-host > :not(.bd-layer){position:relative;z-index:1}.bd-host > .bd-layer{position:absolute;z-index:0}';
    document.head.appendChild(css);

    // API: SeeYouBannerDrops.apply(coverEl, endEl, enabled) -> activa o quita el efecto en ese banner
    window.SeeYouBannerDrops = {
        apply: function (cover, endEl, enabled) {
            if (!cover) return;
            if (cover.__bdFx) { cover.__bdFx.destroy(); cover.__bdFx = null; }
            if (!enabled) return;
            cover.__bdFx = new Fx(cover, endEl);
        },
        _buildPath: buildPath
    };
})();
