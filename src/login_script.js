document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const btnLogin = document.getElementById('btn-login');

    const hasSession = localStorage.getItem('current_user') &&
        localStorage.getItem('current_user_id') &&
        (localStorage.getItem('seeYou_auth_token') || localStorage.getItem('seeYou_session_persistent') === '1');
    if (hasSession) {
        window.location.replace('home.html');
        return;
    }

    btnLogin.addEventListener('click', async (e) => {
        e.preventDefault();

        const prefix = document.getElementById('phone-prefix-container-value').value;
        const requiredLength = parseInt(document.getElementById('phone-prefix-container-length').value || "0");
        const phoneDigits = document.getElementById('telefono').value.trim();
        const id_telefono = prefix + phoneDigits;
        const contrasena = document.getElementById('password').value;

        // Validación rápida
        const cleanDigits = phoneDigits.replace(/\D/g, '');
        if (requiredLength > 0 && cleanDigits.length !== requiredLength) {
            const errorSpan = document.getElementById('telefono-error');
            errorSpan.textContent = `Este país requiere ${requiredLength} dígitos`;
            return;
        }

        if (!id_telefono || !contrasena) {
            alert("Por favor, rellena todos los campos");
            return;
        }

        if (CONFIG.USE_MOCK_DB) {
            const data = MockDB.login(id_telefono, contrasena);
            if (data.error) {
                alert(`Error: ${data.error}`);
            } else {
                localStorage.setItem('current_user', data.user.usuario);
                window.location.href = 'home.html';
            }
            return;
        }

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telefono: id_telefono, contrasena })
            });

            const data = await response.json();

            if (response.ok) {
                const backendUser = data.user || data || {};
                const currentUserName = backendUser.name || backendUser.usuario || backendUser.username || backendUser.displayName || '';
                const currentUserId = backendUser.id || backendUser.userId || backendUser.phone || '';
                const currentUserVerified = backendUser.verificado || backendUser.isVerified || 'false';
                const currentUserFoto = backendUser.foto || backendUser.avatar || backendUser.photo || '';

                localStorage.setItem('current_user', currentUserName);
                localStorage.setItem('current_user_id', currentUserId);
                localStorage.setItem('current_user_verified', currentUserVerified);
                localStorage.setItem('current_user_foto', currentUserFoto);
                localStorage.setItem('seeYou_session_persistent', '1');
                if (data.token) localStorage.setItem('seeYou_auth_token', data.token);
                window.location.href = 'home.html';
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (error) {
            alert("No se pudo conectar con el servidor. ¿Está encendido?");
        }
    });
});
