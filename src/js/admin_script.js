/* ── Helpers de seguridad (XSS) ──────────────────────────────────────────────
 * El servidor guarda los textos ya con entidades (&lt; &#039;...). adminDecode() los pasa a texto plano
 * con DOMParser (documento inerte: no ejecuta scripts ni carga imagenes) y adminEsc() los escapa para
 * insertarlos en innerHTML o en atributos. Nunca se usa innerHTML para decodificar. */
function adminDecode(v) {
    try {
        const doc = new DOMParser().parseFromString('<!doctype html><body>' + String(v == null ? '' : v), 'text/html');
        return doc.body.textContent || '';
    } catch (e) { return String(v == null ? '' : v); }
}
function adminEsc(v) {
    return adminDecode(v).replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));
}
// Solo URLs http(s), data:image o rutas relativas dentro de src="…"
function adminSafeSrc(u) {
    const t = String(u == null ? '' : u).trim();
    if (!t) return '';
    if (/^https?:\/\//i.test(t) || /^data:image\/(png|jpe?g|gif|webp|heic|heif);base64,[A-Za-z0-9+\/=]+$/i.test(t)) return adminEsc(t);
    if (/^[\w\-./%+~@]+$/.test(t) && !t.includes('..')) return adminEsc(CONFIG.API_BASE_URL + '/' + t.replace(/^\/?/, ''));
    return '';
}

// --- CONFIGURACIÓN DE AUTH ADMIN (Simplicada) ---
const ADMIN_AUTH = {
    async login(username, password) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (response.ok && data.success) {
                return true;
            }
            return false;
        } catch (e) {
            console.error('Login error:', e);
            return false;
        }
    },
    async fetch(url, options = {}) {
        const fetchOptions = { ...options, credentials: 'include' };
        if (!fetchOptions.headers) fetchOptions.headers = {};
        return await fetch(url, fetchOptions);
    },
    async checkAuth() {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/admin/session`, { credentials: 'include' });
            return response.ok;
        } catch (e) {
            return false;
        }
    }
};

// --- Control de Vistas y Navegación con Persistencia ---
const navLinks = document.querySelectorAll('#admin-nav a');
const sections = document.querySelectorAll('.admin-section');
const pageTitle = document.getElementById('page-title');

function switchToSection(sectionId, save = true) {
    // Si no estamos autorizados, no hacer nada (el overlay ya bloquea)

    const link = Array.from(navLinks).find(l => l.getAttribute('data-section') === sectionId);
    if (!link) return;

    navLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');

    sections.forEach(s => s.style.display = 'none');
    const target = document.getElementById(sectionId);
    if (target) target.style.display = 'block';

    if (pageTitle) pageTitle.textContent = `Panel de ${link.textContent.trim()}`;

    if (sectionId === 'section-users') fetchUsers();
    if (sectionId === 'section-photos') fetchPhotos();
    if (sectionId === 'section-stats') fetchStats();
    if (sectionId === 'section-reports') fetchReports();
    if (sectionId === 'section-ads') {
        const fr = document.getElementById('ads-frame');
        if (fr && !fr.getAttribute('src')) fr.setAttribute('src', fr.getAttribute('data-src'));
    }
    if (sectionId === 'section-graph' && window.loadGraphSection) window.loadGraphSection();
    if (sectionId === 'section-feed' && window.loadFeedSection) window.loadFeedSection();

    if (save) localStorage.setItem('admin_last_section', sectionId);
}

navLinks.forEach(link => {
    link.onclick = (e) => {
        e.preventDefault();
        switchToSection(link.getAttribute('data-section'));
    };
});

async function fetchUsers() {
    try {
        const response = await ADMIN_AUTH.fetch(`${CONFIG.API_BASE_URL}/api/admin/users`);
        const users = await response.json();
        // Map server user shape (english keys) to admin panel expected spanish keys
        const mapped = (Array.isArray(users) ? users : []).map(u => ({
            id: u.id,
            usuario: u.usuario || u.username || u.name || '',
            telefono: u.telefono || u.phone || u.phoneNumber || '',
            email: u.email || '',
            // prefer explicit visible password, otherwise rawPassword or unhashed password if present
            contrasena_visible: undefined,
            contrasena: undefined,
            verificado: typeof u.verificado !== 'undefined' ? u.verificado : (u.isVerified || false),
            fecha_registro: u.fecha_registro || u.createdAt || u.created_at || new Date().toISOString(),
            streak_days: Number(u.streak_days ?? u.racha ?? 0) || 0,
            streak_source: u.streak_source || 'auto',
            accountStatus: u.accountStatus || null,
            // keep original data for advanced operations
            _raw: u
        }));

        updateDashboard(mapped);
    } catch (error) {
        console.error('Error cargando usuarios:', error);
        alert('Error al conectar con el servidor: ' + CONFIG.API_BASE_URL);
    }
}

async function showAdminLoginModal() {
    const modal = document.getElementById('admin-login-modal');
    const form = document.getElementById('admin-login-form');
    const usernameInput = document.getElementById('admin-login-user');
    const passwordInput = document.getElementById('admin-login-pass');
    const errorBox = document.getElementById('admin-login-error');
    const closeBtn = document.getElementById('close-admin-login');

    if (!modal || !form) return false;

    return new Promise((resolve) => {
        const hideModal = () => {
            modal.classList.remove('active');
            form.reset();
            if (errorBox) errorBox.style.display = 'none';
        };

        const finish = (result) => {
            hideModal();
            resolve(result);
        };

        if (closeBtn) {
            closeBtn.onclick = () => finish(false);
        }

        form.onsubmit = async (event) => {
            event.preventDefault();
            const username = (usernameInput?.value || '').trim();
            const password = (passwordInput?.value || '').trim();

            if (!username || !password) {
                if (errorBox) {
                    errorBox.textContent = 'Introduce usuario y contraseña';
                    errorBox.style.display = 'block';
                }
                return;
            }

            const loginSuccess = await ADMIN_AUTH.login(username, password);
            if (!loginSuccess) {
                if (errorBox) {
                    errorBox.textContent = 'Credenciales incorrectas';
                    errorBox.style.display = 'block';
                }
                return;
            }

            finish(true);
        };

        modal.classList.add('active');
        setTimeout(() => usernameInput?.focus(), 100);
    });
}

function updateDashboard(users) {
    if (!Array.isArray(users)) return;
    const tbody = document.getElementById('users-tbody');
    const totalUsersEl = document.getElementById('total-users');
    const verifiedUsersEl = document.getElementById('verified-users');

    if (tbody) tbody.innerHTML = '';
    let verifiedCount = 0;

    window.currentUsersList = users;

    users.forEach(user => {
        if (user.verificado) verifiedCount++;

        const plainPassword = '(oculta)'; // las contraseñas nunca se muestran (solo existe el hash)
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.innerHTML = `
            <td style="font-family: monospace; color: var(--primary); font-weight: 500;">${adminEsc(user.telefono)}</td>
            <td style="font-weight: 600; color: var(--text-main);">${adminEsc(user.usuario)}${user.accountStatus ? ' <span class="badge" style="background:' + (user.accountStatus.status === 'banned' ? '#fde2e1;color:#b3261e' : '#fff1d6;color:#8a5a00') + ';font-size:10px;padding:2px 6px;border-radius:8px;" title="' + adminEsc(user.accountStatus.reason || '') + '">' + (user.accountStatus.status === 'banned' ? 'BANEADA' : 'SUSPENDIDA' + (user.accountStatus.until ? ' hasta ' + new Date(user.accountStatus.until).toLocaleDateString() : '')) + '</span>' : ''}</td>
            <td style="color: var(--text-dim); font-size: 12px; word-break: break-all; min-width: 140px;">${user.email ? adminEsc(user.email) : '<span style=\'color:#cbd5e1;font-style:italic;\'>Sin correo</span>'}</td>
            <td style="font-family: monospace; color: var(--text-dim); font-size: 11px; word-break: break-all; min-width: 120px;">${adminEsc(plainPassword)}</td>
            <td style="color: var(--text-dim); text-align: center;">
                <span class="badge ${user.verificado ? 'badge-verified' : 'badge-pending'}" style="display:inline-flex; align-items:center; gap:4px;">
                    ${user.verificado ? 'Verificado' + CONFIG.getVerifiedBadge(16) : 'Pendiente'}
                </span>
            </td>
            <td style="color: var(--text-dim); opacity: 0.8;">${new Date(user.fecha_registro).toLocaleDateString()}</td>
            <td style="vertical-align: middle;">
                <div class="actions">
                    <span class="material-icons-round" data-act="verify" title="${user.verificado ? 'Quitar Verificación' : 'Verificar Usuario'}" style="color: ${user.verificado ? 'var(--success)' : 'var(--text-dim)'}; cursor: pointer;">verified</span>
                    <span class="material-icons-round" data-act="files" title="Ver fotos y perfil" style="color: var(--primary); cursor: pointer;">account_circle</span>
                    <span class="material-icons-round" data-act="files" title="Ver Archivos" style="color: var(--primary); cursor: pointer;">visibility</span>
                    <span class="material-icons-round" data-act="edit" title="Editar" style="cursor: pointer;">edit</span>
                    ${user.accountStatus
                        ? '<span class="material-icons-round" data-act="reinstate" title="Levantar sanción" style="color: var(--success); cursor: pointer;">lock_open</span>'
                        : '<span class="material-icons-round" data-act="suspend" title="Suspender cuenta" style="color: #b7791f; cursor: pointer;">pause_circle</span><span class="material-icons-round" data-act="ban" title="Banear cuenta" style="color: var(--danger); cursor: pointer;">gavel</span>'}
                    <span class="material-icons-round" data-act="delete" title="Eliminar" style="color: var(--danger); opacity: 0.8; cursor: pointer;">delete</span>
                </div>
            </td>
        `;
        // Sin onclick en linea: las acciones se resuelven aqui con los datos del usuario (nada se mete en JS dentro de HTML).
        row.onclick = (event) => {
            const act = event.target.closest('[data-act]');
            const uid = encodeURIComponent(user.id);
            if (act) {
                const a = act.getAttribute('data-act');
                if (a === 'verify') toggleVerification(uid);
                else if (a === 'files') viewFiles(uid, user.usuario || '');
                else if (a === 'edit') openEditModal(uid);
                else if (a === 'delete') deleteUser(uid);
                else if (a === 'suspend' || a === 'ban' || a === 'reinstate') sanctionUser(uid, a, user.usuario || '');
                return;
            }
            if (event.target.closest('.material-icons-round')) return;
            viewFiles(uid, user.usuario || '');
        };
        if (tbody) tbody.appendChild(row);
    });

    if (totalUsersEl) totalUsersEl.textContent = users.length;
    if (verifiedUsersEl) verifiedUsersEl.textContent = verifiedCount;
}

// Mostrar contraseña desencriptada en modal
async function showPassword(userId, userName) {
    try {
        const response = await ADMIN_AUTH.fetch(`${CONFIG.API_BASE_URL}/api/admin/user/${userId}/password`);
        const data = await response.json();
        
        if (data.password) {
            // Crear modal para mostrar contraseña
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 5000;
            `;
            
            const content = document.createElement('div');
            content.style.cssText = `
                background: white;
                padding: 24px;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                max-width: 400px;
                text-align: center;
            `;
            
            // Crear elementos de forma segura sin innerHTML
            const title = document.createElement('h3');
            title.style.cssText = 'margin-top: 0; color: var(--text-main);';
            title.textContent = `Contraseña de ${userName}`;
            
            const displayDiv = document.createElement('div');
            displayDiv.style.cssText = 'background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin: 16px 0; font-family: monospace; word-break: break-all; color: var(--primary); font-size: 16px; font-weight: 600;';
            displayDiv.textContent = data.password;
            
            const copyBtn = document.createElement('button');
            copyBtn.style.cssText = 'background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; margin-right: 10px;';
            copyBtn.textContent = '📋 Copiar';
            copyBtn.onclick = () => {
                const text = data.password;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(() => {
                        alert('¡Copiado al portapapeles!');
                    }).catch(() => {
                        alert('Contraseña: ' + text);
                    });
                } else {
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    alert('¡Copiado al portapapeles!');
                }
            };
            
            const closeBtn = document.createElement('button');
            closeBtn.style.cssText = 'background: var(--border); color: var(--text-main); border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px;';
            closeBtn.textContent = 'Cerrar';
            closeBtn.onclick = () => modal.remove();
            
            content.appendChild(title);
            content.appendChild(displayDiv);
            content.appendChild(copyBtn);
            content.appendChild(closeBtn);
            
            modal.appendChild(content);
            document.body.appendChild(modal);
            
            modal.onclick = (e) => {
                if (e.target === modal) modal.remove();
            };
        } else {
            alert('No se pudo obtener la contraseña');
        }
    } catch (e) {
        console.error('Error obteniendo contraseña:', e);
        alert('Error al obtener la contraseña');
    }
}

