document.addEventListener('DOMContentLoaded', () => {
        const form = document.querySelector('.register-form');
        const btnRegister = document.getElementById('btn-register');
        const btnNext1 = document.getElementById('btn-next-1');
        const btnNext2 = document.getElementById('btn-next-2');
        const btnBack2 = document.getElementById('btn-back-2');
        const btnBack3 = document.getElementById('btn-back-3');
        const step1 = document.getElementById('step-1');
        const step2 = document.getElementById('step-2');
        const step3 = document.getElementById('step-3');
        const headerTitle = document.getElementById('header-title');
        const headerSubtitle = document.getElementById('header-subtitle');
        const loginLink = document.getElementById('login-link-container');
    
    document.getElementById('opt-public').onclick = () => {
        selectVisibility('public');
        document.getElementById('opt-public').classList.add('active');
        document.getElementById('opt-private').classList.remove('active');
        document.querySelector('input[name="visibility"][value="public"]').checked = true;
    };
    document.getElementById('opt-private').onclick = () => {
        selectVisibility('private');
        document.getElementById('opt-private').classList.add('active');
        document.getElementById('opt-public').classList.remove('active');
        document.querySelector('input[name="visibility"][value="private"]').checked = true;
    };

    // Lógica de la foto de Perfil y Cropper
    let cropper = null;
    let croppedImageBase64 = null;

    const avatarInput = document.getElementById('avatar-input');
    const cropperModal = document.getElementById('cropper-modal');
    const cropperImg = document.getElementById('cropper-img');

    avatarInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            cropperImg.src = event.target.result;
            cropperModal.style.display = 'flex';
            if (cropper) cropper.destroy();
            cropper = new Cropper(cropperImg, {
                aspectRatio: 1,
                viewMode: 1,
                autoCropArea: 1,
            });
        };
        reader.readAsDataURL(file);
    };

    window.closeCropper = () => {
        cropperModal.style.display = 'none';
        avatarInput.value = '';
        if (cropper) cropper.destroy();
    };

    window.confirmCrop = () => {
        const canvas = cropper.getCroppedCanvas({ width: 400, height: 400 });
        croppedImageBase64 = canvas.toDataURL('image/jpeg', 0.8);
        
        document.getElementById('avatar-preview-img').src = croppedImageBase64;
        document.getElementById('avatar-preview-img').style.display = 'block';
        document.getElementById('avatar-placeholder-icon').style.display = 'none';
        
        closeCropper();
    };

    const fields = {
        username: {
            input: document.getElementById('username'),
            error: document.getElementById('username-error'),
            validate: (val) => val.trim() !== "" ? "" : "El nombre de usuario es obligatorio"
        },
        password: {
            input: document.getElementById('password'),
            error: document.getElementById('password-error'),
            validate: (val) => val.length >= 8 ? "" : "La contraseña debe tener al menos 8 caracteres"
        },
        phone: {
            input: document.getElementById('phone'),
            prefix: { get value() { return document.getElementById('phone-prefix-container-value').value; } },
            error: document.getElementById('phone-error'),
            validate: (val) => {
                if (val.trim() === "") return "El teléfono es obligatorio";
                if (!/^\d+$/.test(val.trim())) return "Solo se permiten números";
                if (val.trim().length < 6) return "El número es demasiado corto";
                return "";
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
        } else {
            field.error.textContent = "";
            field.error.classList.remove('visible');
            field.input.classList.remove('invalid');
            return true;
        }
    }

    Object.keys(fields).forEach(key => {
        fields[key].input.addEventListener('blur', () => validateField(key));
        fields[key].input.addEventListener('input', () => {
            fields[key].input.classList.remove('invalid');
            fields[key].error.classList.remove('visible');
        });
    });

    // Navigation Step 1 -> Step 2
    if (btnNext1) {
        btnNext1.addEventListener('click', () => {
            let isValid = true;
            // Solo validar campos del paso 1
            ['username', 'password', 'phone'].forEach(key => {
                if (!validateField(key)) isValid = false;
            });

            if (isValid) {
                step1.style.display = 'none';
                step2.style.display = 'block';
                // La visibilidad se preguntará en el paso 3, el paso 2 es la foto
                headerTitle.textContent = "Foto de perfil";
                headerSubtitle.textContent = "Añade una foto para que te reconozcan";
                loginLink.style.display = 'none';
            }
        });
    }

    // Navigation Step 2 -> Step 3
    if (btnNext2) {
        btnNext2.addEventListener('click', () => {
            step2.style.display = 'none';
            step3.style.display = 'block';
            headerTitle.textContent = "Visibilidad";
            headerSubtitle.textContent = "¿Quién puede ver tus publicaciones?";
        });
    }

    // Navigation Step 2 -> Step 1
    if (btnBack2) {
        btnBack2.addEventListener('click', () => {
            step2.style.display = 'none';
            step1.style.display = 'block';
            headerTitle.textContent = "Crear Cuenta";
            headerSubtitle.textContent = "Regístrate para comenzar";
            loginLink.style.display = 'block';
        });
    }

    // Navigation Step 3 -> Step 2
    if (btnBack3) {
        btnBack3.addEventListener('click', () => {
            step3.style.display = 'none';
            step2.style.display = 'block';
            headerTitle.textContent = "Foto de perfil";
            headerSubtitle.textContent = "Añade una foto para que te reconozcan";
        });
    }

    btnRegister.addEventListener('click', async (e) => {
        e.preventDefault();
        let isValid = true;
        Object.keys(fields).forEach(key => { if (!validateField(key)) isValid = false; });

        if (isValid) {
            const usuario = fields.username.input.value;
            const contrasena = fields.password.input.value;
            const prefix = fields.phone.prefix.value;
            const telefono = prefix + fields.phone.input.value.trim();
            const selectedVisibility = document.querySelector('input[name="visibility"]:checked');
            const visibilidad = selectedVisibility ? selectedVisibility.value : 'public';
            const foto = croppedImageBase64;

            try {
                const response = await fetch(`${CONFIG.API_BASE_URL}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usuario, contrasena, telefono, visibilidad, foto })
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('current_user', usuario);
                    localStorage.setItem('current_user_name', usuario);
                    localStorage.setItem('current_user_display_name', usuario);
                    localStorage.setItem('current_user_id', data.id);
                    localStorage.setItem('current_user_verified', 'false');
                    localStorage.setItem('current_user_foto', foto || '');
                    alert("¡Registro exitoso!");
                    window.location.href = 'home.html';
                } else {
                    alert(`Error: ${data.error}`);
                }
            } catch (error) {
                alert("Error de conexión con el servidor");
            }
        }
    });
});
