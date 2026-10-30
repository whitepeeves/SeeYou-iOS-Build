document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const btnLogin = document.getElementById('btn-login');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const backToLoginLink = document.getElementById('back-to-login-link');
    const loginFieldsWrapper = document.getElementById('login-fields-wrapper');
    const loginActionsWrapper = document.getElementById('login-actions-wrapper');
    const passwordRecoveryPanel = document.getElementById('password-recovery-panel');
    const recoverySteps = Array.from(document.querySelectorAll('.recovery-step'));
    const currentRecovery = { email: '', phone: '', username: '', name: '', resetToken: '' };
    const rememberInput = document.getElementById('remember-me');
    const isRemember = () => (rememberInput ? rememberInput.checked : true);

    const hasSavedSession = localStorage.getItem('current_user') && localStorage.getItem('current_user_id') && (
        localStorage.getItem('seeYou_auth_token') || localStorage.getItem('seeYou_session_persistent') === '1'
    );
    if (hasSavedSession) {
        window.location.replace('home.html');
        return;
    }

    // Mientras no se puedan mandar SMS, el admin puede desactivar la obligatoriedad del
    // teléfono desde el panel: entonces se entra con correo electrónico o usuario.
    let PHONE_REQUIRED = true;
    (async () => {
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/public-settings`);
            const data = await res.json();
            PHONE_REQUIRED = data.phone_required !== false;
        } catch (e) { PHONE_REQUIRED = true; }
        const phoneGroup = document.getElementById('login-phone-group');
        const identifierGroup = document.getElementById('login-identifier-group');
        const phoneInput = document.getElementById('telefono');
        const identifierInput = document.getElementById('login-identifier');
        if (!PHONE_REQUIRED) {
            if (phoneGroup) phoneGroup.style.display = 'none';
            if (identifierGroup) identifierGroup.style.display = '';
            if (phoneInput) phoneInput.required = false;
            if (identifierInput) identifierInput.required = true;
        }
    })();

    function showToast(message) {
        const toast = document.getElementById('toast-notification');
        const toastMessage = document.getElementById('toast-message');
        if (toast && toastMessage) {
            toastMessage.textContent = message;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 3000);
        }
    }

    function setLoginView(isRecoveryMode) {
        loginFieldsWrapper.style.display = isRecoveryMode ? 'none' : 'flex';
        loginActionsWrapper.style.display = isRecoveryMode ? 'none' : 'flex';
        passwordRecoveryPanel.style.display = isRecoveryMode ? 'block' : 'none';
    }

    function showRecoveryStep(stepName) {
        recoverySteps.forEach((step) => {
            step.style.display = step.dataset.recoveryStep === stepName ? 'block' : 'none';
        });
    }

    function resetRecoveryForm() {
        document.getElementById('recover-email').value = '';
        document.getElementById('recover-code').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-new-password').value = '';
        showRecoveryStep('email');
        currentRecovery.email = '';
        currentRecovery.phone = '';
        currentRecovery.username = '';
        currentRecovery.name = '';
    }

    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        setLoginView(true);
        showRecoveryStep('email');
        document.getElementById('recover-email').focus();
    });

    backToLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        setLoginView(false);
        resetRecoveryForm();
    });

    document.querySelectorAll('.toggle-password').forEach((toggleButton) => {
        toggleButton.addEventListener('click', () => {
            const targetId = toggleButton.dataset.target;
            const targetInput = document.getElementById(targetId);
            if (!targetInput) return;

            if (targetId === 'new-password') {
                const confirmInput = document.getElementById('confirm-new-password');
                const shouldShow = targetInput.type === 'password';
                targetInput.type = shouldShow ? 'text' : 'password';
                confirmInput.type = shouldShow ? 'text' : 'password';
                toggleButton.querySelector('span').textContent = shouldShow ? 'visibility' : 'visibility_off';
                toggleButton.setAttribute('aria-label', shouldShow ? CONFIG.translate('hide_password') : CONFIG.translate('show_password'));
                return;
            }

            const isHidden = targetInput.type === 'password';
            targetInput.type = isHidden ? 'text' : 'password';
            toggleButton.querySelector('span').textContent = isHidden ? 'visibility' : 'visibility_off';
            toggleButton.setAttribute('aria-label', isHidden ? CONFIG.translate('hide_password') : CONFIG.translate('show_password'));
        });
    });

    async function loginAfterReset(password) {
        // request-reset ya no devuelve datos del usuario (anti-enumeracion): se entra con el correo.
        const phone = currentRecovery.phone || currentRecovery.email;
        if (!phone) {
            setLoginView(false);
            resetRecoveryForm();
            return;
        }

        const fp = localStorage.getItem('seeYou_device_fingerprint') || `${navigator.userAgent || ''}||${navigator.platform || ''}`;
            try { if (!localStorage.getItem('seeYou_device_fingerprint')) localStorage.setItem('seeYou_device_fingerprint', fp); } catch (e) { /* sin storage: se recalcula cada vez, no es grave */ }
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                telefono: phone,
                contrasena: password,
                deviceFingerprint: fp,
                remember: true,
                allowCookies: localStorage.getItem('seeYou_cookie_consent') === 'accepted'
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || CONFIG.translate('lg_auto_fail', 'No se pudo iniciar sesión automáticamente.'));
        }

        if (data.token) {
            localStorage.setItem('seeYou_auth_token', data.token);
        }

        const backendUser = data.user || data || {};
        const currentUserName = backendUser.display_name || backendUser.displayName || backendUser.name || backendUser.usuario || backendUser.username || currentRecovery.name || currentRecovery.username || '';
        const currentUserId = backendUser.id || backendUser.userId || backendUser.phone || currentRecovery.phone || '';
        const currentUserVerified = backendUser.verificado || backendUser.isVerified || 'false';
        const currentUserFoto = backendUser.foto || backendUser.avatar || backendUser.photo || '';

        localStorage.setItem('current_user', currentUserName);
        localStorage.setItem('current_user_name', currentUserName);
        localStorage.setItem('current_user_id', currentUserId);
        localStorage.setItem('current_user_phone', backendUser.phone || currentRecovery.phone || '');
        localStorage.setItem('current_user_verified', currentUserVerified);
        localStorage.setItem('current_user_foto', currentUserFoto);
        localStorage.setItem('seeYou_session_persistent', '1');
        if (window.SeeYouSession) SeeYouSession.start(true);
        window.location.replace('home.html');
    }

    async function sendResetCode() {
        const email = document.getElementById('recover-email').value.trim();
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            showToast(CONFIG.translate('reset_email_required'));
            return;
        }

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/password/request-reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || CONFIG.translate('lg_mail_fail', 'No se pudo enviar el correo.'));
            }

            currentRecovery.email = email;
            currentRecovery.phone = data.user?.phone || data.user?.telefono || '';
            currentRecovery.username = data.user?.username || data.user?.usuario || '';
            currentRecovery.name = data.user?.name || '';
            showToast(CONFIG.translate('reset_sent'));
            showRecoveryStep('code');
        } catch (error) {
            showToast(error.message || CONFIG.translate('rg_send_fail', 'No se pudo enviar el código.'));
        }
    }

    async function verifyResetCode() {
        const code = document.getElementById('recover-code').value.trim();
        if (!/^\d{6}$/.test(code)) {
            showToast(CONFIG.translate('reset_code_invalid'));
            return;
        }

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/password/verify-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentRecovery.email, code })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || CONFIG.translate('rg_code_bad', 'Código incorrecto.'));
            }

            currentRecovery.resetToken = data.resetToken || '';
            showToast(CONFIG.translate('reset_verified'));
            showRecoveryStep('new-password');
        } catch (error) {
            showToast(error.message || CONFIG.translate('rg_verify_err', 'Error al verificar el código.'));
        }
    }

    async function saveNewPassword() {
        const password = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-new-password').value;

        if (!password || !confirmPassword) {
            showToast(CONFIG.translate('password_fields_required'));
            return;
        }

        if (password.length < 6) {
            showToast(CONFIG.translate('password_minimum'));
            return;
        }

        if (password !== confirmPassword) {
            showToast(CONFIG.translate('password_mismatch'));
            return;
        }

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/password/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentRecovery.email, password, resetToken: currentRecovery.resetToken || '' })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || CONFIG.translate('lg_pw_fail', 'No se pudo cambiar la contraseña.'));
            }

            if (data.user && (data.user.phone || data.user.telefono)) currentRecovery.phone = data.user.phone || data.user.telefono;
            showToast(CONFIG.translate('password_updated'));
            await loginAfterReset(password);
            resetRecoveryForm();
            setLoginView(false);
        } catch (error) {
            showToast(error.message || CONFIG.translate('lg_pw_save_err', 'Error al guardar la contraseña.'));
        }
    }

    document.getElementById('btn-send-reset-code').addEventListener('click', sendResetCode);
    document.getElementById('btn-verify-code').addEventListener('click', verifyResetCode);
    document.getElementById('btn-save-new-password').addEventListener('click', saveNewPassword);

    // Como los pasos de recuperacion viven dentro del mismo <form> que el login,
    // al pulsar Enter el navegador dispara el submit del boton "btn-login" (es el
    // unico type="submit"), saltandose el paso de recuperacion que se este viendo.
    // Interceptamos Enter en cada campo para que llame a la accion correcta.
    function onRecoveryEnter(action) {
        return (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                action();
            }
        };
    }
    document.getElementById('recover-email').addEventListener('keydown', onRecoveryEnter(sendResetCode));
    document.getElementById('recover-code').addEventListener('keydown', onRecoveryEnter(verifyResetCode));
    document.getElementById('new-password').addEventListener('keydown', onRecoveryEnter(saveNewPassword));
    document.getElementById('confirm-new-password').addEventListener('keydown', onRecoveryEnter(saveNewPassword));

    async function performLogin() {
        const contrasena = document.getElementById('password').value;
        let loginIdentifier;

        if (PHONE_REQUIRED) {
            const prefix = document.getElementById('phone-prefix-container-value').value;
            const requiredLength = parseInt(document.getElementById('phone-prefix-container-length').value || "0");
            const phoneDigits = document.getElementById('telefono').value.trim();
            const id_telefono = prefix + phoneDigits;

            // Validación rápida
            const cleanDigits = phoneDigits.replace(/\D/g, '');
            if (requiredLength > 0 && cleanDigits.length !== requiredLength) {
                const errorSpan = document.getElementById('telefono-error');
                errorSpan.textContent = CONFIG.translate('phone_digits_error').replace('{{digits}}', requiredLength);
                return;
            }
            loginIdentifier = id_telefono;
        } else {
            loginIdentifier = (document.getElementById('login-identifier').value || '').trim();
        }

        if (!loginIdentifier || !contrasena) {
            showToast(CONFIG.translate('fill_fields'));
            return;
        }

        if (CONFIG.USE_MOCK_DB) {
            const data = MockDB.login(id_telefono, contrasena);
            if (data.error) {
                showToast(`Error: ${data.error}`);
            } else {
                localStorage.setItem('current_user', data.user.usuario);
                window.location.replace('home.html');
            }
            return;
        }

        async function tryLoginWithUrl(serverUrl) {
            const fp = localStorage.getItem('seeYou_device_fingerprint') || `${navigator.userAgent || ''}||${navigator.platform || ''}`;
            try { if (!localStorage.getItem('seeYou_device_fingerprint')) localStorage.setItem('seeYou_device_fingerprint', fp); } catch (e) { /* sin storage: se recalcula cada vez, no es grave */ }
            const response = await fetch(`${serverUrl}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ identifier: loginIdentifier, contrasena, deviceFingerprint: fp, remember: isRemember(), allowCookies: localStorage.getItem('seeYou_cookie_consent') === 'accepted' })
            });
            // La respuesta puede no ser JSON (p. ej. un 429 "rate limited" del servidor saturado)
            const raw = await response.text();
            let data = {};
            try { data = JSON.parse(raw); } catch (e) { data = {}; }
            if (response.ok && data.token) {
                localStorage.setItem('seeYou_auth_token', data.token);
            }
            return { response, data };
        }

        try {
            const serverUrl = CONFIG.API_BASE_URL;
            console.log('[SeeYou] login request to', serverUrl);
            let { response, data } = await tryLoginWithUrl(serverUrl);

            // Servidor saturado o en mantenimiento: no es un problema de conexión del usuario
            if (response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504) {
                showToast(response.status === 429
                    ? CONFIG.translate('lg_rate', 'El servidor está recibiendo demasiadas peticiones. Espera un minuto e inténtalo de nuevo.')
                    : CONFIG.translate('lg_down', 'El servidor no está disponible ahora mismo. Inténtalo de nuevo en unos minutos.'));
                return;
            }

            if (!response.ok && serverUrl !== CONFIG.DEFAULT_SERVER_URL) {
                if (response.status === 400 || response.status === 401) {
                    showToast(`Error: ${data.error || CONFIG.translate('invalid_credentials')}`);
                    return;
                }

                console.warn('[SeeYou] login failed on saved server, retrying local fallback');
                CONFIG.setServerUrl(CONFIG.DEFAULT_SERVER_URL);
                ({ response, data } = await tryLoginWithUrl(CONFIG.DEFAULT_SERVER_URL));
            }

            if (response.ok) {
                // Pide al navegador que guarde/actualice la credencial de ESTA cuenta (si no, Chrome ofrecia la del panel admin).
                try {
                    if (isRemember() && window.PasswordCredential && navigator.credentials && navigator.credentials.store) {
                        const cred = new PasswordCredential({ id: loginIdentifier, password: contrasena, name: (data.user && (data.user.usuario || data.user.username)) || loginIdentifier });
                        await navigator.credentials.store(cred);
                    }
                } catch (e) { }
                localStorage.removeItem('offline_demo');
                // Evita que un feed cacheado de una sesión/cuenta anterior en este mismo
                // dispositivo se siga mostrando tras iniciar sesión (bug de "caché vieja").
                try {
                    localStorage.removeItem('seeyou_public_feed_cache_v2');
                    localStorage.removeItem('seeyou_public_feed_cache_v4');
                } catch (e) { }
                const backendUser = data.user || data || {};
                const currentUserName = backendUser.display_name || backendUser.displayName || backendUser.name || backendUser.usuario || backendUser.username || '';
                const currentUserId = backendUser.id || backendUser.userId || backendUser.phone || '';
                const currentUserVerified = backendUser.verificado || backendUser.isVerified || 'false';
                const currentUserFoto = backendUser.foto || backendUser.avatar || backendUser.photo || '';

                localStorage.setItem('current_user', currentUserName);
                localStorage.setItem('current_user_name', currentUserName);
                localStorage.setItem('current_user_id', currentUserId);
                localStorage.setItem('current_user_phone', backendUser.phone || '');
                localStorage.setItem('current_user_verified', currentUserVerified);
                localStorage.setItem('current_user_foto', currentUserFoto);
                localStorage.setItem('seeYou_session_persistent', '1');
                // Si el admin reactivó el teléfono obligatorio y esta cuenta no tiene uno
                // (se creó mientras estaba desactivado), se le pedirá justo tras entrar a Inicio.
                if (data.needsPhone) localStorage.setItem('seeYou_needs_phone', '1');
                else localStorage.removeItem('seeYou_needs_phone');
                // "Recordarme": sesión persistente (30 días) o solo mientras el navegador siga abierto
                if (window.SeeYouSession) SeeYouSession.start(isRemember());
                window.location.replace('home.html');
            } else {
                if (response.status === 400 || response.status === 401) {
                    showToast(`Error: ${data.error || CONFIG.translate('invalid_credentials')}`);
                    return;
                }
                if (serverUrl !== CONFIG.DEFAULT_SERVER_URL) {
                    showToast(CONFIG.translate('server_local_fallback'));
                    CONFIG.setServerUrl(CONFIG.DEFAULT_SERVER_URL);
                    setTimeout(() => showForceLocalPanel(), 1500);
                } else {
                    showToast(`Error: ${data.error || CONFIG.translate('server_unavailable')}`);
                    showForceLocalPanel();
                }
            }
        } catch (error) {
            console.error('[SeeYou] login fetch error', error);
            CONFIG.setServerUrl(CONFIG.DEFAULT_SERVER_URL);
            showForceLocalPanel();
        }
    }

    btnLogin.addEventListener('click', async (e) => {
        e.preventDefault();
        if (btnLogin.disabled) return;
        btnLogin.classList.add('is-loading');
        btnLogin.disabled = true;
        try {
            await performLogin();
        } finally {
            btnLogin.classList.remove('is-loading');
            btnLogin.disabled = false;
        }
    });

    // Panel de forzar servidor local
    function showForceLocalPanel() {
        // Si ya existe, no crear otro
        if (document.getElementById('force-local-panel')) {
            document.getElementById('force-local-panel').style.display = 'flex';
            return;
        }

        const panel = document.createElement('div');
        panel.id = 'force-local-panel';
        panel.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            padding: 20px;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 24px;
            text-align: center;
            max-width: 320px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        `;

        content.innerHTML = `
            <h2 style="color: #1B3A5C; margin-bottom: 16px; font-size: 18px;">${CONFIG.translate('connection_problem')}</h2>
            <p style="color: #49454F; font-size: 14px; margin-bottom: 24px;">
                ${CONFIG.translate('local_server_message')}
            </p>
            <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
                <button id="btn-retry-local" style="
                    background: #1B3A5C;
                    color: white;
                    border: none;
                    padding: 12px 20px;
                    border-radius: 8px;
                    font-weight: 700;
                    font-size: 14px;
                    cursor: pointer;
                    transition: background 0.3s;
                ">
                    🔄 ${CONFIG.translate('retry_local')}
                </button>
                <button id="btn-clear-and-retry" style="
                    background: #FF6B35;
                    color: white;
                    border: none;
                    padding: 12px 20px;
                    border-radius: 8px;
                    font-weight: 700;
                    font-size: 14px;
                    cursor: pointer;
                    transition: background 0.3s;
                ">
                    🧹 ${CONFIG.translate('clear_retry')}
                </button>
                <button id="btn-manual-server" style="
                    background: #795548;
                    color: white;
                    border: none;
                    padding: 12px 20px;
                    border-radius: 8px;
                    font-weight: 700;
                    font-size: 14px;
                    cursor: pointer;
                    transition: background 0.3s;
                ">
                    ⚙️ ${CONFIG.translate('manual_server')}
                </button>
            </div>
        `;

        panel.appendChild(content);
        document.body.appendChild(panel);

        // Evento para reintentar con servidor local
        document.getElementById('btn-retry-local').onclick = () => {
            panel.remove();
            window.location.reload();
        };

        // Evento para limpiar todo y reintentar
        document.getElementById('btn-clear-and-retry').onclick = async () => {
            localStorage.clear();
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (let reg of regs) await reg.unregister();
            }
            if ('caches' in window) {
                const keys = await caches.keys();
                for (let key of keys) await caches.delete(key);
            }
            CONFIG.setServerUrl(CONFIG.DEFAULT_SERVER_URL);
            panel.remove();
            alert(CONFIG.translate('clean_done'));
            window.location.reload();
        };

        // Evento para configurar servidor manual
        document.getElementById('btn-manual-server').onclick = () => {
            const url = prompt(CONFIG.translate('server_prompt'));
            if (url) {
                CONFIG.setServerUrl(url);
                panel.remove();
                window.location.reload();
            }
        };
    }
});