async function fetchPhotos() {
    try {
        const response = await ADMIN_AUTH.fetch(`${CONFIG.API_BASE_URL}/api/admin/media`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const allUploads = await response.json();
        const tbody = document.getElementById('photos-tbody');
        const totalPhotosEl = document.getElementById('total-photos');

        if (tbody) tbody.innerHTML = '';
        if (totalPhotosEl) {
            totalPhotosEl.textContent = Array.isArray(allUploads) ? allUploads.length : 0;
        }

        if (!Array.isArray(allUploads) || allUploads.length === 0) {
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 40px 16px;">No hay imágenes en la base de datos</td></tr>`;
            }
            return;
        }

        const categoryFilter = document.getElementById('media-category-filter');
        const searchInput = document.getElementById('media-search-input');
        const renderFiltered = () => {
            const category = categoryFilter?.value || 'all';
            const search = (searchInput?.value || '').toLowerCase().trim();
            const filteredUploads = allUploads.filter(up => {
                const matchesCategory = category === 'all' || up.category === category;
                const searchable = `${up.usuario || ''} ${up.conversation || ''} ${up.userId || ''}`.toLowerCase();
                return matchesCategory && (!search || searchable.includes(search));
            });
            if (tbody) tbody.innerHTML = '';
            if (totalPhotosEl) totalPhotosEl.textContent = filteredUploads.length;
            // Borrado en bloque: solo Tics (no fotos de perfil ni de chat) y solo si hay una busqueda activa.
            const bulkBtn = document.getElementById('media-bulk-delete');
            if (bulkBtn) {
                const tics = search ? filteredUploads.filter((u) => u.category === 'tic' && u.id) : [];
                bulkBtn.style.display = tics.length ? 'inline-block' : 'none';
                bulkBtn.textContent = `Eliminar los ${tics.length} Tics mostrados`;
                bulkBtn.onclick = async () => {
                    const word = prompt(`Vas a eliminar ${tics.length} Tics de "${search}" de forma definitiva.\nEscribe ELIMINAR para confirmar.`);
                    if (word !== 'ELIMINAR') return;
                    bulkBtn.disabled = true;
                    try {
                        let deleted = 0;
                        for (let i = 0; i < tics.length; i += 200) {
                            const ids = tics.slice(i, i + 200).map((u) => u.id);
                            const r = await ADMIN_AUTH.fetch(`${CONFIG.API_BASE_URL}/api/admin/publicaciones/bulk-delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
                            const d = await r.json().catch(() => ({}));
                            if (!r.ok) { alert('Error: ' + (d.message || r.status) + `\nEliminados antes del error: ${deleted}`); break; }
                            deleted += d.deleted || 0;
                        }
                        alert(`Eliminados: ${deleted}`);
                    } finally { bulkBtn.disabled = false; await fetchPhotos(); }
                };
            }
            if (!filteredUploads.length && tbody) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 40px 16px;">No hay imágenes que coincidan</td></tr>`;
                return;
            }
            filteredUploads.forEach(up => {
            try {
                const uploaderName = (up.usuario || "Desconocido").substring(0, 60);
                const uploadDate = new Date(up.date || up.createdAt || Date.now());
                const hidden = Boolean(up.hidden || up.isHidden);
                const row = document.createElement('tr');
                if (hidden) {
                    row.style.opacity = '0.55';
                    row.style.filter = 'grayscale(0.2)';
                }
                
                const photoCell = document.createElement('td');
                photoCell.style.width = '80px';
                photoCell.style.textAlign = 'center';
                const img = document.createElement('img');
                img.src = up.image || up.data || up.imageUrl || '';
                img.style.cssText = 'width: 44px; height: 70px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 1px solid #334155;';
                img.onerror = () => { img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="44" height="70"%3E%3Crect fill="%23ccc" width="44" height="70"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="10" fill="%23999"%3EError%3C/text%3E%3C/svg%3E'; };
                img.title = 'Haz clic para ver';
                img.onclick = () => previewFileForAdmin(up.image || up.data || up.imageUrl || '', 'image/jpeg', 'Imagen');
                photoCell.appendChild(img);
                row.appendChild(photoCell);

                const userIdCell = document.createElement('td');
                userIdCell.style.cssText = 'font-family: monospace; color: #1B3A5C; font-size: 12px; width: 120px; overflow: hidden; text-overflow: ellipsis;';
                const typeCell = document.createElement('td');
                typeCell.textContent = up.category === 'chat' ? 'Chat' : up.category === 'profile' ? 'Perfil' : 'Tic';
                typeCell.style.cssText = 'font-weight: 700; color: #f8fafc; width: 100px;';
                row.appendChild(typeCell);

                userIdCell.textContent = uploaderName;
                userIdCell.style.width = '220px';
                userIdCell.title = up.userId;
                row.appendChild(userIdCell);

                const userNameCell = document.createElement('td');
                userNameCell.style.cssText = 'font-weight: 600; color: #f8fafc; width: 150px; overflow: hidden; text-overflow: ellipsis;';
                userNameCell.textContent = (up.userId || 'N/A').substring(0, 24);
                userNameCell.title = up.userId || 'N/A';
                row.appendChild(userNameCell);

                const songCell = document.createElement('td');
                songCell.style.width = '200px';
                const songTitle = document.createElement('div');
                songTitle.style.cssText = 'font-size: 12px; color: #f8fafc; font-weight: 500; overflow: hidden; text-overflow: ellipsis;';
                songTitle.textContent = up.category === 'tic' ? (up.spotifyInfo?.title || up.spotify || 'Sin música').substring(0, 50) : up.category === 'chat' ? 'Foto de conversación' : 'Foto de perfil';
                songTitle.title = up.spotifyInfo?.title || up.spotify || 'Sin música';
                const songArtist = document.createElement('div');
                songArtist.style.cssText = 'font-size: 11px; color: #94a3b8;';
                songArtist.textContent = (up.spotifyInfo?.artist || '---').substring(0, 50);
                songArtist.title = up.spotifyInfo?.artist || '---';
                songCell.appendChild(songTitle);
                songCell.appendChild(songArtist);
                row.appendChild(songCell);

                const dateCell = document.createElement('td');
                dateCell.style.cssText = 'font-size: 12px; color: #94a3b8; opacity: 0.8; width: 140px;';
                const dateDiv = document.createElement('div');
                dateDiv.textContent = uploadDate.toLocaleDateString();
                const timeDiv = document.createElement('div');
                timeDiv.style.cssText = 'font-size: 11px; margin-top: 2px;';
                timeDiv.textContent = uploadDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                dateCell.appendChild(dateDiv);
                dateCell.appendChild(timeDiv);
                row.appendChild(dateCell);

                const actionsCell = document.createElement('td');
                actionsCell.style.cssText = 'width: 120px; text-align: center;';
                const actionsDiv = document.createElement('div');
                actionsDiv.style.cssText = 'display: flex; gap: 8px; justify-content: center; align-items: center;';
                
                const viewBtn = document.createElement('span');
                viewBtn.className = 'material-icons-round';
                viewBtn.textContent = 'visibility';
                viewBtn.style.cssText = 'color: #1B3A5C; cursor: pointer; font-size: 18px; user-select: none;';
                viewBtn.title = 'Ver foto';
                viewBtn.onclick = () => previewFileForAdmin(up.image || up.data || up.imageUrl || '', 'image/jpeg', 'Imagen');

                const toggleBtn = document.createElement('span');
                toggleBtn.className = 'material-icons-round';
                toggleBtn.textContent = hidden ? 'visibility_off' : 'visibility';
                toggleBtn.style.cssText = `color: ${hidden ? '#f59e0b' : '#10b981'}; cursor: pointer; font-size: 18px; user-select: none;`;
                toggleBtn.title = hidden ? 'Mostrar foto' : 'Ocultar foto';
                toggleBtn.style.display = up.category === 'tic' ? 'inline-block' : 'none';
                toggleBtn.onclick = async () => {
                    if (confirm(hidden ? '¿Mostrar esta foto de nuevo en la app?' : '¿Ocultar esta foto para que no aparezca en la app?')) {
                        await togglePhotoVisibility(up.id, !hidden);
                    }
                };
                
                const deleteBtn = document.createElement('span');
                deleteBtn.className = 'material-icons-round';
                deleteBtn.textContent = 'delete';
                deleteBtn.style.cssText = 'color: #ef4444; cursor: pointer; font-size: 18px; user-select: none;';
                deleteBtn.title = 'Eliminar foto';
                deleteBtn.style.display = up.category === 'tic' ? 'inline-block' : 'none';
                deleteBtn.onclick = () => {
                    if (confirm('¿Eliminar esta foto definitivamente?')) {
                        deleteGlobalPhoto(up.id);
                    }
                };
                
                actionsDiv.appendChild(viewBtn);
                actionsDiv.appendChild(toggleBtn);
                actionsDiv.appendChild(deleteBtn);
                actionsCell.appendChild(actionsDiv);
                row.appendChild(actionsCell);

                if (tbody) tbody.appendChild(row);
            } catch (itemError) {
                console.error('Error renderizando foto:', itemError);
            }
            });
        };
        if (categoryFilter) categoryFilter.onchange = renderFiltered;
        if (searchInput) searchInput.oninput = renderFiltered;
        renderFiltered();
    } catch (e) { 
        console.error("Error fetching photos:", e);
        const tbody = document.getElementById('photos-tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 40px 16px;">Error al cargar fotos: ${adminEsc(e.message)}</td></tr>`;
        }
    }
}

async function togglePhotoVisibility(photoId, hidden) {
    try {
        const response = await ADMIN_AUTH.fetch(`${CONFIG.API_BASE_URL}/api/admin/publicaciones/${encodeURIComponent(photoId)}/visibility`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hidden })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data?.message || 'No se pudo cambiar la visibilidad');
        }

        alert(hidden ? '✅ Foto ocultada correctamente' : '✅ Foto mostrada de nuevo');
        await fetchPhotos();
        if (document.getElementById('files-modal') && document.getElementById('files-modal').classList.contains('active')) {
            const currentUserId = document.getElementById('files-user-name')?.dataset.userId;
            if (currentUserId) {
                viewFiles(currentUserId, document.getElementById('files-user-name').textContent || 'Usuario');
            }
        }
    } catch (error) {
        console.error('Error toggling photo visibility:', error);
        alert('Error al cambiar la visibilidad de la foto: ' + (error.message || 'desconocido'));
    }
}

async function deleteGlobalPhoto(id) {
    try {
        // Validar que el ID sea válido
        if (!id || id === 'undefined' || id === 'null') {
            alert('Error: ID de foto inválido');
            return;
        }

        console.log(`[DELETE PHOTO] Intentando eliminar foto con ID: ${id}`);
        
        const response = await ADMIN_AUTH.fetch(`${CONFIG.API_BASE_URL}/api/admin/publicaciones/${id}`, { 
            method: 'DELETE' 
        });

        const data = await response.json();
        console.log(`[DELETE PHOTO] Status: ${response.status}, Response:`, data);
        
        if (!response.ok) {
            const errorMsg = data?.message || data?.error || 'Error desconocido al eliminar';
            alert(`❌ Error al eliminar foto:\n${errorMsg}`);
            return;
        }
        
        if (data.success) {
            console.log('[DELETE PHOTO] Foto eliminada exitosamente');
            alert('✓ Foto eliminada exitosamente');
            
            // Refrescar lista de fotos
            await fetchPhotos();
        } else {
            alert(`❌ Error: ${data.message || 'No se pudo eliminar la foto'}`);
        }
    } catch (e) { 
        console.error('[DELETE PHOTO ERROR]', e);
        alert(`❌ Error al eliminar foto:\n${e.message || 'Error desconocido'}`); 
    }
}

const userModal = document.getElementById('user-modal');
const filesModal = document.getElementById('files-modal');
const btnOpenAdd = document.getElementById('btn-open-add-user');
const userForm = document.getElementById('user-form');

if (btnOpenAdd) {
    btnOpenAdd.onclick = () => {
        document.getElementById('modal-title').textContent = "Agregar Nuevo Usuario";
        document.getElementById('edit-user-id').value = "";
        document.getElementById('pass-group').style.display = "block";
        document.getElementById('modal-date').value = "";
        userForm.reset();
        if (userModal) userModal.classList.add('active');
    };
}

const closeUserModal = document.getElementById('close-user-modal');
if (closeUserModal) closeUserModal.onclick = () => userModal.classList.remove('active');

const closeFilesModal = document.getElementById('close-files-modal');
if (closeFilesModal) closeFilesModal.onclick = () => filesModal.classList.remove('active');

window.onclick = (e) => {
    if (e.target == userModal) userModal.classList.remove('active');
    if (e.target == filesModal) filesModal.classList.remove('active');
};

if (userForm) {
    userForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-user-id').value;
        const usuario = document.getElementById('modal-username').value;
        const telefono = document.getElementById('modal-phone').value;
        const email = document.getElementById('modal-email').value.trim();
        const contrasena = document.getElementById('modal-pass').value;
        const fechaRaw = document.getElementById('modal-date').value;
        const fecha_registro = fechaRaw ? new Date(fechaRaw).toISOString() : null;

        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            alert('Introduce un correo electrónico válido.');
            return;
        }

        try {
            let response;
            if (id) {
                const body = { usuario, telefono, email, contrasena };
                if (fecha_registro) body.fecha_registro = fecha_registro;
                response = await ADMIN_AUTH.fetch(`${CONFIG.API_BASE_URL}/api/admin/users/${encodeURIComponent(id)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
            } else {
                const body = { usuario, contrasena, telefono, email };
                if (fecha_registro) body.fecha_registro = fecha_registro;
                response = await ADMIN_AUTH.fetch(`${CONFIG.API_BASE_URL}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
            }
            if (!response.ok) {
                const err = await response.json();
                alert("Error: " + (err.error || err.message || "Fallo en la operación"));
                return;
            }
        } catch (error) {
            alert("Error de conexión con el servidor");
            return;
        }

        if (userModal) userModal.classList.remove('active');
        fetchUsers();
    };
}

function openEditModal(id) {
    const decodedId = decodeURIComponent(id);
    const user = (window.currentUsersList || []).find(u => u.id.toString() === decodedId.toString());
    if (!user) return;

    document.getElementById('modal-title').textContent = "Editar Usuario";
    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('modal-username').value = user.usuario;
    document.getElementById('modal-phone').value = user.telefono;
    document.getElementById('modal-email').value = user.email || '';
    const passInput = document.getElementById('modal-pass');
    const visiblePassword = user.contrasena_visible;
    const currentPassword = visiblePassword && !['(hashed)', '(error)'].includes(visiblePassword) ? visiblePassword : '';
    if (passInput) {
        passInput.value = currentPassword;
        passInput.placeholder = currentPassword ? 'Contraseña actual (puede cambiarla)' : 'Nueva contraseña para cambiarla';
    }
    document.getElementById('pass-group').style.display = "block";

    if (user.fecha_registro) {
        const d = new Date(user.fecha_registro);
        const formatted = d.toISOString().slice(0, 16);
        document.getElementById('modal-date').value = formatted;
    }

    if (userModal) userModal.classList.add('active');
}

// Suspender (temporal), banear (permanente) o levantar la sancion de una cuenta.
async function sanctionUser(id, action, name) {
    const base = `${CONFIG.API_BASE_URL}/api/admin/users/${id}/${action}`;
    let body = {};
    if (action === 'suspend') {
        const days = prompt(`¿Cuántos días suspender a "${name}"? (1 a 365)`, '7');
        if (days === null) return;
        const reason = prompt('Motivo (se le muestra al usuario, opcional):', '') || '';
        body = { days: Number(days), reason };
    } else if (action === 'ban') {
        if (!confirm(`¿Banear PERMANENTEMENTE a "${name}"? No podrá entrar ni volver a registrarse con su correo.`)) return;
        body = { reason: prompt('Motivo (se le muestra al usuario, opcional):', '') || '' };
    } else if (!confirm(`¿Levantar la sanción de "${name}"?`)) return;
    try {
        const response = await ADMIN_AUTH.fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) alert(data.error || 'No se pudo aplicar la acción');
        fetchUsers();
    } catch (error) {
        alert('Error de conexión');
    }
}

