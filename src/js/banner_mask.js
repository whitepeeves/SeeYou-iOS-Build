/* Sustituye al efecto "gotas" (src/js/banner_drops.js, eliminado).
   En vez de una animacion automatica, la persona (si tiene Premium) puede dibujar/borrar a mano,
   con un pincel, la silueta de un SEGUNDO rectangulo (mismo ancho y alto que el banner de siempre),
   justo debajo de el, hasta donde empieza el nombre/descripcion (eso es el maximo). Donde haya
   pintado se ve la CONTINUACION real de la foto o del color del banner -nunca una copia recortada
   ni volteada, que era el problema de las gotas-. Si no hay dibujo guardado (o la persona no es
   Premium) ese rectangulo de abajo no ocupa nada de sitio: todo queda exactamente como ahora.

   API:
     SeeYouBannerMask.apply(coverEl, endEl, maskUrl)
         -> pinta (o quita) el rectangulo de abajo en ese banner.
     SeeYouBannerMask.openEditor({ bannerImageUrl, bannerCss, maskUrl, onSave(dataUrl, close) })
         -> abre el editor de pincel. onSave recibe el PNG dibujado (dataURL) y una funcion close().
*/
(function () {
    'use strict';

    function Fx(cover, endEl) {
        this.cover = cover; this.endEl = endEl; this.maskUrl = ''; this._natCache = null;
        this.host = cover.parentNode;
        var layer = this.layer = document.createElement('div');
        layer.className = 'bm-layer';
        layer.style.cssText = 'position:absolute;z-index:0;pointer-events:none;overflow:hidden;';
        var bot = this.bot = document.createElement('div');
        bot.style.cssText = 'position:absolute;left:0;width:100%;height:0;background-repeat:no-repeat;';
        layer.appendChild(bot);
        this.host.style.position = this.host.style.position || 'relative';
        this.host.classList.add('bm-host');
        this.host.insertBefore(layer, this.host.firstChild);
        var self = this;
        this.ro = (typeof ResizeObserver === 'function') ? new ResizeObserver(function () { self.layout(); }) : null;
        if (this.ro) { this.ro.observe(this.host); if (endEl) this.ro.observe(endEl); }
    }
    Fx.prototype.setMask = function (url) { this.maskUrl = url || ''; this.layout(); };
    Fx.prototype.layout = function () {
        var c = this.cover, cs = getComputedStyle(c);
        var W = c.offsetWidth, TOP = c.offsetHeight;
        if (!W || !TOP) return;                                       // seccion oculta: se mide cuando se vea
        var end = this.endEl ? (this.endEl.offsetTop + this.endEl.offsetHeight + 8) : TOP * 2;
        var TOT = Math.max(TOP + 20, end - c.offsetTop);
        var BOT = TOT - TOP;
        var L = this.layer, B = this.bot;
        L.style.left = c.offsetLeft + 'px'; L.style.top = c.offsetTop + 'px'; L.style.width = W + 'px'; L.style.height = TOT + 'px';
        var RAD = parseFloat(cs.borderBottomLeftRadius) || 0, RADR = parseFloat(cs.borderBottomRightRadius) || 0;
        if (!this.maskUrl || BOT < 4) { B.style.height = '0px'; B.style.backgroundImage = 'none'; return; }
        B.style.top = TOP + 'px'; B.style.height = BOT + 'px';
        B.style.borderRadius = '0 0 ' + RADR + 'px ' + RAD + 'px';
        B.style.maskImage = 'url("' + this.maskUrl + '")'; B.style.webkitMaskImage = 'url("' + this.maskUrl + '")';
        B.style.maskSize = '100% 100%'; B.style.webkitMaskSize = '100% 100%';
        B.style.maskRepeat = 'no-repeat'; B.style.webkitMaskRepeat = 'no-repeat';
        var isImg = /^url\(/.test(cs.backgroundImage);
        if (!isImg) {
            // color o degradado: no hay nada que "recortar mal", el mismo fondo sirve de continuacion
            B.style.backgroundImage = cs.backgroundImage; B.style.backgroundColor = cs.backgroundColor;
            B.style.backgroundSize = ''; B.style.backgroundPosition = '';
            return;
        }
        // foto: calculamos EXACTAMENTE la misma zona "cover" que ya se ve arriba y mostramos lo que
        // sigue justo debajo, desplazando la misma imagen hacia arriba (nunca un trozo distinto ni volteado)
        var urlMatch = /url\(["']?([^"')]+)["']?\)/.exec(cs.backgroundImage);
        var src = urlMatch ? urlMatch[1] : '';
        if (!src) { B.style.backgroundImage = 'none'; return; }
        var self = this;
        var paint = function (natW, natH) {
            if (!natW || !natH) { B.style.backgroundImage = 'none'; return; }
            var scale = Math.max(W / natW, TOP / natH);                // igual que "background-size:cover" para el rectangulo de arriba
            var sw = natW * scale, sh = natH * scale;
            var offX = (W - sw) / 2, offY = (TOP - sh) / 2;             // "background-position:center" sobre ESE rectangulo
            B.style.backgroundImage = 'url("' + src + '")';
            B.style.backgroundSize = sw + 'px ' + sh + 'px';
            B.style.backgroundPosition = offX + 'px ' + (offY - TOP) + 'px';
        };
        if (this._natCache && this._natCache.src === src) { paint(this._natCache.w, this._natCache.h); return; }
        var img = new Image();
        img.onload = function () { self._natCache = { src: src, w: img.naturalWidth, h: img.naturalHeight }; paint(img.naturalWidth, img.naturalHeight); };
        img.onerror = function () { B.style.backgroundImage = 'none'; };
        img.src = src;
    };
    Fx.prototype.destroy = function () {
        if (this.ro) this.ro.disconnect();
        if (this.layer.parentNode) this.layer.parentNode.removeChild(this.layer);
        this.host.classList.remove('bm-host');
    };

    var css = document.createElement('style');
    // :not(.ps-panel) y :not(.profile-drawer): el host de la mascara del banner es el contenedor
    // padre de la portada, pero dentro de ese mismo contenedor (mas abajo en el HTML) tambien
    // vive el panel de Configuracion (#profile-settings-panel, position:fixed de por si). Sin
    // esta exclusion, el selector de abajo le pisaba el position:fixed con un position:relative
    // y el panel se quedaba "abierto" segun el JS pero renderizado metros mas abajo en la pagina,
    // invisible sin hacer scroll. Lo mismo de propina para cualquier .profile-drawer que acabe ahi.
    css.textContent = '.bm-host > :not(.bm-layer):not(.ps-panel):not(.profile-drawer){position:relative;z-index:1}.bm-host > .bm-layer{position:absolute;z-index:0}' +
        '.bm-editor-ov{font-family:inherit}.bm-tool{border:1px solid var(--app-border,#E8EAF0);background:var(--app-surface,#fff);color:var(--app-text,#1D1B20);border-radius:12px;padding:8px 14px;font-size:13.5px;font-weight:600;cursor:pointer}' +
        '.bm-tool.is-active{background:var(--app-primary,#1B3A5C);border-color:var(--app-primary,#1B3A5C);color:#fff}' +
        '.bm-clear,.bm-cancel,.bm-save{border-radius:12px;padding:9px 16px;font-size:13.5px;font-weight:700;cursor:pointer;border:1px solid var(--app-border,#E8EAF0)}' +
        '.bm-clear{background:transparent;color:var(--app-muted,#667085)}.bm-cancel{background:transparent;color:var(--app-text,#1D1B20)}' +
        '.bm-save{background:var(--app-primary,#1B3A5C);border-color:var(--app-primary,#1B3A5C);color:#fff}';
    document.head.appendChild(css);

    window.SeeYouBannerMask = {
        apply: function (cover, endEl, maskUrl) {
            if (!cover) return;
            if (!cover.__bmFx) cover.__bmFx = new Fx(cover, endEl);
            cover.__bmFx.setMask(maskUrl);
        }
    };

    // ----------------- Editor (pincel dibujar/borrar) -----------------
    var activeEditor = null;
    function closeEditor() {
        if (activeEditor && activeEditor.parentNode) activeEditor.parentNode.removeChild(activeEditor);
        activeEditor = null; document.body.style.overflow = '';
    }
    function openEditor(opts) {
        opts = opts || {};
        closeEditor();
        var W = 640, H = 240;
        var ov = document.createElement('div');
        ov.className = 'bm-editor-ov';
        ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(10,14,22,.72);display:flex;align-items:center;justify-content:center;padding:16px;';
        ov.innerHTML =
            '<div class="bm-editor-card" style="background:var(--app-surface,#fff);border-radius:20px;max-width:720px;width:100%;padding:18px;box-shadow:0 30px 70px -30px rgba(0,0,0,.6);max-height:92vh;overflow:auto;">' +
            '<h3 style="margin:0 0 4px;font-size:18px;font-weight:800;color:var(--app-text,#1D1B20);">Editar forma del banner</h3>' +
            '<p style="margin:0 0 12px;font-size:13.5px;color:var(--app-muted,#667085);">Dibuja lo que quieras (rayos, lagrimas, una ola...) justo debajo de tu banner. Se vera tu foto o color de fondo, nunca otra cosa.</p>' +
            '<div class="bm-canvas-wrap" style="position:relative;border-radius:14px;overflow:hidden;border:1px solid var(--app-border,#E8EAF0);"></div>' +
            '<div style="display:flex;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap;">' +
            '<button type="button" data-mode="draw" class="bm-tool is-active">✏️ Dibujar</button>' +
            '<button type="button" data-mode="erase" class="bm-tool">🧽 Borrar</button>' +
            '<label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--app-muted,#667085);">Grosor<input type="range" min="6" max="60" value="22" class="bm-size"></label>' +
            '<button type="button" class="bm-clear" style="margin-left:auto;">Borrar todo</button>' +
            '</div>' +
            '<div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end;">' +
            '<button type="button" class="bm-cancel">Cancelar</button>' +
            '<button type="button" class="bm-save">Guardar</button>' +
            '</div>' +
            '</div>';
        document.body.appendChild(ov);
        document.body.style.overflow = 'hidden';
        activeEditor = ov;

        var wrap = ov.querySelector('.bm-canvas-wrap');
        wrap.style.background = opts.bannerImageUrl ? ('url("' + opts.bannerImageUrl + '") center / cover no-repeat') : (opts.bannerCss || '#1B3A5C');
        wrap.style.aspectRatio = (W / H);
        var canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        canvas.style.cssText = 'display:block;width:100%;height:auto;touch-action:none;cursor:crosshair;';
        wrap.appendChild(canvas);
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, W, H);

        if (opts.maskUrl) {
            var prev = new Image();
            prev.crossOrigin = 'anonymous';
            prev.onload = function () { try { ctx.drawImage(prev, 0, 0, W, H); } catch (e) { } };
            prev.src = opts.maskUrl;
        }

        var mode = 'draw', brush = 22, drawing = false, last = null;
        function toLocal(e) {
            var r = canvas.getBoundingClientRect();
            var p = (e.touches && e.touches[0]) || e;
            return { x: (p.clientX - r.left) / r.width * W, y: (p.clientY - r.top) / r.height * H };
        }
        function strokeTo(pt) {
            ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = brush;
            ctx.globalCompositeOperation = mode === 'erase' ? 'destination-out' : 'source-over';
            ctx.strokeStyle = '#fff';
            ctx.beginPath();
            if (last) { ctx.moveTo(last.x, last.y); ctx.lineTo(pt.x, pt.y); } else { ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x + 0.01, pt.y + 0.01); }
            ctx.stroke();
            last = pt;
        }
        function start(e) { e.preventDefault(); drawing = true; last = null; strokeTo(toLocal(e)); }
        function move(e) { if (!drawing) return; e.preventDefault(); strokeTo(toLocal(e)); }
        function end() { drawing = false; last = null; }
        canvas.addEventListener('pointerdown', start);
        canvas.addEventListener('pointermove', move);
        window.addEventListener('pointerup', end);
        canvas.addEventListener('touchstart', start, { passive: false });
        canvas.addEventListener('touchmove', move, { passive: false });
        canvas.addEventListener('touchend', end);

        Array.prototype.forEach.call(ov.querySelectorAll('.bm-tool'), function (b) {
            b.addEventListener('click', function () {
                Array.prototype.forEach.call(ov.querySelectorAll('.bm-tool'), function (x) { x.classList.remove('is-active'); });
                b.classList.add('is-active'); mode = b.dataset.mode;
            });
        });
        ov.querySelector('.bm-size').addEventListener('input', function (e) { brush = Number(e.target.value) || 22; });
        ov.querySelector('.bm-clear').addEventListener('click', function () { ctx.clearRect(0, 0, W, H); });
        ov.querySelector('.bm-cancel').addEventListener('click', function () { if (opts.onCancel) opts.onCancel(); closeEditor(); });
        ov.querySelector('.bm-save').addEventListener('click', function () {
            var dataUrl;
            try { dataUrl = canvas.toDataURL('image/png'); } catch (e) { if (window.showToast) showToast('No se pudo exportar el dibujo. Dale a "Borrar todo" y dibuja de nuevo.'); return; }
            if (opts.onSave) opts.onSave(dataUrl, closeEditor); else closeEditor();
        });
    }
    window.SeeYouBannerMask.openEditor = openEditor;
    window.SeeYouBannerMask.closeEditor = closeEditor;
})();
