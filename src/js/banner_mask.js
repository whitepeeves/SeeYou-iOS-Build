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
        '.bm-editor-ov{font-family:inherit}' +
        '.bm-editor-card{background:var(--app-surface,#fff);border-radius:24px;max-width:560px;width:100%;padding:20px;box-shadow:0 30px 70px -30px rgba(0,0,0,.6);max-height:92vh;overflow:auto;box-sizing:border-box}' +
        '.bm-title{margin:0 0 6px;font-size:19px;font-weight:800;letter-spacing:-.2px;color:var(--app-text,#1D1B20)}' +
        '.bm-desc{margin:0 0 14px;font-size:13.5px;line-height:1.45;color:var(--app-muted,#667085)}' +
        '.bm-toolbar{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:14px}' +
        '.bm-seg{display:inline-flex;padding:3px;gap:2px;background:var(--app-border,#EEF0F5);border-radius:14px}' +
        '.bm-tool{display:inline-flex;align-items:center;gap:7px;border:0;background:transparent;color:var(--app-muted,#667085);border-radius:10px;padding:9px 9px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:background .15s,color .15s,box-shadow .15s}' +
        '.bm-tool.is-active{background:var(--app-surface,#fff);color:var(--app-primary,#1B3A5C);box-shadow:0 1px 4px rgba(20,30,50,.18)}' +
        '.bm-clear{display:inline-flex;align-items:center;gap:4px;background:transparent;border:0;color:var(--app-muted,#667085);font:inherit;font-size:12.5px;font-weight:700;padding:9px 2px;cursor:pointer;border-radius:10px;white-space:nowrap}' +
        '.bm-clear:active{background:var(--app-border,#EEF0F5)}' +
        '.bm-sizebox{display:flex;align-items:center;gap:12px;margin-top:12px;padding:10px 14px;border-radius:14px;background:var(--app-border,#EEF0F5)}' +
        '.bm-sizelbl{font-size:13px;font-weight:700;color:var(--app-muted,#667085)}' +
        '.bm-size{flex:1;min-width:0;accent-color:var(--app-primary,#1B3A5C)}' +
        '.bm-dotwrap{width:34px;height:34px;display:flex;align-items:center;justify-content:center;flex:none}' +
        '.bm-dot{display:block;border-radius:50%;background:var(--app-primary,#1B3A5C);width:12px;height:12px}' +
        '.bm-actions{display:flex;gap:10px;margin-top:18px}' +
        '.bm-cancel,.bm-save{flex:1;border-radius:14px;padding:13px 16px;font:inherit;font-size:14.5px;font-weight:800;cursor:pointer;border:1px solid var(--app-border,#E8EAF0)}' +
        '.bm-cancel{background:transparent;color:var(--app-text,#1D1B20)}' +
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
    function tr(key, fallback) { try { if (typeof CONFIG !== 'undefined' && CONFIG.translate) return CONFIG.translate(key, fallback) || fallback; } catch (e) { } return fallback; }
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
        ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(10,14,22,.72);display:flex;align-items:center;justify-content:center;padding:16px;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);';
        ov.innerHTML =
            '<div class="bm-editor-card">' +
            '<h3 class="bm-title">' + tr('bm_title', 'Editar forma del banner') + '</h3>' +
            '<p class="bm-desc">' + tr('bm_desc', 'Dibuja en la mitad de abajo. La de arriba es tu banner y no se toca. Se verá tu foto o color de fondo, nunca otra cosa.') + '</p>' +
            '<div class="bm-canvas-wrap"></div>' +
            '<div class="bm-toolbar">' +
            '<div class="bm-seg" role="group">' +
            '<button type="button" data-mode="draw" class="bm-tool is-active"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg><span>' + tr('bm_draw', 'Dibujar') + '</span></button>' +
            '<button type="button" data-mode="erase" class="bm-tool"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 20H9"/><path d="M5.5 14.5 14 6a2.1 2.1 0 0 1 3 0l3 3a2.1 2.1 0 0 1 0 3l-6.5 6.5H8.5z"/><path d="M9 11l5 5"/></svg><span>' + tr('bm_erase', 'Borrar') + '</span></button>' +
            '</div>' +
            '<button type="button" class="bm-clear"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/></svg><span>' + tr('bm_clear', 'Borrar todo') + '</span></button>' +
            '</div>' +
            '<div class="bm-sizebox"><span class="bm-sizelbl">' + tr('bm_size', 'Grosor') + '</span><input type="range" min="6" max="60" value="22" class="bm-size"><span class="bm-dotwrap"><i class="bm-dot"></i></span></div>' +
            '<div class="bm-actions">' +
            '<button type="button" class="bm-cancel">' + tr('bm_cancel', 'Cancelar') + '</button>' +
            '<button type="button" class="bm-save">' + tr('bm_save', 'Guardar') + '</button>' +
            '</div>' +
            '</div>';
        document.body.appendChild(ov);
        document.body.style.overflow = 'hidden';
        activeEditor = ov;

        // El editor enseña las DOS mitades apiladas, igual que en el perfil: arriba el banner (fijo, no se toca)
        // y abajo la zona editable (la continuacion de la foto/color) donde se dibuja la forma.
        var wrap = ov.querySelector('.bm-canvas-wrap');
        var isImg = !!opts.bannerImageUrl;
        var bgPlain = opts.bannerCss || '#1B3A5C';
        function pane(extra) {
            var d = document.createElement('div');
            d.style.cssText = 'position:relative;width:100%;aspect-ratio:' + (W / H) + ';overflow:hidden;' + (extra || '');
            return d;
        }
        function chip(txt, pos) {
            var c = document.createElement('span');
            c.textContent = txt;
            c.style.cssText = 'position:absolute;' + pos + ';z-index:3;background:rgba(15,20,30,.72);color:#fff;font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:999px;pointer-events:none;';
            return c;
        }
        var topPane = pane(isImg ? ('background:url("' + opts.bannerImageUrl + '") center / cover no-repeat;') : ('background:' + bgPlain + ';'));
        topPane.appendChild(chip(tr('bm_top_label', 'Tu banner (no se edita)'), 'left:8px;top:8px'));
        var divider = document.createElement('div');
        divider.style.cssText = 'height:3px;background:var(--app-border,#E8EAF0);';
        var botPane = pane(isImg ? 'background-repeat:no-repeat;' : ('background:' + bgPlain + ';'));
        var dim = document.createElement('div');
        dim.style.cssText = 'position:absolute;inset:0;background:rgba(15,20,30,.55);pointer-events:none;';
        botPane.appendChild(dim);
        botPane.appendChild(chip(tr('bm_bottom_label', 'Dibuja aquí'), 'left:8px;top:8px'));
        wrap.style.cssText = 'position:relative;border-radius:14px;overflow:hidden;border:1px solid var(--app-border,#E8EAF0);';
        wrap.appendChild(topPane); wrap.appendChild(divider); wrap.appendChild(botPane);
        if (isImg) {
            var natImg = new Image();
            natImg.onload = function () {
                function lay() {
                    var k = botPane.clientWidth / W; if (!k) return;
                    var scale = Math.max(W / natImg.naturalWidth, H / natImg.naturalHeight);
                    var sw = natImg.naturalWidth * scale, sh = natImg.naturalHeight * scale;
                    botPane.style.backgroundImage = 'url("' + opts.bannerImageUrl + '")';
                    botPane.style.backgroundSize = (sw * k) + 'px ' + (sh * k) + 'px';
                    // misma imagen que arriba, desplazada una altura: es lo que de verdad se vera debajo del banner
                    botPane.style.backgroundPosition = (((W - sw) / 2) * k) + 'px ' + ((((H - sh) / 2) - H) * k) + 'px';
                }
                lay(); window.addEventListener('resize', lay);
            };
            natImg.src = opts.bannerImageUrl;
        }
        var canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        canvas.style.cssText = 'position:absolute;inset:0;z-index:2;display:block;width:100%;height:100%;touch-action:none;cursor:crosshair;';
        botPane.appendChild(canvas);
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
        var dot = ov.querySelector('.bm-dot');
        function paintDot() { var d = Math.max(6, Math.min(32, brush * 0.55 + 4)); dot.style.width = d + 'px'; dot.style.height = d + 'px'; }
        paintDot();
        ov.querySelector('.bm-size').addEventListener('input', function (e) { brush = Number(e.target.value) || 22; paintDot(); });
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