async function deleteUser(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este usuario y todos sus archivos?')) {
        try {
            const response = await ADMIN_AUTH.fetch(`${CONFIG.API_BASE_URL}/api/admin/users/${id}`, { method: 'DELETE' });
            if (!response.ok) alert("No se pudo eliminar el usuario");
            fetchUsers();
            if (document.getElementById('section-photos').style.display !== 'none') fetchPhotos();
        } catch (error) {
            alert("Error de conexión");
        }
    }
}

window.toggleVerification = async (userId) => {
    const decodedId = decodeURIComponent(userId);
    const user = (window.currentUsersList || []).find(u => u.id.toString() === decodedId.toString());
    if (user) {
        try {
            const response = await ADMIN_AUTH.fetch(`${CONFIG.API_BASE_URL}/api/admin/users/${encodeURIComponent(decodedId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ verificado: !user.verificado })
            });
            if (response.ok) fetchUsers();
        } catch (error) {
            console.error("Error toggling verification:", error);
        }
    }
};

function getUserManualStreak(userId) {
    const id = String(userId ?? '');

    const currentList = Array.isArray(window.currentUsersList) ? window.currentUsersList : [];
    const fromList = currentList.find((entry) => String(entry.id) === id || String(entry.usuario) === id || String(entry.telefono) === id);
    if (fromList && Number.isFinite(Number(fromList.streak_days))) {
        return Math.max(0, Number(fromList.streak_days) || 0);
    }

    return 0;
}

async function setUserManualStreak(userId, value) {
    const safeValue = Math.max(0, Number(value) || 0);

    try {
        const response = await ADMIN_AUTH.fetch(`${CONFIG.API_BASE_URL}/api/admin/users/${encodeURIComponent(String(userId))}/streak`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ streak_days: safeValue, streak_source: 'manual' })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const list = Array.isArray(window.currentUsersList) ? window.currentUsersList : [];
        const matchIndex = list.findIndex((entry) => String(entry.id) === String(userId));
        if (matchIndex >= 0) {
            list[matchIndex].streak_days = Number(data.streak_days ?? safeValue) || 0;
            list[matchIndex].streak_source = data.streak_source || 'manual';
        }
        return;
    } catch (error) {
        console.warn('No se pudo sincronizar la racha manual con Postgres de Railway:', error);
        throw error;
    }
}

function calculateUploadStreakFromPhotos(uploads) {
    if (!Array.isArray(uploads) || uploads.length === 0) return 0;
    const validDates = uploads
        .map((upload) => upload.createdAt || upload.created_at || upload.date || upload.customDate)
        .filter(Boolean)
        .map((dateValue) => {
            const date = new Date(dateValue);
            if (Number.isNaN(date.getTime())) return null;
            return new Date(date.getFullYear(), date.getMonth(), date.getDate());
        })
        .filter(Boolean)
        .sort((a, b) => a - b)
        .map((date) => date.toISOString().slice(0, 10));

    if (validDates.length === 0) return 0;
    const uniqueDays = [...new Set(validDates)];
    if (uniqueDays.length < 2) return 0;

    let best = 0;
    let current = 0;
    let previous = null;

    uniqueDays.forEach((day) => {
        const currentDate = new Date(`${day}T00:00:00`);
        if (previous && (currentDate - previous) > 86400000 * 1.5) {
            current = 0;
        }
        current += 1;
        if (current > best) best = current;
        previous = currentDate;
    });

    return best >= 2 ? best : 0;
}

function getEffectiveStreakValue(userId, uploads) {
    const manualValue = getUserManualStreak(userId);
    const automaticValue = calculateUploadStreakFromPhotos(uploads);
    return manualValue > 0 ? manualValue : automaticValue;
}

function renderStreakEditor(userId, userName, uploads) {
    const manualValue = getUserManualStreak(userId);
    const automaticValue = calculateUploadStreakFromPhotos(uploads);
    const effectiveValue = getEffectiveStreakValue(userId, uploads);
    const streakLabel = document.getElementById('user-streak-days');
    const streakButton = document.getElementById('user-streak-button');
    const streakMinus = document.getElementById('user-streak-minus');
    const streakPlus = document.getElementById('user-streak-plus');
    const streakReset = document.getElementById('user-streak-reset');
    if (!streakLabel || !streakButton || !streakMinus || !streakPlus || !streakReset) return;

    const shouldShowManual = manualValue > 0;
    streakLabel.textContent = String(effectiveValue);
    streakButton.textContent = shouldShowManual ? 'Usar automática' : 'Usar manual';
    streakButton.setAttribute('data-user-id', userId);
    streakButton.setAttribute('data-user-name', userName || 'Usuario');
    streakButton.onclick = async () => {
        const currentCounter = getUserManualStreak(userId);
        const nextValue = currentCounter > 0 ? 0 : (automaticValue > 0 ? automaticValue : 0);
        await setUserManualStreak(userId, nextValue);
        renderStreakEditor(userId, userName, uploads);
    };
    streakMinus.onclick = async () => {
        const nextValue = Math.max(0, effectiveValue - 1);
        await setUserManualStreak(userId, nextValue);
        renderStreakEditor(userId, userName, uploads);
    };
    streakPlus.onclick = async () => {
        const nextValue = effectiveValue + 1;
        await setUserManualStreak(userId, nextValue);
        renderStreakEditor(userId, userName, uploads);
    };
    streakReset.onclick = async () => {
        await setUserManualStreak(userId, 0);
        renderStreakEditor(userId, userName, uploads);
    };
}

const COIN_REASONS = { purchase: 'Compra', ad_reward: 'Vídeo con recompensa', activity: 'Actividad', badge: 'Insignia', invite_first: 'Invitación (1.er Tic)', invite_days: 'Invitación (días)', invited_bonus: 'Bono de bienvenida', rebalance: 'Ajuste de economía', daily_gift: 'Regalo diario', boost: 'Destacar Tic', streak_restore: 'Restaurar racha', banner_unlock: 'Banner premium', banner_image: 'Banner con imagen', refund: 'Reembolso', admin_grant: 'Añadidas por admin', admin_take: 'Quitadas por admin' };

async function setupPremiumEditor(userId) {
    const stEl = document.getElementById('user-prem-status');
    const msgEl = document.getElementById('user-prem-msg');
    const daysEl = document.getElementById('user-prem-days');
    const noteEl = document.getElementById('user-prem-note');
    if (!stEl) return;
    const base = `${CONFIG.API_BASE_URL}/api/admin/users/${encodeURIComponent(String(userId))}/premium`;
    const say = (text, ok) => { if (msgEl) { msgEl.textContent = text || ''; msgEl.style.color = ok === false ? '#b91c1c' : (ok ? '#166534' : '#64748b'); } };
    async function load() {
        try {
            const r = await ADMIN_AUTH.fetch(base, { cache: 'no-store' });
            const d = r.ok ? await r.json() : null;
            if (!d) { stEl.textContent = '—'; return; }
            const src = d.source === 'admin' ? 'regalado por administración' : (d.source ? `vía ${d.source}` : '');
            stEl.textContent = d.active ? (d.forever ? 'Premium SIEMPRE' : `Premium hasta ${new Date(d.expiresAt).toLocaleDateString('es-ES')}`) + (src ? ` (${src})` : '') : 'Sin Premium';
            stEl.style.color = d.active ? '#166534' : '#64748b';
        } catch (e) { stEl.textContent = '—'; }
    }
    async function send(mode) {
        const days = Math.floor(Number(daysEl.value) || 30);
        const label = mode === 'revoke' ? 'quitar el Premium a este usuario' : (mode === 'forever' ? 'dar Premium SIEMPRE a este usuario' : `dar ${days} día(s) de Premium a este usuario`);
        if (!window.confirm(`¿Seguro que quieres ${label}?`)) return;
        say('Guardando…');
        try {
            const r = await ADMIN_AUTH.fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, days, note: noteEl.value.trim() }) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) { say(d.message || 'No se pudo guardar', false); return; }
            say(mode === 'revoke' ? 'Premium retirado. El usuario recibe un mensaje.' : 'Premium concedido. El usuario recibe un aviso y un mensaje.', true);
            noteEl.value = '';
            load();
        } catch (e) { say('No se pudo guardar', false); }
    }
    document.getElementById('user-prem-days-btn').onclick = () => send('days');
    document.getElementById('user-prem-forever-btn').onclick = () => send('forever');
    document.getElementById('user-prem-revoke-btn').onclick = () => send('revoke');
    load();
}
async function setupCoinsEditor(userId) {
    const balanceEl = document.getElementById('user-coins-balance');
    const earnedEl = document.getElementById('user-coins-earned');
    const msgEl = document.getElementById('user-coins-msg');
    const histEl = document.getElementById('user-coins-history');
    const amountEl = document.getElementById('user-coins-amount');
    const noteEl = document.getElementById('user-coins-note');
    const addBtn = document.getElementById('user-coins-add');
    const takeBtn = document.getElementById('user-coins-take');
    if (!balanceEl || !addBtn || !takeBtn) return;
    const base = `${CONFIG.API_BASE_URL}/api/admin/users/${encodeURIComponent(String(userId))}/coins`;
    const say = (text, ok) => { if (msgEl) { msgEl.textContent = text || ''; msgEl.style.color = ok === false ? '#b91c1c' : (ok ? '#166534' : '#64748b'); } };
    const fmt = (n) => Number(n || 0).toLocaleString('es-ES');
    async function load() {
        try {
            const r = await ADMIN_AUTH.fetch(base, { cache: 'no-store' });
            const d = r.ok ? await r.json() : null;
            if (!d) { balanceEl.textContent = '—'; say('No se pudieron cargar las monedas', false); return; }
            balanceEl.textContent = fmt(d.balance);
            if (earnedEl) earnedEl.textContent = `${fmt(d.earned)} ganadas en total`;
            if (histEl) {
                const rows = Array.isArray(d.history) ? d.history : [];
                histEl.innerHTML = rows.length ? rows.map((h) => {
                    const amt = Number(h.amount) || 0;
                    const when = h.at ? new Date(h.at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
                    const note = h.meta && h.meta.note ? ` · ${adminEsc(h.meta.note)}` : '';
                    return `<div style="display:flex; justify-content:space-between; gap:10px; padding:4px 0; border-bottom:1px solid #f1f5f9;"><span>${adminEsc(COIN_REASONS[h.reason] || h.reason || '')}${note}<span style="color:#94a3b8"> · ${when}</span></span><b style="color:${amt >= 0 ? '#166534' : '#b91c1c'}">${amt >= 0 ? '+' : ''}${fmt(amt)}</b></div>`;
                }).join('') : '<div style="color:#94a3b8">Sin movimientos todavía.</div>';
            }
        } catch (e) { say('No se pudieron cargar las monedas', false); }
    }
    async function change(sign) {
        const n = Math.floor(Number(amountEl.value) || 0);
        if (n <= 0) { say('Escribe una cantidad mayor que 0', false); return; }
        if (!confirm(`${sign > 0 ? 'Añadir' : 'Quitar'} ${n.toLocaleString('es-ES')} monedas?`)) return;
        addBtn.disabled = takeBtn.disabled = true;
        try {
            const r = await ADMIN_AUTH.fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delta: sign * n, note: noteEl.value.trim() }) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) { say(d.message || 'No se pudo cambiar el saldo', false); }
            else {
                say(`${d.applied > 0 ? 'Añadidas' : 'Quitadas'} ${Math.abs(d.applied).toLocaleString('es-ES')} monedas. Saldo: ${fmt(d.balance)}`, true);
                amountEl.value = ''; noteEl.value = '';
            }
        } catch (e) { say('Error de conexión', false); }
        addBtn.disabled = takeBtn.disabled = false;
        load();
    }
    addBtn.onclick = () => change(1);
    takeBtn.onclick = () => change(-1);
    load();
}

async function viewFiles(userId, userName) {
    const decodedId = decodeURIComponent(userId);
    const decodedUserName = adminDecode(userName);

    const userNameEl = document.getElementById('files-user-name');
    if (userNameEl) {
        userNameEl.textContent = decodedUserName;
        userNameEl.dataset.userId = decodedId;
    }
    const container = document.getElementById('user-files-container');
    if (container) container.innerHTML = '<div class="loader-small" style="margin:20px auto;"></div>';

    try {
        const profileRes = await ADMIN_AUTH.fetch(`${CONFIG.API_BASE_URL}/api/users/${encodeURIComponent(decodedId)}?streak_refresh=${Date.now()}`, { cache: 'no-store' });
        const profileData = profileRes.ok ? await profileRes.json() : null;
        const photoRes = await ADMIN_AUTH.fetch(`${CONFIG.API_BASE_URL}/api/admin/usuarios/${encodeURIComponent(decodedId)}/fotos`);
        const data = photoRes.ok ? await photoRes.json() : { user: null, fotos: [] };
        const uploads = Array.isArray(data.fotos) ? data.fotos : [];
        if (container) container.innerHTML = '';

        const avatarUrl = profileData?.avatar || data?.user?.avatar || '';
        const avatarHtml = avatarUrl
            ? `<div style="display:flex; align-items:center; justify-content:center; margin: 0 0 18px;"><div style="width: 98px; height: 98px; border-radius: 50%; overflow:hidden; border: 3px solid #1B3A5C; background:#e2e8f0; display:flex; align-items:center; justify-content:center; box-shadow:0 10px 24px rgba(27,58,92,0.18);"><img src="${adminSafeSrc(avatarUrl)}" alt="Perfil" style="width:100%; height:100%; object-fit:cover;"></div></div>`
            : `<div style="display:flex; align-items:center; justify-content:center; margin: 0 0 18px;"><div style="width: 98px; height: 98px; border-radius: 50%; background: linear-gradient(135deg, #1B3A5C, #60a5fa); color:white; display:flex; align-items:center; justify-content:center; font-size: 30px; font-weight:700;">${adminEsc((decodedUserName || 'U').charAt(0).toUpperCase())}</div></div>`;

        const effectiveStreak = getEffectiveStreakValue(decodedId, uploads);
        const userSummary = document.createElement('div');
        userSummary.style.cssText = 'display: grid; grid-template-columns: 120px 1fr; gap: 18px; align-items: center; padding: 6px 8px 16px;';
        userSummary.innerHTML = `
            <div>${avatarHtml}</div>
            <div>
                <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${adminEsc(decodedUserName)}</div>
                <div style="font-size: 13px; color: #475569; margin-bottom: 10px;">${adminEsc(profileData?.phone || profileData?.telefono || 'Sin teléfono')}</div>
                <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
                    <span style="padding: 6px 10px; border-radius: 999px; background:#e2e8f0; color:#1e293b; font-size:12px; font-weight:600;">${uploads.length} fotos</span>
                    <span style="padding: 6px 10px; border-radius: 999px; background:#ecfeff; color:#0f766e; font-size:12px; font-weight:600;">${effectiveStreak || 0} días racha</span>
                </div>
            </div>
        `;
        if (container) container.appendChild(userSummary);

        const streakCard = document.createElement('div');
        streakCard.style.cssText = 'margin: 0 0 18px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 14px; background: #f8fafc; display:flex; align-items:center; justify-content:space-between; gap:12px;';
        streakCard.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <div id="user-streak-visual" style="width: 36px; height: 36px; display:flex; align-items:center; justify-content:center; border-radius: 10px; font-size: 22px; background: rgba(249,115,22,0.12);">🔥</div>
                <div>
                    <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; color:#64748b; text-transform: uppercase;">Racha</div>
                    <div id="user-streak-days" style="font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1;">0</div>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
                <button id="user-streak-button" type="button" style="border:1px solid #dbeafe; background:#eff6ff; color:#1d4ed8; border-radius:10px; padding: 7px 10px; cursor:pointer; font-size:12px; font-weight:700;">Manual</button>
                <button id="user-streak-minus" type="button" style="border:1px solid #cbd5e1; background:#fff; border-radius:10px; width: 30px; height: 30px; cursor:pointer; font-size: 20px; color: #334155;">−</button>
                <button id="user-streak-plus" type="button" style="border:1px solid #cbd5e1; background:#fff; border-radius:10px; width: 30px; height: 30px; cursor:pointer; font-size: 20px; color: #334155;">+</button>
                <button id="user-streak-reset" type="button" style="border:1px solid #fca5a5; background:#fff1f2; color:#991b1b; border-radius:10px; padding: 6px 12px; cursor:pointer; font-size:12px; font-weight:700;">Reset</button>
            </div>
        `;
        if (container) container.appendChild(streakCard);
        renderStreakEditor(decodedId, decodedUserName, uploads);

        const coinsCard = document.createElement('div');
        coinsCard.style.cssText = 'margin: 0 0 18px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 14px; background: #fffbeb;';
        coinsCard.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width: 36px; height: 36px; display:flex; align-items:center; justify-content:center; border-radius: 10px; font-size: 22px; background: rgba(245,184,46,0.25);">🪙</div>
                    <div>
                        <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; color:#64748b; text-transform: uppercase;">Monedas</div>
                        <div id="user-coins-balance" style="font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1;">…</div>
                        <div id="user-coins-earned" style="font-size: 12px; color:#64748b; margin-top:2px;"></div>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
                    <input id="user-coins-amount" type="number" min="1" step="1" placeholder="Cantidad" style="width: 96px; padding: 7px 10px; border:1px solid #cbd5e1; border-radius:10px; font-size:14px;">
                    <input id="user-coins-note" type="text" maxlength="200" placeholder="Motivo (opcional)" style="width: 150px; padding: 7px 10px; border:1px solid #cbd5e1; border-radius:10px; font-size:13px;">
                    <button id="user-coins-add" type="button" style="border:1px solid #bbf7d0; background:#f0fdf4; color:#166534; border-radius:10px; padding: 7px 12px; cursor:pointer; font-size:13px; font-weight:700;">+ Añadir</button>
                    <button id="user-coins-take" type="button" style="border:1px solid #fca5a5; background:#fff1f2; color:#991b1b; border-radius:10px; padding: 7px 12px; cursor:pointer; font-size:13px; font-weight:700;">− Quitar</button>
                </div>
            </div>
            <div id="user-coins-msg" style="font-size:12.5px; margin-top:8px; min-height:16px; color:#64748b;"></div>
            <details style="margin-top:6px;"><summary style="cursor:pointer; font-size:12.5px; font-weight:700; color:#475569;">Últimos movimientos</summary><div id="user-coins-history" style="margin-top:8px; max-height:200px; overflow:auto; font-size:12.5px;"></div></details>
        `;
        if (container) container.appendChild(coinsCard);
        setupCoinsEditor(decodedId);

        const premCard = document.createElement('div');
        premCard.style.cssText = 'margin: 0 0 18px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 14px; background: #f5f3ff;';
        premCard.innerHTML = `
            <div style="font-size: 14px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.08em;">Premium</div>
            <div id="user-prem-status" style="font-size: 18px; font-weight: 800; margin: 6px 0 10px; color:#64748b;">…</div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                <input id="user-prem-days" type="number" min="1" max="3650" step="1" value="30" style="width: 80px; padding: 7px 10px; border:1px solid #cbd5e1; border-radius:10px; font-size:14px;">
                <input id="user-prem-note" type="text" maxlength="300" placeholder="Motivo (lo verá el usuario)" style="width: 190px; padding: 7px 10px; border:1px solid #cbd5e1; border-radius:10px; font-size:13px;">
                <button id="user-prem-days-btn" type="button" style="border:1px solid #c4b5fd; background:#ede9fe; color:#5b21b6; border-radius:10px; padding: 7px 12px; cursor:pointer; font-size:13px; font-weight:700;">Dar días</button>
                <button id="user-prem-forever-btn" type="button" style="border:1px solid #bbf7d0; background:#f0fdf4; color:#166534; border-radius:10px; padding: 7px 12px; cursor:pointer; font-size:13px; font-weight:700;">Dar siempre</button>
                <button id="user-prem-revoke-btn" type="button" style="border:1px solid #fca5a5; background:#fff1f2; color:#991b1b; border-radius:10px; padding: 7px 12px; cursor:pointer; font-size:13px; font-weight:700;">Quitar</button>
            </div>
            <div id="user-prem-msg" style="font-size:12.5px; margin-top:8px; min-height:16px; color:#64748b;"></div>
        `;
        if (container) container.appendChild(premCard);
        setupPremiumEditor(decodedId);

        const photosHeading = document.createElement('div');
        photosHeading.style.cssText = 'margin: 8px 0 12px; font-size: 14px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.08em;';
        photosHeading.textContent = 'Fotos';
        if (container) container.appendChild(photosHeading);

        if (uploads.length === 0) {
            if (container) container.insertAdjacentHTML('beforeend', '<div style="padding: 18px 10px; text-align: center; color: #94a3b8; border: 1px dashed #cbd5e1; border-radius: 12px; background: #f8fafc;">Este usuario aún no ha subido fotos. La racha puede crearse manualmente desde aquí.</div>');
        } else {
            const grid = document.createElement('div');
            grid.style.cssText = 'display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:12px;';
            uploads.forEach((up) => {
                const imageUrl = up.data || up.imageUrl || up.image_url || '';
                const src = adminSafeSrc(imageUrl);
                const hidden = Boolean(up.hidden || up.isHidden);
                const card = document.createElement('div');
                card.style.cssText = 'border:1px solid #e2e8f0; border-radius: 12px; overflow:hidden; background:#fff; box-shadow:0 4px 12px rgba(15,23,42,0.04);';
                card.innerHTML = `
                    <div style="position: relative; background: #e2e8f0; height: 210px; overflow:hidden;">
                        ${src ? `<img src="${src}" style="width:100%; height:100%; object-fit:cover; display:block;" alt="Foto" />` : '<div style="display:flex; align-items:center; justify-content:center; width:100%; height:100%; color:#94a3b8; font-size:12px;">Sin imagen</div>'}
                        ${hidden ? '<span style="position:absolute; top:8px; right:8px; background:rgba(245,158,11,0.16); color:#b45309; border-radius:999px; padding:4px 8px; font-size:10px; font-weight:700;">Oculta</span>' : ''}
                    </div>
                    <div style="padding: 10px;">
                        <div style="font-size: 12px; color:#475569; font-weight: 600;">${new Date(up.date || up.createdAt || Date.now()).toLocaleDateString()}</div>
                        <div style="font-size: 11px; color:#64748b; margin-top: 4px; line-height: 1.4;">${adminEsc((up.caption || 'Sin descripción').slice(0, 60))}</div>
                    </div>
                `;
                if (container) grid.appendChild(card);
            });
            if (container) container.appendChild(grid);
        }
    } catch (e) {
        console.error('Error cargando detalle del usuario:', e);
        if (container) container.innerHTML = '<div style="padding: 20px; color: #dc2626;">Error al cargar la información del usuario.</div>';
    }
    if (filesModal) filesModal.classList.add('active');
}

function previewFileForAdmin(data, type, name) {
    // Decodificar HTML entities
    const decodedData = adminSafeSrc(adminDecode(data));
    if (!decodedData) return;
    
    const win = window.open("");
    const escapedName = name.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    win.document.write(`
        <body style="margin:0; background:#000; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; color:white;">
            <img src="${decodedData}" style="max-height:80vh; border: 2px solid white; border-radius:12px; box-shadow: 0 0 50px rgba(255,255,255,0.2);" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23ccc%22 width=%22200%22 height=%22200%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 font-family=%22sans-serif%22 font-size=%2220%22 fill=%22%23999%22%3EImagen no disponible%3C/text%3E%3C/svg%3E'">
            <div style="margin-top:20px; text-align:center;">
                <h2 style="margin:0;">${escapedName}</h2>
                <p style="color:#aaa;">Previsualización de Administrador</p>
            </div>
        </body>
    `);
}

async function deleteFile(uploadId, userId, userName) {
    // Decodificar HTML entities
    const decodedUserId = adminDecode(userId);
    const decodedUserName = adminDecode(userName);
    
    if (confirm('¿Eliminar este archivo definitivamente?')) {
        try {
            await ADMIN_AUTH.fetch(`${CONFIG.API_BASE_URL}/api/admin/publicaciones/${uploadId}`, { method: 'DELETE' });
            viewFiles(decodedUserId, decodedUserName);
            if (document.getElementById('section-photos').style.display !== 'none') fetchPhotos();
        } catch (e) { alert("Error al eliminar"); }
    }
}

let allUsersData = [];
let allPostsData = [];
let allLoginsData = [];
let allEngagementTotals = { impressions: 0, opens: 0, long_views: 0, quick_skips: 0 };
let chartUploads = null;
let chartUsers = null;
let chartLogins = null;
let chartEngagement = null;
let activeRangeDays = 7;

// Que tarjetas de estadisticas quiere ver el admin (para no saturar la pantalla con
// las 9 a la vez). Se guarda en localStorage para que se recuerde la proxima vez.
const STATS_VISIBILITY_KEY = 'seeYou_admin_visible_stats';
const STATS_ALL_KEYS = ['new-photos', 'new-users', 'new-tics', 'verified-users', 'likes', 'comments', 'logins', 'active-users', 'impressions'];

function loadVisibleStats() {
    try {
        const saved = JSON.parse(localStorage.getItem(STATS_VISIBILITY_KEY) || 'null');
        if (Array.isArray(saved)) return new Set(saved);
    } catch (e) { /* ignore */ }
    return new Set(STATS_ALL_KEYS);
}

function applyVisibleStats(visible) {
    STATS_ALL_KEYS.forEach((key) => {
        const card = document.querySelector(`[data-stat-card="${key}"]`);
        if (card) card.setAttribute('data-stat-hidden', visible.has(key) ? 'false' : 'true');
        const checkbox = document.querySelector(`[data-stat-toggle="${key}"]`);
        if (checkbox) checkbox.checked = visible.has(key);
    });
}

function initStatsCustomizer() {
    const btn = document.getElementById('btn-customize-stats');
    const panel = document.getElementById('stats-customize-panel');
    if (!btn || !panel) return;

    applyVisibleStats(loadVisibleStats());

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
        if (panel.classList.contains('open') && !panel.contains(e.target) && e.target !== btn) {
            panel.classList.remove('open');
        }
    });
    panel.querySelectorAll('[data-stat-toggle]').forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
            const visible = loadVisibleStats();
            const key = checkbox.getAttribute('data-stat-toggle');
            if (checkbox.checked) visible.add(key); else visible.delete(key);
            localStorage.setItem(STATS_VISIBILITY_KEY, JSON.stringify([...visible]));
            applyVisibleStats(visible);
        });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStatsCustomizer);
} else {
    initStatsCustomizer();
}

async function fetchStats() {
    try {
        const uResp = await ADMIN_AUTH.fetch(`${CONFIG.API_BASE_URL}/api/admin/users`);
        const pResp = await ADMIN_AUTH.fetch(`${CONFIG.API_BASE_URL}/api/admin/publicaciones`);
        allUsersData = await uResp.json();
        allPostsData = await pResp.json();

        try {
            const lResp = await ADMIN_AUTH.fetch(`${CONFIG.API_BASE_URL}/api/admin/login-stats`);
            allLoginsData = lResp.ok ? await lResp.json() : [];
        } catch (e) { allLoginsData = []; }

        try {
            const eResp = await ADMIN_AUTH.fetch(`${CONFIG.API_BASE_URL}/api/admin/engagement`);
            if (eResp.ok) {
                const eData = await eResp.json();
                allEngagementTotals = eData.totals || allEngagementTotals;
            }
        } catch (e) { /* engagement es opcional */ }

        document.querySelectorAll('.btn-filter[data-range]').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.btn-filter[data-range]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const range = btn.getAttribute('data-range');
                activeRangeDays = range === 'all' ? Infinity : parseFloat(range);
                renderStats(activeRangeDays);
            };
        });

        const triggerThemeBtn = document.getElementById('btn-trigger-theme');
        if (triggerThemeBtn) {
            triggerThemeBtn.onclick = () => {
                if (typeof window.getTodayDailyTheme !== 'function' || typeof window.setForcedDailyTheme !== 'function') {
                    alert('Daily themes module is not loaded.');
                    return;
                }
                const today = getTodayDailyTheme();
                if (!today || today.index == null) {
                    alert('No hay tema del día disponible ahora.');
                    return;
                }
                setForcedDailyTheme(today.index);
                alert(`Tema del día fijado: ${today.theme}`);
            };
        }

        renderStats(activeRangeDays);
    } catch (e) {
        console.error('Error cargando estadísticas:', e);
    }
}

function filterByRange(items, dateField, rangeDays) {
    if (!isFinite(rangeDays) || !Array.isArray(items)) return items || [];
    const cutoff = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
    return items.filter(item => {
        const dateValue = item[dateField] || item.createdAt || item.date;
        return dateValue && new Date(dateValue) >= cutoff;
    });
}

function buildTimeLabels(rangeDays) {
    const labels = [];
    const now = new Date();
    if (rangeDays <= 0.2) {
        const totalMins = Math.round(rangeDays * 24 * 60);
        for (let i = totalMins - 1; i >= 0; i--) {
            const d = new Date(now - i * 60 * 1000);
            labels.push(`${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`);
        }
    } else if (rangeDays <= 2) {
        const totalHours = Math.max(1, Math.round(rangeDays * 24));
        for (let i = totalHours - 1; i >= 0; i--) {
            const d = new Date(now - i * 60 * 60 * 1000);
            labels.push(`${d.getHours().toString().padStart(2,'0')}:00`);
        }
    } else if (rangeDays <= 60) {
        for (let i = Math.ceil(rangeDays) - 1; i >= 0; i--) {
            const d = new Date(now - i * 24 * 60 * 60 * 1000);
            labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
        }
    } else {
        const totalMonths = Math.ceil(rangeDays / 30);
        for (let i = totalMonths - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            labels.push(`${d.toLocaleString('es', { month: 'short' })} ${d.getFullYear()}`);
        }
    }
    return labels;
}

function aggregateByLabel(items, dateField, labels, rangeDays) {
    const counts = new Array(labels.length).fill(0);
    if (!Array.isArray(items)) return counts;
    items.forEach(item => {
        const dateValue = item[dateField] || item.createdAt || item.date;
        if (!dateValue) return;
        const d = new Date(dateValue);
        const now = new Date();
        let idx = -1;
        if (rangeDays <= 0.2) {
            const diffMins = Math.floor((now - d) / 60000);
            idx = labels.length - 1 - diffMins;
        } else if (rangeDays <= 2) {
            const diffHours = Math.floor((now - d) / 3600000);
            idx = labels.length - 1 - diffHours;
        } else if (rangeDays <= 60) {
            const diffDays = Math.floor((now - d) / 86400000);
            idx = labels.length - 1 - diffDays;
        } else {
            const diffMonths = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
            idx = labels.length - 1 - diffMonths;
        }
        if (idx >= 0 && idx < labels.length) counts[idx]++;
    });
    return counts;
}

function renderStats(rangeDays) {
    const filteredPosts = filterByRange(allPostsData, 'date', rangeDays);
    const filteredUsers = filterByRange(allUsersData, 'fecha_registro', rangeDays);
    const filteredLogins = filterByRange(allLoginsData, 'ts', rangeDays);

    const tics = filteredPosts.filter(item => item.type === 'tic');

    const snp = document.getElementById('stats-new-photos');
    if (snp) snp.textContent = filteredPosts.length;
    const snu = document.getElementById('stats-new-users');
    if (snu) snu.textContent = filteredUsers.length;
    const snt = document.getElementById('stats-new-tics');
    if (snt) snt.textContent = tics.length;

    // --- Nuevas métricas: verificados, likes, comentarios, logins, activos, visualizaciones ---
    const verifiedTotal = allUsersData.filter(u => u.verificado).length;
    const sv = document.getElementById('stats-verified-users');
    if (sv) sv.textContent = `${verifiedTotal} (${allUsersData.length ? Math.round(verifiedTotal / allUsersData.length * 100) : 0}%)`;

    const likesInRange = filteredPosts.reduce((sum, post) => sum + (Array.isArray(post.likes) ? post.likes.length : 0), 0);
    const sl = document.getElementById('stats-likes');
    if (sl) sl.textContent = likesInRange;

    const allComments = [];
    filteredPosts.forEach(post => {
        (Array.isArray(post.comments) ? post.comments : []).forEach(c => allComments.push(c));
    });
    const sc = document.getElementById('stats-comments');
    if (sc) sc.textContent = allComments.length;

    const slg = document.getElementById('stats-logins');
    if (slg) slg.textContent = filteredLogins.length;

    const activeUserIds = new Set(filteredLogins.map(l => String(l.userId)));
    const sau = document.getElementById('stats-active-users');
    if (sau) sau.textContent = activeUserIds.size;

    const sim = document.getElementById('stats-impressions');
    if (sim) sim.textContent = (allEngagementTotals.impressions || 0).toLocaleString('es-ES');

    const topPostsEl = document.getElementById('top-posts-list');
    if (topPostsEl) {
        const ranked = [...filteredPosts]
            .map(post => ({ post, score: (Array.isArray(post.likes) ? post.likes.length : 0) + (Array.isArray(post.comments) ? post.comments.length : 0) }))
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
        topPostsEl.innerHTML = ranked.length ? ranked.map(({ post, score }) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#f8fafc; border-radius:10px;">
                <span style="color:#334155; font-size:13px;">${adminEsc((post.caption || post.usuario || post.username || 'Publicación').toString().slice(0, 60))}</span>
                <span style="color:#64748b; font-size:12px;">❤️ ${Array.isArray(post.likes) ? post.likes.length : 0} · 💬 ${Array.isArray(post.comments) ? post.comments.length : 0}</span>
            </div>
        `).join('') : '<p style="color:#94a3b8; font-size:13px;">Sin interacciones en este rango.</p>';
    }

    const labels = rangeDays === Infinity ? buildTimeLabels(365) : buildTimeLabels(rangeDays);
    const userCounts = rangeDays === Infinity ? aggregateByLabel(allUsersData, 'fecha_registro', labels, 365) : aggregateByLabel(filteredUsers, 'fecha_registro', labels, rangeDays);

    const chartDefaults = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { ticks: { maxTicksLimit: 10, color: '#64748b', font: { size: 11 } }, grid: { color: '#f1f5f9' } },
            y: { beginAtZero: true, ticks: { stepSize: 1, color: '#64748b', font: { size: 11 } }, grid: { color: '#f1f5f9' } }
        }
    };

    const datasets = [{
        label: 'Tics',
        data: rangeDays === Infinity ? aggregateByLabel(allPostsData.filter(item => item.type === 'tic'), 'date', labels, 365) : aggregateByLabel(tics, 'date', labels, rangeDays),
        backgroundColor: 'rgba(56, 189, 248, 0.35)',
        borderColor: '#38bdf8',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#38bdf8',
        pointRadius: 3
    }];

    const ctxUploads = document.getElementById('chart-uploads');
    if (ctxUploads) {
        const ctx = ctxUploads.getContext('2d');
        if (chartUploads) chartUploads.destroy();
        chartUploads = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets },
            options: chartDefaults
        });
    }

    const ctxUsers = document.getElementById('chart-users');
    if (ctxUsers) {
        const ctx = ctxUsers.getContext('2d');
        if (chartUsers) chartUsers.destroy();
        chartUsers = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets: [{ label: 'Nuevos usuarios', data: userCounts, backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10b981', borderWidth: 2, fill: true, tension: 0.4, pointBackgroundColor: '#10b981', pointRadius: 4 }] },
            options: chartDefaults
        });
    }

    // Inicios de sesión por periodo
    const loginsSource = rangeDays === Infinity ? allLoginsData : filterByRange(allLoginsData, 'ts', rangeDays);
    const loginCounts = rangeDays === Infinity ? aggregateByLabel(allLoginsData, 'ts', labels, 365) : aggregateByLabel(loginsSource, 'ts', labels, rangeDays);
    const ctxLogins = document.getElementById('chart-logins');
    if (ctxLogins) {
        const ctx = ctxLogins.getContext('2d');
        if (chartLogins) chartLogins.destroy();
        chartLogins = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets: [{ label: 'Inicios de sesión', data: loginCounts, backgroundColor: 'rgba(34, 197, 94, 0.15)', borderColor: '#22c55e', borderWidth: 2, fill: true, tension: 0.4, pointBackgroundColor: '#22c55e', pointRadius: 4 }] },
            options: chartDefaults
        });
    }

    // Likes (por fecha de publicación, aproximado) y comentarios (por fecha real del comentario)
    const postsForLikes = rangeDays === Infinity ? allPostsData : filteredPosts;
    const likeCounts = new Array(labels.length).fill(0);
    postsForLikes.forEach(post => {
        const dateValue = post.date || post.createdAt || post.created_at;
        if (!dateValue || !Array.isArray(post.likes) || !post.likes.length) return;
        const idx = labelIndexForDate(dateValue, labels, rangeDays === Infinity ? 365 : rangeDays);
        if (idx >= 0) likeCounts[idx] += post.likes.length;
    });
    const commentsFlat = [];
    (rangeDays === Infinity ? allPostsData : filteredPosts).forEach(post => {
        (Array.isArray(post.comments) ? post.comments : []).forEach(c => commentsFlat.push(c));
    });
    const commentCounts = aggregateByLabel(commentsFlat, 'createdAt', labels, rangeDays === Infinity ? 365 : rangeDays);

    const ctxEngagement = document.getElementById('chart-engagement');
    if (ctxEngagement) {
        const ctx = ctxEngagement.getContext('2d');
        if (chartEngagement) chartEngagement.destroy();
        chartEngagement = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Likes', data: likeCounts, backgroundColor: '#f43f5e' },
                    { label: 'Comentarios', data: commentCounts, backgroundColor: '#f59e0b' }
                ]
            },
            options: Object.assign({}, chartDefaults, { plugins: { legend: { display: true, position: 'top' } } })
        });
    }
}

