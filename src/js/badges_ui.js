/*
 * SeeYou - insignias (interfaz).
 *   SeeYouBadges.mount(el, { userId, own })  -> pinta la seccion de insignias con su progreso
 *   SeeYouBadges.checkPending(userId)        -> muestra el aviso animado de las insignias recien conseguidas
 * Se comprueban solas al abrir la app, al volver a ella y cada pocos minutos.
 */
(function () {
    'use strict';
    if (window.SeeYouBadges) return;

    function T(key, fallback) {
        try {
            if (typeof CONFIG !== 'undefined' && typeof CONFIG.translate === 'function') return CONFIG.translate(key, fallback) || fallback;
        } catch (e) { }
        return fallback;
    }


    // Los nombres, niveles y descripciones llegan del servidor siempre en español: se traducen aqui con el idioma de la app.
    var TIER_KEYS = ['bdg_tier_bronze', 'bdg_tier_silver', 'bdg_tier_gold', 'bdg_tier_diamond'];
    function locDesc(id, d) {
        var m = String(d || '').match(/\d+/);
        if (!m) return d;
        var n = parseInt(m[0], 10);
        return T('bdg_desc_' + id + (n === 1 ? '_one' : '_many'), d).replace('{{n}}', n);
    }
    function locBadge(b) {
        if (!b || !b.id) return b;
        b.name = T('coin_badge_' + b.id, b.name);
        if (b.tier > 0) b.tierName = T(TIER_KEYS[b.tier - 1], b.tierName);
        if (b.description) b.description = locDesc(b.id, b.description);
        if (b.tiers) b.tiers.forEach(function (t) { t.name = T(TIER_KEYS[t.tier - 1], t.name); t.description = locDesc(b.id, t.description); });
        return b;
    }

    var TIERS = {
        1: { name: 'Bronce', a: '#F0B27A', b: '#B7691F', c: '#7A430E', glyph: '#FFF4E5' },
        2: { name: 'Plata', a: '#F4F7FB', b: '#AEB9C7', c: '#6C7889', glyph: '#FFFFFF' },
        3: { name: 'Oro', a: '#FFE58A', b: '#F2B01E', c: '#B47A00', glyph: '#FFFBEA' },
        4: { name: 'Diamante', a: '#B8F1FF', b: '#4DB3FF', c: '#2A5FD8', glyph: '#FFFFFF' }
    };
    var GLYPHS = {
        camera: 'M9 3 7.2 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
        flame: 'M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z',
        calendar: 'M19 3h-1V1h-2v2H8V1H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H5V9h14v10zM7 11h5v5H7z',
        people: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
        gift: 'M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8h5.08v6z',
        music: 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
        chatdays: 'M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 11a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm4 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm4 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
        chat: 'M2.01 21 23 12 2.01 3 2 10l15 2-15 2z'
    };
    var seq = 0;
    // CONFIG es un const de config.js: no cuelga de window.CONFIG (ver nota en coins_ui.js).
    var API = function () { try { return (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) || ''; } catch (e) { return ''; } };

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function getJson(url) {
        return fetch(API() + url, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    }

    /* ---------- estilos ---------- */
    function injectCss() {
        if (document.getElementById('bdg-css')) return;
        var st = document.createElement('style');
        st.id = 'bdg-css';
        st.textContent =
            '.bdg-root{--bdg-surface:#fff;--bdg-text:#1D1B20;--bdg-muted:#667085;--bdg-border:#E8EAF0;--bdg-track:#E8ECF3;--bdg-accent:#2F6FDD;width:100%;box-sizing:border-box;text-align:left}' +
            'body[data-theme="dark"] .bdg-root,body[data-theme="blue"] .bdg-root{--bdg-surface:#1B2130;--bdg-text:#F2F4F8;--bdg-muted:#A5AEBF;--bdg-border:#2A3346;--bdg-track:#2A3346;--bdg-accent:#7EBCFF}' +
            '.bdg-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 12px}' +
            '.bdg-head h3{margin:0;font-size:17px;font-weight:800;color:var(--bdg-text)}' +
            '.bdg-count{font-size:13px;font-weight:700;color:var(--bdg-muted)}' +
            '.bdg-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}' +
            '@media(min-width:560px){.bdg-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}' +
            '.bdg-card{appearance:none;border:1px solid var(--bdg-border);background:var(--bdg-surface);border-radius:18px;padding:14px 10px 12px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:4px;cursor:pointer;font:inherit;color:var(--bdg-text);transition:transform .15s ease,box-shadow .2s ease;-webkit-tap-highlight-color:transparent;min-width:0}' +
            '.bdg-card:active{transform:scale(.97)}' +
            '.bdg-card svg{width:64px;height:64px;display:block;filter:drop-shadow(0 6px 8px rgba(20,30,50,.18))}' +
            '.bdg-card.is-locked{opacity:.5;filter:grayscale(1)}' +
            '.bdg-card.is-locked svg{filter:none}' +
            '.bdg-name{font-size:13.5px;font-weight:800;line-height:1.2;margin-top:4px;word-break:break-word}' +
            '.bdg-tier{font-size:11.5px;font-weight:700;color:var(--bdg-muted)}' +
            '.bdg-tier.t1{color:#B7691F}.bdg-tier.t2{color:#7C8899}.bdg-tier.t3{color:#B47A00}.bdg-tier.t4{color:#2A78E0}' +
            '.bdg-bar{width:100%;height:6px;border-radius:99px;background:var(--bdg-track);overflow:hidden;margin-top:6px}' +
            '.bdg-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#3B82F6,#7EBCFF);transition:width .6s ease}' +
            '.bdg-card.is-max .bdg-bar i{background:linear-gradient(90deg,#4DB3FF,#2A5FD8)}' +
            '.bdg-num{font-size:11.5px;color:var(--bdg-muted);font-weight:600}' +
            '.bdg-favs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}' +
            '.bdg-favs .bdg-card{padding:12px 6px 10px}' +
            '.bdg-favs .bdg-card svg{width:56px;height:56px}' +
            '.bdg-favs .bdg-name{font-size:12.5px}' +
            '.bdg-card{position:relative}' +
            '.bdg-star{position:absolute;top:6px;right:8px;font-size:15px;line-height:1;color:#F2B01E;pointer-events:none}' +
            '.bdg-more{margin-top:12px;border:1px solid var(--bdg-border);border-radius:16px;background:var(--bdg-surface);overflow:hidden}' +
            '.bdg-more>summary{list-style:none;cursor:pointer;padding:13px 16px;font-weight:800;font-size:14px;color:var(--bdg-accent);display:flex;align-items:center;justify-content:space-between;-webkit-tap-highlight-color:transparent}' +
            '.bdg-more>summary::-webkit-details-marker{display:none}' +
            '.bdg-more>summary:after{content:"";width:9px;height:9px;border-right:2.4px solid currentColor;border-bottom:2.4px solid currentColor;transform:rotate(45deg) translateY(-2px);transition:transform .2s ease}' +
            '.bdg-more[open]>summary:after{transform:rotate(-135deg) translateY(-2px)}' +
            '.bdg-more .bdg-grid{padding:0 12px 12px}' +
            '.bdg-hint{margin:10px 2px 0;font-size:12.5px;color:var(--bdg-muted);text-align:center}' +
            '.bdg-empty{padding:18px;border:1px dashed var(--bdg-border);border-radius:16px;color:var(--bdg-muted);font-size:14px;text-align:center}' +
            '.bdg-invite{margin-top:16px;display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:16px 18px;border-radius:18px;border:0;background:linear-gradient(120deg,#FF7A18 0%,#FF3D77 48%,#7B4DFF 100%);color:#fff;font:inherit;font-weight:800;font-size:16px;letter-spacing:.2px;cursor:pointer;box-shadow:0 14px 26px -12px rgba(255,61,119,.75),inset 0 1px 0 rgba(255,255,255,.35);position:relative;overflow:hidden;-webkit-tap-highlight-color:transparent}' +
            '.bdg-invite svg{width:24px;height:24px;flex:none}' +
            '.bdg-invite small{display:block;font-size:12px;font-weight:600;opacity:.92;margin-top:1px}' +
            '.bdg-invite:after{content:"";position:absolute;top:0;left:-60%;width:40%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.35),transparent);transform:skewX(-20deg);animation:bdgShine 3.6s ease-in-out infinite}' +
            '@keyframes bdgShine{0%,60%{left:-60%}100%{left:130%}}' +
            '.bdg-invite:active{transform:scale(.98)}' +
            '.bdg-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(10,16,30,.62);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:bdgFade .25s ease both}' +
            '.bdg-sheet{width:100%;max-width:380px;max-height:86vh;overflow:auto;border-radius:26px;background:var(--bdg-surface,#fff);color:var(--bdg-text,#1D1B20);padding:26px 22px 20px;text-align:center;box-shadow:0 30px 70px -20px rgba(0,0,0,.55);animation:bdgPop .45s cubic-bezier(.2,.9,.25,1.15) both}' +
            '.bdg-pop-medal{position:relative;width:132px;height:132px;margin:2px auto 6px}' +
            '.bdg-pop-medal svg{width:100%;height:100%;position:relative;z-index:1;animation:bdgMedal .9s cubic-bezier(.2,.9,.25,1.2) both;filter:drop-shadow(0 12px 16px rgba(20,30,50,.3))}' +
            '.bdg-pop-medal:before{content:"";position:absolute;inset:-14px;border-radius:50%;background:radial-gradient(circle,rgba(255,220,120,.55),rgba(255,220,120,0) 68%);animation:bdgGlow 2s ease-in-out infinite}' +
            '.bdg-kicker{font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--bdg-accent,#2F6FDD);margin-top:6px}' +
            '.bdg-title{font-size:23px;font-weight:800;margin:4px 0 2px;line-height:1.15}' +
            '.bdg-sub{font-size:14.5px;color:var(--bdg-muted,#667085);margin:4px 0 0;line-height:1.4}' +
            '.bdg-actions{display:flex;flex-direction:column;gap:9px;margin-top:20px}' +
            '.bdg-btn{border:0;border-radius:999px;padding:13px 18px;font:inherit;font-weight:800;font-size:15px;cursor:pointer;color:#fff;background:linear-gradient(135deg,#1B3A5C,#2F6FDD);box-shadow:0 10px 22px -10px rgba(27,58,92,.7)}' +
            '.bdg-btn.ghost{background:transparent;color:var(--bdg-accent,#2F6FDD);box-shadow:none;border:1.5px solid rgba(47,111,221,.3)}' +
            '.bdg-btn:active{transform:scale(.97)}' +
            '.bdg-levels{display:flex;flex-direction:column;gap:8px;margin-top:16px;text-align:left}' +
            '.bdg-level{display:flex;align-items:center;gap:12px;padding:8px 10px;border-radius:14px;border:1px solid var(--bdg-border,#E8EAF0)}' +
            '.bdg-level svg{width:42px;height:42px;flex:none}' +
            '.bdg-level b{display:block;font-size:14px}.bdg-level span{font-size:12.5px;color:var(--bdg-muted,#667085)}' +
            '.bdg-level.is-locked{opacity:.62}' +
            '.bdg-level .ok{margin-left:auto;color:#16A34A;font-weight:800;font-size:18px}' +
            '@keyframes bdgFade{from{opacity:0}to{opacity:1}}' +
            '@keyframes bdgPop{from{opacity:0;transform:translateY(24px) scale(.92)}to{opacity:1;transform:none}}' +
            '@keyframes bdgMedal{0%{transform:scale(.2) rotate(-30deg);opacity:0}60%{transform:scale(1.12) rotate(6deg);opacity:1}100%{transform:scale(1) rotate(0)}}' +
            '@keyframes bdgGlow{0%,100%{opacity:.55;transform:scale(.96)}50%{opacity:1;transform:scale(1.06)}}' +
            '.bdg-sp-title{margin:0 0 8px;font-size:12.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#B7791F}' +
            '.bdg-sp-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:16px}' +
            '.bdg-sp{appearance:none;font:inherit;color:inherit;cursor:pointer;position:relative;overflow:hidden;border-radius:18px;padding:14px 6px 11px;text-align:center;display:flex;flex-direction:column;align-items:center;background:var(--bdg-surface);border:1px solid rgba(255,196,50,.5);box-shadow:inset 0 0 0 1px rgba(255,196,50,calc(.18 + var(--lv)*.07)),inset 0 0 calc(10px + var(--lv)*5px) rgba(255,190,40,calc(.22 + var(--lv)*.08));animation:bdgAuraPulse 3.4s ease-in-out infinite}' +
            '.bdg-sp:active{transform:scale(.97)}' +
            '.bdg-sp .bdg-spm{position:relative;width:60px;height:60px}.bdg-sp .bdg-spm svg{width:100%;height:100%;display:block;filter:drop-shadow(0 4px 6px rgba(20,30,50,.22))}' +
            '.bdg-sp .bdg-name{font-size:12px;margin-top:6px}.bdg-sp .bdg-tier{color:#B7791F}' +
            '.bdg-spshine{position:absolute;inset:0;overflow:hidden;pointer-events:none;-webkit-mask:var(--shape) center/contain no-repeat;mask:var(--shape) center/contain no-repeat}' +
            '.bdg-spshine:after{content:"";position:absolute;top:-10%;left:-70%;width:40%;height:120%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.5),transparent);transform:skewX(-20deg);animation:bdgSpSweep 4.6s ease-in-out infinite}' +
            '@keyframes bdgSpSweep{0%,60%{left:-70%}100%{left:130%}}' +
            '@keyframes bdgAuraPulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.07)}}' +
            '.bdg-spsheet{position:relative;width:100%;max-width:340px;background:#fff;color:#1D1B20;border-radius:26px;padding:30px 22px 20px;text-align:center;overflow:hidden;box-shadow:inset 0 0 0 1.5px rgba(255,196,50,calc(.4 + var(--lv)*.1)),inset 0 0 calc(16px + var(--lv)*8px) rgba(255,190,40,calc(.30 + var(--lv)*.08)),0 30px 70px -20px rgba(0,0,0,.6);animation:bdgPop .5s cubic-bezier(.2,.9,.25,1.12) both}' +
            '.bdg-spmedal{position:relative;width:132px;height:132px;margin:0 auto}' +
            '.bdg-spmedal .bdg-spbody{position:absolute;inset:0;opacity:0}.bdg-spmedal svg{width:100%;height:100%;display:block;overflow:visible;filter:drop-shadow(0 12px 14px rgba(20,30,50,.3))}' +
            '.bdg-spmedal.built .bdg-spbody{animation:bdgSpReveal .3s linear both}' +
            '@keyframes bdgSpReveal{0%{opacity:0}100%{opacity:1}}.bdg-spmedal.built{animation:bdgSpPop .7s cubic-bezier(.3,1.4,.5,1) both}@keyframes bdgSpPop{0%{transform:scale(.96)}45%{transform:scale(1.07)}100%{transform:scale(1)}}' +
            '.bdg-spring{position:absolute;left:50%;top:50%;width:132px;height:132px;margin:-66px 0 0 -66px;border-radius:50%;border:2.5px solid rgba(255,196,50,.85);opacity:0;pointer-events:none}' +
            '.bdg-spmedal.built .bdg-spring{animation:bdgSpRing 1.3s ease-out forwards}' +
            '@keyframes bdgSpRing{0%{opacity:.9;transform:scale(.8)}100%{opacity:0;transform:scale(2.3)}}' +
            '.bdg-spmedal .bdg-spshine:after{width:26%;animation:bdgSpSweep2 4.5s 1.6s ease-in-out infinite;background:linear-gradient(100deg,transparent,rgba(255,255,255,.45),transparent)}' +
            '@keyframes bdgSpSweep2{0%{left:-70%}40%,100%{left:140%}}' +
            '.bdg-sptxt{opacity:0}.bdg-spsheet.done .bdg-sptxt{animation:bdgSpUp .55s both}.bdg-spsheet.done .t2{animation-delay:.12s}.bdg-spsheet.done .t3{animation-delay:.28s}.bdg-spsheet.done .t4{animation-delay:.42s}.bdg-spsheet.done .t5{animation-delay:.55s}' +
            '@keyframes bdgSpUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}' +
            '.bdg-sptag{display:inline-block;margin-top:20px;font-size:11.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--spc)}' +
            '.bdg-spttl{font-size:25px;font-weight:800;line-height:1.12;margin:6px 0}' +
            '.bdg-spdsc{font-size:14.5px;line-height:1.45;color:#667085;margin:0 auto;max-width:290px}' +
            '.bdg-spby{font-size:12px;color:#98A2B3;margin-top:10px}' +
            '.bdg-spbtn{margin-top:18px;width:100%;border:0;border-radius:999px;padding:13px 18px;font:inherit;font-weight:800;font-size:15px;cursor:pointer;color:#fff;background:linear-gradient(135deg,var(--spa),var(--spb))}' +
            '.bdg-spcanvas{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483600}' +
            '@media(prefers-reduced-motion:reduce){.bdg-sp,.bdg-spsheet,.bdg-spshine:after{animation:none!important}.bdg-sptxt{opacity:1}.bdg-spmedal .bdg-spbody{opacity:1}}' +
            '@media(prefers-reduced-motion:reduce){.bdg-invite:after{animation:none}.bdg-sheet,.bdg-pop-medal svg,.bdg-pop-medal:before,.bdg-overlay{animation:none}}';
        document.head.appendChild(st);
    }

    /* ---------- dibujo de la insignia ---------- */
    function icon(name, tier, size) {
        var id = 'bdg' + (++seq);
        var t = TIERS[tier];
        var glyph = GLYPHS[name] || GLYPHS.camera;
        var locked = !t;
        var stops = locked
            ? ['#E4E8EF', '#C9D0DB', '#AEB7C5']
            : [t.a, t.b, t.c];
        var glyphColor = locked ? '#9AA5B6' : t.glyph;
        var sparkle = tier === 4
            ? '<path d="M50 9l1.6 3.9L55.5 14.5l-3.9 1.6L50 20l-1.6-3.9L44.5 14.5l3.9-1.6z" fill="#fff" opacity=".95"/><path d="M12 44l1.1 2.6 2.6 1.1-2.6 1.1L12 51.4l-1.1-2.6-2.6-1.1 2.6-1.1z" fill="#fff" opacity=".8"/>'
            : '';
        return '<svg viewBox="0 0 64 64" width="' + (size || 64) + '" height="' + (size || 64) + '" role="img" aria-hidden="true">' +
            '<defs><linearGradient id="' + id + 'g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + stops[0] + '"/><stop offset=".55" stop-color="' + stops[1] + '"/><stop offset="1" stop-color="' + stops[2] + '"/></linearGradient>' +
            '<linearGradient id="' + id + 'i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="' + (locked ? '.35' : '.5') + '"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>' +
            '<path d="M32 3 58 17.5v29L32 61 6 46.5v-29z" fill="url(#' + id + 'g)" stroke="' + stops[2] + '" stroke-width="2" stroke-linejoin="round"/>' +
            '<path d="M32 8.5 53 20.2v23.6L32 55.5 11 43.8V20.2z" fill="none" stroke="#fff" stroke-opacity="' + (locked ? '.5' : '.55') + '" stroke-width="1.2" stroke-linejoin="round"/>' +
            '<path d="M32 3 58 17.5 32 32 6 17.5z" fill="url(#' + id + 'i)"/>' +
            (locked ? '' : '<g transform="translate(18.6 19.1) scale(1.17)" fill="#000" opacity=".22" fill-rule="evenodd"><path d="' + glyph + '"/></g>') +
            '<g transform="translate(18 18) scale(1.17)" fill="' + glyphColor + '" fill-rule="evenodd"><path d="' + glyph + '"/></g>' +
            sparkle + '</svg>';
    }


    /* ---------- insignias especiales (las da el equipo) ---------- */
    function sealPath(n, r1, r2) { var p = ''; for (var i = 0; i <= n * 8; i++) { var a = i / (n * 8) * Math.PI * 2 - Math.PI / 2; var r = (r1 + r2) / 2 + (r1 - r2) / 2 * Math.cos(n * (a + Math.PI / 2)); p += (i ? 'L' : 'M') + (32 + r * Math.cos(a)).toFixed(2) + ' ' + (32 + r * Math.sin(a)).toFixed(2); } return p + 'Z'; }
    var SEAL = sealPath(12, 31.5, 28.2);
    function circ(cx, cy, r) { return 'M' + (cx + r) + ' ' + cy + 'a' + r + ' ' + r + ' 0 1 1 ' + (-2 * r) + ' 0a' + r + ' ' + r + ' 0 1 1 ' + (2 * r) + ' 0z'; }
    var RINGS = '<g fill="none" stroke-width="5.4"><circle cx="24.5" cy="32" r="12" stroke="#1DA1F2"/><circle cx="39.5" cy="32" r="12" stroke="#17375E"/><clipPath id="RC"><rect x="0" y="32" width="64" height="32"/></clipPath><circle cx="24.5" cy="32" r="12" stroke="#1DA1F2" clip-path="url(#RC)"/></g>';
    var SPV = {
        collab: { base: '#17375E', top: '#2A5A8F', rgb: '23,55,94', a: '#2A5A8F', b: '#17375E', frame: '#4F86C6', back: '<circle cx="32" cy="32" r="21" fill="#fff"/>', glyph: RINGS,
            parts: [{ d: circ(24.5, 32, 12), col: '#3FB2FF', n: 44, w: 5.4, from: 'l' }, { d: circ(39.5, 32, 12), col: '#17375E', n: 44, w: 5.4, from: 'r' }] },
        creator: { grad: ['#F58529', '#DD2A7B', '#8134AF'], rgb: '194,48,122', a: '#E0508F', b: '#9B2A8F', frame: '#B02E8F',
            glyph: '<rect x="17" y="21" width="30" height="22" rx="5.5" fill="none" stroke="#fff" stroke-width="3.2"/><path d="M29 27.5v9l8-4.5z" fill="#fff"/><path d="M47 14l1.3 3.2 3.2 1.3-3.2 1.3L47 23l-1.3-3.2-3.2-1.3 3.2-1.3z" fill="#fff"/>',
            parts: [{ d: 'M22.5 21h19a5.5 5.5 0 0 1 5.5 5.5v11a5.5 5.5 0 0 1-5.5 5.5h-19A5.5 5.5 0 0 1 17 37.5v-11A5.5 5.5 0 0 1 22.5 21z', col: '#DD2A7B', n: 56, w: 3 }, { d: 'M29 27.5v9l8-4.5z', col: '#F58529', n: 18, w: 3 }, { d: 'M47 14l1.3 3.2 3.2 1.3-3.2 1.3L47 23l-1.3-3.2-3.2-1.3 3.2-1.3z', col: '#F58529', n: 14, w: 2.4 }] },
        bug: { base: '#1E8E4E', top: '#35B26B', rgb: '30,142,78', a: '#35B26B', b: '#1E8E4E', frame: '#2FA45F',
            glyph: '<g fill="#fff"><ellipse cx="32" cy="36" rx="8" ry="11"/><circle cx="32" cy="22.5" r="5"/></g><g stroke="#fff" stroke-width="2.6" stroke-linecap="round" fill="none"><path d="M24.5 31l-8-3.5M24 37h-9M25 43l-7 4.5M39.5 31l8-3.5M40 37h9M39 43l7 4.5M28.5 18.5l-3-4M35.5 18.5l3-4"/></g><path d="M32 28v19" stroke="#1E8E4E" stroke-width="1.8"/>',
            parts: [{ d: 'M32 25a8 11 0 1 1 0 22a8 11 0 1 1 0-22z', col: '#1E8E4E', n: 40, w: 3 }, { d: circ(32, 22.5, 5), col: '#35B26B', n: 20, w: 3 }, { d: 'M24.5 31l-8-3.5M24 37h-9M25 43l-7 4.5M39.5 31l8-3.5M40 37h9M39 43l7 4.5M28.5 18.5l-3-4M35.5 18.5l3-4', col: '#35B26B', n: 50, w: 2.6 }] },
        founder: { base: '#B8860B', top: '#E5B53A', rgb: '184,134,11', a: '#E5B53A', b: '#B8860B', frame: '#D4A017',
            glyph: '<path d="M17 43l-2-17 9 7 8-12 8 12 9-7-2 17z" fill="#fff"/><rect x="17" y="45" width="30" height="4" rx="1.5" fill="#fff"/>',
            parts: [{ d: 'M17 43l-2-17 9 7 8-12 8 12 9-7-2 17z', col: '#E5B53A', n: 70, w: 3.2 }, { d: 'M17 45h30v4H17z', col: '#B8860B', n: 30, w: 3 }] },
        tester: { base: '#2F6FDD', top: '#4F8EF0', rgb: '47,111,221', a: '#4F8EF0', b: '#2F6FDD', frame: '#3F7FE8',
            glyph: '<rect x="21" y="14" width="22" height="36" rx="5" fill="none" stroke="#fff" stroke-width="3.2"/><path d="M26.5 32.5l4.2 4.2 7-8" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M29 45.5h6" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>',
            parts: [{ d: 'M26 14h12a5 5 0 0 1 5 5v26a5 5 0 0 1-5 5H26a5 5 0 0 1-5-5V19a5 5 0 0 1 5-5z', col: '#2F6FDD', n: 64, w: 3 }, { d: 'M26.5 32.5l4.2 4.2 7-8', col: '#4F8EF0', n: 16, w: 3.2 }, { d: 'M29 45.5h6', col: '#4F8EF0', n: 8, w: 2.6 }] }
    };
    function spMask() { return "url('data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="' + SEAL + '"/></svg>') + "')"; }
    function spMedal(id, size, mode) {
        var v = SPV[id]; if (!v) return '';
        var gid = 'sp' + (++seq);
        var stops = v.grad ? '<stop offset="0" stop-color="' + v.grad[0] + '"/><stop offset=".5" stop-color="' + v.grad[1] + '"/><stop offset="1" stop-color="' + v.grad[2] + '"/>' : '<stop offset="0" stop-color="' + v.top + '"/><stop offset="1" stop-color="' + v.base + '"/>';
        var gl = '<g>' + v.glyph.replace('id="RC"', 'id="RC' + gid + '"').replace('url(#RC)', 'url(#RC' + gid + ')') + '</g>';
        var base = '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1">' + stops + '</linearGradient></defs>' +
            '<path d="' + SEAL + '" fill="url(#' + gid + ')"/><circle cx="32" cy="32" r="24.5" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="1.1"/>' + (v.back || '');
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="' + size + '" height="' + size + '" aria-hidden="true">' +
            (mode === 'glyph' ? gl : mode === 'base' ? base : base + gl) + '</svg>';
    }
    function svgImg(svg, cb) { var im = new Image(); im.onload = function () { cb(im); }; im.onerror = function () { cb(null); }; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
    function spText(sp) {
        return { name: T('bdg_sp_' + sp.id, sp.name), desc: T('bdg_sp_' + sp.id + '_d', sp.description || sp.desc || ''), rarity: T('bdg_rar_' + sp.lvl, sp.rarity || '') };
    }
    function spCard(sp, i) {
        var tx = spText(sp), v = SPV[sp.id]; if (!v) return '';
        return '<button type="button" class="bdg-sp" data-sp="' + i + '" style="--lv:' + (sp.lvl || 1) + '" aria-label="' + esc(tx.name) + '"><div class="bdg-spm" style="--shape:' + spMask() + '">' + spMedal(sp.id, 60) + '<div class="bdg-spshine"></div></div><div class="bdg-name">' + esc(tx.name) + '</div><span class="bdg-tier">' + esc(tx.rarity) + '</span></button>';
    }

    var spBusy = false;
    function samplePath(d, n) { var p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); var L = p.getTotalLength(), out = []; for (var i = 0; i < n; i++) { var q = p.getPointAtLength(L * i / n); out.push([q.x, q.y]); } return out; }
    function starShape(c, x, y, s) { c.beginPath(); c.moveTo(x, y - s); c.quadraticCurveTo(x, y, x + s, y); c.quadraticCurveTo(x, y, x, y + s); c.quadraticCurveTo(x, y, x - s, y); c.quadraticCurveTo(x, y, x, y - s); c.fill(); }
    // Aviso de insignia especial: hilos que llegan de todos lados y tejen la insignia; al final aparece con su aura dorada.
    function playSpecial(sp, onClose) {
        var v = SPV[sp.id];
        if (!v || spBusy) { if (onClose) onClose(); return; }
        spBusy = true; injectCss();
        var tx = spText(sp), reduce = false;
        try { reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { }
        var o = document.createElement('div');
        o.className = 'bdg-overlay bdg-root';
        o.innerHTML = '<div class="bdg-spsheet" style="--lv:' + (sp.lvl || 1) + ';--spc:rgb(' + v.rgb + ');--spa:' + v.a + ';--spb:' + v.b + '" role="dialog" aria-modal="true">' +
            '<div class="bdg-spmedal" style="--shape:' + spMask() + '"><div class="bdg-spring"></div><div class="bdg-spbody">' + spMedal(sp.id, 132) + '<div class="bdg-spshine"></div></div></div>' +
            '<div class="bdg-sptxt t1 bdg-sptag">' + esc(T('bdg_special_kicker', 'Insignia especial')) + ' · ' + esc(tx.rarity) + '</div>' +
            '<div class="bdg-sptxt t2 bdg-spttl">' + esc(tx.name) + '</div><p class="bdg-sptxt t3 bdg-spdsc">' + esc(tx.desc) + '</p>' +
            '<div class="bdg-sptxt t4 bdg-spby">' + esc(T('bdg_special_by', 'Concedida por el equipo de SeeYou')) + '</div>' +
            '<button type="button" class="bdg-sptxt t5 bdg-spbtn">' + esc(T('bdg_great', 'Genial')) + '</button></div>';
        document.body.appendChild(o);
        var sheet = o.firstChild, med = sheet.querySelector('.bdg-spmedal');
        var cv = document.createElement('canvas'); cv.className = 'bdg-spcanvas'; document.body.appendChild(cv);
        var ctx = cv.getContext('2d'), raf = 0, closed = false;
        function end() { if (closed) return; closed = true; cancelAnimationFrame(raf); close(o); close(cv); spBusy = false; if (onClose) onClose(); }
        o.addEventListener('click', function (e) { if (e.target === o || e.target.closest('.bdg-spbtn')) end(); });
        if (reduce) { med.classList.add('built'); sheet.classList.add('done'); close(cv); return; }
        var K = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
        cv.width = W * K; cv.height = H * K; ctx.setTransform(K, 0, 0, K, 0, 0);
        var START = 520, threads = [], gStart = START, frameStart = START;
        var groups = v.parts.map(function (p) { return { pts: samplePath(p.d, p.n), col: p.col, w: p.w, from: p.from, spread: 620 }; });
        groups.push({ pts: samplePath(SEAL, 170).concat(samplePath(circ(32, 32, 24.5), 70)), col: v.frame, w: 2.2, spread: 1250, frame: true });
        groups.forEach(function (g) {
            var st = gStart; if (g.frame) frameStart = st;
            g.pts.forEach(function (pt, k) {
                var ang, R = Math.hypot(W, H) * 0.5;
                if (g.from === 'l') ang = Math.PI + (Math.random() - 0.5) * 2.4; else if (g.from === 'r') ang = (Math.random() - 0.5) * 2.4; else ang = Math.random() * Math.PI * 2;
                var fly = 560 + Math.random() * 700;
                var r1 = Math.random(), launch = g.frame ? Math.pow(r1, 0.8) : r1;
                threads.push({ g: g, k: k, tx: pt[0], ty: pt[1], ang: ang, R: R * (0.8 + Math.random() * 0.4), fly: fly, t0: st + launch * g.spread, cp: (Math.random() - 0.5) * 1.8, cq: (Math.random() - 0.5) * 1.4, sw: (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.6), landed: false });
            });
            gStart += g.frame ? 0 : 300;
        });
        var lastLaunch = 0; threads.forEach(function (t) { lastLaunch = Math.max(lastLaunch, t.t0 + t.fly); });
        var END = lastLaunch;
        // La imagen final se construye con las mismas capas que la insignia real (sello y dibujo), reveladas segun aterrizan los hilos.
        var imgBase = null, imgGlyph = null, SZ = 300;
        function mkCanvas() { var c2 = document.createElement('canvas'); c2.width = SZ * K; c2.height = SZ * K; return c2; }
        var mk = mkCanvas(), bm = mkCanvas(), bm2 = mkCanvas(), tmp = mkCanvas();
        var mx = mk.getContext('2d'), bx = bm.getContext('2d'), bx2 = bm2.getContext('2d'), tx2 = tmp.getContext('2d');
        mx.setTransform(K, 0, 0, K, 0, 0); bx.setTransform(K, 0, 0, K, 0, 0);
        var frameTotal = 0, frameLanded = 0; threads.forEach(function (t) { if (t.g.frame) frameTotal++; });
        var t0 = 0, revealed = false, spark = [];
        function bez(p, a, b, c, d) { var u = 1 - p; return u * u * u * a + 3 * u * u * p * b + 3 * u * p * p * c + p * p * p * d; }
        function center() { var q = med.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2, s: q.width }; }
        function blob(cx, x, y, r, a0) { var g = cx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(0,0,0,' + a0 + ')'); g.addColorStop(0.55, 'rgba(0,0,0,' + a0 + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r, 0, 6.2832); cx.fill(); }
        function masked(img, m, S) {
            var L = 64 * S;
            tx2.setTransform(1, 0, 0, 1, 0, 0); tx2.globalCompositeOperation = 'source-over'; tx2.clearRect(0, 0, tmp.width, tmp.height);
            tx2.setTransform(K, 0, 0, K, 0, 0); tx2.drawImage(img, SZ / 2 - 32 * S, SZ / 2 - 32 * S, L, L);
            tx2.setTransform(1, 0, 0, 1, 0, 0); tx2.globalCompositeOperation = 'destination-in'; tx2.drawImage(m, 0, 0); tx2.globalCompositeOperation = 'source-over';
        }
        function drawBuilt(c, S, tt) {
            var x = c.x - 32 * S, y = c.y - 32 * S, L = 64 * S, ga = ctx.globalAlpha;
            var frac = frameTotal ? frameLanded / frameTotal : 0;
            var fr = Math.max(0, Math.min(1, (tt - frameStart) / Math.max(1, END - frameStart)));
            var full = Math.max(0, (fr - 0.45) / 0.55);
            if (frac > 0) {
                // el sello se llena a manchas donde aterrizan los hilos y crece desde dentro, sin barrido
                bx2.setTransform(1, 0, 0, 1, 0, 0); bx2.clearRect(0, 0, bm2.width, bm2.height); bx2.drawImage(bm, 0, 0); bx2.setTransform(K, 0, 0, K, 0, 0);
                blob(bx2, SZ / 2, SZ / 2, 52 * S * Math.pow(frac, 1.15) + 1, 1);
                masked(imgBase, bm2, S); ctx.globalAlpha = ga; ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, c.x - SZ / 2, c.y - SZ / 2, SZ, SZ);
            }
            masked(imgGlyph, mk, S); ctx.globalAlpha = ga; ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, c.x - SZ / 2, c.y - SZ / 2, SZ, SZ);
            if (full > 0) { ctx.globalAlpha = ga * full; ctx.drawImage(imgGlyph, x, y, L, L); ctx.globalAlpha = ga; }
        }
        function frame(now) {
            if (closed) return;
            if (!t0) t0 = now;
            var tt = now - t0; ctx.clearRect(0, 0, W, H);
            var c = center(), S = c.s / 64 || 2, ox = c.x - 32 * S, oy = c.y - 32 * S;
            ctx.globalAlpha = revealed ? Math.max(0, Math.min(1, 1 - (tt - (END + 220)) / 80)) : 1;
            drawBuilt(c, S, tt); ctx.globalAlpha = 1;
            threads.forEach(function (t) {
                var p = (tt - t.t0) / t.fly; if (p <= 0 || t.done) return;
                var ea = 1 - Math.pow(1 - Math.min(1, p), 2.2), an = t.ang + t.sw * (1 - ea), sx = c.x + Math.cos(an) * t.R, sy = c.y + Math.sin(an) * t.R, ex = ox + t.tx * S, ey = oy + t.ty * S;
                var dx = ex - sx, dy = ey - sy, nx = -dy, ny = dx, nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
                var x1 = sx + dx * 0.3 + nx * t.cp * 300, y1 = sy + dy * 0.3 + ny * t.cp * 300, x2 = sx + dx * 0.7 + nx * t.cq * 180, y2 = sy + dy * 0.7 + ny * t.cq * 180;
                var e = function (q) { return 1 - Math.pow(1 - q, 2.2); };
                var head = Math.min(1, e(Math.min(1, p))), tail = Math.max(0, e(Math.max(0, p - 0.2)));
                if (p >= 1) tail = Math.min(1, e(Math.min(1, (p - 1) * 4 + 0.75)));
                if (!t.landed && head >= 1) {
                    t.landed = true;
                    if (t.g.frame) { frameLanded++; bx.fillStyle = '#000'; blob(bx, SZ / 2 + (t.tx - 32) * S, SZ / 2 + (t.ty - 32) * S, (7 + Math.random() * 5) * S, 1); }
                    else {
                        var q = t.g.pts[(t.k + 1) % t.g.pts.length];
                        mx.lineCap = 'round'; mx.lineJoin = 'round'; mx.strokeStyle = '#000'; mx.lineWidth = Math.max(t.g.w * 1.6, 5.5) * S * 0.5;
                        mx.beginPath(); mx.moveTo(SZ / 2 + (t.tx - 32) * S, SZ / 2 + (t.ty - 32) * S); mx.lineTo(SZ / 2 + (q[0] - 32) * S, SZ / 2 + (q[1] - 32) * S); mx.stroke();
                    }
                }
                if (tail >= 1) { t.done = true; return; }
                ctx.lineCap = 'round'; ctx.strokeStyle = t.g.col;
                var N = 14, prev = null;
                for (var i = 0; i <= N; i++) {
                    var u = tail + (head - tail) * i / N, px = bez(u, sx, x1, x2, ex), py = bez(u, sy, y1, y2, ey);
                    if (prev) { ctx.globalAlpha = 0.15 + 0.85 * (i / N); ctx.lineWidth = 0.8 + 1.1 * (i / N); ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(px, py); ctx.stroke(); }
                    prev = [px, py];
                }
                ctx.globalAlpha = 1;
            });
            if (!revealed && tt > END - 120) {
                revealed = true; med.classList.add('built');
                for (var n = 0; n < 22; n++) { var a = Math.random() * 6.283, d = 40 + Math.random() * 50; spark.push({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, vx: Math.cos(a) * 0.5, vy: Math.sin(a) * 0.5 - 0.25, s: 3 + Math.random() * 5, age: 0, max: 55 + Math.random() * 35, delay: Math.random() * 20 }); }
                setTimeout(function () { sheet.classList.add('done'); }, 420);
            }
            if (revealed && Math.random() < 0.08) spark.push({ x: c.x + (Math.random() - 0.5) * 190, y: c.y + (Math.random() - 0.5) * 190, vx: 0, vy: -0.4, s: 2 + Math.random() * 4, age: 0, max: 60, delay: 0 });
            spark = spark.filter(function (p) {
                if (p.delay-- > 0) return true; p.age++; p.x += p.vx; p.y += p.vy;
                var l = Math.sin(Math.min(1, p.age / p.max) * Math.PI); ctx.globalAlpha = Math.max(0, l); ctx.fillStyle = '#FFC83C'; starShape(ctx, p.x, p.y, p.s * (0.6 + l * 0.6)); ctx.globalAlpha = 1;
                return p.age < p.max;
            });
            raf = requestAnimationFrame(frame);
        }
        var pend = 2, fail = false;
        function ready() { if (--pend) return; if (fail || closed) { med.classList.add('built'); sheet.classList.add('done'); close(cv); return; } raf = requestAnimationFrame(frame); }
        svgImg(spMedal(sp.id, 64, 'base'), function (im) { imgBase = im; if (!im) fail = true; ready(); });
        svgImg(spMedal(sp.id, 64, 'glyph'), function (im) { imgGlyph = im; if (!im) fail = true; ready(); });
    }
    function replaySpecial(id) {
        var me = ''; try { me = localStorage.getItem('current_user_id') || ''; } catch (e) { }
        if (!me) return;
        getJson('/api/badges/' + encodeURIComponent(me)).then(function (d) {
            var sp = d && (d.specials || []).filter(function (x) { return x.id === id; })[0];
            if (sp) playSpecial(sp);
        });
    }

    /* ---------- seccion de insignias ---------- */
    function progressPct(b) {
        if (b.maxed) return 100;
        var span = b.nextTarget - b.prevTarget;
        if (span <= 0) return 0;
        return Math.max(2, Math.min(100, Math.round(((b.value - b.prevTarget) / span) * 100)));
    }
    function card(b, i, isFav) {
        var tierLabel = b.tier > 0 ? '<span class="bdg-tier t' + b.tier + '">' + esc(b.tierName) + '</span>' : '<span class="bdg-tier">' + esc(T('bdg_not_achieved', 'Sin conseguir')) + '</span>';
        var num = b.maxed ? T('bdg_max_level', 'Nivel máximo') : (b.value + ' / ' + b.nextTarget);
        return '<button type="button" class="bdg-card' + (b.tier === 0 ? ' is-locked' : '') + (b.maxed ? ' is-max' : '') + '" data-i="' + i + '" aria-label="' + esc(b.name) + '. ' + esc(b.description) + '">' +
            (isFav ? '<span class="bdg-star" aria-hidden="true">\u2605</span>' : '') +
            icon(b.icon, b.tier, 64) +
            '<div class="bdg-name">' + esc(b.name) + '</div>' + tierLabel +
            '<div class="bdg-bar"><i style="width:' + progressPct(b) + '%"></i></div><div class="bdg-num">' + esc(num) + '</div></button>';
    }
    function close(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }
    function overlay(html, onClose) {
        var o = document.createElement('div');
        o.className = 'bdg-overlay bdg-root';
        o.innerHTML = '<div class="bdg-sheet" role="dialog" aria-modal="true">' + html + '</div>';
        o.addEventListener('click', function (e) { if (e.target === o) { close(o); if (onClose) onClose(); } });
        document.body.appendChild(o);
        return o;
    }
    function detail(b, own, fav) {
        var levels = b.tiers.map(function (t) {
            return '<div class="bdg-level' + (t.unlocked ? '' : ' is-locked') + '">' + icon(b.icon, t.unlocked ? t.tier : 0, 42) +
                '<div><b>' + esc(t.name) + '</b><span>' + esc(t.description) + (t.coins ? ' · ' + T('bdg_plus_coins', '+{{n}} monedas').replace('{{n}}', t.coins) : '') + '</span></div>' + (t.unlocked ? '<em class="ok">✓</em>' : '') + '</div>';
        }).join('');
        var o = overlay(
            '<div class="bdg-pop-medal" style="width:104px;height:104px">' + icon(b.icon, b.tier, 104) + '</div>' +
            '<div class="bdg-title">' + esc(b.name) + '</div>' +
            '<p class="bdg-sub">' + (b.maxed ? esc(T('bdg_max_level_reached', '¡Nivel máximo conseguido!')) : esc(b.description) + ' · ' + esc(T('bdg_you_have_n', 'llevas {{n}}.').replace('{{n}}', b.value))) + '</p>' +
            '<div class="bdg-levels">' + levels + '</div>' +
            '<div class="bdg-actions">' + (own && fav ? '<button type="button" class="bdg-btn" data-act="fav">' + (fav.is ? '\u2605 ' + esc(T('bdg_remove_fav', 'Quitar de mis favoritas')) : '\u2606 ' + esc(T('bdg_add_fav', 'Poner en mis favoritas'))) + '</button>' : '') + (own && b.id === 'invites' ? '<button type="button" class="bdg-btn" data-act="invite">' + esc(T('bdg_invite_friends_short', 'Invitar amigos')) + '</button>' : '') + '<button type="button" class="bdg-btn ghost" data-act="close">' + esc(T('tic_close', 'Cerrar')) + '</button></div>');
        o.addEventListener('click', function (e) {
            var act = e.target.closest('[data-act]');
            if (!act) return;
            if (act.dataset.act === 'close') close(o);
            if (act.dataset.act === 'invite') invite();
            if (act.dataset.act === 'fav' && fav) { close(o); fav.toggle(); }
        });
    }
    function invite() {
        var id = '';
        try { id = localStorage.getItem('current_user_id') || ''; } catch (e) { }
        if (window.SeeYouCoins && id) { SeeYouCoins.openSheet(id, 'invite'); return; }
        toast(T('bdg_open_profile_to_invite', 'Abre tu perfil para invitar amigos'));
    }
    function toast(msg) {
        var t = document.createElement('div');
        t.textContent = msg;
        t.style.cssText = 'position:fixed;left:50%;bottom:calc(90px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:rgba(20,26,40,.92);color:#fff;padding:11px 18px;border-radius:999px;font:600 14px system-ui,sans-serif;z-index:2147483001;max-width:88vw;text-align:center';
        document.body.appendChild(t);
        setTimeout(function () { close(t); }, 2200);
    }

    function mount(el, opts) {
        if (!el || !opts || !opts.userId) return Promise.resolve();
        injectCss();
        el.classList.add('bdg-root');
        if (!el.dataset.bdgReady) el.innerHTML = '<div class="bdg-head"><h3>' + esc(T('bdg_title', 'Insignias')) + '</h3></div><div class="bdg-empty">' + esc(T('tic_loading', 'Cargando…')) + '</div>';
        return getJson('/api/badges/' + encodeURIComponent(opts.userId)).then(function (data) {
            if (!data || !data.badges) { el.innerHTML = ''; el.hidden = true; return; }
            el.hidden = false;
            el.dataset.bdgReady = '1';
            data.badges.forEach(locBadge);
            var byId = {};
            data.badges.forEach(function (b) { byId[b.id] = b; });
            var favIds = (data.favorites || []).filter(function (id) { return byId[id]; }).slice(0, 3);
            var favList = favIds.map(function (id) { return byId[id]; });
            var rest = data.badges.filter(function (b) { return favIds.indexOf(b.id) < 0; })
                .sort(function (a, b) { return (b.tier > 0) - (a.tier > 0) || b.tier - a.tier; });
            var all = favList.concat(rest);
            var specials = (data.specials || []).filter(function (x) { return SPV[x.id]; });
            var spHtml = specials.length ? '<div class="bdg-sp-title">' + esc(T('bdg_special_title', 'Insignias especiales')) + '</div><div class="bdg-sp-grid">' + specials.map(spCard).join('') + '</div>' : '';
            el.innerHTML = spHtml + '<div class="bdg-head"><h3>' + esc(T('bdg_title', 'Insignias')) + '</h3><span class="bdg-count">' + esc(T('bdg_levels_count', '{{cur}} / {{max}} niveles').replace('{{cur}}', data.totalTiers).replace('{{max}}', data.maxTiers)) + '</span></div>' +
                '<div class="bdg-favs">' + favList.map(function (b, i) { return card(b, i, true); }).join('') + '</div>' +
                (rest.length ? '<details class="bdg-more"' + (el.dataset.bdgOpen === '1' ? ' open' : '') + '><summary>' + esc(T('bdg_see_other_badges', 'Ver las otras {{n}} insignias').replace('{{n}}', rest.length)) + '</summary><div class="bdg-grid">' +
                    rest.map(function (b, i) { return card(b, favList.length + i, false); }).join('') + '</div></details>' : '') +
                (opts.own ? '<button type="button" class="bdg-invite" data-act="invite"><svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M15 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg><span style="text-align:left">' + esc(T('bdg_invite_friends_title', 'Invitar amigos a SeeYou')) + '<small>' + esc(T('bdg_invite_friends_sub', 'Gana monedas por cada amigo que se una')) + '</small></span></button>' : '');
            var more = el.querySelector('.bdg-more');
            if (more) more.addEventListener('toggle', function () { el.dataset.bdgOpen = more.open ? '1' : '0'; });

            function saveFavs(ids, doneMsg) {
                var uid = opts.userId;
                fetch(API() + '/api/badges/' + encodeURIComponent(uid) + '/favorites', {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ favorites: ids })
                }).then(function (r) { if (!r.ok) throw new Error('http'); if (doneMsg) toast(doneMsg); mount(el, opts); })
                    .catch(function () { toast(T('bdg_favs_save_failed', 'No se pudieron guardar tus favoritas')); });
            }
            function favControl(b) {
                var is = favIds.indexOf(b.id) >= 0;
                return {
                    is: is,
                    toggle: function () {
                        var next = favIds.slice();
                        if (is) { next = next.filter(function (id) { return id !== b.id; }); saveFavs(next, T('bdg_fav_removed', 'Quitada de tus favoritas')); return; }
                        var replaced = '';
                        if (next.length >= 3) { var out = next.shift(); replaced = byId[out] ? byId[out].name : ''; }
                        next.push(b.id);
                        saveFavs(next, replaced ? T('bdg_fav_replaces', 'Sustituye a {{name}}').replace('{{name}}', replaced) : T('bdg_fav_added', 'Añadida a tus favoritas'));
                    }
                };
            }
            el.onclick = function (e) {
                var spc = e.target.closest('.bdg-sp');
                if (spc) { playSpecial(specials[Number(spc.dataset.sp)]); return; }
                var c = e.target.closest('.bdg-card');
                if (c) { var b = all[Number(c.dataset.i)]; detail(b, opts.own, opts.own ? favControl(b) : null); return; }
                if (e.target.closest('[data-act="invite"]')) invite();
            };
        });
    }

    /* ---------- aviso al conseguir una insignia ---------- */
    var showing = false;
    function markSeenNow(userId, lastAt) {
        try {
            fetch(API() + '/api/badges/' + encodeURIComponent(userId) + '/seen', {
                method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ upTo: lastAt || new Date().toISOString() })
            }).catch(function () { });
        } catch (e) { }
    }
    function shownKey(userId) { return 'seeYou_badges_shown_' + userId; }
    function itemSig(p) { return p.kind === 'backfill' ? 'backfill' : (p.kind === 'special' ? 'sp:' + p.id + ':' + (p.at || '') : p.id + ':' + p.tier); }
    function showNext(queue, userId, lastAt) {
        if (!queue.length) { showing = false; return; }
        var item = queue.shift();
        if (item.kind === 'special') { playSpecial(item, function () { showNext(queue, userId, lastAt); }); return; }
        var onProfile = /section=perfil/.test(location.search) || location.pathname.indexOf('profile.html') >= 0;
        var body;
        if (item.kind === 'backfill') {
            body = '<div class="bdg-kicker">' + esc(T('bdg_welcome_title', '¡Bienvenido a las insignias!')) + '</div><div class="bdg-title">' + esc(T(item.count === 1 ? 'bdg_you_have_badges_one' : 'bdg_you_have_badges_many', 'Ya tienes {{n}} insignias').replace('{{n}}', item.count)) + '</div>' +
                '<p class="bdg-sub">' + esc(T('bdg_backfill_sub', 'Las hemos conseguido con lo que ya has hecho en SeeYou: Tics, amigos, racha y más.')) + (item.coins ? ' ' + T('bdg_backfill_coins', 'Te llevas <b>{{n}} monedas</b>.').replace('{{n}}', item.coins) : '') + '</p>';
        } else {
            body = '<div class="bdg-pop-medal">' + icon(item.icon, item.tier, 132) + '</div>' +
                '<div class="bdg-kicker">' + esc(T('bdg_new_badge_title', '¡Nueva insignia!')) + '</div><div class="bdg-title">' + esc(item.name) + ' · ' + esc(item.tierName) + '</div><p class="bdg-sub">' + esc(item.description) + '</p>' +
                (item.coins ? '<p class="bdg-sub" style="margin-top:10px;display:flex;align-items:center;justify-content:center;gap:6px;font-weight:800;color:#B7791F">' + (window.SeeYouCoins ? SeeYouCoins.coinSvg(22) : '') + esc(T('bdg_plus_coins', '+{{n}} monedas').replace('{{n}}', item.coins)) + '</p>' : '');
        }
        var o = overlay(body + '<div class="bdg-actions"><button type="button" class="bdg-btn" data-act="ok">' + esc(queue.length ? T('next', 'Siguiente') : T('bdg_great', 'Genial')) + '</button>' +
            (!onProfile && !queue.length ? '<button type="button" class="bdg-btn ghost" data-act="see">' + esc(T('bdg_see_my_badges', 'Ver mis insignias')) + '</button>' : '') + '</div>');
        o.addEventListener('click', function (e) {
            var act = e.target.closest('[data-act]');
            if (!act && e.target !== o) return;
            close(o);
            var see = act && act.dataset.act === 'see';
            showNext(queue, userId, lastAt);
            if (see) location.href = 'home.html?section=perfil';
        });
    }
    function checkPending(userId) {
        if (showing || !userId) return Promise.resolve();
        return getJson('/api/badges/' + encodeURIComponent(userId) + '/pending').then(function (data) {
            if (!data || !data.pending || !data.pending.length || showing) return;
            // Lo ya mostrado en este dispositivo no vuelve a salir aunque el servidor tarde en registrar el 'visto'.
            var shown = [];
            try { shown = JSON.parse(localStorage.getItem(shownKey(userId)) || '[]'); } catch (e) { }
            var fresh = data.pending.filter(function (p) { return shown.indexOf(itemSig(p)) < 0; });
            if (!fresh.length) { markSeenNow(userId, ''); return; }
            injectCss();
            showing = true;
            // Se marca como visto en cuanto se enseña (antes solo al cerrar el ultimo aviso: si salias de la pantalla, volvian todos).
            try { localStorage.setItem(shownKey(userId), JSON.stringify(shown.concat(fresh.map(itemSig)).slice(-200))); } catch (e) { }
            data.pending = fresh;
            data.pending.forEach(function (p) { if (p.kind !== 'backfill' && p.kind !== 'special') locBadge(p); });
            var lastAt = data.pending.reduce(function (m, p) { return p.at && p.at > m ? p.at : m; }, '');
            markSeenNow(userId, lastAt);
            showNext(data.pending.slice(), userId, lastAt);
        });
    }

    window.SeeYouBadges = { mount: mount, checkPending: checkPending, icon: icon, replaySpecial: replaySpecial };

    /* ---------- comprobacion automatica ---------- */
    var me = '';
    try { me = localStorage.getItem('current_user_id') || ''; } catch (e) { }
    if (me) {
        // Al momento: el servidor avisa por tiempo real cuando el equipo da una insignia especial.
        (function hookRealtime(tries) {
            if (window.SeeYouRT && SeeYouRT.on) { SeeYouRT.on('badge:special', function () { lastCheck = 0; (function go(n) { if (!showing && !spBusy) { checkPending(me); return; } if (n < 60) setTimeout(function () { go(n + 1); }, 1000); })(0); }); return; }
            if (tries < 40) setTimeout(function () { hookRealtime(tries + 1); }, 500);
        })(0);
        // Al pulsar la notificacion del sistema se repite la animacion (aunque ya se hubiera visto).
        try {
            var qs = new URLSearchParams(location.search), spId = qs.get('special');
            if (spId) {
                qs.delete('special');
                try { history.replaceState(null, '', location.pathname + (qs.toString() ? '?' + qs.toString() : '') + location.hash); } catch (e) { }
                setTimeout(function () { replaySpecial(spId); }, 1200);
            }
        } catch (e) { }
        var lastCheck = 0;
        var run = function () { if (Date.now() - lastCheck < 45000) return; lastCheck = Date.now(); checkPending(me); };
        setTimeout(run, 4000);
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') setTimeout(run, 1500); });
        setInterval(run, 5 * 60 * 1000);
    }
})();
