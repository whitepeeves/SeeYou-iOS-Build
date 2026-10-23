// Simple local database stored in localStorage for offline demo user
const LocalDB = (function () {
    const PUBLICATIONS_KEY = 'local_publicaciones_v1';
    const USERS_KEY = 'local_usuarios_v1';

    function _read(key) {
        try {
            const v = localStorage.getItem(key);
            return v ? JSON.parse(v) : [];
        } catch (e) {
            console.error('LocalDB read error', e);
            return [];
        }
    }

    function _write(key, val) {
        try {
            localStorage.setItem(key, JSON.stringify(val));
            return true;
        } catch (e) {
            console.error('LocalDB write error', e);
            return false;
        }
    }

    function initDemoUser() {
        const users = _read(USERS_KEY);
        const exists = users.find(u => u.telefono === '111111111');
        if (!exists) {
            const demo = {
                id: 'local_111111111',
                usuario: 'demo_offline',
                telefono: '111111111',
                contrasena: '1',
                foto: '',
                verificado: true,
                display_name: 'Usuario Demo (Offline)'
            };
            users.push(demo);
            _write(USERS_KEY, users);
        }
    }

    function login(telefono, contrasena) {
        const users = _read(USERS_KEY);
        const u = users.find(x => x.telefono === telefono && x.contrasena === contrasena);
        if (!u) return { error: 'Credenciales inválidas (local)' };
        return { user: u };
    }

    function savePublication(pub) {
        const pubs = _read(PUBLICATIONS_KEY);
        const id = 'lp_' + Date.now();
        const authorName = localStorage.getItem('current_user') || localStorage.getItem('current_user_name') || localStorage.getItem('current_user_display_name') || '';
        const authorAvatar = localStorage.getItem('current_user_foto') || '';
        const obj = Object.assign({
            id,
            createdAt: new Date().toISOString(),
            author: authorName,
            usuario: authorName,
            authorAvatar,
            foto: authorAvatar
        }, pub);
        pubs.unshift(obj);
        _write(PUBLICATIONS_KEY, pubs);
        return obj;
    }

    function getFeedForUser(userId) {
        const pubs = _read(PUBLICATIONS_KEY);
        return pubs.filter(p => p.userId === userId || p.visibility === 'public' || true).slice(0, 200);
    }

    function getUserPublications(userId) {
        const pubs = _read(PUBLICATIONS_KEY);
        return pubs.filter(p => p.userId === userId);
    }

    function getUser(id) {
        const users = _read(USERS_KEY);
        return users.find(u => u.id === id || u.telefono === id || u.usuario === id || u.username === id) || null;
    }

    function updateUser(id, newData) {
        const users = _read(USERS_KEY);
        const index = users.findIndex(u => u.id === id || u.telefono === id);
        if (index === -1) {
            return { error: 'Usuario no encontrado' };
        }
        users[index] = { ...users[index], ...newData };
        _write(USERS_KEY, users);
        return { message: 'Usuario actualizado', user: users[index] };
    }

    function clearAll() {
        _write(PUBLICATIONS_KEY, []);
        _write(USERS_KEY, []);
    }

    return {
        initDemoUser,
        login,
        savePublication,
        getFeedForUser,
        getUserPublications,
        getUser,
        updateUser,
        clearAll
    };
})();

/* Export for UMD-like usage in pages */
window.LocalDB = LocalDB;