function labelIndexForDate(dateValue, labels, rangeDays) {
    const d = new Date(dateValue);
    const now = new Date();
    let idx = -1;
    if (rangeDays <= 0.2) {
        idx = labels.length - 1 - Math.floor((now - d) / 60000);
    } else if (rangeDays <= 2) {
        idx = labels.length - 1 - Math.floor((now - d) / 3600000);
    } else if (rangeDays <= 60) {
        idx = labels.length - 1 - Math.floor((now - d) / 86400000);
    } else {
        idx = labels.length - 1 - ((now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()));
    }
    return (idx >= 0 && idx < labels.length) ? idx : -1;
}


const REPORT_REASON_LABELS = {
    spam: 'Spam o publicidad',
    acoso: 'Acoso o bullying',
    contenido_inapropiado: 'Contenido inapropiado',
    suplantacion: 'Suplanta identidad',
    menor_de_edad: 'Persona menor de edad',
    otro: 'Otro motivo'
};
const REPORT_STATUS_LABELS = { open: 'Pendiente', reviewed: 'Revisado', dismissed: 'Descartado' };

async function fetchReports() {
    const tbody = document.getElementById('reports-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8">Cargando...</td></tr>';
    try {
        const response = await ADMIN_AUTH.fetch(`${CONFIG.API_BASE_URL}/api/admin/reports`);
        if (!response.ok) { tbody.innerHTML = '<tr><td colspan="8">No se pudieron cargar los reportes</td></tr>'; return; }
        const reports = await response.json();
        window.currentReportsList = Array.isArray(reports) ? reports : [];
        renderReports();
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="8">Error de conexión</td></tr>';
    }
}

function renderReports() {
    const tbody = document.getElementById('reports-tbody');
    const totalOpenEl = document.getElementById('total-reports-open');
    const filterEl = document.getElementById('reports-status-filter');
    if (!tbody) return;
    const all = window.currentReportsList || [];
    if (totalOpenEl) totalOpenEl.textContent = all.filter(r => (r.status || 'open') === 'open').length;
    const filter = filterEl ? filterEl.value : 'open';
    const list = filter === 'all' ? all : all.filter(r => (r.status || 'open') === filter);
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="8">No hay reportes en este filtro</td></tr>';
        return;
    }
    tbody.innerHTML = list.map(r => {
        const status = r.status || 'open';
        const date = r.createdAt ? new Date(r.createdAt).toLocaleString('es-ES') : '-';
        const reasonLabel = REPORT_REASON_LABELS[r.reason] || r.reason || '-';
        const statusLabel = REPORT_STATUS_LABELS[status] || status;
        const statusColor = status === 'open' ? '#d9534f' : (status === 'reviewed' ? '#1B3A5C' : '#6B7280');
        const sanction = r.reportedStatus;
        const sanctionBadge = sanction ? ` <span class="badge" style="background:${sanction.status === 'banned' ? '#fde2e1;color:#b3261e' : '#fff1d6;color:#8a5a00'};font-size:10px;padding:2px 6px;border-radius:8px;">${sanction.status === 'banned' ? 'BANEADA' : 'SUSPENDIDA' + (sanction.until ? ' hasta ' + new Date(sanction.until).toLocaleDateString('es-ES') : '')}</span>` : '';
        const countBadge = r.reportedTotal > 1 ? `<div style="font-size:11px;color:#b3261e;font-weight:600">${r.reportedTotal} reportes en total (${r.reportedOpen} pendientes)</div>` : '';
        const idq = adminEsc(r.id), uid = adminEsc(r.reportedUserId), uname = adminEsc(r.reportedName || '').replace(/'/g, '&#39;');
        const TYPE_LABEL = { user: 'Perfil', tic: 'Tic', comment: 'Comentario', chat: 'Chat' };
        const typeBadge = `<span style="font-size:10px;font-weight:700;background:#eef2f7;color:#1B3A5C;border-radius:8px;padding:2px 6px;margin-right:4px">${TYPE_LABEL[r.type] || 'Perfil'}</span>`;
        let ticCell = '-';
        let evidenceCell = '';
        if (r.type === 'comment' && r.evidence) {
            const st = adminSafeSrc(r.evidence.sticker || '');
            evidenceCell = `<div style="white-space:normal;font-size:12px;max-width:230px;border-left:3px solid #d9534f;padding-left:8px;margin-bottom:6px">${st ? `<img src="${st}" alt="Sticker" style="width:64px;height:64px;object-fit:contain;display:block">` : adminEsc(r.evidence.text || '')}</div>`;
        } else if (r.type === 'chat') {
            const n = r.evidence && Array.isArray(r.evidence.messages) ? r.evidence.messages.length : 0;
            evidenceCell = `<button type="button" class="btn-filter" style="font-size:12px;margin-bottom:6px" onclick="reportShowChat('${adminEsc(r.id)}')">Ver conversación (${n} mensajes)</button>`;
        }
        if (r.publicationId) {
            const pub = r.publication;
            if (!pub || !pub.exists) ticCell = '<span style="color:#6B7280">Tic ya borrado</span>';
            else {
                const src = adminSafeSrc(pub.imageUrl || '');
                ticCell = `<div style="display:flex;gap:8px;align-items:flex-start;max-width:230px">
                    ${src ? `<img src="${src}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:8px;cursor:pointer;flex:none" onclick="previewFileForAdmin(this.src,'image/jpeg','Tic denunciado')">` : ''}
                    <div style="white-space:normal;font-size:12px">${pub.hidden ? '<b style="color:#b7791f">Oculto</b><br>' : ''}${adminEsc((pub.caption || '').slice(0, 120))}</div></div>`;
            }
        }
        const pubExists = r.publicationId && r.publication && r.publication.exists;
        const icon = (title, name, color, onclick) => `<button type="button" class="btn-icon" title="${title}" onclick="${onclick}"><span class="material-icons-round" style="color:${color}">${name}</span></button>`;
        return `<tr>
            <td>${date}</td>
            <td>${adminEsc(r.reporterName || r.reporterId || '-')}</td>
            <td><b>${adminEsc(r.reportedName || r.reportedUserId || '-')}</b>${sanctionBadge}${countBadge}</td>
            <td>${typeBadge}${adminEsc(reasonLabel)}</td>
            <td style="max-width:220px;white-space:normal;">${adminEsc(r.details || '')}</td>
            <td>${evidenceCell}${ticCell}</td>
            <td><span style="color:${statusColor};font-weight:600">${statusLabel}</span></td>
            <td style="white-space:nowrap">
                ${status !== 'reviewed' ? icon('Marcar como revisado', 'done', '#1B3A5C', `updateReportStatus('${idq}','reviewed')`) : ''}
                ${status !== 'dismissed' ? icon('Descartar', 'close', '#6B7280', `updateReportStatus('${idq}','dismissed')`) : ''}
                ${r.type === 'comment' && r.commentId ? icon('Borrar comentario', 'comments_disabled', '#d9534f', `reportDeleteComment('${idq}')`) : ''}
                ${pubExists ? icon(r.publication.hidden ? 'Mostrar Tic' : 'Ocultar Tic', r.publication.hidden ? 'visibility' : 'visibility_off', '#b7791f', `reportToggleTic('${idq}')`) : ''}
                ${pubExists ? icon('Eliminar Tic', 'delete', '#d9534f', `reportDeleteTic('${idq}')`) : ''}
                ${sanction ? icon('Levantar sanción', 'lock_open', '#16A34A', `reportSanction('${uid}','reinstate','${uname}')`) : icon('Suspender cuenta', 'pause_circle', '#b7791f', `reportSanction('${uid}','suspend','${uname}')`) + icon('Banear cuenta', 'gavel', '#d9534f', `reportSanction('${uid}','ban','${uname}')`)}
            </td>
        </tr>`;
    }).join('');
}

function reportById(id) { return (window.currentReportsList || []).find(r => String(r.id) === String(id)); }
async function reportSanction(userId, action, name) {
    await sanctionUser(userId, action, String(name || '').replace(/&#39;/g, "'"));
    fetchReports();
}
async function reportToggleTic(reportId) {
    const r = reportById(reportId); if (!r || !r.publication) return;
    const hide = !r.publication.hidden;
    if (!confirm(hide ? '¿Ocultar este Tic para los demás usuarios?' : '¿Volver a mostrar este Tic?')) return;
    try {
        const response = await ADMIN_AUTH.fetch(`${CONFIG.API_BASE_URL}/api/admin/publicaciones/${encodeURIComponent(r.publicationId)}/visibility`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hidden: hide })
        });
        if (!response.ok) { alert('No se pudo cambiar la visibilidad del Tic'); return; }
        fetchReports();
    } catch (error) { alert('Error de conexión'); }
}
async function reportDeleteTic(reportId) {
    const r = reportById(reportId); if (!r) return;
    if (!confirm('¿Eliminar este Tic para siempre? No se puede deshacer.')) return;
    try {
        const response = await ADMIN_AUTH.fetch(`${CONFIG.API_BASE_URL}/api/admin/publicaciones/${encodeURIComponent(r.publicationId)}`, { method: 'DELETE' });
        if (!response.ok) { alert('No se pudo eliminar el Tic'); return; }
        fetchReports();
    } catch (error) { alert('Error de conexión'); }
}
async function reportDeleteComment(reportId) {
    if (!confirm('¿Borrar este comentario? No se puede deshacer.')) return;
    try {
        const response = await ADMIN_AUTH.fetch(`${CONFIG.API_BASE_URL}/api/admin/reports/${encodeURIComponent(reportId)}/delete-comment`, { method: 'POST' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) { alert(data.message || 'No se pudo borrar el comentario'); return; }
        fetchReports();
    } catch (error) { alert('Error de conexión'); }
}
function reportShowChat(reportId) {
    const r = reportById(reportId); if (!r || !r.evidence) return;
    const msgs = Array.isArray(r.evidence.messages) ? r.evidence.messages : [];
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
    const rows = msgs.map(m => {
        const mine = m.who === 'reported';
        const img = adminSafeSrc(m.image || '');
        return `<div style="display:flex;justify-content:${mine ? 'flex-start' : 'flex-end'};margin:4px 0"><div style="max-width:75%;padding:8px 12px;border-radius:14px;background:${mine ? '#fde2e1' : '#e8eefc'};font-size:13px;white-space:pre-wrap">${img ? `<img src="${img}" alt="" style="max-width:180px;border-radius:8px;display:block;margin-bottom:4px">` : ''}${adminEsc(m.text || '')}<div style="font-size:10px;color:#6b7280;margin-top:3px">${m.at ? new Date(m.at).toLocaleString('es-ES') : ''}</div></div></div>`;
    }).join('') || '<p>Sin mensajes guardados.</p>';
    ov.innerHTML = `<div style="background:#fff;border-radius:16px;max-width:520px;width:100%;max-height:85vh;display:flex;flex-direction:column;overflow:hidden"><div style="padding:14px 18px;border-bottom:1px solid #e5e7eb;font-weight:700">Conversación entre ${adminEsc(r.reporterName)} y ${adminEsc(r.reportedName)}<div style="font-size:11px;font-weight:500;color:#6b7280;margin-top:2px">En rojo, ${adminEsc(r.reportedName)} (denunciado/a). En azul, ${adminEsc(r.reporterName)} (quien denuncia).</div></div><div style="padding:12px 16px;overflow:auto">${rows}</div><button type="button" style="border:0;background:#1B3A5C;color:#fff;padding:12px;font-weight:700;cursor:pointer">Cerrar</button></div>`;
    ov.addEventListener('click', (e) => { if (e.target === ov || e.target.tagName === 'BUTTON') ov.remove(); });
    document.body.appendChild(ov);
}
window.reportDeleteComment = reportDeleteComment; window.reportShowChat = reportShowChat;
window.reportSanction = reportSanction; window.reportToggleTic = reportToggleTic; window.reportDeleteTic = reportDeleteTic;

async function updateReportStatus(id, status) {
    try {
        const response = await ADMIN_AUTH.fetch(`${CONFIG.API_BASE_URL}/api/admin/reports/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (!response.ok) { alert('No se pudo actualizar el reporte'); return; }
        const report = (window.currentReportsList || []).find(r => String(r.id) === String(id));
        if (report) report.status = status;
        renderReports();
    } catch (error) {
        alert('Error de conexión');
    }
}
window.updateReportStatus = updateReportStatus;
document.addEventListener('change', (e) => { if (e.target && e.target.id === 'reports-status-filter') renderReports(); });

document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar servidor de CONFIG
    if (typeof CONFIG !== 'undefined' && CONFIG.initServer) {
        await CONFIG.initServer();
    }

    const isAuth = await ADMIN_AUTH.checkAuth();
    if (isAuth) {
        // Sesion ya valida: el cuadro de acceso venia abierto por defecto en el HTML y se quedaba tapando el panel.
        const loginModal = document.getElementById('admin-login-modal');
        if (loginModal) loginModal.classList.remove('active');
    } else {
        const loginSuccess = await showAdminLoginModal();
        if (!loginSuccess) {
            alert('Acceso rechazado: debes iniciar sesión como administrador');
            window.location.href = '/';
            return;
        }
    }

    const lastSection = localStorage.getItem('admin_last_section') || 'section-users';
    switchToSection(lastSection, false);
});
