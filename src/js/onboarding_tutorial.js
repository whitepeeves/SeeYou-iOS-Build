/*
 * SeeYou - Tutorial interactivo de bienvenida.
 *
 * Se ofrece SOLO la primera vez que este navegador ve a este usuario logueado
 * (recién creada la cuenta, o primer login en un navegador/perfil que no
 * reconocemos, p. ej. modo incógnito). Guardamos una marca en localStorage por
 * usuario para no volver a preguntar.
 *
 * Deliberadamente independiente de "racha" y "tema del día": no se lanza
 * automáticamente, solo se ofrece con un aviso propio y espera a que esos
 * otros avisos (el modal de tema del día, sobre todo) no estén en pantalla.
 *
 * El paso del Tic es interactivo de verdad: al darle a "Siguiente" se abre
 * la cámara/galería como si el usuario fuera a subir un Tic de verdad, y una
 * vez está en la pantalla de edición de la foto se le enseña para qué sirven
 * los botones de ubicación, música y hora.
 */
(function (global) {
    'use strict';

    var SEEN_KEY_PREFIX = 'seeYou_onboarding_seen:';
    var STEP_DELAY_MS = 260;
    var WAIT_POLL_MS = 400;
    var WAIT_MAX_MS = 90000; // hasta 90s esperando a que el usuario haga/elija su foto

    function seenKey(userId) {
        return SEEN_KEY_PREFIX + String(userId || 'anon');
    }

    function hasSeenOnboarding(userId) {
        try { return localStorage.getItem(seenKey(userId)) === '1'; } catch (e) { return true; }
    }

    function markOnboardingSeen(userId) {
        try { localStorage.setItem(seenKey(userId), '1'); } catch (e) { /* noop */ }
    }

    var cachedSafeTop = null;
    function getSafeTop() {
        if (cachedSafeTop !== null) return cachedSafeTop;
        try {
            var probe = document.createElement('div');
            probe.style.position = 'fixed';
            probe.style.top = '0';
            probe.style.left = '0';
            probe.style.paddingTop = 'env(safe-area-inset-top, 0px)';
            probe.style.visibility = 'hidden';
            probe.style.pointerEvents = 'none';
            document.body.appendChild(probe);
            var val = parseFloat(getComputedStyle(probe).paddingTop) || 0;
            document.body.removeChild(probe);
            cachedSafeTop = val;
        } catch (e) { cachedSafeTop = 0; }
        return cachedSafeTop;
    }

    function isDailyThemeModalActive() {
        var modal = document.getElementById('daily-theme-modal');
        return !!(modal && modal.classList.contains('active'));
    }

    function translate(key, fallback) {
        try {
            // "global" es de Node.js y no existe en el navegador/app: esta comprobacion
            // fallaba siempre (con try/catch tragandose el ReferenceError), asi que el
            // tutorial de bienvenida nunca se traducia, ni en la web ni en la app.
            if (typeof CONFIG !== 'undefined' && CONFIG && typeof CONFIG.translate === 'function') {
                var value = CONFIG.translate(key);
                if (value && value !== key) return value;
            }
        } catch (e) { /* noop */ }
        return fallback;
    }

    var STYLE_ID = 'seeyou-onboarding-style';
    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            '.sy-onb-overlay{position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:20000;display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity .25s ease;}',
            '.sy-onb-overlay.sy-onb-show{opacity:1;}',
            '.sy-onb-card{background:#fff;border-radius:20px;max-width:340px;width:100%;padding:26px 22px;box-shadow:0 20px 60px rgba(15,23,42,0.25);text-align:center;transform:translateY(10px);transition:transform .25s ease;}',
            '.sy-onb-overlay.sy-onb-show .sy-onb-card{transform:translateY(0);}',
            '.sy-onb-emoji{font-size:40px;line-height:1;margin-bottom:10px;}',
            '.sy-onb-title{font-size:18px;font-weight:800;color:#1B3A5C;margin:0 0 8px;}',
            '.sy-onb-text{font-size:14px;color:#49454F;line-height:1.45;margin:0 0 20px;}',
            '.sy-onb-actions{display:flex;gap:10px;}',
            '.sy-onb-btn{flex:1;border:none;border-radius:999px;padding:12px 14px;font-size:14px;font-weight:700;cursor:pointer;transition:opacity .15s ease;}',
            '.sy-onb-btn:active{opacity:.8;}',
            '.sy-onb-btn-primary{background:#1B3A5C;color:#fff;}',
            '.sy-onb-btn-secondary{background:#F1F3F8;color:#1B3A5C;}',
            '.sy-onb-spot-overlay{position:fixed;inset:0;z-index:20000;pointer-events:none;}',
            '.sy-onb-spot-dim{position:absolute;inset:0;background:rgba(15,23,42,0.6);transition:clip-path .3s ease;pointer-events:auto;}',
            '.sy-onb-ring{position:fixed;z-index:20001;border:3px solid #FF6B35;border-radius:16px;box-shadow:0 0 0 4px rgba(255,107,53,0.25);pointer-events:none;transition:top .3s ease,left .3s ease,width .3s ease,height .3s ease;}',
            '.sy-onb-tooltip{position:fixed;z-index:20002;max-width:280px;background:#fff;border-radius:16px;padding:16px 18px;box-shadow:0 16px 40px rgba(15,23,42,0.3);transition:top .3s ease,left .3s ease;pointer-events:auto;}',
            '.sy-onb-tooltip-step{font-size:11px;font-weight:700;color:#FF6B35;letter-spacing:.04em;text-transform:uppercase;margin:0 0 4px;}',
            '.sy-onb-tooltip-title{font-size:15px;font-weight:800;color:#1B3A5C;margin:0 0 6px;}',
            '.sy-onb-tooltip-text{font-size:13px;color:#49454F;line-height:1.4;margin:0 0 14px;}',
            '.sy-onb-tooltip-actions{display:flex;justify-content:space-between;align-items:center;gap:8px;}',
            '.sy-onb-link{background:none;border:none;color:#8A94A6;font-size:13px;cursor:pointer;padding:6px 2px;}',
            '.sy-onb-next{background:#1B3A5C;color:#fff;border:none;border-radius:999px;padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;}',
            '.sy-onb-hint{position:fixed;left:50%;top:calc(18px + env(safe-area-inset-top, 0px));transform:translateX(-50%);z-index:20002;background:rgba(27,58,92,0.95);color:#fff;padding:10px 18px;border-radius:999px;font-size:13px;font-weight:600;box-shadow:0 10px 28px rgba(0,0,0,0.35);display:flex;align-items:center;gap:10px;max-width:90vw;}',
            '.sy-onb-hint button{background:none;border:none;color:rgba(255,255,255,0.75);font-size:12px;cursor:pointer;text-decoration:underline;padding:0;}',
            '.sy-onb-prog{display:flex;align-items:center;gap:5px;margin:0 0 12px;}',
            '.sy-onb-prog i{flex:1;height:5px;border-radius:3px;background:#E3E8F1;transition:background .3s;}',
            '.sy-onb-prog i.f{background:#FF6B35;}',
            '.sy-onb-hand{position:fixed;z-index:20003;font-size:40px;line-height:1;pointer-events:none;filter:drop-shadow(0 4px 6px rgba(0,0,0,.4));transition:top .45s ease,left .45s ease;animation:syOnbTap 1s ease-in-out infinite;}',
            '@keyframes syOnbTap{50%{transform:translateY(5px) scale(.88);}}',
            '.sy-onb-gift{background:#FFF1EA;color:#C2410C;border-radius:14px;padding:9px 12px;font-size:13px;font-weight:700;margin:0 0 16px;}',
            '.sy-onb-sheet{position:fixed;left:0;right:0;bottom:0;z-index:20004;background:#fff;border-radius:26px 26px 0 0;padding:22px 20px calc(24px + env(safe-area-inset-bottom,0px));box-shadow:0 -10px 40px rgba(15,23,42,.25);transform:translateY(105%);transition:transform .45s ease;max-width:520px;margin:0 auto;}',
            '.sy-onb-sheet.sy-onb-show{transform:none;}',
            '.sy-onb-sheet h3{margin:0;font-size:19px;font-weight:800;color:#1B3A5C;}',
            '.sy-onb-sheet .sy-onb-sub{margin:2px 0 6px;font-size:13px;color:#6b7788;}',
            '.sy-onb-task{display:flex;align-items:center;gap:12px;background:#F1F3F8;border-radius:16px;padding:13px;margin-top:10px;font-size:14px;font-weight:700;color:#1B3A5C;border:0;width:100%;text-align:left;cursor:pointer;font-family:inherit;}',
            '.sy-onb-task .c{width:26px;height:26px;border-radius:50%;border:2.5px solid #c5cddb;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;flex:0 0 auto;transition:.35s;}',
            '.sy-onb-task.d .c{background:#2DB57B;border-color:#2DB57B;}',
            '.sy-onb-task.d{color:#8793a6;cursor:default;}',
            '.sy-onb-bar{height:9px;border-radius:5px;background:#E3E8F1;margin-top:16px;overflow:hidden;}',
            '.sy-onb-bar u{display:block;height:100%;width:0;background:linear-gradient(90deg,#FF6B35,#ffb347);transition:width .8s;}',
            '.sy-onb-later{display:block;margin:12px auto 0;background:none;border:0;color:#8A94A6;font-size:13px;cursor:pointer;}',
            '.sy-onb-cf{position:fixed;top:-20px;width:9px;height:14px;z-index:20010;pointer-events:none;animation:syOnbFall 3.2s linear forwards;}',
            '@keyframes syOnbFall{to{transform:translateY(110vh) rotate(720deg);}}',
            '@media (prefers-reduced-motion:reduce){.sy-onb-hand{animation:none;}.sy-onb-cf{display:none;}}',
            '@media (max-width:420px){.sy-onb-tooltip{left:16px !important;right:16px;max-width:none;width:auto;}}'
        ].join('\n');
        document.head.appendChild(style);
    }

    // Varios elementos comparten id (barra lateral de escritorio y barra inferior del móvil):
    // se usa el primero que esté realmente visible, no el primero del documento.
    function findTarget(selector) {
        var list;
        try { list = document.querySelectorAll(selector); } catch (e) { return null; }
        for (var i = 0; i < list.length; i++) {
            var r = list[i].getBoundingClientRect();
            if (r.width > 0 && r.height > 0) return list[i];
        }
        return null;
    }

    function buildSteps() {
        var all = [
            {
                target: '#nav-inicio',
                title: translate('onboarding_step_home_title', 'Tu Inicio'),
                text: translate('onboarding_step_home_text', 'Aquí ves los Tics de tus amigos, en orden, a medida que los suben.')
            },
            {
                target: '#nav-mapa',
                title: translate('onboarding_step_map_title', 'El Mapa'),
                text: translate('onboarding_step_map_text', 'Descubre actividades y quedadas cerca de ti, o crea las tuyas propias.')
            },
            {
                target: '#nav-amigos',
                title: translate('onboarding_step_friends_title', 'Amigos'),
                text: translate('onboarding_step_friends_text', 'Busca personas y envía solicitudes de amistad para ver sus Tics.')
            },
            {
                target: '#nav-perfil',
                title: translate('onboarding_step_profile_title', 'Tu perfil'),
                text: translate('onboarding_step_profile_text', 'Aquí gestionas tu cuenta, tu racha y tus ajustes.')
            },
            {
                id: 'tic-intro',
                target: '#btn-add-tic-feed',
                title: translate('onboarding_step_tic_title', '¿Qué es un Tic?'),
                text: translate('onboarding_step_tic_text', 'Un Tic es una foto del momento. Vamos a subir tu primer Tic para que veas cómo funciona.'),
                nextLabel: translate('onboarding_tic_cta', 'Vamos a subirlo'),
                startsCreationFlow: true
            },
            {
                id: 'location',
                target: '#btn-add-location',
                title: translate('onboarding_step_location_title', 'Añade tu ubicación'),
                text: translate('onboarding_step_location_text', 'Toca aquí para etiquetar dónde estás. Tus amigos podrán ver el sitio en el Tic, y también aparecerá en el Mapa si lo activas.')
            },
            {
                id: 'music',
                target: '#btn-add-music',
                title: translate('onboarding_step_music_title', 'Añade música'),
                text: translate('onboarding_step_music_text', 'Busca una canción para ambientar tu Tic. Sonará cuando tus amigos lo vean.')
            },
            {
                id: 'date',
                target: '#btn-add-date',
                title: translate('onboarding_step_date_title', 'Cambia la hora'),
                text: translate('onboarding_step_date_text', 'Por defecto se publica con la fecha y hora de ahora mismo, pero puedes ajustarla aquí si el momento fue antes.'),
                lastStep: true
            }
        ];
        return all.filter(function (step) {
            // Los pasos dentro de la pantalla de edición (ubicación/música/hora)
            // no existen todavía en el DOM hasta que se abre esa pantalla:
            // se validan más tarde, al llegar a ellos, no aquí.
            return step.startsCreationFlow || step.lastStep || step.id === 'location' || step.id === 'music' || !!findTarget(step.target);
        });
    }

    var state = { steps: [], index: 0, elements: null, userId: null, waiting: false, waitTimer: null, waitDeadline: 0, hintEl: null };

    function removeTourElements() {
        if (!state.elements) return;
        Object.keys(state.elements).forEach(function (key) {
            var el = state.elements[key];
            if (el && el.parentNode) el.parentNode.removeChild(el);
        });
        state.elements = null;
        window.removeEventListener('resize', onViewportChange);
        window.removeEventListener('scroll', onViewportChange, true);
        document.removeEventListener('click', onDocumentClickDuringTour, true);
    }

    function removeHint() {
        if (state.hintEl && state.hintEl.parentNode) state.hintEl.parentNode.removeChild(state.hintEl);
        state.hintEl = null;
        if (state.waitTimer) { clearTimeout(state.waitTimer); state.waitTimer = null; }
        state.waiting = false;
    }

    function onViewportChange() {
        if (state.elements) positionStep();
    }

    function positionStep() {
        var step = state.steps[state.index];
        var target = step && findTarget(step.target);
        if (!target) {
            // El elemento aún no existe (p.ej. estamos esperando a la pantalla de edición):
            // no lo tratamos como error, simplemente no avanzamos solos.
            return;
        }

        var rect = target.getBoundingClientRect();
        var pad = 8;
        var ring = state.elements.ring;
        ring.style.top = (rect.top - pad) + 'px';
        ring.style.left = (rect.left - pad) + 'px';
        ring.style.width = (rect.width + pad * 2) + 'px';
        ring.style.height = (rect.height + pad * 2) + 'px';

        var dim = state.elements.dim;
        var r = rect;
        var clip = 'polygon(0% 0%, 0% 100%, ' + (r.left - pad) + 'px 100%, ' + (r.left - pad) + 'px ' + (r.top - pad) + 'px, ' +
            (r.right + pad) + 'px ' + (r.top - pad) + 'px, ' + (r.right + pad) + 'px ' + (r.bottom + pad) + 'px, ' +
            (r.left - pad) + 'px ' + (r.bottom + pad) + 'px, ' + (r.left - pad) + 'px 100%, 100% 100%, 100% 0%)';
        dim.style.clipPath = clip;

        var tooltip = state.elements.tooltip;
        var safeTop = getSafeTop();
        var minTop = 16 + safeTop;
        var tipTop = rect.bottom + 16;
        var viewportH = window.innerHeight || document.documentElement.clientHeight;
        if (tipTop + 150 > viewportH) tipTop = Math.max(minTop, rect.top - 150);
        if (tipTop < minTop) tipTop = minTop;
        var tipLeft = Math.min(Math.max(16, rect.left), (window.innerWidth || 360) - 296);
        tooltip.style.top = tipTop + 'px';
        tooltip.style.left = tipLeft + 'px';

        state.elements.stepLabel.textContent = (state.index + 1) + ' / ' + state.steps.length;
        var dotsHtml = '';
        for (var di = 0; di < state.steps.length; di++) dotsHtml += '<i class="' + (di <= state.index ? 'f' : '') + '"></i>';
        state.elements.prog.innerHTML = dotsHtml;
        var hand = state.elements.hand;
        hand.style.left = Math.max(4, rect.left + rect.width / 2 - 10) + 'px';
        hand.style.top = (rect.top > viewportH / 2 ? rect.top + 6 : rect.bottom - 14) + 'px';
        state.elements.title.textContent = step.title;
        state.elements.text.textContent = step.text;
        state.elements.nextBtn.textContent = step.nextLabel
            ? step.nextLabel
            : (step.lastStep ? translate('onboarding_finish', 'Entendido') : translate('onboarding_next', 'Siguiente'));
    }

    function goToStepIndex(idx) {
        state.index = idx;
        if (state.index >= state.steps.length) { finishTour(state.userId); return; }
        // Pequeño margen por si un paso previo acaba de cambiar el DOM
        // (p.ej. la pantalla de edición aún terminando de renderizar).
        setTimeout(positionStep, STEP_DELAY_MS);
    }

    function nextStep() {
        var current = state.steps[state.index];
        if (current && current.startsCreationFlow) {
            beginCreationFlow();
            return;
        }
        goToStepIndex(state.index + 1);
    }

    function onDocumentClickDuringTour(event) {
        var step = state.steps[state.index];
        if (!step || !step.startsCreationFlow) return;
        var target = findTarget(step.target);
        if (!target) return;
        if (target === event.target || (target.contains && target.contains(event.target))) {
            // El usuario ha tocado directamente el botón real (el que está bajo el
            // spotlight) en vez del botón "Siguiente" del tutorial. Avanzamos el
            // tour igualmente, sin volver a abrir la cámara/galería (ya se ha
            // abierto sola al tocar el botón real).
            removeTourElements();
            showWaitingHint();
            state.waiting = true;
            state.waitDeadline = Date.now() + WAIT_MAX_MS;
            pollForEditScreen();
        }
    }

    function beginCreationFlow() {
        // Ocultamos el spotlight (la cámara/edición van a pantalla completa) y
        // dejamos un aviso pequeño no intrusivo mientras el usuario hace/elige su foto.
        removeTourElements();
        try {
            if (typeof window.openCreatePostSection === 'function') {
                window.openCreatePostSection('tic');
            } else if (typeof window.openCamera === 'function') {
                window.openCamera();
            }
        } catch (e) { console.warn('[SeeYouOnboarding] No se pudo abrir la cámara', e); }

        showWaitingHint();
        state.waiting = true;
        state.waitDeadline = Date.now() + WAIT_MAX_MS;
        pollForEditScreen();
    }

    function showWaitingHint() {
        removeHint();
        ensureStyles();
        var hint = document.createElement('div');
        hint.className = 'sy-onb-hint';
        hint.innerHTML = '<span>' + translate('onboarding_wait_photo', 'Haz o elige una foto para tu Tic') + '</span>' +
            '<button type="button" data-action="skip-tour">' + translate('onboarding_skip', 'Saltar tutorial') + '</button>';
        document.body.appendChild(hint);
        hint.querySelector('[data-action="skip-tour"]').addEventListener('click', function () {
            removeHint();
            finishTour(state.userId);
        });
        state.hintEl = hint;
    }

    function pollForEditScreen() {
        if (!state.waiting) return;
        var editScreen = document.getElementById('edit-photo-container');
        var isOpen = !!(editScreen && editScreen.classList.contains('open'));
        if (isOpen) {
            removeHint();
            resumeAfterCreationFlow();
            return;
        }
        if (Date.now() > state.waitDeadline) {
            // El usuario se ha ido sin completar la foto: no insistimos más.
            removeHint();
            markOnboardingSeen(state.userId);
            return;
        }
        state.waitTimer = setTimeout(pollForEditScreen, WAIT_POLL_MS);
    }

    function resumeAfterCreationFlow() {
        ensureStyles();
        // Ahora que la pantalla de edición está abierta, los botones de
        // ubicación/música/hora ya existen en el DOM: continuamos el tour ahí.
        buildTourUI();
        goToStepIndex(state.index + 1);
    }

    function finishTour(userId, completed) {
        removeHint();
        removeTourElements();
        if (userId) markOnboardingSeen(userId);
        if (completed && userId && !state.replay) {
            try { localStorage.setItem(missionKey(userId), 'pending'); } catch (e) { /* noop */ }
            // No tapamos la pantalla de edición: la misión aparece cuando el usuario la cierra (publica o cancela).
            (function waitEditClosed(tries) {
                var ed = document.getElementById('edit-photo-container');
                var open = !!(ed && ed.classList.contains('open'));
                if (open && tries < 900) { setTimeout(function () { waitEditClosed(tries + 1); }, 1000); return; }
                setTimeout(function () { showMissions(userId); }, 600);
            })(0);
        }
    }

    function buildTourUI() {
        if (state.elements) return;

        var spotOverlay = document.createElement('div');
        spotOverlay.className = 'sy-onb-spot-overlay';
        var dim = document.createElement('div');
        dim.className = 'sy-onb-spot-dim';
        spotOverlay.appendChild(dim);
        document.body.appendChild(spotOverlay);

        var ring = document.createElement('div');
        ring.className = 'sy-onb-ring';
        document.body.appendChild(ring);

        var tooltip = document.createElement('div');
        tooltip.className = 'sy-onb-tooltip';
        var stepLabel = document.createElement('p');
        stepLabel.className = 'sy-onb-tooltip-step';
        var title = document.createElement('p');
        title.className = 'sy-onb-tooltip-title';
        var text = document.createElement('p');
        text.className = 'sy-onb-tooltip-text';
        var actions = document.createElement('div');
        actions.className = 'sy-onb-tooltip-actions';
        var skipBtn = document.createElement('button');
        skipBtn.type = 'button';
        skipBtn.className = 'sy-onb-link';
        skipBtn.textContent = translate('onboarding_skip', 'Saltar');
        skipBtn.onclick = function () { finishTour(state.userId); };
        var nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'sy-onb-next';
        nextBtn.onclick = function () {
            var step = state.steps[state.index];
            if (step && step.lastStep) { finishTour(state.userId, true); }
            else { nextStep(); }
        };
        actions.appendChild(skipBtn);
        actions.appendChild(nextBtn);
        var prog = document.createElement('div');
        prog.className = 'sy-onb-prog';
        var hand = document.createElement('div');
        hand.className = 'sy-onb-hand';
        hand.textContent = '\uD83D\uDC46';
        document.body.appendChild(hand);
        tooltip.appendChild(stepLabel);
        tooltip.appendChild(prog);
        tooltip.appendChild(title);
        tooltip.appendChild(text);
        tooltip.appendChild(actions);
        document.body.appendChild(tooltip);

        state.elements = { spotOverlay: spotOverlay, dim: dim, ring: ring, tooltip: tooltip, stepLabel: stepLabel, title: title, text: text, nextBtn: nextBtn, prog: prog, hand: hand };

        window.addEventListener('resize', onViewportChange);
        window.addEventListener('scroll', onViewportChange, true);
        document.addEventListener('click', onDocumentClickDuringTour, true);
    }

    function startTour(userId) {
        ensureStyles();
        if (arguments[1] !== 'replay' && state.replay && !state.elements) { /* conserva el modo repetición */ }
        var steps = buildSteps();
        if (!steps.length) { markOnboardingSeen(userId); return; }

        state.userId = userId;
        state.steps = steps;
        state.index = 0;

        buildTourUI();
        positionStep();
    }

    function showOfferPrompt(userId) {
        ensureStyles();
        var overlay = document.createElement('div');
        overlay.className = 'sy-onb-overlay';
        var card = document.createElement('div');
        card.className = 'sy-onb-card';
        card.innerHTML =
            '<div class="sy-onb-emoji">👋</div>' +
            '<p class="sy-onb-title">' + translate('onboarding_offer_title', '¡Bienvenido a SeeYou!') + '</p>' +
            '<p class="sy-onb-text">' + translate('onboarding_offer_text', '¿Quieres un tour rápido (30 s) para aprender a usar los Tics, el mapa y cómo añadir amigos?') + '</p>' +
            '<div class="sy-onb-gift" id="sy-onb-gift" style="display:none"></div>' +
            '<div class="sy-onb-actions">' +
            '<button type="button" class="sy-onb-btn sy-onb-btn-secondary" data-action="no">' + translate('onboarding_offer_no', 'Ahora no') + '</button>' +
            '<button type="button" class="sy-onb-btn sy-onb-btn-primary" data-action="yes">' + translate('onboarding_offer_yes', 'Sí, enséñame') + '</button>' +
            '</div>';
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        requestAnimationFrame(function () { overlay.classList.add('sy-onb-show'); });
        claimWelcomeGift().then(function (g) {
            var box = document.getElementById('sy-onb-gift');
            if (box && g && g.granted) {
                box.textContent = '\uD83C\uDF81 ' + translate('onboarding_gift', 'Regalo de bienvenida: {n} monedas').replace('{n}', g.amount);
                box.style.display = 'block';
            }
        });

        function close() {
            overlay.classList.remove('sy-onb-show');
            setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 250);
        }

        card.addEventListener('click', function (event) {
            var action = event.target && event.target.getAttribute && event.target.getAttribute('data-action');
            if (!action) return;
            close();
            markOnboardingSeen(userId);
            if (action === 'yes') {
                state.replay = false; setTimeout(function () { startTour(userId); }, 260);
            }
        });
    }


    // ── Regalo de bienvenida y misiones ─────────────────────────────────────
    function apiBase() {
        try { return (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.API_BASE_URL) || ''; } catch (e) { return ''; }
    }
    function authHeaders() {
        var h = { 'Content-Type': 'application/json' };
        try { var t = localStorage.getItem('seeYou_auth_token'); if (t) h.Authorization = 'Bearer ' + t; } catch (e) { /* noop */ }
        return h;
    }
    function claimWelcomeGift() {
        return fetch(apiBase() + '/api/onboarding/gift', { method: 'POST', headers: authHeaders() })
            .then(function (r) { return r.ok ? r.json() : null; })
            .catch(function () { return null; });
    }

    function missionKey(userId) { return 'seeYou_onboarding_mission:' + String(userId || 'anon'); }

    function pushGranted() {
        try {
            var cap = window.Capacitor;
            var plugin = cap && cap.Plugins && cap.Plugins.PushNotifications;
            if (plugin && plugin.checkPermissions) {
                return plugin.checkPermissions().then(function (p) { return !!(p && p.receive === 'granted'); }).catch(function () { return false; });
            }
            if (typeof Notification !== 'undefined') return Promise.resolve(Notification.permission === 'granted');
        } catch (e) { /* noop */ }
        return Promise.resolve(false);
    }
    function askPush() {
        try {
            var cap = window.Capacitor;
            var plugin = cap && cap.Plugins && cap.Plugins.PushNotifications;
            if (plugin && plugin.requestPermissions) return plugin.requestPermissions().catch(function () { });
            if (typeof Notification !== 'undefined' && Notification.requestPermission) return Promise.resolve(Notification.requestPermission()).catch(function () { });
        } catch (e) { /* noop */ }
        return Promise.resolve();
    }
    function fetchJson(url) {
        return fetch(url, { headers: authHeaders(), cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    }
    function checkMissions(userId) {
        var base = apiBase();
        var uid = encodeURIComponent(userId);
        return Promise.all([
            fetchJson(base + '/api/publicaciones/usuario/' + uid + '?viewerId=' + uid + '&limit=1'),
            fetchJson(base + '/api/friends/' + uid),
            pushGranted()
        ]).then(function (res) {
            var pubs = res[0]; var fr = res[1];
            var nPubs = Array.isArray(pubs) ? pubs.length : (pubs && (pubs.publications || pubs.items || []).length) || 0;
            var nFr = Array.isArray(fr) ? fr.length : (fr && (fr.friends || []).length) || 0;
            return { tic: nPubs > 0, friend: nFr > 0, push: !!res[2] };
        });
    }

    var missionState = { el: null, timer: null };
    function closeMissions() {
        if (missionState.timer) { clearInterval(missionState.timer); missionState.timer = null; }
        var el = missionState.el; missionState.el = null;
        if (el) { el.classList.remove('sy-onb-show'); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 500); }
    }

    function confetti() {
        var colors = ['#FF6B35', '#1B3A5C', '#2DB57B', '#ffb347'];
        for (var i = 0; i < 40; i++) {
            var c = document.createElement('div');
            c.className = 'sy-onb-cf';
            c.style.left = Math.random() * 100 + 'vw';
            c.style.background = colors[i % 4];
            c.style.animationDelay = (Math.random() * 1.2) + 's';
            document.body.appendChild(c);
            (function (n) { setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 5000); })(c);
        }
    }

    function showReward(userId) {
        try { localStorage.setItem(missionKey(userId), 'done'); } catch (e) { /* noop */ }
        ensureStyles();
        var overlay = document.createElement('div');
        overlay.className = 'sy-onb-overlay';
        overlay.innerHTML = '<div class="sy-onb-card"><div class="sy-onb-emoji">🎉</div>' +
            '<p class="sy-onb-title">' + translate('onboarding_reward_title', '¡Ya eres de SeeYou!') + '</p>' +
            '<p class="sy-onb-text">' + translate('onboarding_reward_text', 'Has completado tu primera misión. Sigue subiendo Tics para mantener tu racha 🔥') + '<br><br><small style="color:#8A94A6">' +
            translate('onboarding_reward_replay', 'Puedes repetir el tutorial en Perfil › Ajustes') + '</small></p>' +
            '<div class="sy-onb-actions"><button type="button" class="sy-onb-btn sy-onb-btn-primary">' + translate('onboarding_reward_cta', 'Genial') + '</button></div></div>';
        document.body.appendChild(overlay);
        requestAnimationFrame(function () { overlay.classList.add('sy-onb-show'); });
        confetti();
        overlay.querySelector('button').addEventListener('click', function () {
            overlay.classList.remove('sy-onb-show');
            setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 250);
        });
    }

    function showMissions(userId) {
        if (missionState.el) return;
        ensureStyles();
        var sheet = document.createElement('div');
        sheet.className = 'sy-onb-sheet';
        var items = [
            { id: 'tic', label: translate('onboarding_mission_tic', 'Sube tu primer Tic') },
            { id: 'friend', label: translate('onboarding_mission_friend', 'Añade a un amigo') },
            { id: 'push', label: translate('onboarding_mission_push', 'Activa los avisos') }
        ];
        sheet.innerHTML = '<h3>' + translate('onboarding_mission_title', 'Tu primera misión 🚀') + '</h3>' +
            '<p class="sy-onb-sub">' + translate('onboarding_mission_sub', 'Completa estas 3 cosas para dominar SeeYou') + '</p>' +
            items.map(function (it) { return '<button type="button" class="sy-onb-task" data-id="' + it.id + '"><span class="c">✓</span>' + it.label + '</button>'; }).join('') +
            '<div class="sy-onb-bar"><u></u></div>' +
            '<button type="button" class="sy-onb-later">' + translate('onboarding_mission_later', 'Más tarde') + '</button>';
        document.body.appendChild(sheet);
        missionState.el = sheet;
        requestAnimationFrame(function () { sheet.classList.add('sy-onb-show'); });

        var bar = sheet.querySelector('.sy-onb-bar u');
        var last = { tic: false, friend: false, push: false };
        function paint(r) {
            var n = 0;
            items.forEach(function (it) {
                var btn = sheet.querySelector('[data-id="' + it.id + '"]');
                if (r[it.id]) { n++; btn.classList.add('d'); } else { btn.classList.remove('d'); }
            });
            bar.style.width = Math.round(n / items.length * 100) + '%';
            return n;
        }
        function poll() {
            checkMissions(userId).then(function (r) {
                last = r;
                if (paint(r) === items.length) {
                    closeMissions();
                    setTimeout(function () { showReward(userId); }, 700);
                }
            });
        }
        sheet.addEventListener('click', function (e) {
            var t = e.target;
            while (t && t !== sheet && !(t.getAttribute && (t.getAttribute('data-id') || t.className === 'sy-onb-later'))) t = t.parentNode;
            if (!t || t === sheet) return;
            if (t.className === 'sy-onb-later') { closeMissions(); return; }
            var id = t.getAttribute('data-id');
            if (last[id]) return;
            if (id === 'tic') {
                closeMissions();
                try { if (typeof window.openCreatePostSection === 'function') window.openCreatePostSection('tic'); } catch (er) { /* noop */ }
            } else if (id === 'friend') {
                closeMissions();
                try { if (typeof window.navigate === 'function') window.navigate('amigos'); else window.location.href = 'friends.html'; } catch (er) { /* noop */ }
            } else if (id === 'push') {
                askPush().then(poll);
            }
        });
        poll();
        missionState.timer = setInterval(poll, 4000);
    }

    function resumeMissionIfPending(userId) {
        var v = null;
        try { v = localStorage.getItem(missionKey(userId)); } catch (e) { /* noop */ }
        if (v === 'pending') setTimeout(function () { showMissions(userId); }, 1500);
    }

    function maybeOffer(userId, options) {
        options = options || {};
        if (!userId) return;
        if (hasSeenOnboarding(userId)) { resumeMissionIfPending(userId); return; }

        var attempt = 0;
        var maxAttempts = 20; // ~10s esperando a que el tema del día se cierre
        (function waitForClearScreen() {
            attempt += 1;
            if (isDailyThemeModalActive() && attempt < maxAttempts) {
                setTimeout(waitForClearScreen, 500);
                return;
            }
            showOfferPrompt(userId);
        })();
    }

    global.SeeYouOnboarding = {
        maybeOffer: maybeOffer,
        hasSeenOnboarding: hasSeenOnboarding,
        markOnboardingSeen: markOnboardingSeen,
        startTour: startTour,
        replay: function (userId) { state.replay = true; startTour(userId); }
    };
})(window);
