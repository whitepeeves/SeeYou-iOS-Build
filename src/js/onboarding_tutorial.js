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
            '@media (max-width:420px){.sy-onb-tooltip{left:16px !important;right:16px;max-width:none;width:auto;}}'
        ].join('\n');
        document.head.appendChild(style);
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
            return step.startsCreationFlow || step.lastStep || step.id === 'location' || step.id === 'music' || !!document.querySelector(step.target);
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
        var target = step && document.querySelector(step.target);
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
        var target = document.querySelector(step.target);
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

    function finishTour(userId) {
        removeHint();
        removeTourElements();
        if (userId) markOnboardingSeen(userId);
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
            if (step && step.lastStep) { finishTour(state.userId); }
            else { nextStep(); }
        };
        actions.appendChild(skipBtn);
        actions.appendChild(nextBtn);
        tooltip.appendChild(stepLabel);
        tooltip.appendChild(title);
        tooltip.appendChild(text);
        tooltip.appendChild(actions);
        document.body.appendChild(tooltip);

        state.elements = { spotOverlay: spotOverlay, dim: dim, ring: ring, tooltip: tooltip, stepLabel: stepLabel, title: title, text: text, nextBtn: nextBtn };

        window.addEventListener('resize', onViewportChange);
        window.addEventListener('scroll', onViewportChange, true);
        document.addEventListener('click', onDocumentClickDuringTour, true);
    }

    function startTour(userId) {
        ensureStyles();
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
            '<p class="sy-onb-text">' + translate('onboarding_offer_text', '¿Quieres un tour rápido para aprender a usar los Tics, el mapa, los likes y cómo añadir amigos?') + '</p>' +
            '<div class="sy-onb-actions">' +
            '<button type="button" class="sy-onb-btn sy-onb-btn-secondary" data-action="no">' + translate('onboarding_offer_no', 'Ahora no') + '</button>' +
            '<button type="button" class="sy-onb-btn sy-onb-btn-primary" data-action="yes">' + translate('onboarding_offer_yes', 'Sí, enséñame') + '</button>' +
            '</div>';
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        requestAnimationFrame(function () { overlay.classList.add('sy-onb-show'); });

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
                setTimeout(function () { startTour(userId); }, 260);
            }
        });
    }

    function maybeOffer(userId, options) {
        options = options || {};
        if (!userId) return;
        if (hasSeenOnboarding(userId)) return;

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
        startTour: startTour
    };
})(window);
