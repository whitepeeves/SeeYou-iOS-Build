// SeeYou · Registro en 3 pasos: datos -> verificación por correo -> foto de perfil
document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const card = $('reg-card');
    const steps = Array.from(card.querySelectorAll('.auth-step'));
    const dots = Array.from(document.querySelectorAll('#reg-progress .dot'));
    const STEP_ORDER = ['form', 'verify', 'photo'];

    const btnRegister = $('btn-register');
    const modalCodeInput = $('modal-verify-code');
    const btnModalVerify = $('btn-modal-verify');
    const btnModalCancel = $('btn-modal-cancel');
    const btnResend = $('btn-resend-code');
    const verifyError = $('verify-error');

    const currentRegistration = { email: '', username: '', phone: '', verified: false, password: '', foto: null, visibility: 'public' };

    // Mientras no se puedan mandar SMS, el admin puede desactivar la obligatoriedad del
    // teléfono desde el panel: entonces no se pide ni se manda al registrarse.
    let PHONE_REQUIRED = true;
    (async () => {
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/public-settings`);
            const data = await res.json();
            PHONE_REQUIRED = data.phone_required !== false;
        } catch (e) { PHONE_REQUIRED = true; }
        const phoneGroup = $('phone') && $('phone').closest('.input-group');
        if (!PHONE_REQUIRED && phoneGroup) {
            phoneGroup.style.display = 'none';
            $('phone').required = false;
        }
    })();

    // ---------- Utilidades ----------
    function showToast(message) {
        const toast = $('toast-notification');
        const toastMessage = $('toast-message');
        if (toast && toastMessage) {
            toastMessage.textContent = message;
            toast.classList.add('show');
            clearTimeout(showToast._t);
            showToast._t = setTimeout(() => toast.classList.remove('show'), 3200);
        }
    }

    function setLoading(btn, loading) {
        if (!btn) return;
        btn.classList.toggle('is-loading', loading);
        btn.disabled = loading;
    }

    function goToStep(name) {
        const from = steps.findIndex((s) => s.classList.contains('is-active'));
        const to = STEP_ORDER.indexOf(name);
        steps.forEach((s) => s.classList.remove('is-active', 'from-back'));
        const target = steps.find((s) => s.dataset.step === name);
        if (!target) return;
        target.classList.add('is-active');
        if (to < from) target.classList.add('from-back');
        dots.forEach((d, i) => {
            d.classList.toggle('active', i === to);
            d.classList.toggle('done', i < to);
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ---------- Paso 2: código por correo ----------
    let resendTimer = null;
    function startResendCooldown(seconds = 30) {
        clearInterval(resendTimer);
        let left = seconds;
        btnResend.disabled = true;
        btnResend.textContent = `Reenviar código (${left}s)`;
        resendTimer = setInterval(() => {
            left -= 1;
            if (left <= 0) {
                clearInterval(resendTimer);
                btnResend.disabled = false;
                btnResend.textContent = 'Reenviar código';
            } else {
                btnResend.textContent = `Reenviar código (${left}s)`;
            }
        }, 1000);
    }

    function setVerifyError(msg) {
        verifyError.textContent = msg || '';
        modalCodeInput.classList.toggle('invalid', !!msg);
    }

    async function requestVerificationCode(email, { resend = false } = {}) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/register/request-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, username: currentRegistration.username, phone: currentRegistration.phone })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'No se pudo enviar el código.');
            }

            currentRegistration.email = email;
            $('verify-email').textContent = email;
            showToast(resend ? 'Te hemos enviado un nuevo código.' : 'Se ha enviado un código de verificación a tu correo.');
            modalCodeInput.value = '';
            setVerifyError('');
            goToStep('verify');
            startResendCooldown(30);
            setTimeout(() => modalCodeInput.focus(), 350);
            return true;
        } catch (error) {
            showToast(error.message || 'No se pudo enviar el código.');
            return false;
        }
    }

    let verifying = false;
    async function verifyCode() {
        if (verifying) return;
        const code = modalCodeInput.value.trim();
        if (!/^\d{6}$/.test(code)) {
            setVerifyError('El código debe contener 6 dígitos.');
            return;
        }

        verifying = true;
        setLoading(btnModalVerify, true);
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/register/verify-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentRegistration.email, code })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Código incorrecto.');
            }

            currentRegistration.verified = true;
            setVerifyError('');
            showToast('Correo verificado correctamente.');
            goToStep('photo');
        } catch (error) {
            setVerifyError(error.message || 'Error al verificar el código.');
        } finally {
            verifying = false;
            setLoading(btnModalVerify, false);
        }
    }

    modalCodeInput.addEventListener('input', () => {
        modalCodeInput.value = modalCodeInput.value.replace(/\D/g, '').slice(0, 6);
        setVerifyError('');
        if (modalCodeInput.value.length === 6) verifyCode();
    });
    modalCodeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') verifyCode(); });
    btnModalVerify.addEventListener('click', verifyCode);
    btnResend.addEventListener('click', async () => {
        btnResend.disabled = true;
        const ok = await requestVerificationCode(currentRegistration.email, { resend: true });
        if (!ok) { btnResend.disabled = false; }
    });
    btnModalCancel.addEventListener('click', () => {
        clearInterval(resendTimer);
        modalCodeInput.value = '';
        setVerifyError('');
        currentRegistration.verified = false;
        goToStep('form');
    });

    // ---------- Paso 3: foto de perfil (recorte circular propio, sin librerías) ----------
    const frame = $('avatar-frame');
    const canvas = $('avatar-canvas');
    const ctx = canvas.getContext('2d');
    const zoomInput = $('avatar-zoom');
    const adjust = $('avatar-adjust');
    const hint = $('avatar-hint');
    const avatarInput = $('avatar-input');
    const btnPick = $('btn-pick-photo');
    const btnPickLabel = $('btn-pick-photo-label');
    const btnContinue = $('btn-photo-continue');
    const btnSkip = $('btn-photo-skip');
    const MAX_FILE_MB = 15;
    const OUTPUT_SIZE = 512;

    const photo = { img: null, zoom: 1, x: 0, y: 0, baseScale: 1 };

    function clampOffsets() {
        const s = photo.baseScale * photo.zoom;
        const maxX = Math.max(0, (photo.img.width * s - canvas.width) / 2);
        const maxY = Math.max(0, (photo.img.height * s - canvas.height) / 2);
        photo.x = Math.min(maxX, Math.max(-maxX, photo.x));
        photo.y = Math.min(maxY, Math.max(-maxY, photo.y));
    }

    function drawTo(targetCtx, size) {
        const k = size / canvas.width;
        const s = photo.baseScale * photo.zoom * k;
        const w = photo.img.width * s;
        const h = photo.img.height * s;
        targetCtx.fillStyle = '#fff';
        targetCtx.fillRect(0, 0, size, size);
        targetCtx.drawImage(photo.img, size / 2 - w / 2 + photo.x * k, size / 2 - h / 2 + photo.y * k, w, h);
    }

    function render() {
        if (!photo.img) return;
        clampOffsets();
        drawTo(ctx, canvas.width);
    }

    function loadFile(file) {
        if (!file) return;
        if (!/^image\//.test(file.type)) {
            showToast('Selecciona un archivo de imagen.');
            return;
        }
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
            showToast(`La imagen es demasiado grande (máx. ${MAX_FILE_MB} MB).`);
            return;
        }

        const useBitmap = typeof createImageBitmap === 'function';
        const decode = useBitmap
            ? createImageBitmap(file, { imageOrientation: 'from-image' })
            : new Promise((resolve, reject) => {
                const url = URL.createObjectURL(file);
                const img = new Image();
                img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
                img.onerror = reject;
                img.src = url;
            });

        decode.then((img) => {
            photo.img = img;
            photo.zoom = 1;
            photo.x = 0;
            photo.y = 0;
            photo.baseScale = Math.max(canvas.width / img.width, canvas.height / img.height);
            zoomInput.value = '1';
            frame.classList.add('has-photo');
            adjust.classList.add('show');
            hint.textContent = 'Arrastra para encuadrar y usa el zoom para ajustar.';
            btnPickLabel.textContent = 'Cambiar foto';
            btnContinue.disabled = false;
            render();
        }).catch(() => {
            showToast('No se pudo leer esa imagen. Prueba con otra (JPG o PNG).');
        });
    }

    btnPick.addEventListener('click', () => avatarInput.click());
    frame.addEventListener('click', () => { if (!photo.img) avatarInput.click(); });
    avatarInput.addEventListener('change', (e) => {
        loadFile(e.target.files && e.target.files[0]);
        avatarInput.value = '';
    });

    zoomInput.addEventListener('input', () => {
        photo.zoom = parseFloat(zoomInput.value) || 1;
        render();
    });

    // Arrastrar la foto dentro del círculo (ratón y táctil)
    let drag = null;
    frame.addEventListener('pointerdown', (e) => {
        if (!photo.img) return;
        frame.setPointerCapture(e.pointerId);
        drag = { x: e.clientX, y: e.clientY, ox: photo.x, oy: photo.y };
    });
    frame.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const ratio = canvas.width / frame.clientWidth;
        photo.x = drag.ox + (e.clientX - drag.x) * ratio;
        photo.y = drag.oy + (e.clientY - drag.y) * ratio;
        render();
    });
    ['pointerup', 'pointercancel'].forEach((ev) => frame.addEventListener(ev, () => { drag = null; }));
    frame.addEventListener('wheel', (e) => {
        if (!photo.img) return;
        e.preventDefault();
        const z = Math.min(3, Math.max(1, photo.zoom - e.deltaY * 0.002));
        photo.zoom = z;
        zoomInput.value = String(z);
        render();
    }, { passive: false });

    function exportPhoto() {
        if (!photo.img) return null;
        const out = document.createElement('canvas');
        out.width = out.height = OUTPUT_SIZE;
        drawTo(out.getContext('2d'), OUTPUT_SIZE);
        return out.toDataURL('image/jpeg', 0.86);
    }

    // ---------- Crear cuenta (tras verificar el correo y decidir la foto) ----------
    let finishing = false;
    async function completeRegistration(foto, sourceBtn) {
        if (finishing) return;
        finishing = true;
        [btnContinue, btnSkip, btnPick].forEach((b) => { b.disabled = true; });
        setLoading(sourceBtn === btnSkip ? btnContinue : sourceBtn, true);
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: currentRegistration.username,
                    username: currentRegistration.username,
                    phone: currentRegistration.phone,
                    email: currentRegistration.email,
                    correo: currentRegistration.email,
                    password: currentRegistration.password,
                    contrasena: currentRegistration.password,
                    visibility: currentRegistration.visibility,
                    visibilidad: currentRegistration.visibility,
                    avatar: foto,
                    foto: foto,
                    inviteCode: ((document.getElementById('invite-code') || {}).value || '').trim()
                })
            });

            const data = await response.json();
            if (!response.ok) {
                showToast(`Error: ${data.error || 'No se pudo crear la cuenta.'}`);
                // Si el problema son los datos (usuario/teléfono ya en uso) volvemos al formulario
                currentRegistration.verified = false;
                goToStep('form');
                return;
            }

            const registeredUser = data.user || data || {};
            const displayName = registeredUser.name || registeredUser.display_name || registeredUser.displayName || currentRegistration.username;
            // Si el servidor no devuelve la foto, se usa la que acaba de elegir el usuario (así siempre se ve en su perfil)
            let userFoto = registeredUser.foto || registeredUser.avatar || registeredUser.photo || foto || '';
            let userId = registeredUser.id || data.id || '';

            // Inicio de sesión automático: obtiene el token igual que el login normal (sin guardar la contraseña)
            try {
                const fp = localStorage.getItem('seeYou_device_fingerprint') || `${navigator.userAgent}||${navigator.platform}`;
                const loginRes = await fetch(`${CONFIG.API_BASE_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        telefono: currentRegistration.phone,
                        contrasena: currentRegistration.password,
                        deviceFingerprint: fp,
                        remember: true,
                        allowCookies: localStorage.getItem('seeYou_cookie_consent') === 'accepted'
                    })
                });
                const loginData = await loginRes.json();
                if (loginRes.ok && loginData.token) {
                    localStorage.setItem('seeYou_auth_token', loginData.token);
                    const u = loginData.user || {};
                    userFoto = u.foto || u.avatar || userFoto;
                    userId = u.id || loginData.id || userId;
                    localStorage.setItem('seeYou_session_persistent', '1');
                }
            } catch (e) {
                console.warn('[SeeYou] Login automático tras el registro no disponible', e);
            }

            currentRegistration.password = '';
            localStorage.setItem('current_user', displayName);
            localStorage.setItem('current_user_name', displayName);
            localStorage.setItem('current_user_id', userId);
            localStorage.setItem('current_user_phone', currentRegistration.phone);
            localStorage.setItem('current_user_verified', 'false');
            localStorage.setItem('current_user_foto', userFoto);
            if (window.SeeYouSession) SeeYouSession.start(true);
            showToast('¡Cuenta creada! Bienvenido a SeeYou.');
            setTimeout(() => { window.location.href = 'home.html'; }, 450);
        } catch (error) {
            showToast('Error de conexión con el servidor');
        } finally {
            finishing = false;
            setLoading(btnContinue, false);
            btnContinue.disabled = !photo.img;
            btnSkip.disabled = false;
            btnPick.disabled = false;
        }
    }

    btnContinue.addEventListener('click', () => completeRegistration(exportPhoto(), btnContinue));
    btnSkip.addEventListener('click', () => completeRegistration(null, btnSkip));

    // ---------- Paso 1: formulario ----------
    function selectVisibility(type) {
        const optPublicBtn = $('opt-public');
        const optPrivateBtn = $('opt-private');
        const publicInput = document.querySelector('input[name="visibility"][value="public"]');
        const privateInput = document.querySelector('input[name="visibility"][value="private"]');

        if (type === 'private') {
            optPrivateBtn.classList.add('active');
            optPublicBtn.classList.remove('active');
            privateInput.checked = true;
            currentRegistration.visibility = 'private';
        } else {
            optPublicBtn.classList.add('active');
            optPrivateBtn.classList.remove('active');
            publicInput.checked = true;
            currentRegistration.visibility = 'public';
        }
    }

    $('opt-public').addEventListener('click', () => selectVisibility('public'));
    $('opt-private').addEventListener('click', () => selectVisibility('private'));

    const emailInput = $('email');
    const fields = {
        username: {
            input: $('username'),
            error: $('username-error'),
            validate: (val) => val.trim() !== '' ? '' : 'El nombre de usuario es obligatorio'
        },
        email: {
            input: emailInput,
            error: $('email-error'),
            validate: (val) => /^\S+@\S+\.\S+$/.test((val || '').trim()) ? '' : 'Introduce un correo electrónico válido'
        },
        password: {
            input: $('password'),
            error: $('password-error'),
            validate: (val) => val.length >= 8 ? '' : 'La contraseña debe tener al menos 8 caracteres'
        },
        phone: {
            input: $('phone'),
            prefix: { get value() { return $('phone-prefix-container-value').value; } },
            error: $('phone-error'),
            validate: (val) => {
                if (val.trim() === '') return 'El teléfono es obligatorio';
                if (!/^\d+$/.test(val.trim())) return 'Solo se permiten números';
                if (val.trim().length < 6) return 'El número es demasiado corto';
                return '';
            }
        }
    };

    function validateField(fieldName) {
        const field = fields[fieldName];
        const errorMsg = field.validate(field.input.value);

        if (errorMsg) {
            field.error.textContent = errorMsg;
            field.error.classList.add('visible');
            field.input.classList.add('invalid');
            return false;
        }
        field.error.textContent = '';
        field.error.classList.remove('visible');
        field.input.classList.remove('invalid');
        return true;
    }

    Object.keys(fields).forEach((key) => {
        fields[key].input.addEventListener('blur', () => validateField(key));
        fields[key].input.addEventListener('input', () => {
            fields[key].input.classList.remove('invalid');
            fields[key].error.textContent = '';
            fields[key].error.classList.remove('visible');
        });
    });

    btnRegister.addEventListener('click', async (e) => {
        e.preventDefault();

        let isValid = true;
        Object.keys(fields).forEach((key) => {
            if (key === 'phone' && !PHONE_REQUIRED) return;
            if (!validateField(key)) isValid = false;
        });
        if (!isValid) return;

        const email = emailInput.value.trim().toLowerCase();
        currentRegistration.email = email;
        currentRegistration.username = fields.username.input.value;
        currentRegistration.phone = PHONE_REQUIRED ? (fields.phone.prefix.value + fields.phone.input.value.trim()) : '';
        currentRegistration.password = fields.password.input.value;
        currentRegistration.visibility = document.querySelector('input[name="visibility"]:checked').value;
        currentRegistration.verified = false;

        setLoading(btnRegister, true);
        try {
            await requestVerificationCode(email);
        } finally {
            setLoading(btnRegister, false);
        }
    });
});
