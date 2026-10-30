/* SeeYou · Visor de Tics a pantalla completa (estilo Reels/TikTok)
 * Reutiliza SocialUI.ticCardHTML para generar cada "página" y la delegación de
 * eventos global que ya existe en tics_ui.js (like, comentarios, menú de 3 puntos
 * funcionan automáticamente sobre cualquier .tic-card insertada en el DOM). */
(function () {
    'use strict';
    var SocialUI = null;
    function ready(cb) { SocialUI ? cb() : setTimeout(function () { SocialUI = window.SocialUI; ready(cb); }, 30); }
    document.addEventListener('DOMContentLoaded', function () { SocialUI = window.SocialUI; });
    SocialUI = window.SocialUI || null;

    var overlay = null, scrollEl = null, io = null, currentList = [], loadMoreFn = null, loadingMore = false, onCloseFn = null;

    function esc(v) { return SocialUI.esc(v); }

    // En el visor a pantalla completa la foto se ve mucho mas grande que en el feed (ocupa toda la
    // pantalla), asi que usamos la variante de maxima resolucion (originalImageUrl) en vez del
    // thumbnail reducido del feed, para que no se vea borrosa al estirarse/recortarse.
    function hiResPub(pub) {
        var hiUrl = pub.originalImageUrl;
        if (!hiUrl || hiUrl === pub.imgUrl) return pub;
        var clone = Object.assign({}, pub);
        clone.imgUrl = hiUrl;
        clone.imgAlt = [pub.imgUrl].filter(Boolean);
        return clone;
    }

    function buildSlide(pub) {
        var section = document.createElement('section');
        section.className = 'tv-slide';
        section.dataset.pubId = pub.id;
        section.innerHTML = SocialUI.ticCardHTML(hiResPub(pub), { feed: true });
        SocialUI.hydrate(section);
        SocialUI.scanImages(section);
        var media = section.querySelector('.tic-media');
        if (media && pub.videoUrl) setupVideo(section, media, pub);
        setupCaptionToggle(section);
        setupMusic(section, pub);
        return section;
    }

    function setupVideo(section, media, pub) {
        var playIcon = media.querySelector('.tic-play');
        var video = document.createElement('video');
        video.className = 'tv-video';
        // Si la ruta es relativa (/uploads/video/...), en la app nativa hay que anteponerle el servidor, igual que a las fotos.
        var vsrc = String(pub.videoUrl || '');
        if (vsrc && !/^(https?:|blob:|data:)/i.test(vsrc)) {
            var vbase = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) || '';
            vsrc = vbase.replace(/\/$/, '') + '/' + vsrc.replace(/^\/?/, '');
        }
        video.src = vsrc;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.preload = 'metadata';
        media.appendChild(video);
        section._tvVideo = video;
        // Si el vídeo no carga o no arranca, se avisa en pantalla con el motivo (antes quedaba la foto quieta sin explicación).
        function tr(k, d) { try { return (typeof CONFIG !== 'undefined' && CONFIG.translate) ? CONFIG.translate(k, d) : d; } catch (e) { return d; } }
        function showVideoProblem(why) {
            try { console.warn('[SeeYou] Vídeo del Tic no se reproduce:', why, pub.videoUrl); } catch (e) { }
            var badge = media.querySelector('.tv-vid-err');
            if (!badge) { badge = document.createElement('div'); badge.className = 'tv-vid-err'; media.appendChild(badge); }
            badge.textContent = tr('tv_video_na', 'Vídeo no disponible ({{why}})').replace('{{why}}', why);
            // Diagnostico: se pregunta al servidor por el archivo para saber si falta (404), esta bloqueado (403) o es otro problema.
            if (!badge.dataset.probed) {
                badge.dataset.probed = '1';
                try {
                    fetch(vsrc, { method: 'GET', headers: { Range: 'bytes=0-1' }, cache: 'no-store' }).then(function (r) {
                        try { console.warn('[SeeYou] Vídeo del Tic: HTTP ' + r.status + ' · ' + (r.headers.get('content-type') || 'sin tipo') + ' · ' + vsrc); } catch (e) { }
                        if (!r.ok && r.status !== 206) badge.textContent = tr('tv_video_na', 'Vídeo no disponible ({{why}})').replace('{{why}}', 'HTTP ' + r.status);
                    }).catch(function (e) { badge.textContent = tr('tv_video_na', 'Vídeo no disponible ({{why}})').replace('{{why}}', tr('tv_no_conn', 'sin conexión con el archivo')); });
                } catch (e) { }
            }
        }
        video.addEventListener('error', function () {
            var err = video.error;
            showVideoProblem('error ' + (err ? err.code : '?') + (err && err.message ? ' ' + err.message : ''));
        });
        section._tvVideoProblem = showVideoProblem;
        video.addEventListener('click', function (e) {
            e.stopPropagation();
            video.muted = !video.muted;
            section.classList.toggle('tv-muted', video.muted);
        });
        section.classList.add('tv-muted');
        if (playIcon) playIcon.style.display = 'none';
    }

    function setupCaptionToggle(section) {
        var cap = section.querySelector('.tic-caption');
        if (!cap) return;
        cap.classList.add('tv-caption-clamped');
        // Esperamos a que tenga layout para saber si realmente se desborda.
        requestAnimationFrame(function () {
            if (cap.scrollHeight > cap.clientHeight + 4) {
                var more = document.createElement('button');
                more.type = 'button';
                more.className = 'tv-seemore';
                more.textContent = (typeof CONFIG !== 'undefined' && CONFIG.translate) ? CONFIG.translate('tic_see_more_text', 'Ver más') : 'Ver más';
                more.addEventListener('click', function (e) {
                    e.stopPropagation();
                    cap.classList.remove('tv-caption-clamped');
                    more.remove();
                });
                cap.insertAdjacentElement('afterend', more);
            }
        });
    }

    // ---- Musica del Tic: el avance (30 s) que el autor eligio, suena mientras su Tic esta en pantalla ----
    var musicAudio = null, musicOwner = null, musicMuted = false;
    function musicChipState(section) {
        var chip = section && section.querySelector('.tic-chip-inline');
        if (chip) chip.classList.toggle('is-muted', musicMuted || !(musicOwner === section && musicAudio && !musicAudio.paused));
    }
    function stopMusic(section) {
        if (section && musicOwner !== section) return;
        if (musicAudio) { try { musicAudio.pause(); } catch (e) { } musicAudio = null; }
        var prev = musicOwner; musicOwner = null;
        if (prev) musicChipState(prev);
    }
    function startMusic(section) {
        var url = section && section._tvMusic;
        if (!url) return;
        if (musicOwner === section && musicAudio) { musicAudio.muted = musicMuted; if (musicAudio.paused && !musicMuted) musicAudio.play().catch(function () { }); return; }
        stopMusic(musicOwner);
        musicOwner = section;
        var a = new Audio(url);
        a.loop = true; a.volume = 0.8; a.muted = musicMuted; a.preload = 'auto';
        musicAudio = a;
        var p = a.play();
        if (p && p.catch) p.catch(function () { musicChipState(section); }); // si el sistema bloquea el sonido, basta tocar el chip
        a.addEventListener('playing', function () { musicChipState(section); });
        musicChipState(section);
    }
    function setupMusic(section, pub) {
        var url = pub && pub.musicPreviewUrl;
        var chip = section.querySelector('.tic-chip-inline');
        if (!url || !chip || pub.videoUrl) return; // los videos llevan su propio sonido
        section._tvMusic = url;
        chip.classList.add('tv-music');
        chip.setAttribute('role', 'button');
        chip.insertAdjacentHTML('beforeend', '<span class="tv-music-state" aria-hidden="true"></span>');
        chip.addEventListener('click', function (e) {
            e.stopPropagation();
            if (musicOwner === section && musicAudio && !musicAudio.paused) { musicMuted = true; musicAudio.muted = true; musicAudio.pause(); }
            else { musicMuted = false; startMusic(section); }
            musicChipState(section);
        });
    }

    /* Precarga: el Tic que se ve y los 2 siguientes (foto + inicio del video) para que al deslizar ya esten listos. */
    var WARM_AHEAD = 2;
    function warmAhead(section) {
        try {
            var next = section;
            for (var i = 0; i <= WARM_AHEAD && next; i++) {
                if (window.SocialUI && SocialUI.warmImage) SocialUI.warmImage(next);
                var v = next._tvVideo;
                if (v && v.preload !== 'auto') v.preload = 'auto';
                next = next.nextElementSibling;
                if (next && !next.classList.contains('tv-slide')) next = null;
            }
        } catch (e) { }
    }

    function playActive(section) {
        startMusic(section);
        var v = section && section._tvVideo;
        if (!v) return;
        if (!v.getAttribute('data-loaded')) { v.setAttribute('data-loaded', '1'); v.preload = 'auto'; }
        v.play().catch(function (e) { if (section._tvVideoProblem && e && e.name !== 'AbortError') section._tvVideoProblem(e.name || 'play'); });
    }
    function pauseSlide(section) {
        stopMusic(section);
        var v = section && section._tvVideo;
        if (v) { v.pause(); try { v.currentTime = 0; } catch (e) {} }
    }

    function ensureIO() {
        if (io) return io;
        io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting && en.intersectionRatio > 0.6) {
                    playActive(en.target);
                    warmAhead(en.target);
                    en.target.classList.add('tv-active');
                    maybeLoadMore(en.target);
                } else {
                    pauseSlide(en.target);
                    en.target.classList.remove('tv-active');
                    // Si se deja de ver este Tic (se desliza a otro), cerramos sus comentarios
                    // en vez de dejarlos abiertos de fondo.
                    var openCard = en.target.querySelector && en.target.querySelector('.tic-card.comments-open');
                    if (openCard && window.SocialUI && window.SocialUI.closeComments) window.SocialUI.closeComments(openCard);
                }
            });
        }, { root: scrollEl, threshold: [0, 0.6, 1] });
        return io;
    }

    function maybeLoadMore(section) {
        if (!loadMoreFn || loadingMore) return;
        var slides = scrollEl.querySelectorAll('.tv-slide');
        var idx = Array.prototype.indexOf.call(slides, section);
        if (idx >= slides.length - 5) {
            loadingMore = true;
            Promise.resolve(loadMoreFn()).then(function (more) {
                loadingMore = false;
                if (Array.isArray(more) && more.length) appendSlides(more);
            }).catch(function () { loadingMore = false; });
        }
    }

    function appendSlides(pubs) {
        pubs.forEach(function (p) {
            if (!p || currentList.indexOf(p) !== -1) return;
            currentList.push(p);
            var slide = buildSlide(p);
            scrollEl.appendChild(slide);
            ensureIO().observe(slide);
        });
    }

    // Barra inferior (Inicio/Amigos/Mapa/Perfil) visible sobre el visor: al pulsarla se cierra el visor y navega.
    document.addEventListener('click', function (e) {
        if (overlay && e.target.closest && e.target.closest('.bottom-nav-bar .nav-btn')) close();
    }, true);

    // Esc cierra el visor y vuelve a la pantalla de inicio.
    document.addEventListener('keydown', function (e) {
        if (!overlay || (e.key !== 'Escape' && e.key !== 'Esc')) return;
        var cm = overlay.querySelector('.tic-card.comments-open');
        if (cm && window.SocialUI && SocialUI.closeComments) { SocialUI.closeComments(cm); return; }
        close();
    });

    // Deslizar la pantalla en horizontal cambia de seccion (Inicio -> Amigos -> Mapa -> Perfil).
    var SECTIONS = ['inicio', 'amigos', 'actividades-map', 'perfil'];
    var swipe = null;
    function wireSectionSwipe() {
        scrollEl.addEventListener('touchstart', function (e) {
            if (e.touches.length !== 1 || (e.target.closest && e.target.closest('.tic-comments'))) { swipe = null; return; }
            swipe = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }, { passive: true });
        scrollEl.addEventListener('touchend', function (e) {
            if (!swipe) return;
            var t = e.changedTouches[0], dx = t.clientX - swipe.x, dy = t.clientY - swipe.y;
            swipe = null;
            if (Math.abs(dx) < 90 || Math.abs(dx) < Math.abs(dy) * 2) return;
            var next = SECTIONS[dx < 0 ? 1 : -1];
            if (dx > 0 || !next) return; // el visor se abre desde Inicio: solo se puede ir hacia la derecha (Amigos)
            close();
            if (typeof window.navigate === 'function') window.navigate(next);
        }, { passive: true });
    }

    function close() {
        if (!overlay || overlay.classList.contains('tv-animating-out')) return;
        scrollEl.querySelectorAll('.tv-slide').forEach(function (s) { pauseSlide(s); });
        stopMusic(musicOwner);
        if (io) { io.disconnect(); io = null; }
        document.body.classList.remove('tv-open');
        // En vez de quitar el visor de golpe, se encoge y desaparece ("encaja en su lugar")
        // y solo al terminar la animacion se elimina del DOM.
        var el = overlay;
        var list = currentList, loadFn = loadMoreFn;
        var onClose = onCloseFn;
        overlay = null; scrollEl = null; currentList = []; loadMoreFn = null; onCloseFn = null;
        if (onClose) { try { onClose(); } catch (e) { } }
        el.classList.add('tv-animating-out');
        var done = false;
        var finish = function () {
            if (done) return;
            done = true;
            if (el.parentNode) el.remove();
        };
        el.addEventListener('transitionend', finish, { once: true });
        setTimeout(finish, 320); // red de seguridad si transitionend no llega
    }

    function open(startId, list, opts) {
        opts = opts || {};
        if (!SocialUI) return;
        onCloseFn = typeof opts.onClose === 'function' ? opts.onClose : null;
        list = (Array.isArray(list) ? list : []).filter(Boolean);
        var startIdx = list.findIndex(function (p) { return String(p.id) === String(startId); });
        if (startIdx === -1) {
            var single = SocialUI.findPub(startId);
            if (single) { list = [single]; startIdx = 0; }
        }
        if (!list.length) return;
        currentList = list.slice();
        loadMoreFn = typeof opts.loadMore === 'function' ? opts.loadMore : null;

        overlay = document.createElement('div');
        overlay.className = 'tv-overlay tv-animating-in';
        overlay.innerHTML = '<div class="tv-scroll"></div>';
        document.body.appendChild(overlay);
        document.body.classList.add('tv-open');
        // Empieza encogido/transparente (tv-animating-in) y en el siguiente frame se quita la
        // clase para que la transicion de tic_viewer.css lo haga crecer hasta su tamano normal.
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                if (overlay) overlay.classList.remove('tv-animating-in');
            });
        });
        scrollEl = overlay.querySelector('.tv-scroll');

        currentList.forEach(function (p) {
            var slide = buildSlide(p);
            scrollEl.appendChild(slide);
        });
        var slides = scrollEl.querySelectorAll('.tv-slide');
        slides.forEach(function (s) { ensureIO().observe(s); });
        var target = slides[startIdx] || slides[0];
        if (target) target.scrollIntoView({ block: 'start' });
        wireSectionSwipe();
    }

    /* ---- Abrir el visor al tocar un Tic en el feed normal (no doble toque = like) ---- */
    function wireOpenOnTap() {
        var pending = null;
        document.addEventListener('click', function (e) {
            var media = e.target.closest && e.target.closest('.tic-media');
            if (!media || media.closest('.tv-slide')) return;
            if (e.target.closest('[data-act]')) return; // like/comments/menu llevan su propio handler
            if (pending && pending.media === media) {
                clearTimeout(pending.timer);
                pending = null; // segundo toque: lo gestiona el doble-like, no abrimos el visor
                return;
            }
            if (pending) { clearTimeout(pending.timer); pending = null; }
            var card = media.closest('.tic-card');
            if (!card) return;
            var timer = setTimeout(function () {
                pending = null;
                var list = window.publicationPhotos || [];
                open(card.dataset.pubId, list, {
                    loadMore: typeof window.loadMoreFeedTics === 'function' ? window.loadMoreFeedTics : null
                });
            }, 260);
            pending = { media: media, timer: timer };
        });
    }

    ready(wireOpenOnTap);
    window.SocialTicViewer = { open: open, close: close };
})();
