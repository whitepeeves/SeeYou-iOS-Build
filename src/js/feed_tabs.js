/* SeeYou · Pestañas "Feed" (algoritmo, ya existente) / "Amigos" (seguidos + amigos, cronológico) */
(function () {
    'use strict';

    function apiBase() {
        // CONFIG es un const de config.js: no cuelga de window.CONFIG. El fallback a
        // window.location.origin tampoco sirve en la app nativa: ahi el origen de la pagina
        // es "https://localhost" (el servidor local de Capacitor), no el servidor real.
        try { if (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) return String(CONFIG.API_BASE_URL).replace(/\/$/, ''); } catch (e) { }
        return String(window.location.origin).replace(/\/$/, '');
    }
    function currentUserId() {
        return localStorage.getItem('current_user_id') || localStorage.getItem('current_user') || '';
    }

    // Misma transformación que usa el feed "Feed" para que SocialUI.ticCardHTML reciba el formato que espera.
    function mapRawToPhoto(up) {
        var base = apiBase();
        var imgUrl = up.data || up.imageUrl || up.imgUrl || '';
        if (typeof imgUrl !== 'string') imgUrl = '';
        if (imgUrl && !imgUrl.startsWith('http') && !imgUrl.startsWith('data:')) imgUrl = base + '/' + imgUrl.replace(/^\/?/, '');
        var userId = up.userId || up.user_id || '';
        return {
            id: up.id,
            imgUrl: imgUrl,
            originalImageUrl: up.originalImageUrl || up.original_image_url || up.data || up.imageUrl || '',
            videoUrl: up.videoUrl || '',
            author: up.author || up.username || up.name || up.usuario || userId,
            authorAvatar: up.foto || up.avatar || up.userAvatar || up.authorAvatar || '',
            verified: !!(up.verificado || up.verified),
            music: up.spotifyInfo && up.spotifyInfo.title ? up.spotifyInfo.title : null,
                        musicArtwork: up.spotifyInfo && up.spotifyInfo.artworkUrl ? up.spotifyInfo.artworkUrl : null,
            musicPreviewUrl: up.spotifyInfo && up.spotifyInfo.previewUrl ? up.spotifyInfo.previewUrl : null,
            caption: up.caption || '',
            metadata: up.metadata || {},
            location: up.location || null,
            date: up.customDate || up.date || up.createdAt ? new Date(up.customDate || up.date || up.createdAt) : null,
            userId: userId,
            type: String(up.type || 'tic').toLowerCase(),
            likes: Array.isArray(up.likes) ? up.likes : [],
            comments: Array.isArray(up.comments) ? up.comments : [],
            taggedUserIds: Array.isArray(up.taggedUserIds || up.tagged_user_ids) ? (up.taggedUserIds || up.tagged_user_ids) : [],
            visibility: up.visibility || 'public',
            frameOverlayUrl: up.frameOverlayUrl || null,
            frameEnabled: !!up.frameEnabled,
            frameConfig: up.frameConfig || null
        };
    }

    function tr(k, d) { try { return (typeof CONFIG !== 'undefined' && CONFIG.translate) ? CONFIG.translate(k, d) : d; } catch (e) { return d; } }
    var followingCursor = null;
    var followingLoading = false;
    var activeTab = 'feed';   // pestaña visible (para ignorar respuestas tardias de la otra)
    var followingGen = 0;     // se incrementa al cambiar de pestaña / recargar: descarta respuestas obsoletas

    function renderInto(container, photos, append) {
        var html = photos.map(function (p) { return window.SocialUI.ticCardHTML(p); }).join('');
        if (append) container.insertAdjacentHTML('beforeend', html);
        else container.innerHTML = html;
        if (window.SocialUI) window.SocialUI.hydrate(container);
        if (window.SocialUI) window.SocialUI.scanImages(container);
    }

    function loadFollowingFeed(opts) {
        opts = opts || {};
        var container = document.getElementById('vertical-feed');
        if (!container) return;
        var uid = currentUserId();
        if (!uid) return;
        if (followingLoading && opts.append) return;
        var gen = opts.append ? followingGen : ++followingGen;
        followingLoading = true;
        if (!opts.append) {
            container.innerHTML = '<div style="padding:30px 16px;text-align:center;color:#999;">Cargando…</div>';
            followingCursor = null;
        }
        var url = apiBase() + '/api/publicaciones/following/' + encodeURIComponent(uid) + '?limit=20' + (opts.append && followingCursor ? '&before=' + encodeURIComponent(followingCursor) : '');
        fetch(url).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
            .then(function (data) {
                if (activeTab !== 'following' || gen !== followingGen) return; // el usuario ya cambio de pestaña
                var pubs = Array.isArray(data.publications) ? data.publications : [];
                followingCursor = data.next || null;
                var photos = pubs.map(mapRawToPhoto);
                if (!photos.length && !opts.append) {
                    container.innerHTML = '<div style="padding:40px 20px; text-align:center; color:#999;">' +
                        '<span class="material-icons-outlined" style="font-size:48px; display:block; margin-bottom:12px; opacity:0.3;">group</span>' +
                        '<p>' + tr('ft_empty', 'Sigue a algunos amigos para ver sus Tics aquí.') + '</p></div>';
                    window.publicationPhotos = [];
                    return;
                }
                renderInto(container, photos, opts.append);
                window.publicationPhotos = opts.append ? (window.publicationPhotos || []).concat(photos) : photos;
                if (followingCursor) {
                    var more = document.createElement('button');
                    more.type = 'button';
                    more.textContent = tr('ft_more', 'Cargar más');
                    more.style.cssText = 'display:block;margin:14px auto;padding:10px 22px;border-radius:999px;border:none;background:#F0F2F5;color:#1B3A5C;font-weight:700;';
                    more.addEventListener('click', function () { more.remove(); loadFollowingFeed({ append: true }); });
                    container.appendChild(more);
                }
            })
            .catch(function () {
                if (activeTab !== 'following' || gen !== followingGen) return;
                // Un error de red o del servidor ya no se confunde con "no tienes amigos": se avisa y se ofrece reintentar (tambien al cargar mas).
                var retry = document.createElement('button');
                retry.type = 'button';
                retry.textContent = 'No se pudo cargar. Reintentar';
                retry.style.cssText = 'display:block;margin:20px auto;padding:10px 22px;border-radius:999px;border:none;background:#F0F2F5;color:#C0392B;font-weight:700;';
                retry.addEventListener('click', function () { retry.remove(); loadFollowingFeed(opts.append ? { append: true } : {}); });
                if (!opts.append) container.innerHTML = '';
                container.appendChild(retry);
            })
            .finally(function () { if (gen === followingGen) followingLoading = false; });
    }

    function switchTab(tab) {
        var buttons = document.querySelectorAll('.feed-tab-btn');
        buttons.forEach(function (b) { b.classList.toggle('active', b.dataset.feedTab === tab); });
        activeTab = tab;
        followingGen++;
        followingLoading = false;
        try { localStorage.setItem('seeyou_feed_tab', tab); } catch (e) { /* almacenamiento bloqueado o lleno: no debe impedir cambiar de pestaña */ }
        if (tab === 'following') {
            loadFollowingFeed({});
        } else if (typeof window.renderHorizontalFeed === 'function') {
            window.renderHorizontalFeed({ cacheFirst: true }).catch(function () {});
        }
    }

    document.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('.feed-tab-btn');
        if (!btn) return;
        switchTab(btn.dataset.feedTab);
    });

    window.SeeYouFeedTabs = { switchTab: switchTab, active: function () { return activeTab; } };
})();
