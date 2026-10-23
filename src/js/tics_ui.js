/* SeeYou · Tarjetas de Tic (feed y perfil)
 * - Diseño de tarjeta, "me gusta" con animación y actualización en el sitio (sin recargar el feed)
 * - Doble toque / doble clic sobre la foto = me gusta (solo da like, nunca lo quita)
 * - Nombre y avatar del autor llevan a su perfil (profile.html?id=…)
 * Usa los mismos endpoints de siempre: POST /api/publicaciones/:id/like y /comments.
 */
(function () {
    'use strict';

    var ICON = {
        heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
        comment: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.6-.8L3 21l1.9-5.4A8.4 8.4 0 1 1 21 11.5z"/></svg>',
        send: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
        star: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.6 6.9 19.3l1-5.7-4.1-4 5.7-.8z"/></svg>',
        sticker: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12a2 2 0 0 1 2 2v7l-7 7H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M20 13h-5a2 2 0 0 0-2 2v5"/><path d="M8.6 9.6h.01M13.4 9.6h.01" stroke-width="2.4"/><path d="M8.4 13a3.2 3.2 0 0 0 3.4 1.6"/></svg>',
        clock: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
        flame: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5c3.2 3.6 5.2 6.2 5.2 9.4a5.2 5.2 0 0 1-10.4 0c0-3.2 2-5.8 5.2-9.4z"/><path d="M12 13c1.6 1.6 2.2 2.6 2.2 3.6a2.2 2.2 0 0 1-4.4 0c0-1 .6-2 2.2-3.6z"/></svg>',
        plus: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
        music: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
        pin: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.6"/></svg>',
        bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
        theme: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 5.8L20 9l-4.6 4 1.3 6-4.7-3-4.7 3 1.3-6L3 9l5.6-1.2z"/></svg>'
    };

    var userCache = {};      // id -> {id,name,username,avatar}
    var pending = {};        // id -> Promise

    // El servidor guarda nombres, bio, musica y textos ya con entidades HTML (O&#039;Brien): se decodifican antes de escapar,
    // si no se escapaban dos veces y se veia "Don&#039;t Stop" en pantalla. Sigue siendo seguro: lo que sale siempre va escapado.
    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&(?:amp|lt|gt|quot|#0?39);/g, function (m) { return { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#039;': "'" }[m]; })
            .replace(/[&<>"']/g, function (c) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
            });
    }
    function me() {
        return localStorage.getItem('current_user_id') || localStorage.getItem('current_user') || '';
    }
    function apiBase() {
        // CONFIG es una constante de config.js (no cuelga de window): en la APK hay que usarla directamente,
        // porque las rutas relativas apuntarían a los archivos locales de la app y no al servidor.
        try { if (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) return CONFIG.API_BASE_URL; } catch (e) { }
        return '';
    }
    function assetUrl(u) {
        if (!u || u === 'null' || u === 'undefined') return '';
        if (/^(https?:|data:|blob:)/i.test(u)) return u;
        return apiBase() + '/' + String(u).replace(/^\/?/, '');
    }
    function initial(name) {
        var s = String(name || '?').trim();
        return (s ? s[0] : '?').toUpperCase();
    }
    function looksLikeId(v) {
        return !v || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v)) || /^u-/.test(String(v));
    }

    /* ---------- Aro azul del avatar = "tiene Tics de hoy" ----------
     * El aro solo debe verse si el autor ha subido algún Tic hoy (hora de España, igual que el
     * resto de la app), y al tocar el avatar debe abrirse SOLO esos Tics de hoy, no el perfil
     * completo. Se usa el mismo cálculo de "día" que la racha/tema del día (getSpainDayKey, en
     * daily_themes.js) para que todo coincida; si esa función no está cargada en la página se cae
     * a comparar fecha local. */
    function isSameAppDay(a, b) {
        try { if (typeof getSpainDayKey === 'function') return getSpainDayKey(a) === getSpainDayKey(b); } catch (e) { }
        var da = a instanceof Date ? a : new Date(a);
        var db = b instanceof Date ? b : new Date(b);
        return !isNaN(da) && !isNaN(db) && da.toDateString() === db.toDateString();
    }
    function isToday(d) { return !!d && isSameAppDay(d, new Date()); }
    function photoPool() {
        return window.publicationPhotos || window.ticPhotos || window.feedPhotos || [];
    }
    function todayTicsForUser(userId) {
        return photoPool().filter(function (ph) { return ph && ph.date && String(ph.userId) === String(userId) && isToday(ph.date); });
    }

    function timeAgo(date) {
        if (!date) return '';
        var d = date instanceof Date ? date : new Date(date);
        var t = d.getTime();
        if (!isFinite(t)) return '';
        var s = Math.max(0, Math.round((Date.now() - t) / 1000));
        if (s < 45) return CONFIG.translate('tic_ago_now', 'ahora mismo');
        var m = Math.round(s / 60);
        if (m < 60) return CONFIG.translate('tic_ago_min', 'hace {{n}} min').replace('{{n}}', m);
        var h = Math.round(m / 60);
        if (h < 24) return CONFIG.translate('tic_ago_hours', 'hace {{n}} h').replace('{{n}}', h);
        var days = Math.round(h / 24);
        if (days === 1) return CONFIG.translate('tic_ago_yesterday', 'ayer');
        if (days < 7) return CONFIG.translate('tic_ago_days', 'hace {{n}} días').replace('{{n}}', days);
        var locale = (typeof CONFIG !== 'undefined' && CONFIG.currentLanguage) ? CONFIG.currentLanguage : 'es';
        return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
    }

    function profileHref(uid) {
        if (!uid) return '#';
        if (String(uid) === String(me())) return 'home.html?section=perfil';
        return 'profile.html?id=' + encodeURIComponent(uid);
    }

    // Cuentas que ya no existen (404): se recuerdan 12 h para no volver a pedirlas en cada carga ni reintentarlas
    // (antes cada recarga llenaba la consola de errores 404 por usuarios borrados que siguen en likes/autores antiguos).
    var GONE_KEY = 'sy_gone_users_v2', GONE_TTL = 12 * 3600 * 1000;
    function goneLoad() { try { return JSON.parse(localStorage.getItem(GONE_KEY) || '{}') || {}; } catch (e) { return {}; } }
    function isGone(uid) { var t = goneLoad()[uid]; return !!t && (Date.now() - t) < GONE_TTL; }
    function markGone(uid) { try { var g = goneLoad(); g[uid] = Date.now(); localStorage.setItem(GONE_KEY, JSON.stringify(g)); } catch (e) { /* sin almacenamiento */ } }

    function getUser(uid) {
        if (!uid) return Promise.resolve(null);
        if (userCache[uid]) return Promise.resolve(userCache[uid]);
        if (isGone(uid)) return Promise.resolve(null);
        if (pending[uid]) return pending[uid];
        var once = function () { return fetch(apiBase() + '/api/users/' + encodeURIComponent(uid)).then(function (r) { if (r.status === 404) { markGone(uid); return null; } return r.ok ? r.json() : null; }).catch(function () { return null; }); };
        // Un fallo puntual del servidor (o una cuenta recien creada) no debe dejar al autor como "Usuario": se reintenta una vez (salvo que sea un 404 firme).
        pending[uid] = once().then(function (u) { return u || (isGone(uid) ? null : new Promise(function (res) { setTimeout(res, 1200); }).then(once)); })
            .then(function (u) {
                if (u) userCache[uid] = { id: u.id, name: u.name || u.username || '', username: u.username || '', avatar: u.avatar || u.foto || '', streak: Math.max(0, Math.floor(Number(u.streak_days != null ? u.streak_days : u.racha) || 0)) };
                return userCache[uid] || null;
            })
            .catch(function () { return null; })
            .then(function (v) { delete pending[uid]; return v; });
        return pending[uid];
    }

    function avatarInner(name, avatar) {
        var url = assetUrl(avatar);
        if (url && !/6VBx3io/.test(url)) {
            return '<img src="' + esc(url) + '" alt="" loading="lazy" decoding="async" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{textContent:\'' + esc(initial(name)) + '\'}))">';
        }
        return '<span>' + esc(initial(name)) + '</span>';
    }

    function likeSummary(likes, uid) {
        var list = Array.isArray(likes) ? likes : [];
        var mine = list.some(function (id) { return String(id) === String(uid); });
        var others = list.filter(function (id) { return String(id) !== String(uid); });
        if (!list.length) return '';
        var first = others.length ? userCache[others[0]] : null;
        var firstName = first && first.name ? esc(first.name) : '';
        if (mine) {
            if (!others.length) return CONFIG.translate('tic_like_you', 'Te gusta a ti');
            var okey = others.length === 1 ? 'tic_like_you_and_one' : 'tic_like_you_and_many';
            var odef = others.length === 1 ? 'Te gusta a ti y a {{n}} persona más' : 'Te gusta a ti y a {{n}} personas más';
            return CONFIG.translate(okey, odef).replace('{{n}}', others.length);
        }
        if (firstName) {
            if (others.length === 1) return CONFIG.translate('tic_like_name', 'A <b>{{name}}</b> le gusta').replace('{{name}}', firstName);
            var nkey = others.length === 2 ? 'tic_like_name_and_one' : 'tic_like_name_and_many';
            var ndef = others.length === 2 ? 'A <b>{{name}}</b> y a {{n}} persona más les gusta' : 'A <b>{{name}}</b> y a {{n}} personas más les gusta';
            return CONFIG.translate(nkey, ndef).replace('{{name}}', firstName).replace('{{n}}', others.length - 1);
        }
        return CONFIG.translate('tic_like_count', '{{n}} me gusta').replace('{{n}}', others.length);
    }

    /* ---------- Hashtags ----------
     * Los #hashtags del texto se convierten en enlaces. Al tocarlos se abre la lista de Tics con ese tema
     * y el servidor lo apunta como interés (el feed te enseñará más Tics parecidos). */
    var TAG_RE;
    try { TAG_RE = new RegExp('(^|[^\\p{L}\\p{N}_&#])#([\\p{L}\\p{N}_][\\p{L}\\p{M}\\p{N}_]{1,39})', 'gu'); }
    catch (e) { TAG_RE = /(^|[^A-Za-z0-9_\u00C0-\u024F&#])#([A-Za-z0-9_\u00C0-\u024F][A-Za-z0-9_\u00C0-\u024F\u0300-\u036F]{1,39})/g; }
    var MENTION_RE = /(^|[^A-Za-z0-9_])@([A-Za-z0-9_.]{2,30})/g;
    function normTag(t) {
        var s = String(t || '').replace(/^#+/, '');
        try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { }
        return s.toLowerCase();
    }
    // `html` ya viene escapado del servidor: solo se envuelven los #hashtags en un enlace
    function linkifyTags(html) {
        var withHashtags = String(html == null ? '' : html).replace(TAG_RE, function (all, pre, tag) {
            var n = normTag(tag);
            if (n.length < 2 || /^\d+$/.test(n)) return all;
            return pre + '<a class="tic-hashtag" href="#" data-hashtag="' + esc(n) + '">#' + tag + '</a>';
        });
        return withHashtags.replace(MENTION_RE, function (all, pre, username) {
            return pre + '<a class="tic-mention" href="#" data-mention="' + esc(username) + '">@' + username + '</a>';
        });
    }

    /* Usuarios bloqueados (en cualquier sentido): sus comentarios no se muestran. */
    var hiddenIds = {};
    function loadHiddenIds() {
        var u = me(); if (!u) return;
        apiCall('GET', '/api/blocks/' + encodeURIComponent(u) + '/hidden').then(function (r) {
            if (r && r.ok && Array.isArray(r.data)) { hiddenIds = {}; r.data.forEach(function (id) { hiddenIds[String(id)] = 1; }); }
        }).catch(function () { });
    }
    setTimeout(loadHiddenIds, 700);

    function commentHTML(c) {
        if (c && c.userId && hiddenIds[String(c.userId)]) return '';
        var name = c.userName || c.username || (c.userId && userCache[c.userId] && userCache[c.userId].name) || CONFIG.translate('tic_default_user', 'Usuario');
        var av = c.userId && userCache[c.userId] ? userCache[c.userId].avatar : '';
        return '<div class="tic-comment"><a class="tic-avatar tic-avatar--xs" href="' + profileHref(c.userId) + '" data-uid="' + esc(c.userId || '') + '">' + avatarInner(name, av) + '</a>' +
            '<div class="tic-comment-body"><a class="tic-comment-name" href="' + profileHref(c.userId) + '" data-uid="' + esc(c.userId || '') + '" data-role="name">' + esc(name) + '</a> ' +
            (c.replyToUserName ? '<span class="tic-reply-to">↪ ' + esc(c.replyToUserName) + '</span> ' : '') +
            (c.sticker ? '<img class="tic-comment-sticker" src="' + esc(assetUrl(c.sticker)) + '" alt="Sticker" loading="lazy" decoding="async">' : '<span>' + linkifyTags(c.text || '') + '</span>') +
            (c.id && me() ? '<div class="tic-comment-actions"><button type="button" class="tic-reply-btn" data-act="reply-comment" data-cid="' + esc(c.id) + '" data-cname="' + esc(name) + '" data-cuser="' + esc(c.userUsername || '') + '">' + esc(CONFIG.translate('tic_reply', 'Responder')) + '</button>' +
                (c.userId && String(c.userId) !== String(me()) ? '<button type="button" class="tic-reply-btn tic-report-btn" data-act="report-comment" data-cid="' + esc(c.id) + '" data-cuid="' + esc(c.userId) + '" data-cname="' + esc(name) + '">' + esc(CONFIG.translate('tic_report', 'Reportar')) + '</button>' : '') + '</div>' : '') +
            '</div></div>';
    }

    /* Tarjeta de Tic. `p` = objeto ya normalizado por el feed (id, imgUrl, author, authorAvatar, userId, caption, date, likes, comments, music, location, frameOverlayUrl). */
    var FLAME = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M19.48 12.35c-1.57-4.08-7.16-4.3-5.81-10.23.1-.44-.37-.78-.75-.55C9.29 3.71 6.68 8 8.87 13.62c.18.46-.36.89-.75.59-1.81-1.37-2-3.34-1.84-4.75.06-.52-.62-.77-.91-.34C4.69 10.16 4 11.84 4 14.37c.38 5.6 5.11 7.32 6.81 7.54 2.43.31 5.06-.14 6.95-1.87 2.08-1.93 2.84-5.01 1.72-7.69zm-9.28 5.03c1.44-.35 2.18-1.39 2.38-2.31.33-1.43-.96-2.83-.09-5.09.33 1.87 3.27 3.04 3.27 5.08.08 2.53-2.66 4.7-5.56 2.32z"/></svg>';
    function streakHTML(uid, n) {
        n = Math.floor(Number(n) || 0);
        return '<span class="tic-streak" data-streak-uid="' + esc(uid) + '"' + (n > 0 ? '' : ' hidden') + ' title="' + esc(CONFIG.translate('tic_streak_title', 'Racha')) + '">' + FLAME + '<b>' + (n > 0 ? n : '') + '</b></span>';
    }
    function ticCardHTML(p, opts) {
        opts = opts || {};
        var uid = me();
        var likes = Array.isArray(p.likes) ? p.likes : [];
        var comments = Array.isArray(p.comments) ? p.comments : [];
        var liked = likes.some(function (id) { return String(id) === String(uid); });
        var known = userCache[p.userId];
        var name = known && known.name ? known.name : (looksLikeId(p.author) ? '' : p.author);
        var avatar = p.authorAvatar || (known && known.avatar) || '';
        if (!avatar && String(p.userId) === String(uid)) avatar = localStorage.getItem('current_user_foto') || '';
        if (!name && String(p.userId) === String(uid)) name = localStorage.getItem('current_user_name') || '';
        var display = name || CONFIG.translate('tic_default_user', 'Usuario');
        var when = timeAgo(p.date);
        var mainSrc = assetUrl(p.imgUrl);
        var alts = (Array.isArray(p.imgAlt) ? p.imgAlt : []).map(assetUrl).filter(function (u, i, a) { return u && u !== mainSrc && a.indexOf(u) === i; });
        if (!mainSrc && alts.length) mainSrc = alts.shift();
        // En vez de la ubicacion, se muestra el Tema del dia del dia en que se publico el Tic
        // (texto en español de daily_themes.js, traducido al vuelo igual que en el aviso
        // principal). Al tocarlo se expande para leerlo entero.
        var themeObj = null;
        try {
            if (typeof getDailyThemeForDate === 'function' && p.date) themeObj = getDailyThemeForDate(new Date(p.date));
        } catch (e) { }
        var themeFull = themeObj && themeObj.theme ? themeObj.theme : '';
        var themePreview = themeFull.length > 46 ? themeFull.slice(0, 46).replace(/\s+\S*$/, '') + '…' : themeFull;
        var themeChip = themeFull ? '<button type="button" class="tic-theme" data-act="theme" data-theme-full="' + esc(themeFull) + '">' + ICON.theme + '<em data-role="theme-preview">' + esc(themePreview) + '</em></button>' : '';
        var feed = !!opts.feed; // visor a pantalla completa: mismo contenido, otra disposicion (ver css/tic_viewer.css)
        var sub = [feed ? '' : themeChip, when ? '<span>' + esc(when) + '</span>' : ''].filter(Boolean).join('<i class="tic-dot"></i>');
        var id = esc(p.id);
        var musicArt = p.musicArtwork ? '<img src="' + esc(p.musicArtwork) + '" alt="" style="width:16px;height:16px;border-radius:3px;object-fit:cover;margin-right:4px;">' : ICON.music;
        var music = p.music ? '<div class="tic-chip tic-chip--music">' + musicArt + '<span>' + esc(p.music) + '</span></div>' : '';
        var overlay = p.frameOverlayUrl ? '<img src="' + esc(p.frameOverlayUrl) + '" class="tic-frame" alt="">' : '';
        var visBadge = (p.visibility === 'friends' || p.visibility === 'private')
            ? '<span class="tic-vis">' + SVG_LOCK + esc(VIS_LABEL[p.visibility]) + '</span>' : '';
        if (visBadge) sub = sub ? sub + '<i class="tic-dot"></i>' + visBadge : visBadge;
        var ownMenu = opts.menuHTML != null ? opts.menuHTML
            : (p.userId && uid ? '<button type="button" class="tic-more" data-act="tic-menu" aria-label="' + esc(CONFIG.translate('tic_aria_more_options', 'Más opciones')) + '">' + SVG_MORE + '</button>' : '');
        var isVerified = !!(p.verified || p.verificado || (known && known.verificado));
        var verifiedBadge = isVerified && typeof CONFIG !== 'undefined' && typeof CONFIG.getVerifiedBadge === 'function' ? CONFIG.getVerifiedBadge(15) : '';
        var hasTodayTic = isToday(p.date) || todayTicsForUser(p.userId).length > 0;

        return '' +
            '<article class="tic-card' + (feed ? ' tic-card--feed' : '') + '" data-pub-id="' + id + '" data-user-id="' + esc(p.userId) + '">' +
            '<header class="tic-head">' +
            '<a class="tic-avatar' + (hasTodayTic ? ' tic-avatar--today' : '') + '" href="' + profileHref(p.userId) + '" data-uid="' + esc(p.userId) + '"' + (hasTodayTic ? ' data-act="today-tics"' : '') + ' aria-label="' + esc(CONFIG.translate('tic_aria_view_profile', 'Ver perfil de {{name}}').replace('{{name}}', display)) + '">' + avatarInner(display, avatar) + '</a>' +
            '<div class="tic-who">' +
            '<a class="tic-name" href="' + profileHref(p.userId) + '" data-uid="' + esc(p.userId) + '" data-role="name">' + esc(display) + verifiedBadge + '</a>' +
            (sub ? '<div class="tic-sub">' + sub + '</div>' : '') +
            (themeFull && !feed ? '<div class="tic-theme-full" data-role="theme-full" hidden>' + esc(themeFull) + '</div>' : '') +
            '</div>' + streakHTML(p.userId, known ? known.streak : 0) + ownMenu +
            '</header>' +
            '<div class="tic-media" data-pub-id="' + id + '">' +
            '<div class="tic-bg" data-bg-src="' + esc(mainSrc) + '" aria-hidden="true"></div>' +
            '<img class="tic-img" data-src="' + esc(mainSrc) + '" data-alts="' + esc(JSON.stringify(alts)) + '" alt="' + esc(CONFIG.translate('tic_alt_photo_of', 'Tic de {{name}}').replace('{{name}}', display)) + '" decoding="async" draggable="false" onload="this.parentNode.classList.add(\'is-loaded\'); var bg=this.parentNode.querySelector(\'.tic-bg\'); if(bg) bg.style.backgroundImage=\'url(\' + this.currentSrc + \')\';" onerror="SocialUI.imgFail(this)">' +
            overlay + music + (p.videoUrl ? '<span class="tic-play" aria-label="' + esc(CONFIG.translate('tic_aria_video', 'Vídeo')) + '">&#9654;</span>' : '') +
            '<div class="tic-burst" aria-hidden="true">' + ICON.heart + '</div>' +
            '</div>' +
            '<div class="tic-actions">' +
            '<button type="button" class="tic-act tic-like' + (liked ? ' is-liked' : '') + '" data-act="like" aria-pressed="' + liked + '" aria-label="' + esc(CONFIG.translate('tic_aria_like', 'Me gusta')) + '">' + ICON.heart + '<b class="tic-count">' + likes.length + '</b></button>' +
            '<button type="button" class="tic-act tic-cmt" data-act="comments" aria-label="' + esc(CONFIG.translate('tic_aria_comments', 'Comentarios')) + '">' + ICON.comment + '<b class="tic-ccount">' + comments.length + '</b></button>' +
            '<button type="button" class="tic-act tic-send" data-act="send-tic" aria-label="' + esc(CONFIG.translate('tic_aria_send', 'Enviar')) + '">' + ICON.send + '</button>' +
            '<button type="button" class="tic-act tic-save" data-act="save-tic" aria-label="' + esc(CONFIG.translate('tic_aria_save', 'Guardar')) + '" style="margin-left:auto">' + ICON.bookmark + '</button>' +
            '</div>' +
            (feed ? '<div class="tic-meta">' + themeChip + (p.music ? '<div class="tic-chip-inline">' + musicArt + '<span>' + esc(p.music) + '</span></div>' : '') +
                (themeFull ? '<div class="tic-theme-full" data-role="theme-full" hidden>' + esc(themeFull) + '</div>' : '') + '</div>' : '') +
            '<div class="tic-likes-line" data-role="likes">' + likeSummary(likes, uid) + '</div>' +
            (p.caption ? '<p class="tic-caption"><a class="tic-name" href="' + profileHref(p.userId) + '" data-uid="' + esc(p.userId) + '" data-role="name">' + esc(display) + '</a> ' + linkifyTags(p.caption) + '</p>' : '') +
            (p.taggedUserIds && p.taggedUserIds.length ? '<div class="tic-tagged" data-tagged="' + esc(p.taggedUserIds.join(',')) + '">' + esc(CONFIG.translate('tic_with_tagged', 'Con {{names}}')).replace('{{names}}', '') + p.taggedUserIds.map(function (t) { return '<a href="' + profileHref(t) + '" data-uid="' + esc(t) + '" data-role="tag">' + esc(userCache[t] && userCache[t].name ? userCache[t].name : CONFIG.translate('tic_default_friend', 'amigo')) + '</a>'; }).join(', ') + '</div>' : '') +
            '<button type="button" class="tic-viewcomments" data-act="comments"' + (comments.length ? '' : ' hidden') + '>' + esc(CONFIG.translate('tic_view_comments', 'Ver los {{n}} comentarios')).replace('{{n}}', '<span class="tic-ccount2">' + comments.length + '</span>').replace(/&lt;/g,'<').replace(/&gt;/g,'>') + '</button>' +
            '<div id="publication-comments-panel-' + id + '" class="tic-comments" style="display:none;">' +
            '<div class="tic-comments-head"><span class="tic-comments-title">' + esc(CONFIG.translate('tic_comments_title', 'Comentarios')) + ' <b class="tic-ccount3">' + comments.length + '</b></span>' +
            '<button type="button" class="tic-comments-close" data-act="comments" aria-label="' + esc(CONFIG.translate('tic_aria_close_comments', 'Cerrar comentarios')) + '">&times;</button></div>' +
            '<div class="tic-comment-list">' + comments.map(commentHTML).join('') + '</div>' +
            '<div class="tic-comment-form"><textarea id="publication-comment-input-' + id + '" class="tic-comment-input" placeholder="' + esc(CONFIG.translate('tic_comment_placeholder', 'Escribe un comentario…')) + '" maxlength="300" autocomplete="off" rows="1"></textarea>' +
            '<button type="button" class="tic-stk-btn" data-act="stickers" aria-label="' + esc(CONFIG.translate('tic_aria_stickers', 'Stickers')) + '">' + ICON.sticker + '</button>' +
            '<button type="button" class="tic-send" data-act="send-comment" aria-label="' + esc(CONFIG.translate('tic_aria_send_comment', 'Enviar comentario')) + '">' + ICON.send + '</button></div>' +
            '<div class="tic-stk-tray" hidden></div>' +
            '</div>' +
            '</article>';
    }

    /* Rellena nombre/avatar reales de los autores (el feed solo trae el id del usuario) */
    /* ---------- Señales para el algoritmo del feed ----------
     * Se mide cuánto tiempo está cada Tic (de otras personas) visible en pantalla y se avisa al servidor
     * en lotes (POST /api/publicaciones/engagement). Los Tics que retienen y gustan suben en el feed. */
    var dwell = { io: null, since: {}, vis: {}, queue: [], timer: null };
    function dwellStart(id) { if (!dwell.since[id] && document.visibilityState === 'visible') dwell.since[id] = Date.now(); }
    function dwellStop(id) {
        var t = dwell.since[id];
        if (!t) return;
        delete dwell.since[id];
        var ms = Date.now() - t;
        if (ms >= 300) dwellQueue({ id: id, ms: Math.min(ms, 120000) });
    }
    function dwellQueue(ev) {
        dwell.queue.push(ev);
        if (dwell.queue.length >= 20) dwellFlush();
        else if (!dwell.timer) dwell.timer = setTimeout(dwellFlush, 8000);
    }
    function dwellFlush() {
        if (dwell.timer) { clearTimeout(dwell.timer); dwell.timer = null; }
        if (!dwell.queue.length) return;
        var events = dwell.queue.splice(0, 60), uid = me(), base = apiBase();
        if (!uid) return;
        try {
            fetch(base + '/api/publicaciones/engagement', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
                body: JSON.stringify({ userId: uid, events: events })
            }).catch(function () { });
        } catch (e) { }
        if (dwell.queue.length) dwell.timer = setTimeout(dwellFlush, 1000);
    }
    function dwellObserve(root) {
        if (!root || typeof IntersectionObserver === 'undefined' || !me()) return;
        if (!dwell.io) {
            dwell.io = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    var id = entry.target.dataset.pubId;
                    if (!id) return;
                    var big = entry.isIntersecting && (entry.intersectionRatio >= 0.6 || entry.intersectionRect.height >= window.innerHeight * 0.5);
                    dwell.vis[id] = !!big;
                    if (big) dwellStart(id); else dwellStop(id);
                });
            }, { threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] });
            document.addEventListener('visibilitychange', function () {
                if (document.visibilityState === 'hidden') {
                    Object.keys(dwell.since).forEach(dwellStop);
                    dwellFlush();
                } else {
                    Object.keys(dwell.vis).forEach(function (id) { if (dwell.vis[id]) dwellStart(id); });
                }
            });
            window.addEventListener('pagehide', function () { Object.keys(dwell.since).forEach(dwellStop); dwellFlush(); });
        }
        var cards = root.matches && root.matches('.tic-card[data-pub-id]') ? [root] : [].slice.call(root.querySelectorAll('.tic-card[data-pub-id]'));
        cards.forEach(function (card) {
            if (card.__dwellObserved || card.dataset.userId === me()) return;   // tus propios Tics no cuentan
            card.__dwellObserved = true;
            dwell.io.observe(card);
        });
    }

    function hydrate(root) {
        try { dwellObserve(root); } catch (e) { }
        root = root || document;
        var ids = {};
        root.querySelectorAll('[data-uid]').forEach(function (el) { if (el.dataset.uid) ids[el.dataset.uid] = 1; });
        root.querySelectorAll('.tic-likes-line').forEach(function (el) {
            var card = el.closest('[data-pub-id]');
            var pub = card && findPub(card.dataset.pubId);
            if (pub) (pub.likes || []).slice(0, 3).forEach(function (l) { ids[l] = 1; });
        });
        root.querySelectorAll('.tic-comment [data-uid]').forEach(function (el) { if (el.dataset.uid) ids[el.dataset.uid] = 1; });
        Object.keys(ids).forEach(function (uid) {
            getUser(uid).then(function (u) {
                if (!u) return;
                root.querySelectorAll('[data-uid="' + (window.CSS && CSS.escape ? CSS.escape(uid) : uid) + '"]').forEach(function (el) {
                    var role = el.dataset.role;
                    if (role === 'name' || role === 'tag') {
                        if (u.name) {
                            var nm = decodeHtml(u.name), tn = el.firstChild;
                            if (el.children.length && tn && tn.nodeType === 3) tn.nodeValue = nm; /* conserva la insignia de verificado */
                            else if (!el.children.length) el.textContent = nm;
                        }
                    } else if (el.classList.contains('tic-avatar')) {
                        var alt = el.querySelector('img');
                        var needs = !alt || /6VBx3io/.test(alt.getAttribute('src') || '');
                        if (needs && u.avatar && !/6VBx3io/.test(u.avatar)) el.innerHTML = avatarInner(u.name, u.avatar);
                        else if (!alt) el.innerHTML = avatarInner(u.name, u.avatar);
                    }
                });
                if (u.streak > 0) {
                    root.querySelectorAll('.tic-streak[data-streak-uid="' + (window.CSS && CSS.escape ? CSS.escape(uid) : uid) + '"]').forEach(function (el) {
                        var b = el.querySelector('b'); if (b) b.textContent = String(u.streak);
                        el.hidden = false;
                    });
                }
                root.querySelectorAll('.tic-img').forEach(function (img) {
                    var card = img.closest('.tic-card');
                    if (card && card.dataset.userId === uid && u.name) img.alt = CONFIG.translate('tic_alt_photo_of', 'Tic de {{name}}').replace('{{name}}', u.name);
                });
                // resumen de "me gusta" cuando ya conocemos los nombres
                root.querySelectorAll('.tic-card').forEach(function (card) { refreshLikeLine(card); });
            });
        });
    }

    /* Carga de imágenes controlada: solo las cercanas a la pantalla y como mucho 4 a la vez.
     * Así no saturamos el almacenamiento público (r2.dev responde 429 / time-out con muchas peticiones seguidas). */
    var MAX_PARALLEL = 6, active = 0, queue = [];
    /* Las tarjetas del feed piden una versión reducida (720 px, WebP) en vez de la foto de 1440 px: pesa 3-4 veces menos.
     * El visor a pantalla completa sigue usando la original. Si la reducida falla, se reintenta con la original. */
    var CARD_W = 720;
    function sizedSrc(u) {
        if (!u || /[?&]w=/.test(u)) return u;
        if (!/\/media\/[^?]+\.(jpe?g|png|webp|avif)$/i.test(u)) return u;
        return u + '?w=' + CARD_W;
    }
    var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { io.unobserve(en.target); lowRes(en.target); enqueue(en.target); } });
    }, { rootMargin: '1400px 0px' }) : null;

    /* Miniatura mínima (160 px, ~3 KB) que se pinta enseguida de fondo mientras llega la foto buena. */
    function lowRes(img) {
        try {
            var box = img.parentNode, src = img.dataset.src;
            if (!box || box.dataset.lq === '1' || !src || !/\/media\/[^?]+\.(jpe?g|png|webp|avif)$/i.test(src)) return;
            box.dataset.lq = '1';
            var tiny = new Image();
            tiny.onload = function () {
                if (box.classList.contains('is-loaded')) return;
                box.style.background = 'url(' + tiny.src + ') center / cover no-repeat #E9EEF5';
                box.style.animation = 'none';
            };
            tiny.src = src + '?w=160';
        } catch (e) { }
    }
    function enqueue(img) { queue.push(img); pump(); }
    function pump() {
        while (active < MAX_PARALLEL && queue.length) {
            var img = queue.shift();
            if (!img || !img.isConnected || !img.dataset.src) continue;
            active++;
            var done = false;
            var release = function () { if (done) return; done = true; active = Math.max(0, active - 1); pump(); };
            img.addEventListener('load', release, { once: true });
            img.addEventListener('error', release, { once: true });
            img.removeAttribute('src');
            var sized = img.dataset.fullres === '1' ? img.dataset.src : sizedSrc(img.dataset.src);
            img.dataset.sized = sized !== img.dataset.src ? '1' : '0';
            img.src = sized;
        }
    }
    function watch(img) {
        if (!img || img.dataset.watched === '1' || img.getAttribute('src')) return;
        img.dataset.watched = '1';
        if (io) io.observe(img); else enqueue(img);
    }
    /* Precarga forzada de la foto de una tarjeta (la usa el visor para los Tics que vienen despues del actual). */
    function warmImage(root) {
        try {
            var img = root && root.querySelector && root.querySelector('img.tic-img[data-src]');
            if (!img || img.getAttribute('src') || img.dataset.warm === '1') return;
            img.dataset.warm = '1';
            if (io) { try { io.unobserve(img); } catch (e) { } }
            lowRes(img); enqueue(img);
        } catch (e) { }
    }
    function scanImages(root) { (root || document).querySelectorAll('img.tic-img[data-src]').forEach(watch); }
    if ('MutationObserver' in window) {
        new MutationObserver(function (muts) {
            muts.forEach(function (m) {
                m.addedNodes.forEach(function (n) {
                    if (n.nodeType !== 1) return;
                    if (n.matches && n.matches('img.tic-img[data-src]')) watch(n);
                    else if (n.querySelectorAll) scanImages(n);
                });
            });
        }).observe(document.documentElement, { childList: true, subtree: true });
    }

    function imgFail(img) {
        if (img.dataset.sized === '1') { img.dataset.sized = '0'; img.dataset.fullres = '1'; enqueue(img); return; }
        var alts = [];
        try { alts = JSON.parse(img.getAttribute('data-alts') || '[]'); } catch (e) { }
        var next = alts.shift();
        img.setAttribute('data-alts', JSON.stringify(alts));
        if (next) { img.dataset.src = next; img.dataset.tries = '0'; enqueue(img); return; }
        // Si el enlace directo de r2.dev no conecta (bloqueo del proveedor / 429), probar por el propio dominio.
        var direct = /^https:\/\/[a-z0-9-]+\.r2\.dev\/(.+)$/i.exec(img.dataset.src || '');
        if (direct && img.dataset.viaMedia !== '1') {
            img.dataset.viaMedia = '1';
            img.dataset.src = apiBase() + '/media/' + direct[1];
            img.dataset.tries = '0';
            enqueue(img);
            return;
        }
        var tries = Number(img.dataset.tries || 0);
        if (tries < 3) {
            img.dataset.tries = String(tries + 1);
            setTimeout(function () { if (img.isConnected) enqueue(img); }, [1500, 4000, 9000][tries]);
            return;
        }
        if (img.parentNode) img.parentNode.classList.add('is-broken');
    }

    function findPub(id) {
        var list = window.publicationPhotos || [];
        for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
        return tagPubs[String(id)] || null;
    }

    function refreshLikeLine(card) {
        var pub = findPub(card.dataset.pubId);
        var line = card.querySelector('.tic-likes-line');
        if (!pub || !line) return;
        line.innerHTML = likeSummary(pub.likes, me());
    }

    function applyLikeState(card, liked, count) {
        var btn = card.querySelector('.tic-like');
        if (!btn) return;
        btn.classList.toggle('is-liked', liked);
        btn.setAttribute('aria-pressed', String(liked));
        var c = btn.querySelector('.tic-count');
        if (c) c.textContent = String(count);
        if (liked) {
            btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
        }
    }

    function playBurst(media) {
        var b = media && media.querySelector('.tic-burst');
        if (!b) return;
        b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');
    }

    var inflight = {};
    function setLike(pubId, want, card) {
        // want: true (dar like), false (quitar), null (alternar)
        var uid = me();
        if (!uid) { if (window.showToast) showToast(CONFIG.translate('tic_user_not_identified', 'Usuario no identificado')); return; }
        var pub = findPub(pubId);
        var likes = pub ? pub.likes : null;
        var currently = likes ? likes.some(function (id) { return String(id) === String(uid); }) : !!(card && card.querySelector('.tic-like.is-liked'));
        var target = want == null ? !currently : want;
        if (target === currently) return;
        if (inflight[pubId]) return;
        inflight[pubId] = true;

        function paint(state) {
            if (pub && likes) {
                var idx = likes.findIndex(function (id) { return String(id) === String(uid); });
                if (state && idx < 0) likes.push(uid);
                if (!state && idx >= 0) likes.splice(idx, 1);
            }
            var n = pub ? pub.likes.length : 0;
            var cards = document.querySelectorAll('.tic-card[data-pub-id="' + pubId + '"]');
            cards.forEach(function (c) {
                var count = pub ? n : (parseInt((c.querySelector('.tic-count') || {}).textContent, 10) || 0) + (state ? 1 : -1);
                applyLikeState(c, state, Math.max(0, count));
                refreshLikeLine(c);
            });
        }
        paint(target);
        fetch(apiBase() + '/api/publicaciones/' + encodeURIComponent(pubId) + '/like', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: uid })
        }).then(function (r) {
            if (!r.ok) throw new Error('like');
            return r.json();
        }).then(function (data) {
            // el servidor alterna; si su resultado no coincide, nos alineamos con él
            if (Array.isArray(data.likes) && pub) {
                pub.likes.length = 0;
                data.likes.forEach(function (x) { pub.likes.push(x); });
                var real = data.likes.some(function (id) { return String(id) === String(uid); });
                document.querySelectorAll('.tic-card[data-pub-id="' + pubId + '"]').forEach(function (c) {
                    applyLikeState(c, real, pub.likes.length);
                    refreshLikeLine(c);
                });
            }
            hydrate(document.querySelector('.tic-card[data-pub-id="' + pubId + '"]') || document);
        }).catch(function () {
            paint(!target);
            if (window.showToast) showToast(CONFIG.translate('tic_like_failed', 'No se pudo dar me gusta. Inténtalo de nuevo.'));
        }).then(function () { delete inflight[pubId]; });
    }

    /* El teclado de Android reduce la ventana: hay que volver a mostrar el cuadro de texto cuando
       termina de abrirse, si no queda tapado detras del teclado. En el visor a pantalla completa
       (estilo TikTok) la hoja de comentarios ya esta fijada abajo, asi que en vez de desplazar toda
       la pantalla (scrollIntoView) solo subimos esa hoja justo encima del teclado. */
    function keepInputVisible(input) {
        if (!input || input.closest('.tv-slide')) return;
        var show = function () {
            try { if (document.activeElement === input) input.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { }
        };
        [80, 250, 500].forEach(function (ms) { setTimeout(show, ms); });
    }
    // iOS: al tocar "enviar" el campo pierde el foco, la hoja de comentarios recupera su tamaño normal y el boton se
    // mueve bajo el dedo: el toque acababa "fuera de la hoja" y la cerraba. Se evita quitando el foco con el boton
    // (mousedown) y, por si acaso, ignorando cierres por toque justo despues de bajar el teclado.
    var lastCommentBlurAt = 0;
    document.addEventListener('mousedown', function (e) {
        if (e.target && e.target.closest && e.target.closest('[data-act="send-comment"]')) e.preventDefault();
    });
    (function watchKeyboard() {
        var vv = window.visualViewport;
        function activeCommentInput() {
            var el = document.activeElement;
            return (el && el.classList && el.classList.contains('tic-comment-input')) ? el : null;
        }
        function syncViewerPanel() {
            if (!vv) return;
            var input = activeCommentInput();
            var panel = input && input.closest('.tv-slide .tic-comments');
            if (!panel) return;
            var keyboardInset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
            // Mientras se escribe, la hoja se encoge (se ocultan los demas comentarios) para que
            // el Tic se siga viendo igual de bien; solo flota el cuadro de escribir, justo encima
            // del teclado, en vez de subir toda la hoja (lo que antes tapaba la parte de arriba del Tic).
            panel.style.transform = keyboardInset > 40 ? 'translateY(-' + keyboardInset + 'px)' : '';
        }
        var onResize = function () {
            var el = document.activeElement;
            if (el && el.classList && el.classList.contains('tic-comment-input')) keepInputVisible(el);
            syncViewerPanel();
        };
        window.addEventListener('resize', onResize);
        if (vv) vv.addEventListener('resize', onResize);
        document.addEventListener('focusin', function (e) {
            if (e.target && e.target.classList && e.target.classList.contains('tic-comment-input')) {
                keepInputVisible(e.target);
                var panel = e.target.closest('.tv-slide .tic-comments');
                if (panel) {
                    // height:auto no se puede animar con CSS (es uno de los valores que las
                    // transiciones no interpolan), asi que al añadir tv-typing el alto saltaba
                    // de golpe de 85% a su tamaño final: se veia igual que si hubieras deslizado
                    // la hoja entera para cerrarla. Calculamos aqui el alto final en pixeles
                    // (tirador + formulario) para que la transicion "height" de abajo (tic_viewer.css)
                    // si pueda animarlo con normalidad, como el resto de la hoja.
                    // Estilo "TikTok": la barra de escribir va pegada al teclado (la barra de abajo de la app se
                    // oculta) y la lista de comentarios sigue viéndose encima.
                    panel.classList.add('tv-typing');
                    document.body.classList.add('tv-composing');
                    panel.style.bottom = '0px';
                    var cardEl = panel.closest('.tic-card');
                    if (cardEl) closeStickerTray(cardEl);
                }
                // iOS intenta "ayudar" desplazando el contenedor con scroll nativo (el carrusel
                // de Tics) para que el campo de texto quede visible, por encima de lo que ya
                // movemos nosotros con el transform de abajo: eso es lo que hacia que el teclado
                // subiera demasiado y dejara un hueco grande entre el teclado y el comentario.
                // Bloqueamos ese scroll nativo mientras se escribe; nuestro transform es el unico
                // que mueve la hoja.
                var scroller = e.target.closest('.tv-scroll');
                if (scroller) scroller.style.overflow = 'hidden';
                syncViewerPanel();
            }
        });
        document.addEventListener('focusout', function (e) {
            if (!(e.target && e.target.classList && e.target.classList.contains('tic-comment-input'))) return;
            lastCommentBlurAt = Date.now();
            var panel = e.target.closest('.tv-slide .tic-comments');
            var scroller = e.target.closest('.tv-scroll');
            if (panel) setTimeout(function () {
                panel.style.transform = '';
                panel.classList.remove('tv-typing');
                document.body.classList.remove('tv-composing');
                try {
                    var navEl = document.querySelector('.bottom-nav-bar');
                    var navH = (navEl && getComputedStyle(navEl).display !== 'none') ? Math.round(navEl.getBoundingClientRect().height) : 0;
                    panel.style.bottom = navH + 'px';
                } catch (err) { }
            }, 50);
            if (scroller) setTimeout(function () { scroller.style.overflow = ''; }, 50);
        });
    })();

    function toggleComments(card, forceOpen) {
        var panel = card.querySelector('.tic-comments');
        if (!panel) return;
        var inViewer = !!panel.closest('.tv-slide');
        var open = inViewer ? panel.classList.contains('tc-open') : panel.style.display === 'block';
        var next = forceOpen === true ? true : !open;
        if (inViewer) {
            // En el visor a pantalla completa la hoja se desliza desde abajo (como TikTok) en
            // vez de aparecer/desaparecer de golpe: se anima con la clase tc-open (ver
            // tic_viewer.css) y solo se quita del flujo (display:none) cuando termina de bajar.
            if (next) {
                panel.classList.remove('tc-open');
                panel.style.transform = '';
                panel.style.display = 'flex';
                // La barra inferior de la app queda por encima del visor: la hoja se apoya sobre ella
                // (si no, tapaba el cuadro de escribir los comentarios).
                try {
                    var navEl = document.querySelector('.bottom-nav-bar');
                    var navH = (navEl && getComputedStyle(navEl).display !== 'none') ? Math.round(navEl.getBoundingClientRect().height) : 0;
                    panel.style.bottom = navH + 'px';
                    panel.style.paddingBottom = '10px';
                } catch (e) { }
                // panel.offsetHeight (forzar reflow sincrono) no basta en WKWebView/iOS: a veces
                // el navegador no llega a pintar ese frame "cerrado" antes de aplicar tc-open, y
                // la hoja aparece ya abierta sin animar. Con un doble requestAnimationFrame nos
                // aseguramos de que el frame de abajo del todo (translateY 100%) se ha pintado de
                // verdad antes de pedir la transicion hacia arriba.
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () {
                        panel.classList.add('tc-open');
                    });
                });
            } else {
                panel.classList.remove('tc-open');
                panel.style.transform = '';
                setTimeout(function () {
                    if (!panel.classList.contains('tc-open')) panel.style.display = 'none';
                }, 320);
            }
        } else {
            panel.style.display = next ? 'block' : 'none';
        }
        card.classList.toggle('comments-open', next);
        if (next && card.dataset.pubId && card.dataset.userId !== me()) dwellQueue({ id: card.dataset.pubId, ms: 0, act: 'open' });
        if (next) {
            // No enfocamos el campo de texto al abrir: se ven los comentarios primero,
            // y el teclado solo aparece si el usuario toca el campo para escribir.
            hydrate(panel);
        }
    }

    function clearReply(card) {
        delete card.dataset.replyTo;
        var input = card.querySelector('.tic-comment-input');
        if (input && input.dataset.basePlaceholder != null) input.placeholder = input.dataset.basePlaceholder;
    }
    function startReply(card, btn) {
        var input = card.querySelector('.tic-comment-input');
        if (!input) return;
        if (input.dataset.basePlaceholder == null) input.dataset.basePlaceholder = input.placeholder || '';
        card.dataset.replyTo = btn.dataset.cid || '';
        var who = btn.dataset.cuser ? '@' + btn.dataset.cuser + ' ' : '';
        input.placeholder = CONFIG.translate('tic_replying_to', 'Respondiendo a') + ' ' + (btn.dataset.cname || '');
        if (who && input.value.indexOf(who) !== 0) input.value = who + input.value;
        input.focus();
    }

    function submitComment(card, stickerId) {
        var pubId = card.dataset.pubId;
        var input = card.querySelector('.tic-comment-input');
        var btn = card.querySelector('[data-act="send-comment"]');
        if (!input || !btn) return;
        var text = stickerId ? '' : input.value.trim();
        var uid = me();
        if ((!text && !stickerId) || !uid) return;
        btn.disabled = true;
        fetch(apiBase() + '/api/publicaciones/' + encodeURIComponent(pubId) + '/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: uid, text: text, stickerId: stickerId || undefined, replyToId: card.dataset.replyTo || undefined })
        }).then(function (r) {
            if (!r.ok) throw new Error('comment');
            return r.json();
        }).then(function (data) {
            var pub = findPub(pubId);
            var comments = data.comments || [];
            if (pub) pub.comments = comments;
            if (!stickerId) { input.value = ''; input.style.height = ''; }
            clearReply(card);
            if (stickerId) closeStickerTray(card);
            document.querySelectorAll('.tic-card[data-pub-id="' + pubId + '"]').forEach(function (c) {
                var list = c.querySelector('.tic-comment-list');
                if (list) list.innerHTML = comments.map(commentHTML).join('');
                c.querySelectorAll('.tic-ccount').forEach(function (n) { n.textContent = String(comments.length); });
                c.querySelectorAll('.tic-ccount2').forEach(function (n) { n.textContent = String(comments.length); });
                c.querySelectorAll('.tic-ccount3').forEach(function (n) { n.textContent = String(comments.length); });
                var vc = c.querySelector('.tic-viewcomments');
                if (vc) vc.hidden = !comments.length;
                hydrate(c);
                var last = list && list.lastElementChild;
                if (last) last.classList.add('is-new');
            });
        }).catch(function () {
            if (window.showToast) showToast(CONFIG.translate('tic_comment_failed', 'No se pudo enviar el comentario'));
        }).then(function () { btn.disabled = false; });
    }


    /* ---------- Stickers de los usuarios ---------- */
    var stickerCache = null, stickerTab = 'fav';
    function loadStickers(force) {
        if (stickerCache && !force) return Promise.resolve(stickerCache);
        return apiCall('GET', '/api/stickers').then(function (r) {
            var d = r.data || {};
            stickerCache = { favorites: d.favorites || [], recent: d.recent || [], trending: d.trending || [], mine: d.stickers || [] };
            return stickerCache;
        });
    }
    function stickerTrayHTML(data) {
        var tabs = [['fav', ICON.star, 'tic_sticker_tab_fav', 'Favoritos'], ['recent', ICON.clock, 'tic_sticker_tab_recent', 'Recientes'], ['trend', ICON.flame, 'tic_sticker_tab_trend', 'De moda hoy']];
        var h = '<div class="tic-stk-tabs">';
        tabs.forEach(function (t) {
            h += '<button type="button" class="tic-stk-tab' + (stickerTab === t[0] ? ' on' : '') + '" data-stk-tab="' + t[0] + '" aria-label="' + esc(CONFIG.translate(t[2], t[3])) + '">' + t[1] + '</button>';
        });
        h += '<button type="button" class="tic-stk-tab tic-stk-new" data-stk-add="1" aria-label="' + esc(CONFIG.translate('tic_sticker_add', 'Crear sticker')) + '">' + ICON.plus + '</button></div>';
        var list = stickerTab === 'fav' ? data.favorites : stickerTab === 'recent' ? data.recent : data.trending;
        h += '<div class="tic-stk-grid">';
        list.forEach(function (st) {
            h += '<button type="button" class="tic-stk" data-stk="' + esc(st.id) + '"><img src="' + esc(assetUrl(st.url)) + '" alt="" loading="lazy" decoding="async"></button>';
        });
        h += '</div>';
        var msg = list.length ? CONFIG.translate('tic_sticker_hint', 'Toca uno para enviarlo. Mantén pulsado para más opciones.') :
            (stickerTab === 'fav' ? CONFIG.translate('tic_sticker_empty_fav', 'Aquí salen tus favoritos y los stickers que creas. Toca + para crear uno (mejor un PNG con fondo transparente).') :
            stickerTab === 'recent' ? CONFIG.translate('tic_sticker_empty_recent', 'Aún no has usado ningún sticker.') :
            CONFIG.translate('tic_sticker_empty_trend', 'Hoy todavía no hay stickers de moda. ¡Sé el primero!'));
        return h + '<p class="tic-stk-hint">' + esc(msg) + '</p>';
    }
    function paintStickerTray(card) {
        var tray = card.querySelector('.tic-stk-tray');
        if (tray && stickerCache) tray.innerHTML = stickerTrayHTML(stickerCache);
    }
    function renderStickerTray(card) {
        var tray = card.querySelector('.tic-stk-tray');
        if (!tray) return;
        if (!stickerCache) tray.innerHTML = '<p class="tic-stk-hint">' + esc(CONFIG.translate('tic_loading', 'Cargando…')) + '</p>';
        else paintStickerTray(card);
        loadStickers(true).then(function () { paintStickerTray(card); }).catch(function () {
            tray.innerHTML = '<p class="tic-stk-hint">' + esc(CONFIG.translate('tic_sticker_error', 'No se pudieron cargar los stickers.')) + '</p>';
        });
    }
    function closeStickerTray(card) {
        var tray = card.querySelector('.tic-stk-tray');
        if (tray) tray.hidden = true;
        var panel = card.querySelector('.tic-comments');
        if (panel) panel.classList.remove('tv-stickers');
        var b = card.querySelector('[data-act="stickers"]');
        if (b) b.classList.remove('is-on');
    }
    function toggleStickerTray(card) {
        var tray = card.querySelector('.tic-stk-tray');
        if (!tray) return;
        if (!tray.hidden) { closeStickerTray(card); return; }
        var input = card.querySelector('.tic-comment-input');
        if (input && document.activeElement === input) input.blur(); // baja el teclado para que se vea la bandeja
        tray.hidden = false;
        var panel = card.querySelector('.tic-comments');
        // Por si quedo algo de un arrastre o del teclado: la hoja con la bandeja siempre parte de su sitio, sin desplazar
        if (panel) { panel.style.transform = ''; panel.style.transition = ''; }
        if (panel) panel.classList.add('tv-stickers');
        var b = card.querySelector('[data-act="stickers"]');
        if (b) b.classList.add('is-on');
        renderStickerTray(card);
    }
    // La imagen se reduce a 512 px en el movil antes de subirla (menos datos; el servidor la vuelve a ajustar).
    function fileToStickerData(file) {
        return new Promise(function (resolve, reject) {
            var fr = new FileReader();
            fr.onerror = function () { reject(new Error('read')); };
            fr.onload = function () {
                var img = new Image();
                img.onerror = function () { reject(new Error('img')); };
                img.onload = function () {
                    var max = 512, w = img.naturalWidth, h = img.naturalHeight;
                    var k = Math.min(1, max / Math.max(w, h));
                    var cv = document.createElement('canvas');
                    cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
                    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
                    var out = cv.toDataURL('image/webp', 0.85);
                    if (out.indexOf('data:image/webp') !== 0) out = cv.toDataURL('image/png');
                    resolve(out);
                };
                img.src = fr.result;
            };
            fr.readAsDataURL(file);
        });
    }
    function pickAndUploadSticker(card) {
        var fi = document.createElement('input');
        fi.type = 'file'; fi.accept = 'image/png,image/webp,image/jpeg';
        fi.style.display = 'none';
        document.body.appendChild(fi);
        fi.addEventListener('change', function () {
            var f = fi.files && fi.files[0];
            if (fi.parentNode) fi.parentNode.removeChild(fi);
            if (!f) return;
            fileToStickerData(f).then(function (data) {
                return apiCall('POST', '/api/stickers', { image: data });
            }).then(function (r) {
                if (!r.ok) { toastMsg((r.data && r.data.message) || CONFIG.translate('tic_sticker_upload_failed', 'No se pudo subir el sticker')); return; }
                stickerTab = 'fav';
                renderStickerTray(card);
            }).catch(function () { toastMsg(CONFIG.translate('tic_sticker_upload_failed', 'No se pudo subir el sticker')); });
        });
        fi.click();
    }
    (function bindStickerTray() {
        var pressTimer = null, longPressed = false;
        function findSticker(id) {
            var d = stickerCache || {}, all = [].concat(d.favorites || [], d.recent || [], d.trending || []);
            for (var k = 0; k < all.length; k++) if (all[k].id === id) return all[k];
            return null;
        }
        function stickerMenu(card, id) {
            var st = findSticker(id); if (!st) return;
            var tray = card.querySelector('.tic-stk-tray');
            var old = tray.querySelector('.tic-stk-menu'); if (old) old.remove();
            var m = document.createElement('div'); m.className = 'tic-stk-menu';
            m.innerHTML = '<button type="button" data-m="fav">' + esc(st.fav ? CONFIG.translate('tic_sticker_unfav', 'Quitar de favoritos') : CONFIG.translate('tic_sticker_fav', 'Añadir a favoritos')) + '</button>' +
                (st.own ? '<button type="button" data-m="del" class="danger">' + esc(CONFIG.translate('tic_sticker_delete', 'Borrar sticker')) + '</button>' : '') +
                '<button type="button" data-m="x">' + esc(CONFIG.translate('tic_back', 'Cancelar')) + '</button>';
            tray.insertBefore(m, tray.firstChild);
            m.addEventListener('click', function (ev) {
                var b = ev.target.closest('[data-m]'); if (!b) return;
                ev.stopPropagation();
                m.remove();
                if (b.dataset.m === 'fav') {
                    apiCall(st.fav ? 'DELETE' : 'POST', '/api/stickers/' + encodeURIComponent(id) + '/favorite').then(function () { renderStickerTray(card); });
                } else if (b.dataset.m === 'del') {
                    if (!window.confirm(CONFIG.translate('tic_sticker_delete_confirm', '¿Borrar este sticker?'))) return;
                    apiCall('DELETE', '/api/stickers/' + encodeURIComponent(id)).then(function () { renderStickerTray(card); });
                }
            });
        }
        function deleteSticker(card, id) { stickerMenu(card, id); }
        document.addEventListener('click', function (e) {
            var tray = e.target.closest && e.target.closest('.tic-stk-tray');
            if (!tray) return;
            var card = tray.closest('.tic-card');
            if (!card) return;
            e.stopPropagation();
            if (longPressed) { longPressed = false; return; }
            if (e.target.closest('.tic-stk-menu')) return;
            if (e.target.closest('[data-stk-add]')) return pickAndUploadSticker(card);
            var tab = e.target.closest('[data-stk-tab]');
            if (tab) { stickerTab = tab.dataset.stkTab; return paintStickerTray(card); }
            var tile = e.target.closest('[data-stk]');
            if (tile) submitComment(card, tile.dataset.stk);
        });
        document.addEventListener('touchstart', function (e) {
            var tile = e.target.closest && e.target.closest('.tic-stk-tray [data-stk]');
            if (!tile) return;
            longPressed = false;
            clearTimeout(pressTimer);
            pressTimer = setTimeout(function () {
                longPressed = true;
                var card = tile.closest('.tic-card');
                if (card) deleteSticker(card, tile.dataset.stk);
            }, 650);
        }, { passive: true });
        ['touchend', 'touchmove', 'touchcancel'].forEach(function (ev) {
            document.addEventListener(ev, function () { clearTimeout(pressTimer); }, { passive: true });
        });
        document.addEventListener('contextmenu', function (e) {
            var tile = e.target.closest && e.target.closest('.tic-stk-tray [data-stk]');
            if (!tile) return;
            e.preventDefault();
            var card = tile.closest('.tic-card');
            if (card) deleteSticker(card, tile.dataset.stk);
        });
    })();

    /* ---------- eventos delegados ---------- */
    document.addEventListener('click', function (e) {
        var tagEl = e.target.closest && e.target.closest('[data-hashtag]');
        if (tagEl) {
            e.preventDefault();
            e.stopPropagation();
            openHashtag(tagEl.dataset.hashtag);
        }
    }, true);
    document.addEventListener('click', function (e) {
        var mentionEl = e.target.closest && e.target.closest('[data-mention]');
        if (mentionEl) {
            e.preventDefault();
            e.stopPropagation();
            openMentionedProfile(mentionEl.dataset.mention);
        }
    }, true);
    document.addEventListener('click', function (e) {
        var todayEl = e.target.closest && e.target.closest('[data-act="today-tics"]');
        if (!todayEl) return;
        var uidToday = todayEl.dataset.uid;
        var todayList = todayTicsForUser(uidToday);
        if (todayList.length && window.SocialTicViewer) {
            e.preventDefault();
            e.stopPropagation();
            window.SocialTicViewer.open(todayList[0].id, todayList);
        }
        // Si no hay Tics de hoy para mostrar (p. ej. se borraron tras pintar la tarjeta), se deja
        // el comportamiento normal del enlace y se va al perfil.
    }, true);
    document.addEventListener('click', function (e) {
        // En el visor a pantalla completa, tocar fuera de la hoja de comentarios la cierra (como TikTok).
        var openCard = e.target.closest('.tic-card.comments-open');
        if (openCard && openCard.closest('.tv-slide') && !e.target.closest('.tic-comments, [data-act]')) {
            if (Date.now() - lastCommentBlurAt < 700) return; // iOS: el toque que bajo el teclado no debe cerrar la hoja
            toggleComments(openCard, false);
            return;
        }
        var actEl = e.target.closest('[data-act]');
        var card = e.target.closest('.tic-card');
        if (!actEl || !card) return;
        var act = actEl.dataset.act;
        if (act === 'like') { e.stopPropagation(); setLike(card.dataset.pubId, null, card); }
        else if (act === 'comments') { e.stopPropagation(); toggleComments(card); }
        else if (act === 'send-comment') { e.stopPropagation(); submitComment(card); }
        else if (act === 'stickers') { e.stopPropagation(); toggleStickerTray(card); }
        else if (act === 'reply-comment') { e.stopPropagation(); startReply(card, actEl); }
        else if (act === 'report-comment') { e.stopPropagation(); openReportComment(actEl.dataset.cuid, actEl.dataset.cname, card.dataset.pubId, actEl.dataset.cid); }
        else if (act === 'tic-menu') { e.stopPropagation(); openTicMenu(card); }
        else if (act === 'save-tic') { e.stopPropagation(); openSaveSheet(card.dataset.pubId); }
        else if (act === 'send-tic') { e.stopPropagation(); openSendSheet(card.dataset.pubId); }
        else if (act === 'theme') { e.stopPropagation(); toggleThemeChip(actEl, card); }
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey && e.target.classList && e.target.classList.contains('tic-comment-input')) {
            e.preventDefault();
            var card = e.target.closest('.tic-card');
            if (card) submitComment(card);
        }
    });
    /* El cuadro de comentario es un textarea que crece hacia abajo (en vez de desplazar el
       texto hacia la derecha) a medida que el texto ocupa mas de una linea. */
    function autoGrowCommentInput(el) {
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 140) + 'px';
    }
    document.addEventListener('input', function (e) {
        if (e.target && e.target.classList && e.target.classList.contains('tic-comment-input')) {
            autoGrowCommentInput(e.target);
        }
    });

    function doubleLike(media) {
        var card = media.closest('.tic-card');
        if (!card) return;
        playBurst(media);
        setLike(card.dataset.pubId, true, card); // doble toque solo da like
    }
    // Ratón: doble clic nativo
    document.addEventListener('dblclick', function (e) {
        var media = e.target.closest && e.target.closest('.tic-media');
        if (!media) return;
        e.preventDefault();
        doubleLike(media);
    });
    // Táctil: detectamos dos toques seguidos (dblclick no es fiable en móviles).
    // Usamos pointerdown+pointerup (no solo pointerup) para no perder el toque cuando
    // el doble toque es muy rápido, y comprobamos que no hubo arrastre de por medio.
    var lastTap = { t: 0, x: 0, y: 0, el: null };
    var tapStart = null;

    /* Arrastrar la hoja de comentarios hacia abajo para cerrarla (como en TikTok).
       Solo se activa tocando la cabecera/tirador, o si la lista ya esta arriba del todo
       (asi no interfiere con el scroll normal de los comentarios). */
    (function sheetDrag() {
        // Usamos eventos touch "de toda la vida" (touchstart/touchmove/touchend), no Pointer
        // Events: en el WKWebView de Capacitor en iOS los Pointer Events no siguen el dedo de
        // forma fiable en este gesto (es lo que hacia que la hoja apareciera/desapareciera de
        // golpe en vez de seguir al dedo). El swipe horizontal de cambiar de seccion (mas abajo
        // en tic_viewer.js) ya usa touch events puros y SI funciona bien en el dispositivo, asi
        // que seguimos el mismo patron aqui.
        var st = null;
        function closePanel(panel) {
            var card = panel.closest('.tic-card');
            if (card) toggleComments(card, false);
        }
        document.addEventListener('touchstart', function (e) {
            if (e.touches.length !== 1) return;
            var t = e.touches[0];
            var panel = t.target.closest && t.target.closest('.tv-slide .tic-comments');
            if (!panel) return;
            if (t.target.closest('input, button, a, textarea')) return;
            var head = t.target.closest('.tic-comments-head');
            var onHandle = t.target === panel || !!head;
            var list = panel.querySelector('.tic-comment-list');
            if (!onHandle && list && list.scrollTop > 0) return;
            st = { panel: panel, startY: t.clientY, dy: 0 };
            panel.style.transition = 'none';
        }, { passive: true });
        document.addEventListener('touchmove', function (e) {
            if (!st) return;
            var t = e.touches[0];
            if (!t) return;
            var dy = Math.max(0, t.clientY - st.startY);
            if (dy <= 0) return;
            e.preventDefault();
            st.dy = dy;
            st.panel.style.transform = 'translateY(' + dy + 'px)';
        }, { passive: false });
        function endDrag() {
            if (!st) return;
            var panel = st.panel, dy = st.dy;
            panel.style.transition = 'transform .18s ease';
            if (dy > 90) {
                panel.style.transform = 'translateY(100%)';
                setTimeout(function () {
                    closePanel(panel);
                    panel.style.transition = '';
                    panel.style.transform = '';
                }, 160);
            } else {
                panel.style.transform = '';
            }
            st = null;
        }
        document.addEventListener('touchend', endDrag, { passive: true });
        document.addEventListener('touchcancel', endDrag, { passive: true });
    })();

    document.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse') return;
        var media = e.target.closest && e.target.closest('.tic-media');
        if (!media || e.target.closest('[data-act], a, button, input, .tic-comments')) { tapStart = null; return; }
        tapStart = { media: media, x: e.clientX, y: e.clientY };
    }, { passive: true });
    document.addEventListener('pointerup', function (e) {
        if (e.pointerType === 'mouse') return;
        var media = e.target.closest && e.target.closest('.tic-media');
        if (!media) return;
        if (e.target.closest('[data-act], a, button, input, .tic-comments')) { lastTap.t = 0; tapStart = null; return; } // tocar botones no cuenta como doble toque
        // Si hubo arrastre (scroll/swipe) entre el pointerdown y el pointerup, no cuenta como toque.
        var wasDrag = !tapStart || tapStart.media !== media ||
            Math.abs(e.clientX - tapStart.x) > 18 || Math.abs(e.clientY - tapStart.y) > 18;
        tapStart = null;
        if (wasDrag) { lastTap.t = 0; return; }
        var now = Date.now();
        if (lastTap.el === media && now - lastTap.t < 400 && Math.abs(e.clientX - lastTap.x) < 60 && Math.abs(e.clientY - lastTap.y) < 60) {
            doubleLike(media);
            lastTap.t = 0;
        } else {
            lastTap = { t: now, x: e.clientX, y: e.clientY, el: media };
        }
    }, { passive: true });

    /* ---------- compatibilidad con el código antiguo de home.html ---------- */
    function installCompat() {
        window.toggleLikePublication = function (pubId, event) {
            if (event && event.stopPropagation) event.stopPropagation();
            var card = document.querySelector('.tic-card[data-pub-id="' + pubId + '"]');
            setLike(pubId, null, card);
        };
        window.handleImageDoubleClick = function (pubId, event) {
            if (event && event.stopPropagation) event.stopPropagation();
            var media = document.querySelector('.tic-media[data-pub-id="' + pubId + '"]');
            if (media) playBurst(media);
            setLike(pubId, true, media && media.closest('.tic-card'));
        };
        window.openPublicationComments = function (pubId, event) {
            if (event && event.stopPropagation) event.stopPropagation();
            var card = document.querySelector('.tic-card[data-pub-id="' + pubId + '"]');
            if (card) toggleComments(card);
        };
        window.submitPublicationComment = function (pubId, event) {
            if (event && event.stopPropagation) event.stopPropagation();
            var card = document.querySelector('.tic-card[data-pub-id="' + pubId + '"]');
            if (card) submitComment(card);
        };
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installCompat);
    else installCompat();
    window.addEventListener('load', installCompat);

    /* ---------- Menú del Tic: editar / visibilidad / borrar (propios) · bloquear / reportar (ajenos) ---------- */
    var VIS_LABEL = { get public() { return CONFIG.translate('vis_public', 'Público'); }, get friends() { return CONFIG.translate('vis_friends', 'Solo amigos'); }, get private() { return CONFIG.translate('vis_private', 'Solo yo'); } };
    var VIS_HELP = {
        get public() { return CONFIG.translate('vis_help_public', 'Lo puede ver cualquiera que pueda ver tu perfil.'); },
        get friends() { return CONFIG.translate('vis_help_friends', 'Solo lo ven tus amigos.'); },
        get private() { return CONFIG.translate('vis_help_private', 'Solo lo ves tú.'); }
    };
    function REPORT_REASONS_LIST() { return [
        ['spam', CONFIG.translate('report_spam', 'Spam o publicidad')],
        ['acoso', CONFIG.translate('report_harassment', 'Acoso o bullying')],
        ['contenido_inapropiado', CONFIG.translate('report_inappropriate', 'Contenido inapropiado')],
        ['suplantacion', CONFIG.translate('report_impersonation', 'Suplanta la identidad de otra persona')],
        ['menor_de_edad', CONFIG.translate('report_minor', 'Persona menor de edad')],
        ['otro', CONFIG.translate('report_other', 'Otro motivo')]
    ]; }
    var SVG_MORE = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>';
    var SVG_LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>';

    function decodeHtml(str) {
        var t = document.createElement('textarea');
        t.innerHTML = String(str == null ? '' : str);
        return t.value;
    }
    function normVis(v) { return (v === 'friends' || v === 'private') ? v : 'public'; }

    function toastMsg(msg) {
        if (window.showToast) { window.showToast(msg); return; }
        var el = document.getElementById('tic-mini-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'tic-mini-toast';
            el.className = 'tic-mini-toast';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(el._t);
        el._t = setTimeout(function () { el.classList.remove('show'); }, 3200);
    }

    function apiCall(method, path, body) {
        return fetch(apiBase() + path, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined
        }).then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (data) { return { ok: r.ok, status: r.status, data: data || {} }; });
        }).catch(function () { return { ok: false, status: 0, data: { message: CONFIG.translate('generic_connection_error', 'Error de conexión') } }; });
    }

    function ensureSheetStyle() {
        if (document.getElementById('tic-sheet-style')) return;
        var st = document.createElement('style');
        st.id = 'tic-sheet-style';
        st.textContent = [
            '.tic-more{margin-left:auto;flex:none;width:40px;height:40px;border:0;border-radius:50%;background:transparent;color:#49454F;display:grid;place-items:center;cursor:pointer;-webkit-tap-highlight-color:transparent}',
            '.tic-more:hover,.tic-more:active{background:rgba(27,58,92,.09)}',
            '.tic-more svg{width:22px;height:22px}',
            '.tic-vis{display:inline-flex;align-items:center;gap:4px;color:#79747E}',
            '.tic-vis svg{width:12px;height:12px}',
            '.tsheet-back{position:fixed;inset:0;z-index:30000;background:rgba(9,16,28,.55);display:flex;align-items:flex-end;justify-content:center;animation:tsFade .18s ease both}',
            '.tsheet{width:min(520px,100%);max-height:88vh;overflow-y:auto;background:#fff;border-radius:22px 22px 0 0;padding:8px 16px calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -10px 40px rgba(0,0,0,.25);animation:tsUp .22s cubic-bezier(.2,.8,.2,1) both;font-family:inherit;color:#1D1B20}',
            '@media (min-width:700px){.tsheet-back{align-items:center}.tsheet{border-radius:22px}}',
            '.tsheet-grab{width:40px;height:4px;border-radius:4px;background:#D0D5DD;margin:6px auto 10px}',
            '.tsheet h3{margin:4px 4px 10px;font-size:16px;color:#1B3A5C}',
            '.tsheet p.ts-note{margin:0 4px 12px;font-size:13px;color:#6B7280;line-height:1.4}',
            '.ts-btn{display:flex;align-items:center;gap:12px;width:100%;text-align:left;border:0;background:transparent;padding:14px 8px;border-radius:12px;font-size:15px;color:#1D1B20;cursor:pointer;font-family:inherit}',
            '.ts-btn:hover,.ts-btn:active{background:#F1F4F9}',
            '.ts-btn.danger{color:#B3261E}',
            '.ts-btn[disabled]{opacity:.55;pointer-events:none}',
            '.ts-opt{display:flex;align-items:flex-start;gap:12px;width:100%;text-align:left;border:1.5px solid #E1E6EE;background:#fff;padding:12px 14px;border-radius:14px;margin-bottom:8px;cursor:pointer;font-family:inherit}',
            '.ts-opt.sel{border-color:#00A3FF;background:#F0F9FF}',
            '.ts-opt b{display:block;font-size:14.5px;color:#1D1B20}',
            '.ts-opt span{display:block;font-size:12.5px;color:#6B7280;margin-top:2px}',
            '.ts-radio{flex:none;width:18px;height:18px;border-radius:50%;border:2px solid #B8C0CC;margin-top:2px;position:relative}',
            '.ts-opt.sel .ts-radio{border-color:#00A3FF}',
            '.ts-opt.sel .ts-radio:after{content:"";position:absolute;inset:3px;border-radius:50%;background:#00A3FF}',
            '.tsheet textarea{width:100%;box-sizing:border-box;border:1.5px solid #D7DBE8;border-radius:14px;padding:12px 14px;font-size:14.5px;font-family:inherit;resize:vertical;outline:none;min-height:96px}',
            '.tsheet textarea:focus{border-color:#00A3FF}',
            '.ts-row{display:flex;gap:10px;margin-top:12px}',
            '.ts-row button{flex:1;border:0;border-radius:14px;padding:13px;font-size:14.5px;font-weight:600;cursor:pointer;font-family:inherit}',
            '.ts-primary{background:#1B3A5C;color:#fff}',
            '.ts-ghost{background:#EEF2F7;color:#1B3A5C}',
            '.ts-danger{background:#B3261E;color:#fff}',
            '.ts-row button[disabled]{opacity:.6}',
            '.ts-link-row{display:flex;align-items:center;gap:12px;width:100%;text-align:left;border:1.5px solid #E1E6EE;background:#fff;padding:12px 14px;border-radius:14px;margin-bottom:10px;cursor:pointer;font-family:inherit}',
            '.ts-link-row:hover,.ts-link-row:active{background:#F1F4F9;border-color:#D7DBE8}',
            '.ts-link-icon{flex:none;width:40px;height:40px;border-radius:50%;background:#EEF2F7;display:grid;place-items:center;font-size:18px}',
            '.ts-link-row span{font-size:14.5px;font-weight:600;color:#1D1B20}',
            '.ts-send-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(68px,1fr));gap:2px;margin:4px 0 6px}',
            '.ts-friend-cell{display:flex;flex-direction:column;align-items:center;gap:6px;border:0;background:transparent;padding:8px 2px;border-radius:14px;cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent}',
            '.ts-friend-cell:hover,.ts-friend-cell:active{background:#F1F4F9}',
            '.ts-friend-avatar{width:56px;height:56px;border-radius:50%;overflow:hidden;background:#EEF2F7;display:grid;place-items:center;font-size:19px;font-weight:600;color:#1B3A5C}',
            '.ts-friend-avatar img{width:100%;height:100%;object-fit:cover;display:block}',
            '.ts-friend-cell span{font-size:12px;color:#1D1B20;text-align:center;max-width:68px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
            '.ts-friend-cell.sending{opacity:.45;pointer-events:none}',
            '.ts-friend-cell.sent .ts-friend-avatar{box-shadow:0 0 0 2px #1B9E5A inset}',
            '.tic-mini-toast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translate(-50%,20px);background:#1D1B20;color:#fff;padding:11px 18px;border-radius:14px;font-size:14px;opacity:0;pointer-events:none;transition:.25s;z-index:40000;max-width:86vw;text-align:center}',
            '.tic-mini-toast.show{opacity:1;transform:translate(-50%,0)}',
            '@keyframes tsFade{from{opacity:0}to{opacity:1}}@keyframes tsUp{from{transform:translateY(30px);opacity:.6}to{transform:none;opacity:1}}',
            '@media (prefers-reduced-motion:reduce){.tsheet,.tsheet-back{animation:none}}'
        ].join('');
        document.head.appendChild(st);
    }

    var sheetEl = null;
    function closeSheet() {
        if (sheetEl && sheetEl.parentNode) sheetEl.parentNode.removeChild(sheetEl);
        sheetEl = null;
    }
    function openSheet(html) {
        ensureSheetStyle();
        closeSheet();
        sheetEl = document.createElement('div');
        sheetEl.className = 'tsheet-back';
        sheetEl.innerHTML = '<div class="tsheet" role="dialog" aria-modal="true"><div class="tsheet-grab"></div><div class="ts-body"></div></div>';
        sheetEl.addEventListener('click', function (e) { if (e.target === sheetEl) closeSheet(); });
        document.body.appendChild(sheetEl);
        setSheetBody(html);
        return sheetEl;
    }
    function setSheetBody(html) {
        if (!sheetEl) return null;
        var body = sheetEl.querySelector('.ts-body');
        body.innerHTML = html;
        return body;
    }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheetEl) closeSheet(); });

    function emit(name, detail) {
        try { document.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) { }
    }

    function nameOfCard(card) {
        var n = card && card.querySelector('.tic-head .tic-name');
        return n ? n.textContent.trim() : CONFIG.translate('tic_this_user', 'este usuario');
    }

    function applyVisibilityBadge(pubId, vis) {
        vis = normVis(vis);
        document.querySelectorAll('.tic-card[data-pub-id="' + pubId + '"]').forEach(function (card) {
            var sub = card.querySelector('.tic-sub');
            if (!sub) {
                var who = card.querySelector('.tic-who');
                if (!who) return;
                sub = document.createElement('div');
                sub.className = 'tic-sub';
                who.appendChild(sub);
            }
            var old = sub.querySelector('.tic-vis');
            if (old) {
                if (old.previousElementSibling && old.previousElementSibling.classList.contains('tic-dot')) old.previousElementSibling.remove();
                old.remove();
            }
            if (vis !== 'public') {
                if (sub.children.length) sub.insertAdjacentHTML('beforeend', '<i class="tic-dot"></i>');
                sub.insertAdjacentHTML('beforeend', '<span class="tic-vis">' + SVG_LOCK + esc(VIS_LABEL[vis]) + '</span>');
            }
        });
    }

    function applyCaption(pubId, captionEscaped) {
        document.querySelectorAll('.tic-card[data-pub-id="' + pubId + '"]').forEach(function (card) {
            var p = card.querySelector('.tic-caption');
            var nameLink = card.querySelector('.tic-head .tic-name');
            if (!captionEscaped) { if (p) p.remove(); return; }
            if (!p) {
                p = document.createElement('p');
                p.className = 'tic-caption';
                var anchor = card.querySelector('.tic-likes-line');
                if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(p, anchor.nextSibling);
                else card.appendChild(p);
            }
            var link = nameLink ? nameLink.cloneNode(true) : null;
            p.innerHTML = '';
            if (link) { p.appendChild(link); p.appendChild(document.createTextNode(' ')); }
            var span = document.createElement('span');
            span.innerHTML = linkifyTags(captionEscaped);   // el servidor ya devuelve el texto escapado
            p.appendChild(span);
        });
    }

    /* --- Menú de un Tic --- */
    function openTicMenu(card) {
        if (!card) return;
        var pubId = card.dataset.pubId;
        var ownerId = card.dataset.userId;
        var uid = me();
        var own = uid && String(ownerId) === String(uid);
        if (own) return openOwnMenu(pubId);
        var known = userCache[ownerId];
        return openUserMenu(ownerId, (known && known.name) || nameOfCard(card), { publicationId: pubId });
    }

    function openOwnMenu(pubId) {
        var pub = findPub(pubId) || { id: pubId, caption: '', visibility: 'public', _stub: true }; // _stub: no tenemos sus datos reales
        openSheet('');
        renderOwnMenu(pub);
    }

    function renderOwnMenu(pub) {
        var vis = normVis(pub.visibility);
        var body = setSheetBody(
            '<h3>' + esc(CONFIG.translate('tic_menu_title_own', 'Tu Tic')) + '</h3>' +
            '<button type="button" class="ts-btn" data-ts="edit">✏️ ' + esc(CONFIG.translate('tic_menu_edit_caption', 'Editar descripción')) + '</button>' +
            '<button type="button" class="ts-btn" data-ts="vis">🔒 ' + esc(CONFIG.translate('tic_menu_who_can_see', 'Quién puede verlo:')) + ' <b style="margin-left:auto;color:#1B3A5C">' + esc(VIS_LABEL[vis]) + '</b></button>' +
            '<button type="button" class="ts-btn" data-ts="share">📤 ' + esc(CONFIG.translate('tic_menu_share', 'Compartir')) + '</button>' +
            '<button type="button" class="ts-btn" data-ts="boost">🚀 ' + esc(CONFIG.translate('tic_menu_boost', 'Destacar con monedas')) + '</button>' +
            '<button type="button" class="ts-btn" data-ts="download">⬇️ ' + esc(CONFIG.translate('tic_menu_download', 'Descargar')) + '</button>' +
            '<button type="button" class="ts-btn danger" data-ts="delete">🗑️ ' + esc(CONFIG.translate('tic_menu_delete', 'Borrar Tic')) + '</button>' +
            '<button type="button" class="ts-btn" data-ts="close" style="color:#6B7280">' + esc(CONFIG.translate('tic_cancel', 'Cancelar')) + '</button>');
        body.onclick = function (e) {
            var b = e.target.closest('[data-ts]');
            if (!b) return;
            var a = b.dataset.ts;
            if (a === 'close') closeSheet();
            else if (a === 'edit') renderEditCaption(pub);
            else if (a === 'vis') renderVisibility(pub);
            else if (a === 'share') openSendSheet(pub.id);
            else if (a === 'boost') renderBoost(pub);
            else if (a === 'download') renderDownloadMenu(pub);
            else if (a === 'delete') renderConfirmDelete(pub);
        };
    }

    /* ---------- Descargar un Tic propio: tal cual, o con el tema del dia como pegatina movible ---------- */
    var DOWNLOAD_CATEGORY_STYLE = {
        'recuerdo': { emoji: '💭', from: '#7C3AED', to: '#C4B5FD' },
        'foto nueva': { emoji: '📸', from: '#2563EB', to: '#93C5FD' },
        'amigos': { emoji: '🧑‍🤝‍🧑', from: '#EA580C', to: '#FDBA74' },
        'familia': { emoji: '👨‍👩‍👧', from: '#15803D', to: '#86EFAC' },
        'pareja': { emoji: '💞', from: '#DB2777', to: '#F9A8D4' },
        'lugares': { emoji: '📍', from: '#0D9488', to: '#5EEAD4' },
        'viajes': { emoji: '✈️', from: '#0284C7', to: '#7DD3FC' },
        'comida': { emoji: '🍕', from: '#D97706', to: '#FCD34D' },
        'reto': { emoji: '🔥', from: '#DC2626', to: '#FCA5A5' },
        'creatividad': { emoji: '🎨', from: '#9333EA', to: '#F0ABFC' },
        'emociones': { emoji: '💛', from: '#CA8A04', to: '#FDE68A' },
        'favoritos': { emoji: '⭐', from: '#B45309', to: '#FCD34D' },
        'nostalgia': { emoji: '🕰️', from: '#78350F', to: '#D6B98C' },
        'actualidad': { emoji: '📰', from: '#334155', to: '#94A3B8' }
    };
    // El tema que se pega al Tic es el del DIA EN QUE SE TOMO/PUBLICO ese Tic, no el de hoy
    // (antes siempre salia el tema de hoy, aunque descargaras un Tic viejo).
    function themeInfoForPub(pub) {
        try {
            var raw = pub && (pub.customDate || pub.createdAt || pub.created_at || pub.date);
            var d = raw ? new Date(raw) : null;
            if (d && isNaN(d.getTime())) d = null;
            if (typeof getDailyThemeForDate === 'function') {
                var t = getDailyThemeForDate(d || undefined);
                if (t) {
                    var st = DOWNLOAD_CATEGORY_STYLE[t.category] || { emoji: '✨', from: '#1B3A5C', to: '#60A5FA' };
                    var label = String(t.category || '').replace(/^./, function (c) { return c.toUpperCase(); });
                    return { emoji: st.emoji, from: st.from, to: st.to, label: label };
                }
            }
        } catch (e) { }
        return { emoji: '✨', from: '#1B3A5C', to: '#60A5FA', label: CONFIG.translate('tic_theme_of_day', 'Tema del día') };
    }
    function renderDownloadMenu(pub) {
        var body = setSheetBody(
            '<h3>⬇️ ' + esc(CONFIG.translate('tic_download_title', 'Descargar este Tic')) + '</h3>' +
            '<button type="button" class="ts-opt" data-ts="plain"><div><b>' + esc(CONFIG.translate('tic_download_plain', 'Descargar tal cual')) + '</b><span>' + esc(CONFIG.translate('tic_download_plain_desc', 'La foto como la subiste.')) + '</span></div></button>' +
            '<button type="button" class="ts-opt" data-ts="themed"><div><b>' + esc(CONFIG.translate('tic_download_themed', 'Descargar con el tema del día')) + '</b><span>' + esc(CONFIG.translate('tic_download_themed_desc', 'Añade una pegatina del tema de hoy que puedes mover a tu gusto.')) + '</span></div></button>' +
            '<div class="ts-row"><button type="button" class="ts-ghost" data-ts="back">' + esc(CONFIG.translate('tic_back', 'Atrás')) + '</button></div>');
        body.onclick = function (e) {
            var b = e.target.closest('[data-ts]');
            if (!b) return;
            if (b.dataset.ts === 'back') return renderOwnMenu(pub);
            if (b.dataset.ts === 'plain') return startTicDownload(pub, false);
            if (b.dataset.ts === 'themed') return startTicDownload(pub, true);
        };
    }
    // Dibuja el logo de SeeYou (solo los dos aros, sin fondo blanco) + "SeeYou" debajo, centrado abajo.
    function drawWatermark(ctx, w, h) {
        var scale = Math.max(1, w / 900);
        var r = 15 * scale, cx = w / 2, cy = h - 74 * scale;
        // Separados, sin tocarse ni cruzarse (el logo real de SeeYou no superpone los dos aros).
        var gap = r + 5 * scale;
        ctx.save();
        ctx.globalAlpha = 0.55; // mas translucido: lo importante es la foto, no la marca de agua
        ctx.lineWidth = 5.5 * scale;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#00A3FF';
        ctx.beginPath(); ctx.arc(cx - gap, cy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.96)';
        ctx.beginPath(); ctx.arc(cx + gap, cy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.font = '700 ' + Math.round(15 * scale) + 'px system-ui,-apple-system,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 6 * scale;
        ctx.fillStyle = '#fff';
        ctx.fillText('SeeYou', cx, cy + r + 6 * scale);
        ctx.restore();
    }
    // Marco/vignette con los colores del tema del dia, para que el fondo "pegue" con la foto
    // (ademas de la pegatina movible que se dibuja encima, aparte).
    function drawThemeFrame(ctx, w, h, theme) {
        ctx.save();
        var border = Math.max(6, Math.round(Math.min(w, h) * 0.018));
        ctx.strokeStyle = theme.from;
        ctx.lineWidth = border;
        ctx.strokeRect(border / 2, border / 2, w - border, h - border);
        var corner = Math.min(w, h) * 0.38;
        function vignette(cx, cy, color) {
            var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, corner);
            g.addColorStop(0, color + '99');
            g.addColorStop(1, color + '00');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
        }
        vignette(0, 0, theme.from);
        vignette(w, h, theme.to);
        ctx.restore();
    }
    function triggerBlobDownload(blob, filename) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
    }
    function loadImageFromBlob(blob) {
        return new Promise(function (resolve, reject) {
            var url = URL.createObjectURL(blob);
            var img = new Image();
            img.onload = function () { resolve({ img: img, url: url }); };
            img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('img')); };
            img.src = url;
        });
    }
    function startTicDownload(pub, themed) {
        var src = assetUrl(pub.originalImageUrl || pub.imgUrl);
        if (!src) { toastMsg(CONFIG.translate('tic_download_failed', 'No se pudo descargar este Tic')); return; }
        closeSheet();
        toastMsg(CONFIG.translate('tic_downloading', 'Preparando descarga…'));
        fetch(src, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('fetch'); return r.blob(); }).then(function (blob) {
            return loadImageFromBlob(blob);
        }).then(function (res) {
            if (!themed) {
                var c = document.createElement('canvas');
                c.width = res.img.naturalWidth || res.img.width; c.height = res.img.naturalHeight || res.img.height;
                var ctx = c.getContext('2d');
                ctx.drawImage(res.img, 0, 0, c.width, c.height);
                drawWatermark(ctx, c.width, c.height);
                c.toBlob(function (outBlob) {
                    URL.revokeObjectURL(res.url);
                    if (!outBlob) { toastMsg(CONFIG.translate('tic_download_failed', 'No se pudo descargar este Tic')); return; }
                    triggerBlobDownload(outBlob, 'seeyou-tic-' + pub.id + '.jpg');
                    toastMsg(CONFIG.translate('tic_download_done', '¡Descargado!'));
                }, 'image/jpeg', 0.92);
            } else {
                openThemedDownloadEditor(pub, res);
            }
        }).catch(function () { toastMsg(CONFIG.translate('tic_download_failed', 'No se pudo descargar este Tic')); });
    }
    function ensureDownloadEditorStyle() {
        if (document.getElementById('tic-dl-style')) return;
        var st = document.createElement('style');
        st.id = 'tic-dl-style';
        st.textContent =
            '.tdl-overlay{position:fixed;inset:0;z-index:45000;background:#0B1A2E;display:flex;flex-direction:column}' +
            '.tdl-stage{position:relative;flex:1;overflow:hidden;display:flex;align-items:center;justify-content:center;touch-action:none}' +
            '.tdl-img-wrap{position:relative;max-width:100%;max-height:100%;display:inline-flex}' +
            '.tdl-stage img{max-width:100%;max-height:100%;display:block;user-select:none;-webkit-user-drag:none}' +
            '.tdl-frame{position:absolute;inset:0;pointer-events:none;opacity:.9;border-radius:2px}' +
            '.tdl-sticker{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:999px;color:#fff;font:800 15px system-ui,sans-serif;white-space:nowrap;box-shadow:0 10px 24px -8px rgba(0,0,0,.5);cursor:grab;touch-action:none;-webkit-tap-highlight-color:transparent}' +
            '.tdl-sticker:active{cursor:grabbing}' +
            '.tdl-hint{position:absolute;top:calc(14px + env(safe-area-inset-top,0px));left:0;right:0;text-align:center;color:rgba(255,255,255,.85);font:600 13px system-ui,sans-serif;pointer-events:none}' +
            '.tdl-bar{flex:none;display:flex;gap:10px;padding:14px 16px calc(14px + env(safe-area-inset-bottom,0px));background:#0B1A2E}' +
            '.tdl-bar button{flex:1;border:0;border-radius:999px;padding:13px;font:800 15px system-ui,sans-serif;cursor:pointer}' +
            '.tdl-bar .ghost{background:rgba(255,255,255,.12);color:#fff}' +
            '.tdl-bar .go{background:linear-gradient(135deg,#1B3A5C,#2F6FDD);color:#fff}';
        document.head.appendChild(st);
    }
    function openThemedDownloadEditor(pub, res) {
        ensureDownloadEditorStyle();
        var theme = themeInfoForPub(pub);
        var ov = document.createElement('div');
        ov.className = 'tdl-overlay';
        ov.innerHTML = '<div class="tdl-stage"><div class="tdl-hint">' + esc(CONFIG.translate('tic_download_drag_hint', 'Arrastra la pegatina a donde quieras')) + '</div>' +
            '<div class="tdl-img-wrap"><img src="' + res.url + '" alt=""><div class="tdl-frame" style="box-shadow:inset 0 0 0 8px ' + theme.from + ', inset 0 0 70px 20px ' + theme.to + '66, inset 0 0 70px 20px ' + theme.from + '55"></div></div>' +
            '<div class="tdl-sticker" style="background:linear-gradient(135deg,' + theme.from + ',' + theme.to + ')">' + theme.emoji + ' ' + esc(theme.label) + '</div></div>' +
            '<div class="tdl-bar"><button type="button" class="ghost" data-ts="cancel">' + esc(CONFIG.translate('tic_cancel', 'Cancelar')) + '</button><button type="button" class="go" data-ts="save">' + esc(CONFIG.translate('tic_download_save', 'Guardar')) + '</button></div>';
        document.body.appendChild(ov);
        var stage = ov.querySelector('.tdl-stage'), imgEl = ov.querySelector('img'), sticker = ov.querySelector('.tdl-sticker');
        var pos = { xPct: 50, yPct: 50 };
        function applyPos() { sticker.style.left = pos.xPct + '%'; sticker.style.top = pos.yPct + '%'; }
        (function dragSticker() {
            var st = null;
            sticker.addEventListener('pointerdown', function (e) {
                e.preventDefault();
                var r = stage.getBoundingClientRect();
                st = { startX: e.clientX, startY: e.clientY, startXPct: pos.xPct, startYPct: pos.yPct, rect: r };
                sticker.setPointerCapture && sticker.setPointerCapture(e.pointerId);
            });
            sticker.addEventListener('pointermove', function (e) {
                if (!st) return;
                var dxPct = ((e.clientX - st.startX) / st.rect.width) * 100;
                var dyPct = ((e.clientY - st.startY) / st.rect.height) * 100;
                pos.xPct = Math.max(6, Math.min(94, st.startXPct + dxPct));
                pos.yPct = Math.max(6, Math.min(94, st.startYPct + dyPct));
                applyPos();
            });
            function endDrag() { st = null; }
            sticker.addEventListener('pointerup', endDrag);
            sticker.addEventListener('pointercancel', endDrag);
        })();
        applyPos();
        ov.querySelector('.tdl-bar').onclick = function (e) {
            var b = e.target.closest('[data-ts]');
            if (!b) return;
            if (b.dataset.ts === 'cancel') { URL.revokeObjectURL(res.url); ov.remove(); return; }
            if (b.dataset.ts !== 'save') return;
            b.disabled = true; b.textContent = CONFIG.translate('tic_saving', 'Guardando…');
            var c = document.createElement('canvas');
            var w = res.img.naturalWidth || res.img.width, h = res.img.naturalHeight || res.img.height;
            c.width = w; c.height = h;
            var ctx = c.getContext('2d');
            ctx.drawImage(res.img, 0, 0, w, h);
            drawThemeFrame(ctx, w, h, theme);
            // La pegatina se dibuja en la misma posicion relativa que se ve en pantalla (porcentaje del area visible de la imagen).
            var imgRect = imgEl.getBoundingClientRect(), stageRect = stage.getBoundingClientRect();
            var relX = ((stageRect.left + (pos.xPct / 100) * stageRect.width) - imgRect.left) / imgRect.width;
            var relY = ((stageRect.top + (pos.yPct / 100) * stageRect.height) - imgRect.top) / imgRect.height;
            relX = Math.max(0, Math.min(1, relX)); relY = Math.max(0, Math.min(1, relY));
            var scale = w / imgRect.width;
            ctx.save();
            ctx.font = '800 ' + Math.round(15 * scale) + 'px system-ui,-apple-system,sans-serif';
            var label = theme.emoji + ' ' + theme.label;
            var padX = 16 * scale, padY = 10 * scale;
            var textW = ctx.measureText(label).width;
            var boxW = textW + padX * 2, boxH = 15 * scale + padY * 2;
            var bx = relX * w - boxW / 2, by = relY * h - boxH / 2;
            var grad = ctx.createLinearGradient(bx, by, bx + boxW, by + boxH);
            grad.addColorStop(0, theme.from); grad.addColorStop(1, theme.to);
            ctx.fillStyle = grad;
            ctx.beginPath();
            var rad = boxH / 2;
            if (ctx.roundRect) ctx.roundRect(bx, by, boxW, boxH, rad); else ctx.rect(bx, by, boxW, boxH);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(label, bx + boxW / 2, by + boxH / 2 + 1);
            ctx.restore();
            drawWatermark(ctx, w, h);
            c.toBlob(function (outBlob) {
                URL.revokeObjectURL(res.url);
                ov.remove();
                if (!outBlob) { toastMsg(CONFIG.translate('tic_download_failed', 'No se pudo descargar este Tic')); return; }
                triggerBlobDownload(outBlob, 'seeyou-tic-' + pub.id + '-tema.jpg');
                toastMsg(CONFIG.translate('tic_download_done', '¡Descargado!'));
            }, 'image/jpeg', 0.92);
        };
    }

    /* Destacar un Tic con monedas: durante unas horas sale mas veces en los feeds de otras personas. */
    function renderBoost(pub) {
        var body = setSheetBody('<h3>🚀 ' + esc(CONFIG.translate('tic_boost_title', 'Destacar este Tic')) + '</h3><p class="ts-note">' + esc(CONFIG.translate('tic_loading', 'Cargando…')) + '</p>');
        Promise.all([apiCall('GET', '/api/publicaciones/' + encodeURIComponent(pub.id) + '/boost'), apiCall('GET', '/api/shop/config')]).then(function (rs) {
            var b = (rs[0] && rs[0].data) || {}, cfg = (rs[1] && rs[1].data) || {};
            var cost = Number(b.cost) || 20, hours = Number(b.hours) || 24, mult = Number(b.multiplier) || 3, bal = Number(cfg.balance) || 0;
            var box = setSheetBody(
                '<h3>🚀 ' + esc(CONFIG.translate('tic_boost_title', 'Destacar este Tic')) + '</h3>' +
                '<p class="ts-note">' + esc(CONFIG.translate('tic_boost_text', 'Durante {{h}} horas tu Tic saldrá {{x}} veces más en los feeds de otras personas, y tiene más opciones de hacerse viral.').replace('{{h}}', hours).replace('{{x}}', mult)) + '</p>' +
                '<p class="ts-note"><b>' + esc(CONFIG.translate('tic_boost_cost', 'Cuesta {{n}} monedas').replace('{{n}}', cost)) + '</b> · ' + esc(CONFIG.translate('tic_boost_balance', 'Tienes {{n}}').replace('{{n}}', bal)) + '</p>' +
                (b.boosted ? '<p class="ts-note" style="color:#16A34A"><b>' + esc(CONFIG.translate('tic_boost_active', 'Ya está destacado ahora mismo.')) + '</b></p>' : '') +
                '<div class="ts-row"><button type="button" class="ts-ghost" data-ts="back">' + esc(CONFIG.translate('tic_back', 'Atrás')) + '</button>' +
                '<button type="button" class="ts-primary" data-ts="go"' + (b.boosted || bal < cost ? ' disabled style="opacity:.55"' : '') + '>' + esc(bal < cost ? CONFIG.translate('tic_boost_nocoins', 'Faltan monedas') : CONFIG.translate('tic_boost_go', 'Destacar')) + '</button></div>');
            if (bal < cost && !b.boosted && window.SeeYouAdMob && SeeYouAdMob.mountOffer) {
                var slot = document.createElement('div');
                var row = box.querySelector('.ts-row');
                if (row) row.parentNode.insertBefore(slot, row);
                SeeYouAdMob.mountOffer(slot, me(), { need: cost, onEarned: function () { renderBoost(pub); } });
            }
            box.onclick = function (e) {
                var t = e.target.closest('[data-ts]');
                if (!t) return;
                if (t.dataset.ts === 'back') return renderOwnMenu(pub);
                if (t.dataset.ts !== 'go' || t.disabled) return;
                t.disabled = true; t.textContent = CONFIG.translate('tic_saving', 'Guardando…');
                apiCall('POST', '/api/publicaciones/' + encodeURIComponent(pub.id) + '/boost', {}).then(function (r) {
                    if (!r.ok) { toastMsg(r.data.message || CONFIG.translate('tic_boost_failed', 'No se pudo destacar')); return renderBoost(pub); }
                    emit('seeyou:coins-changed', { balance: r.data.balance });
                    closeSheet();
                    toastMsg(CONFIG.translate('tic_boost_done', '¡Tic destacado! Durante {{h}} horas sale más en los feeds.').replace('{{h}}', r.data.hours || hours));
                });
            };
        }).catch(function () { renderOwnMenu(pub); });
    }

    function renderEditCaption(pub) {
        var body = setSheetBody(
            '<h3>' + esc(CONFIG.translate('tic_edit_caption_title', 'Editar descripción')) + '</h3>' +
            '<textarea id="ts-caption" maxlength="500" placeholder="' + esc(CONFIG.translate('tic_caption_placeholder', 'Describe tu Tic…')) + '"></textarea>' +
            '<div class="ts-row"><button type="button" class="ts-ghost" data-ts="back">' + esc(CONFIG.translate('tic_back', 'Atrás')) + '</button><button type="button" class="ts-primary" data-ts="save">' + esc(CONFIG.translate('tic_save', 'Guardar')) + '</button></div>');
        var ta = body.querySelector('#ts-caption');
        ta.value = decodeHtml(pub.caption || '');
        setTimeout(function () { try { ta.focus(); } catch (e) { } }, 60);
        body.onclick = function (e) {
            var b = e.target.closest('[data-ts]');
            if (!b) return;
            if (b.dataset.ts === 'back') return renderOwnMenu(pub);
            if (b.dataset.ts !== 'save') return;
            // Sin los datos reales del Tic el cuadro sale vacio: guardar asi borraria su descripcion sin querer.
            if (pub._stub && !ta.value.trim()) { toastMsg(CONFIG.translate('tic_caption_empty', 'Escribe la nueva descripción')); return; }
            b.disabled = true;
            b.textContent = CONFIG.translate('tic_saving', 'Guardando…');
            apiCall('PUT', '/api/publicaciones/' + encodeURIComponent(pub.id), { userId: me(), caption: ta.value.trim() }).then(function (r) {
                if (!r.ok) { b.disabled = false; b.textContent = CONFIG.translate('tic_save', 'Guardar'); toastMsg(r.data.message || CONFIG.translate('tic_save_failed', 'No se pudo guardar el cambio')); return; }
                var saved = (r.data.publication && r.data.publication.caption) || '';
                pub.caption = saved;
                var live = findPub(pub.id);
                if (live) live.caption = saved;
                applyCaption(pub.id, saved);
                emit('seeyou:tic-updated', { id: pub.id, caption: saved });
                closeSheet();
                toastMsg(CONFIG.translate('tic_caption_updated', 'Descripción actualizada'));
            });
        };
    }

    function renderVisibility(pub) {
        var current = normVis(pub.visibility);
        var html = '<h3>' + esc(CONFIG.translate('tic_who_can_see_title', '¿Quién puede ver este Tic?')) + '</h3>';
        ['public', 'friends', 'private'].forEach(function (v) {
            html += '<button type="button" class="ts-opt' + (v === current ? ' sel' : '') + '" data-vis="' + v + '"><i class="ts-radio"></i><div><b>' + esc(VIS_LABEL[v]) + '</b><span>' + esc(VIS_HELP[v]) + '</span></div></button>';
        });
        html += '<div class="ts-row"><button type="button" class="ts-ghost" data-ts="back">' + esc(CONFIG.translate('tic_back', 'Atrás')) + '</button></div>';
        var body = setSheetBody(html);
        body.onclick = function (e) {
            var back = e.target.closest('[data-ts="back"]');
            if (back) return renderOwnMenu(pub);
            var opt = e.target.closest('[data-vis]');
            if (!opt) return;
            var next = opt.dataset.vis;
            if (next === current) return renderOwnMenu(pub);
            body.querySelectorAll('.ts-opt').forEach(function (o) { o.classList.toggle('sel', o === opt); o.style.pointerEvents = 'none'; });
            apiCall('PUT', '/api/publicaciones/' + encodeURIComponent(pub.id), { userId: me(), visibility: next }).then(function (r) {
                if (!r.ok) { toastMsg(r.data.message || CONFIG.translate('tic_vis_failed', 'No se pudo cambiar la visibilidad')); return renderVisibility(pub); }
                pub.visibility = next;
                var live = findPub(pub.id);
                if (live) live.visibility = next;
                applyVisibilityBadge(pub.id, next);
                emit('seeyou:tic-updated', { id: pub.id, visibility: next });
                closeSheet();
                toastMsg(CONFIG.translate('tic_now_vis', 'Ahora: {{vis}}').replace('{{vis}}', VIS_LABEL[next]));
            });
        };
    }

    function renderConfirmDelete(pub) {
        var body = setSheetBody(
            '<h3>' + esc(CONFIG.translate('tic_confirm_delete_title', '¿Borrar este Tic?')) + '</h3>' +
            '<p class="ts-note">' + esc(CONFIG.translate('tic_confirm_delete_text', 'Se eliminará para siempre, junto con sus me gusta y comentarios. Esta acción no se puede deshacer.')) + '</p>' +
            '<div class="ts-row"><button type="button" class="ts-ghost" data-ts="back">' + esc(CONFIG.translate('tic_cancel', 'Cancelar')) + '</button><button type="button" class="ts-danger" data-ts="confirm">' + esc(CONFIG.translate('tic_delete', 'Borrar')) + '</button></div>');
        body.onclick = function (e) {
            var b = e.target.closest('[data-ts]');
            if (!b) return;
            if (b.dataset.ts === 'back') return renderOwnMenu(pub);
            if (b.dataset.ts !== 'confirm') return;
            b.disabled = true;
            b.textContent = CONFIG.translate('tic_deleting', 'Borrando…');
            apiCall('DELETE', '/api/publicaciones/' + encodeURIComponent(pub.id), { userId: me() }).then(function (r) {
                if (!r.ok) { b.disabled = false; b.textContent = CONFIG.translate('tic_delete', 'Borrar'); toastMsg(r.data.message || CONFIG.translate('tic_delete_failed', 'No se pudo borrar el Tic')); return; }
                var list = window.publicationPhotos;
                if (Array.isArray(list)) {
                    for (var i = list.length - 1; i >= 0; i--) if (String(list[i].id) === String(pub.id)) list.splice(i, 1);
                }
                document.querySelectorAll('.tic-card[data-pub-id="' + pub.id + '"]').forEach(function (c) { c.remove(); });
                emit('seeyou:tic-deleted', { id: pub.id });
                closeSheet();
                toastMsg(CONFIG.translate('tic_deleted', 'Tic borrado'));
            });
        };
    }

    /* --- Menú de un usuario: bloquear / reportar --- */
    function openUserMenu(userId, name, opts) {
        opts = opts || {};
        var uid = me();
        if (!uid || !userId || String(uid) === String(userId)) return;
        var label = name || CONFIG.translate('tic_this_user', 'este usuario');
        openSheet('<h3>' + esc(label) + '</h3><p class="ts-note">' + esc(CONFIG.translate('tic_loading', 'Cargando…')) + '</p>');
        apiCall('GET', '/api/blocks/' + encodeURIComponent(uid) + '/status/' + encodeURIComponent(userId)).then(function (r) {
            renderUserMenu(userId, label, opts, !!(r.data && r.data.blockedByMe));
        });
    }

    /* Reportar un comentario concreto: va directo a elegir el motivo */
    function openReportComment(userId, name, pubId, commentId) {
        var uid = me();
        if (!uid || !userId || !commentId || String(uid) === String(userId)) return;
        var label = name || CONFIG.translate('tic_this_user', 'este usuario');
        openSheet('<h3>' + esc(label) + '</h3>');
        renderReport(userId, label, { publicationId: pubId, commentId: commentId, direct: true });
    }

    function renderUserMenu(userId, label, opts, blockedByMe) {
        if (!sheetEl) return;
        var body = setSheetBody(
            '<h3>' + esc(label) + '</h3>' +
            (opts && opts.publicationId ? '<button type="button" class="ts-btn" data-ts="not-interested">🙈 ' + esc(CONFIG.translate('tic_not_interested', 'No me interesa')) + '</button>' : '') +
            (blockedByMe
                ? '<button type="button" class="ts-btn" data-ts="unblock">✅ ' + esc(CONFIG.translate('tic_unblock_prefix', 'Desbloquear a {{name}}').replace('{{name}}', label)) + '</button>'
                : '<button type="button" class="ts-btn danger" data-ts="block">🚫 ' + esc(CONFIG.translate('tic_block_prefix', 'Bloquear a {{name}}').replace('{{name}}', label)) + '</button>') +
            '<button type="button" class="ts-btn" data-ts="report">⚑ ' + esc(CONFIG.translate('tic_report', 'Reportar')) + '</button>' +
            '<button type="button" class="ts-btn" data-ts="close" style="color:#6B7280">' + esc(CONFIG.translate('tic_cancel', 'Cancelar')) + '</button>');
        body.onclick = function (e) {
            var b = e.target.closest('[data-ts]');
            if (!b) return;
            var a = b.dataset.ts;
            if (a === 'close') closeSheet();
            else if (a === 'block') renderConfirmBlock(userId, label, opts);
            else if (a === 'unblock') doUnblock(userId, label);
            else if (a === 'report') renderReport(userId, label, opts);
            else if (a === 'not-interested') doNotInterested(opts.publicationId);
        };
    }

    function doNotInterested(pubId) {
        if (!pubId) return;
        apiCall('POST', '/api/publicaciones/' + encodeURIComponent(pubId) + '/not-interested', { userId: me() }).catch(function () { });
        document.querySelectorAll('.tic-card[data-pub-id="' + pubId + '"]').forEach(function (c) { c.remove(); });
        var list = window.publicationPhotos;
        if (Array.isArray(list)) {
            for (var i = list.length - 1; i >= 0; i--) if (String(list[i].id) === String(pubId)) list.splice(i, 1);
        }
        closeSheet();
        toastMsg(CONFIG.translate('tic_not_interested_done', 'Entendido, mostraremos menos cosas así'));
    }

    function renderConfirmBlock(userId, label, opts) {
        var body = setSheetBody(
            '<h3>' + esc(CONFIG.translate('tic_confirm_block_title', '¿Bloquear a {{name}}?').replace('{{name}}', label)) + '</h3>' +
            '<p class="ts-note">' + esc(CONFIG.translate('tic_confirm_block_text', 'No podrá ver tus Tics, escribirte ni enviarte solicitudes de amistad, y dejaréis de ser amigos. No se le avisa. Puedes desbloquearle cuando quieras desde tu perfil → Usuarios bloqueados.')) + '</p>' +
            '<div class="ts-row"><button type="button" class="ts-ghost" data-ts="back">' + esc(CONFIG.translate('tic_cancel', 'Cancelar')) + '</button><button type="button" class="ts-danger" data-ts="confirm">' + esc(CONFIG.translate('tic_block', 'Bloquear')) + '</button></div>');
        body.onclick = function (e) {
            var b = e.target.closest('[data-ts]');
            if (!b) return;
            if (b.dataset.ts === 'back') return renderUserMenu(userId, label, opts, false);
            if (b.dataset.ts !== 'confirm') return;
            b.disabled = true;
            b.textContent = CONFIG.translate('tic_blocking', 'Bloqueando…');
            apiCall('POST', '/api/blocks', { blockerId: me(), blockedId: userId }).then(function (r) {
                if (!r.ok) { b.disabled = false; b.textContent = CONFIG.translate('tic_block', 'Bloquear'); toastMsg(r.data.message || CONFIG.translate('tic_block_failed', 'No se pudo bloquear')); return; }
                document.querySelectorAll('.tic-card[data-user-id="' + (window.CSS && CSS.escape ? CSS.escape(String(userId)) : userId) + '"]').forEach(function (c) { c.remove(); });
                var list = window.publicationPhotos;
                if (Array.isArray(list)) {
                    for (var i = list.length - 1; i >= 0; i--) if (String(list[i].userId) === String(userId)) list.splice(i, 1);
                }
                hiddenIds[String(userId)] = 1;
                emit('seeyou:user-blocked', { userId: userId, blocked: true });
                closeSheet();
                toastMsg(CONFIG.translate('tic_blocked_user', 'Has bloqueado a {{name}}').replace('{{name}}', label));
            });
        };
    }

    function doUnblock(userId, label) {
        apiCall('DELETE', '/api/blocks', { blockerId: me(), blockedId: userId }).then(function (r) {
            if (!r.ok) { toastMsg(r.data.message || CONFIG.translate('tic_unblock_failed', 'No se pudo desbloquear')); return; }
            delete hiddenIds[String(userId)];
            emit('seeyou:user-blocked', { userId: userId, blocked: false });
            closeSheet();
            toastMsg(CONFIG.translate('tic_unblocked_user', 'Has desbloqueado a {{name}}').replace('{{name}}', label));
        });
    }

    function renderReport(userId, label, opts) {
        var html = '<h3>' + esc(CONFIG.translate(opts && opts.commentId ? 'tic_report_comment_title' : 'tic_report_title', opts && opts.commentId ? 'Reportar el comentario de {{name}}' : 'Reportar a {{name}}').replace('{{name}}', label)) + '</h3><p class="ts-note">' + esc(CONFIG.translate('tic_report_intro', '¿Qué ocurre? Revisaremos el reporte y no se le avisará a la persona.')) + '</p>';
        var REPORT_REASONS = REPORT_REASONS_LIST();
        REPORT_REASONS.forEach(function (r, i) {
            html += '<button type="button" class="ts-opt' + (i === 0 ? ' sel' : '') + '" data-reason="' + r[0] + '"><i class="ts-radio"></i><div><b>' + esc(r[1]) + '</b></div></button>';
        });
        html += '<textarea id="ts-details" maxlength="500" placeholder="' + esc(CONFIG.translate('tic_report_details_placeholder', 'Añade más detalles (opcional)')) + '" style="min-height:70px"></textarea>' +
            '<div class="ts-row"><button type="button" class="ts-ghost" data-ts="back">' + esc(CONFIG.translate('tic_back', 'Atrás')) + '</button><button type="button" class="ts-primary" data-ts="send">' + esc(CONFIG.translate('tic_send_report', 'Enviar reporte')) + '</button></div>';
        var body = setSheetBody(html);
        var reason = REPORT_REASONS[0][0];
        body.onclick = function (e) {
            var opt = e.target.closest('[data-reason]');
            if (opt) {
                reason = opt.dataset.reason;
                body.querySelectorAll('.ts-opt').forEach(function (o) { o.classList.toggle('sel', o === opt); });
                return;
            }
            var b = e.target.closest('[data-ts]');
            if (!b) return;
            if (b.dataset.ts === 'back') return opts.direct ? closeSheet() : renderUserMenu(userId, label, opts, false);
            if (b.dataset.ts !== 'send') return;
            b.disabled = true;
            b.textContent = CONFIG.translate('tic_sending_report', 'Enviando…');
            apiCall('POST', '/api/reports', {
                reporterId: me(), reportedUserId: userId, publicationId: opts.publicationId || '', commentId: opts.commentId || undefined,
                reason: reason, details: (body.querySelector('#ts-details').value || '').trim()
            }).then(function (r) {
                if (!r.ok) { b.disabled = false; b.textContent = CONFIG.translate('tic_send_report', 'Enviar reporte'); toastMsg(r.data.message || CONFIG.translate('tic_report_failed', 'No se pudo enviar el reporte')); return; }
                closeSheet();
                toastMsg(CONFIG.translate('tic_report_sent', 'Gracias, hemos recibido tu reporte'));
            });
        };
    }

    /* ---------- Pantalla de un hashtag: Tics con ese tema ---------- */
    var tagPubs = {};   // id -> Tic normalizado (para likes y comentarios dentro de la lista)
    function normalizeLeanPub(up) {
        var loc = up.location || null;
        if (!loc && up.metadata && up.metadata.latitude != null) loc = { lat: up.metadata.latitude, lng: up.metadata.longitude, name: 'Ubicación GPS de la foto' };
        return {
            id: up.id,
            imgUrl: up.imageUrl || up.imgUrl || up.data || '',
            imgAlt: [up.originalImageUrl].filter(Boolean),
            videoUrl: up.videoUrl || '',
            author: up.author || up.username || up.name || up.usuario || '',
            authorAvatar: up.foto || up.avatar || '',
            music: up.spotifyInfo && up.spotifyInfo.title ? up.spotifyInfo.title : null,
            caption: up.caption || '',
            location: loc,
            date: up.customDate || up.createdAt ? new Date(up.customDate || up.createdAt) : null,
            userId: up.userId || up.user_id || '',
            likes: Array.isArray(up.likes) ? up.likes : [],
            comments: Array.isArray(up.comments) ? up.comments : [],
            taggedUserIds: Array.isArray(up.taggedUserIds) ? up.taggedUserIds : [],
            visibility: up.visibility || 'public',
            frameOverlayUrl: up.frameOverlayUrl || null
        };
    }
    function ensureTagStyle() {
        if (document.getElementById('tic-tag-style')) return;
        var st = document.createElement('style');
        st.id = 'tic-tag-style';
        st.textContent = [
            '.tic-hashtag{color:#0B6BCB;font-weight:600;text-decoration:none;-webkit-tap-highlight-color:transparent}',
            '.tic-hashtag:hover{text-decoration:underline}',
            'body[data-theme="dark"] .tic-hashtag,body[data-theme="blue"] .tic-hashtag{color:#7CC4FF}',
            '.tic-mention{color:#1B3A5C;font-weight:600;text-decoration:none;-webkit-tap-highlight-color:transparent}',
            '.tic-mention:hover{text-decoration:underline}',
            'body[data-theme="dark"] .tic-mention,body[data-theme="blue"] .tic-mention{color:#9DC4F8}',
            '.tsheet.tsheet--tag{width:min(620px,100%);max-height:92vh;padding-left:0;padding-right:0}',
            '.tsheet--tag .ts-taghead{display:flex;align-items:center;gap:12px;padding:0 16px 12px;border-bottom:1px solid #EEF1F6}',
            '.tsheet--tag .ts-tagicon{flex:none;width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#1B3A5C,#00A3FF);color:#fff;display:grid;place-items:center;font-size:24px;font-weight:800}',
            '.tsheet--tag .ts-taghead h3{margin:0;font-size:18px}',
            '.tsheet--tag .ts-taghead span{display:block;font-size:13px;color:#6B7280;margin-top:2px}',
            '.tsheet--tag .ts-close{margin-left:auto;width:38px;height:38px;border:0;border-radius:50%;background:#EEF2F7;color:#1B3A5C;font-size:20px;cursor:pointer}',
            '.tsheet--tag .ts-taglist{padding-top:8px}',
            '.tsheet--tag .ts-tagmsg{padding:28px 20px;text-align:center;color:#6B7280;font-size:14px}',
            '.tsheet--tag .ts-more{display:block;margin:10px auto 4px;border:0;border-radius:14px;padding:11px 20px;background:#EEF2F7;color:#1B3A5C;font-weight:600;font-family:inherit;cursor:pointer}'
        ].join('');
        document.head.appendChild(st);
    }
    function openMentionedProfile(username) {
        if (!username) return;
        window.location.href = 'profile.html?id=' + encodeURIComponent(username);
    }
    function openHashtag(tag) {
        tag = normTag(tag);
        if (!tag) return;
        ensureTagStyle();
        var uid = me();
        if (uid) apiCall('POST', '/api/hashtags/visita', { userId: uid, tag: tag });
        var back = openSheet(
            '<div class="ts-taghead"><div class="ts-tagicon">#</div><div><h3>#' + esc(tag) + '</h3><span class="ts-tagcount">' + esc(CONFIG.translate('loading_tics', 'Cargando Tics...')) + '</span></div>' +
            '<button type="button" class="ts-close" aria-label="' + esc(CONFIG.translate('tic_close', 'Cerrar')) + '">×</button></div>' +
            '<div class="ts-taglist"></div>'
        );
        var sheet = back.querySelector('.tsheet');
        sheet.classList.add('tsheet--tag');
        var list = sheet.querySelector('.ts-taglist');
        var countEl = sheet.querySelector('.ts-tagcount');
        var total = 0;
        sheet.querySelector('.ts-close').addEventListener('click', closeSheet);
        function load(before) {
            var q = '?limit=12&viewerId=' + encodeURIComponent(uid) + (before ? '&before=' + encodeURIComponent(before) : '');
            apiCall('GET', '/api/hashtags/' + encodeURIComponent(tag) + '/publicaciones' + q).then(function (r) {
                if (!sheet.isConnected) return;
                var more = list.querySelector('.ts-more');
                if (more) more.remove();
                if (!r.ok) { list.insertAdjacentHTML('beforeend', '<div class="ts-tagmsg">' + esc(r.data.message || CONFIG.translate('tic_load_failed', 'No se pudieron cargar los Tics')) + '</div>'); return; }
                var pubs = (r.data.publications || []).map(normalizeLeanPub);
                total += pubs.length;
                if (total) {
                    var ckey = (total === 1 && !r.data.next) ? 'tic_count_one' : 'tic_count_many';
                    var cdef = (total === 1 && !r.data.next) ? '{{n}} Tic' : '{{n}} Tics';
                    countEl.textContent = CONFIG.translate(ckey, cdef).replace('{{n}}', total) + (r.data.next ? '+' : '');
                } else {
                    countEl.textContent = CONFIG.translate('tic_no_tics_yet', 'Sin Tics todavía');
                }
                if (!total) { list.innerHTML = '<div class="ts-tagmsg">' + esc(CONFIG.translate('tic_no_tics_for_tag', 'Aún no hay Tics con #{{tag}}. ¡Sé el primero en usarlo!').replace('{{tag}}', tag)) + '</div>'; return; }
                var html = pubs.map(function (p) { tagPubs[String(p.id)] = p; return ticCardHTML(p); }).join('');
                var holder = document.createElement('div');
                holder.innerHTML = html;
                var added = [].slice.call(holder.children);
                added.forEach(function (el) { list.appendChild(el); });
                added.forEach(function (el) { hydrate(el); });
                scanImages(list);
                if (r.data.next) {
                    list.insertAdjacentHTML('beforeend', '<button type="button" class="ts-more">' + esc(CONFIG.translate('tic_see_more', 'Ver más')) + '</button>');
                    list.querySelector('.ts-more').addEventListener('click', function (ev) { ev.target.disabled = true; ev.target.textContent = CONFIG.translate('tic_loading', 'Cargando…'); load(r.data.next); });
                }
            });
        }
        load('');
    }


    /* ---------- Tu actividad (likes, comentarios, guardados) ---------- */
    function ensureActivityStyle() {
        if (document.getElementById('tic-act-style')) return;
        var st = document.createElement('style');
        st.id = 'tic-act-style';
        st.textContent = [
            '.tsheet.tsheet--act{width:min(620px,100%);height:94vh;max-height:94vh;padding-left:0;padding-right:0;display:flex;flex-direction:column}',
            '.tsheet--act .ts-body{flex:1;min-height:0;display:flex;flex-direction:column}',
            '.ts-actmain,.ts-actdetail{flex:1;min-height:0;display:flex;flex-direction:column}',
            '.ts-actmain[hidden],.ts-actdetail[hidden]{display:none!important}',
            '.ts-acthead{display:flex;align-items:center;gap:10px;padding:0 16px 10px}',
            '.ts-acthead h3{margin:0;font-size:18px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
            '.ts-acthead .ts-close,.ts-acthead .ts-actback{flex:none;width:38px;height:38px;border:0;border-radius:50%;background:#EEF2F7;color:#1B3A5C;font-size:20px;cursor:pointer;display:grid;place-items:center}',
            '.ts-acttabs{display:flex;gap:8px;padding:0 16px 10px;border-bottom:1px solid #EEF1F6}',
            '.ts-acttab{flex:1;border:0;border-radius:999px;padding:9px 6px;background:#EEF2F7;color:#1B3A5C;font-weight:700;font-size:13px;font-family:inherit;cursor:pointer}',
            '.ts-acttab.is-on{background:#1B3A5C;color:#fff}',
            '.ts-actlist,.ts-actdetailbody{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch}',
            '.ts-actlist{padding:10px 12px 14px}',
            '.ts-actgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}',
            '.ts-acttile{position:relative;display:block;padding:0;border:0;border-radius:14px;overflow:hidden;aspect-ratio:4/5;background:#DCE4F0;cursor:pointer;font-family:inherit;text-align:left;-webkit-tap-highlight-color:transparent}',
            '.ts-acttile img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}',
            '.ts-acttile .ts-tileshade{position:absolute;left:0;right:0;bottom:0;padding:26px 9px 8px;background:linear-gradient(to top,rgba(0,0,0,.72),rgba(0,0,0,0));color:#fff;font-size:11.5px;font-weight:700;line-height:1.25}',
            '.ts-acttile .ts-tilecmt{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-weight:600;font-size:12px;margin-bottom:3px;word-break:break-word}',
            '.ts-acttile .ts-tilemeta{opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.ts-actmsg{padding:30px 20px;text-align:center;color:#6B7280;font-size:14px}',
            '.ts-actwhen{padding:2px 16px 8px;font-size:12px;font-weight:700;color:#6B7280}',
            '.ts-actdetailbody{padding-bottom:18px}',
            '.ts-actmore{display:block;margin:12px auto 4px;border:0;border-radius:14px;padding:11px 20px;background:#EEF2F7;color:#1B3A5C;font-weight:600;font-family:inherit;cursor:pointer}',
            'body[data-theme="dark"] .ts-acttab,body[data-theme="blue"] .ts-acttab,body[data-theme="dark"] .ts-actmore,body[data-theme="blue"] .ts-actmore,body[data-theme="dark"] .ts-acthead .ts-close,body[data-theme="blue"] .ts-acthead .ts-close,body[data-theme="dark"] .ts-acthead .ts-actback,body[data-theme="blue"] .ts-acthead .ts-actback{background:#2A3140;color:#E6ECF5}',
            'body[data-theme="dark"] .ts-acttab.is-on,body[data-theme="blue"] .ts-acttab.is-on{background:#60A5FA;color:#0B1220}',
            'body[data-theme="dark"] .ts-acttile,body[data-theme="blue"] .ts-acttile{background:#1F2A3D}'
        ].join('');
        document.head.appendChild(st);
    }
    function actShortDate(iso, approx) {
        var d = iso ? new Date(iso) : null;
        if (!d || isNaN(d.getTime())) return '';
        var t = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
        return approx ? CONFIG.translate('act_date_tic', 'Tic del {{d}}').replace('{{d}}', t) : t;
    }
    function actDateLabel(iso, approx, kind) {
        var d = iso ? new Date(iso) : null;
        if (!d || isNaN(d.getTime())) return '';
        var when = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
        if (approx) return CONFIG.translate('act_date_tic', 'Tic del {{d}}').replace('{{d}}', when);
        var t = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        var key = kind === 'comments' ? 'act_date_comment' : kind === 'saved' ? 'act_date_saved' : 'act_date_like';
        var def = kind === 'comments' ? 'Comentaste el {{d}}' : kind === 'saved' ? 'Guardaste el {{d}}' : 'Te gustó el {{d}}';
        return CONFIG.translate(key, def).replace('{{d}}', when + ' · ' + t);
    }
    function openActivity(startTab) {
        var uid = me();
        if (!uid) return;
        ensureActivityStyle();
        var tabs = [
            { id: 'likes', label: CONFIG.translate('act_tab_likes', 'Likes'), empty: CONFIG.translate('act_empty_likes', 'Todavía no has dado like a ningún Tic.') },
            { id: 'comments', label: CONFIG.translate('act_tab_comments', 'Comentarios'), empty: CONFIG.translate('act_empty_comments', 'Todavía no has comentado ningún Tic.') },
            { id: 'saved', label: CONFIG.translate('act_tab_saved', 'Guardados'), empty: CONFIG.translate('act_empty_saved', 'Todavía no has guardado ningún Tic.') }
        ];
        var cur = startTab || 'likes';
        var back = openSheet(
            '<div class="ts-actmain">' +
            '<div class="ts-acthead"><h3>' + esc(CONFIG.translate('act_title', 'Tu actividad')) + '</h3><button type="button" class="ts-close" aria-label="' + esc(CONFIG.translate('tic_close', 'Cerrar')) + '">×</button></div>' +
            '<div class="ts-acttabs">' + tabs.map(function (t) { return '<button type="button" class="ts-acttab" data-tab="' + t.id + '">' + esc(t.label) + '</button>'; }).join('') + '</div>' +
            '<div class="ts-actlist"></div></div>' +
            '<div class="ts-actdetail" hidden>' +
            '<div class="ts-acthead"><button type="button" class="ts-actback" aria-label="' + esc(CONFIG.translate('tic_back', 'Volver')) + '"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z"/></svg></button><h3 class="ts-actdetailtitle"></h3></div>' +
            '<div class="ts-actdetailbody"></div></div>'
        );
        var sheet = back.querySelector('.tsheet');
        sheet.classList.add('tsheet--act');
        var main = sheet.querySelector('.ts-actmain'), detail = sheet.querySelector('.ts-actdetail');
        var list = sheet.querySelector('.ts-actlist');
        var token = 0, loaded = {};   // loaded[id] = item (para abrir el detalle sin pedirlo otra vez)
        sheet.querySelector('.ts-close').addEventListener('click', closeSheet);

        function tileHTML(it, tab, key) {
            var p = it.publication || {};
            var src = sizedSrc(assetUrl(p.imageUrl || p.imgUrl || p.data || ''));
            var cmt = '';
            if (it.comment) cmt = '<div class="ts-tilecmt">' + esc(decodeHtml(it.comment.text || '')) + '</div>';
            var meta = actShortDate(it.activityAt, it.approx) + (it.listName ? ' · ' + esc(it.listName) : '');
            return '<button type="button" class="ts-acttile" data-key="' + esc(key) + '">' +
                (src ? '<img src="' + esc(src) + '" alt="" loading="lazy" decoding="async" onerror="this.style.visibility=\'hidden\'">' : '') +
                '<span class="ts-tileshade">' + cmt + '<div class="ts-tilemeta">' + (it.listName ? esc(actShortDate(it.activityAt, it.approx)) + ' · ' + esc(it.listName) : esc(meta)) + '</div></span></button>';
        }
        function openDetail(it, tab) {
            var p = normalizeLeanPub(it.publication);
            var openComments = false;
            if (it.comment) {
                // El comentario elegido va el primero, luego los otros mios y despues el resto: el primero que se ve es el tuyo.
                var all = Array.isArray(p.comments) ? p.comments.slice() : [];
                var sel = null;
                all = all.filter(function (c) { if (c && String(c.id) === String(it.comment.id)) { sel = c; return false; } return true; });
                var mine = all.filter(function (c) { return c && String(c.userId) === String(uid); });
                var rest = all.filter(function (c) { return !(c && String(c.userId) === String(uid)); });
                p.comments = (sel ? [sel] : []).concat(mine, rest);
                openComments = true;
            }
            tagPubs[String(p.id)] = p;
            var body = detail.querySelector('.ts-actdetailbody');
            body.innerHTML = '<div class="ts-actwhen">' + esc(actDateLabel(it.activityAt, it.approx, tab)) + (it.listName ? ' · ' + esc(it.listName) : '') + '</div>' + ticCardHTML(p);
            detail.querySelector('.ts-actdetailtitle').textContent = decodeHtml(p.author || '') || CONFIG.translate('act_title', 'Tu actividad');
            main.hidden = true; detail.hidden = false;
            body.scrollTop = 0;
            var card = body.querySelector('.tic-card');
            hydrate(body); scanImages(body);
            if (card && openComments) toggleComments(card, true);
        }
        detail.querySelector('.ts-actback').addEventListener('click', function () {
            detail.hidden = true; main.hidden = false;
            detail.querySelector('.ts-actdetailbody').innerHTML = '';
        });
        list.addEventListener('click', function (e) {
            var t = e.target.closest('.ts-acttile');
            if (t && loaded[t.dataset.key]) openDetail(loaded[t.dataset.key].it, loaded[t.dataset.key].tab);
        });

        function load(tab, offset, mine) {
            apiCall('GET', '/api/activity/' + encodeURIComponent(uid) + '?type=' + tab + '&limit=12&offset=' + offset).then(function (r) {
                if (!sheet.isConnected || mine !== token) return;
                var more = list.querySelector('.ts-actmore');
                if (more) more.remove();
                var loading = list.querySelector('.ts-actmsg');
                if (loading) loading.remove();
                if (!r.ok) { list.insertAdjacentHTML('beforeend', '<div class="ts-actmsg">' + esc(r.data.message || CONFIG.translate('tic_load_failed', 'No se pudieron cargar los Tics')) + '</div>'); return; }
                var items = r.data.items || [];
                if (!items.length && !offset) {
                    var tdef = tabs.filter(function (t) { return t.id === tab; })[0];
                    list.innerHTML = '<div class="ts-actmsg">' + esc(tdef.empty) + '</div>';
                    return;
                }
                var grid = list.querySelector('.ts-actgrid');
                if (!grid) { grid = document.createElement('div'); grid.className = 'ts-actgrid'; list.appendChild(grid); }
                var html = items.map(function (it, i) {
                    var key = tab + ':' + offset + ':' + i;
                    loaded[key] = { it: it, tab: tab };
                    return tileHTML(it, tab, key);
                }).join('');
                grid.insertAdjacentHTML('beforeend', html);
                if (r.data.next != null) {
                    list.insertAdjacentHTML('beforeend', '<button type="button" class="ts-actmore">' + esc(CONFIG.translate('tic_see_more', 'Ver más')) + '</button>');
                    list.querySelector('.ts-actmore').addEventListener('click', function (ev) { ev.target.disabled = true; ev.target.textContent = CONFIG.translate('tic_loading', 'Cargando…'); load(tab, r.data.next, mine); });
                }
            });
        }
        function show(tab) {
            cur = tab;
            token++;
            loaded = {};
            [].forEach.call(sheet.querySelectorAll('.ts-acttab'), function (b) { b.classList.toggle('is-on', b.dataset.tab === tab); });
            list.scrollTop = 0;
            list.innerHTML = '<div class="ts-actmsg">' + esc(CONFIG.translate('tic_loading', 'Cargando…')) + '</div>';
            load(tab, 0, token);
        }
        sheet.querySelector('.ts-acttabs').addEventListener('click', function (e) {
            var b = e.target.closest('.ts-acttab');
            if (b && b.dataset.tab !== cur) show(b.dataset.tab);
        });
        show(cur);
    }

    /* ---------- Guardar en listas ---------- */
    var saveStyleDone = false;
    function ensureSaveStyle() {
        if (saveStyleDone || document.getElementById('tic-save-style')) { saveStyleDone = true; return; }
        saveStyleDone = true;
        var st = document.createElement('style');
        st.id = 'tic-save-style';
        st.textContent = [
            '.ts-savetitle{margin:2px 0 10px;text-align:center;font-size:16px;font-weight:700;color:#1B3A5C}',
            '.ts-list{display:flex;align-items:center;gap:12px;width:100%;text-align:left;border:0;background:transparent;padding:8px 6px;border-radius:12px;cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent}',
            '.ts-list:active{background:#F1F4F9}',
            '.ts-list.on{background:#EEF3F9}',
            '.ts-list[disabled]{opacity:.6;pointer-events:none}',
            '.ts-th{flex:none;width:48px;height:48px;border-radius:9px;overflow:hidden;background:#EEF1F5;position:relative}',
            '.ts-th img{width:100%;height:100%;object-fit:cover;display:block}',
            '.ts-th.ts-empty:before{content:"";position:absolute;left:14px;top:14px;width:20px;height:20px;border-radius:5px;border:2px solid #B8C0CC;box-sizing:border-box}',
            '.ts-th.ts-new:before,.ts-th.ts-new:after{content:"";position:absolute;background:#6B7380;border-radius:2px;border:0;width:auto;height:auto}',
            '.ts-th.ts-new:before{left:15px;right:15px;top:23px;height:2px}',
            '.ts-th.ts-new:after{top:15px;bottom:15px;left:23px;width:2px}',
            '.ts-ln{flex:1;min-width:0}',
            '.ts-ln b{display:block;font-size:14.5px;color:#1D1B20;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
            '.ts-ln em{display:block;font-style:normal;font-size:12px;color:#7A8594;margin-top:1px}',
            '.ts-lock{display:inline-block;width:8px;height:7px;border:1.6px solid #8A94A3;border-radius:2px;margin-left:6px;position:relative;top:-1px}',
            '.ts-lock:before{content:"";position:absolute;left:0;top:-6px;width:4px;height:5px;border:1.6px solid #8A94A3;border-bottom:0;border-radius:4px 4px 0 0}',
            '.ts-plus{flex:none;width:24px;height:24px;position:relative}',
            '.ts-plus:before,.ts-plus:after{content:"";position:absolute;background:#6B7380;border-radius:2px}',
            '.ts-plus:before{left:4px;right:4px;top:11px;height:2px}',
            '.ts-plus:after{top:4px;bottom:4px;left:11px;width:2px}',
            '.ts-check{flex:none;width:24px;height:24px;border-radius:50%;background:#1B3A5C;position:relative}',
            '.ts-check:after{content:"";position:absolute;left:8px;top:4px;width:5px;height:10px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}',
            '.ts-cover{display:flex;align-items:center;gap:14px;margin:4px 0 14px}',
            '.ts-coverbox{flex:none;width:84px;height:84px;border-radius:16px;overflow:hidden;background:#EEF1F5;border:1.5px dashed #B7C0CC;position:relative;cursor:pointer;padding:0}',
            '.ts-coverbox img{width:100%;height:100%;object-fit:cover;display:block}',
            '.ts-coverbox.has{border-style:solid;border-color:#D9DFE7}',
            '.ts-coverbox:not(.has):before{content:"";position:absolute;left:30px;top:32px;width:24px;height:18px;border:2.5px solid #8A94A3;border-radius:5px;box-sizing:border-box}',
            '.ts-coverbox:not(.has):after{content:"";position:absolute;left:38px;top:37px;width:8px;height:8px;border:2.5px solid #8A94A3;border-radius:50%;box-sizing:border-box}',
            '.ts-covertxt{flex:1;min-width:0;font-size:13px;color:#55606A;line-height:1.35}',
            '.ts-covertxt button{display:block;margin-top:6px;border:0;background:none;padding:0;color:#1B3A5C;font-weight:700;font-size:13.5px;font-family:inherit;cursor:pointer}',
            '.ts-covertxt button.rm{color:#B3261E;font-weight:600}',
            '.ts-lbl{font-size:12px;color:#55606A;font-weight:700;margin:0 2px 6px}',
            '.ts-input{width:100%;box-sizing:border-box;border:1px solid #D9DFE7;border-radius:12px;padding:12px;font-size:14.5px;font-family:inherit;outline:none}',
            '.ts-input:focus{border-color:#1B3A5C}'
        ].join('');
        document.head.appendChild(st);
    }
    function listLabelCount(n) {
        return n === 1 ? CONFIG.translate('tic_count_one', '{{n}} Tic').replace('{{n}}', n) : CONFIG.translate('tic_count_many', '{{n}} Tics').replace('{{n}}', n);
    }
    // Miniatura de una lista: su foto, o la del ultimo Tic guardado, o un hueco neutro. Si una imagen falla al cargar
    // (portada quitada, Tic borrado...) se pasa a la siguiente opcion en vez de dejar un icono roto (ver onThumbError).
    function listThumbHTML(l) {
        var main = assetUrl(l.cover || '');
        var fb = assetUrl(l.fallbackCover || '');
        var src = main || fb;
        if (!src) return '<div class="ts-th ts-empty"></div>';
        return '<div class="ts-th"><img src="' + esc(src) + '" alt="" loading="lazy" data-fb="' + esc(main && fb && fb !== main ? fb : '') + '"></div>';
    }
    function onThumbError(ev) {
        var img = ev.target;
        if (!img || img.tagName !== 'IMG' || !img.closest || !img.closest('.ts-th')) return;
        var fb = img.getAttribute('data-fb');
        if (fb && img.getAttribute('src') !== fb) { img.setAttribute('data-fb', ''); img.setAttribute('src', fb); return; }
        var box = img.parentNode;
        if (box) { box.classList.add('ts-empty'); }
        img.remove();
    }
    // Recorta la foto en cuadrado y la reduce (≈480 px) para que pese poco y el servidor la acepte.
    function fileToCoverDataUrl(file) {
        return new Promise(function (resolve, reject) {
            var fr = new FileReader();
            fr.onerror = function () { reject(new Error('read')); };
            fr.onload = function () {
                var img = new Image();
                img.onerror = function () { reject(new Error('decode')); };
                img.onload = function () {
                    try {
                        var s = Math.min(img.naturalWidth, img.naturalHeight);
                        if (!s) throw new Error('empty');
                        var c = document.createElement('canvas');
                        c.width = 480; c.height = 480;
                        c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 480, 480);
                        var q = 0.82, d = c.toDataURL('image/jpeg', q);
                        while (d.length > 150000 && q > 0.4) { q -= 0.1; d = c.toDataURL('image/jpeg', q); }
                        resolve(d);
                    } catch (e) { reject(e); }
                };
                img.src = fr.result;
            };
            fr.readAsDataURL(file);
        });
    }
    var saveCtx = null; // { pubId, lists, draftName, draftCover }
    function openSaveSheet(pubId) {
        var uid = me();
        if (!uid) return;
        ensureSaveStyle();
        saveCtx = { pubId: pubId, lists: [], draftName: '', draftCover: '' };
        openSheet('<div class="ts-savetitle">' + esc(CONFIG.translate('tic_save_title2', 'Guarda el Tic en una lista')) + '</div><p class="ts-note">' + esc(CONFIG.translate('tic_loading', 'Cargando…')) + '</p>');
        apiCall('GET', '/api/saved/' + encodeURIComponent(uid)).then(function (r) {
            if (!sheetEl || !saveCtx || saveCtx.pubId !== pubId) return;
            saveCtx.lists = (r.data && r.data.lists) || [];
            renderSaveSheet();
        });
    }
    function renderSaveSheet() {
        if (!sheetEl || !saveCtx) return;
        var pubId = saveCtx.pubId, lists = saveCtx.lists;
        var html = '<div class="ts-savetitle">' + esc(CONFIG.translate('tic_save_title2', 'Guarda el Tic en una lista')) + '</div>';
        lists.forEach(function (l) {
            var has = (l.publicationIds || []).some(function (id) { return String(id) === String(pubId); });
            html += '<button type="button" class="ts-list' + (has ? ' on' : '') + '" data-list="' + esc(l.name) + '" data-has="' + (has ? '1' : '0') + '">' +
                listThumbHTML(l) +
                '<span class="ts-ln"><b>' + esc(l.name) + '<span class="ts-lock" aria-hidden="true"></span></b><em>' + esc(listLabelCount(l.count || 0)) + '</em></span>' +
                (has ? '<span class="ts-check" aria-hidden="true"></span>' : '<span class="ts-plus" aria-hidden="true"></span>') + '</button>';
        });
        html += '<button type="button" class="ts-list" data-ts="new-list"><div class="ts-th ts-new"></div><span class="ts-ln"><b>' + esc(CONFIG.translate('tic_new_list_row', 'Crear una lista nueva')) + '</b><em>' + esc(CONFIG.translate('tic_new_list_sub', 'Organiza los Tics que quieras recordar')) + '</em></span><span class="ts-plus" aria-hidden="true"></span></button>';
        var body = setSheetBody(html);
        body.addEventListener('error', onThumbError, true);
        body.onclick = function (e) {
            var listBtn = e.target.closest('[data-list]');
            if (listBtn) return toggleInList(listBtn.dataset.list, listBtn.dataset.has === '1');
            if (e.target.closest('[data-ts="new-list"]')) { saveCtx.draftName = ''; saveCtx.draftCover = ''; renderNewListView(); }
        };
    }
    function toggleInList(listName, has) {
        var ctx = saveCtx;
        if (!ctx) return;
        var l = ctx.lists.filter(function (x) { return x.name === listName; })[0];
        if (!l) return;
        var pubId = ctx.pubId;
        var ids = (l.publicationIds || []).map(String);
        // Se actualiza al momento (check y contador) y, si el servidor falla, se deshace.
        function apply(add) {
            l.publicationIds = add ? ids.concat([String(pubId)]) : ids.filter(function (id) { return id !== String(pubId); });
            l.count = Math.max(0, (l.count || 0) + (add ? 1 : -1));
            if (sheetEl && saveCtx === ctx) renderSaveSheet();
        }
        var before = { ids: l.publicationIds, count: l.count };
        apply(!has);
        apiCall(has ? 'DELETE' : 'POST', '/api/saved', { userId: me(), listName: listName, publicationId: pubId }).then(function (r) {
            if (r.ok) {
                toastMsg(has ? CONFIG.translate('tic_removed_from_list', 'Quitado de {{list}}').replace('{{list}}', listName) : CONFIG.translate('tic_saved_to_list', 'Guardado en {{list}}').replace('{{list}}', listName));
                if (has && l.count === 0) { ctx.lists = ctx.lists.filter(function (x) { return x !== l; }); if (sheetEl && saveCtx === ctx) renderSaveSheet(); }
            } else {
                l.publicationIds = before.ids; l.count = before.count;
                if (sheetEl && saveCtx === ctx) renderSaveSheet();
                toastMsg((r.data && r.data.message) || CONFIG.translate('tic_save_failed', 'No se pudo guardar'));
            }
        });
    }
    function renderNewListView() {
        if (!sheetEl || !saveCtx) return;
        var ctx = saveCtx;
        var html = '<div class="ts-savetitle">' + esc(CONFIG.translate('tic_new_list_title', 'Nueva lista')) + '</div>' +
            '<div class="ts-cover"><button type="button" class="ts-coverbox' + (ctx.draftCover ? ' has' : '') + '" data-ts="pick-cover" aria-label="' + esc(CONFIG.translate('tic_list_cover_add', 'Añadir foto de la lista')) + '">' + (ctx.draftCover ? '<img src="' + ctx.draftCover + '" alt="">' : '') + '</button>' +
            '<div class="ts-covertxt">' + esc(CONFIG.translate('tic_list_cover_hint', 'Foto de la lista (opcional). Si no pones ninguna, se usa la del último Tic que guardes.')) +
            '<button type="button" data-ts="pick-cover">' + esc(ctx.draftCover ? CONFIG.translate('tic_list_cover_change', 'Cambiar foto') : CONFIG.translate('tic_list_cover_add', 'Añadir foto de la lista')) + '</button>' +
            (ctx.draftCover ? '<button type="button" class="rm" data-ts="rm-cover">' + esc(CONFIG.translate('tic_list_cover_remove', 'Quitar foto')) + '</button>' : '') + '</div></div>' +
            '<div class="ts-lbl">' + esc(CONFIG.translate('tic_list_name_label', 'Nombre')) + '</div>' +
            '<input id="ts-new-list" class="ts-input" maxlength="60" value="' + esc(ctx.draftName) + '" placeholder="' + esc(CONFIG.translate('tic_new_list_placeholder', 'Ej. Sitios para ir')) + '">' +
            '<input type="file" id="ts-cover-file" accept="image/*" style="display:none">' +
            '<div class="ts-row"><button type="button" class="ts-ghost" data-ts="back">' + esc(CONFIG.translate('tic_back', 'Atrás')) + '</button><button type="button" class="ts-primary" data-ts="create-list">' + esc(CONFIG.translate('tic_create_and_save', 'Crear y guardar el Tic')) + '</button></div>';
        var body = setSheetBody(html);
        var nameInput = body.querySelector('#ts-new-list');
        var fileInput = body.querySelector('#ts-cover-file');
        nameInput.addEventListener('input', function () { ctx.draftName = nameInput.value; });
        fileInput.addEventListener('change', function () {
            var f = fileInput.files && fileInput.files[0];
            if (!f) return;
            fileToCoverDataUrl(f).then(function (d) {
                if (!sheetEl || saveCtx !== ctx) return;
                ctx.draftCover = d; renderNewListView();
            }).catch(function () { toastMsg(CONFIG.translate('tic_list_cover_error', 'No se pudo usar esa foto. Prueba con otra.')); });
        });
        body.onclick = function (e) {
            var b = e.target.closest('[data-ts]');
            if (!b) return;
            var act = b.dataset.ts;
            if (act === 'back') { renderSaveSheet(); return; }
            if (act === 'pick-cover') { fileInput.click(); return; }
            if (act === 'rm-cover') { ctx.draftCover = ''; renderNewListView(); return; }
            if (act === 'create-list') {
                var name = (nameInput.value || '').trim();
                if (!name) { nameInput.focus(); return; }
                var exists = ctx.lists.some(function (x) { return String(x.name).toLowerCase() === name.toLowerCase(); });
                if (exists) { toastMsg(CONFIG.translate('tic_list_exists', 'Ya tienes una lista con ese nombre')); return; }
                b.disabled = true;
                var payload = { userId: me(), listName: name, publicationId: ctx.pubId };
                if (ctx.draftCover) payload.cover = ctx.draftCover;
                apiCall('POST', '/api/saved', payload).then(function (r) {
                    if (!r.ok) { b.disabled = false; toastMsg((r.data && r.data.message) || CONFIG.translate('tic_save_failed', 'No se pudo guardar')); return; }
                    toastMsg(CONFIG.translate('tic_saved_to_list', 'Guardado en {{list}}').replace('{{list}}', name) + (ctx.draftCover && r.data && r.data.coverSaved === false ? ' · ' + CONFIG.translate('tic_list_cover_not_saved', 'sin foto de lista') : ''));
                    return apiCall('GET', '/api/saved/' + encodeURIComponent(me())).then(function (g) {
                        if (!sheetEl || saveCtx !== ctx) return;
                        ctx.lists = (g.data && g.data.lists) || ctx.lists;
                        renderSaveSheet();
                    });
                });
            }
        };
    }

    /* ---------- Enviar (compartir) ---------- */
    function openSendSheet(pubId) {
        var uid = me();
        if (!uid) return;
        openSheet('<h3>' + esc(CONFIG.translate('tic_send_title', 'Enviar')) + '</h3><p class="ts-note">' + esc(CONFIG.translate('tic_loading', 'Cargando…')) + '</p>');
        apiCall('GET', '/api/friends/' + encodeURIComponent(uid)).then(function (r) {
            renderSendSheet(pubId, (r.data && (r.data.friends || r.data)) || []);
        });
    }
    var themeTranslateCache = {};
    function translateThemeChip(text) {
        try {
            var lang = (typeof CONFIG !== 'undefined' && CONFIG.currentLanguage) ? CONFIG.currentLanguage : 'es';
            if (!text || lang === 'es') return Promise.resolve(text);
            var key = lang + '|' + text;
            if (themeTranslateCache[key]) return Promise.resolve(themeTranslateCache[key]);
            if (typeof window.translateDailyThemeText === 'function') {
                return window.translateDailyThemeText(text).then(function (t) { themeTranslateCache[key] = t || text; return themeTranslateCache[key]; }).catch(function () { return text; });
            }
            var base = apiBase();
            if (!base) return Promise.resolve(text);
            return fetch(base + '/api/translate-theme?lang=' + encodeURIComponent(lang) + '&text=' + encodeURIComponent(text))
                .then(function (r) { return r.ok ? r.json() : null; })
                .then(function (data) { var t = (data && data.text) || text; themeTranslateCache[key] = t; return t; })
                .catch(function () { return text; });
        } catch (e) { return Promise.resolve(text); }
    }
    function toggleThemeChip(btn, card) {
        var full = card.querySelector('[data-role="theme-full"]');
        if (!full) return;
        var willOpen = !!full.hidden;
        full.hidden = !willOpen;
        btn.classList.toggle('is-open', willOpen);
        if (willOpen && !full.dataset.translated) {
            full.dataset.translated = '1';
            var original = btn.dataset.themeFull || full.textContent;
            translateThemeChip(original).then(function (translated) {
                full.textContent = translated;
                var preview = btn.querySelector('[data-role="theme-preview"]');
                if (preview) preview.textContent = translated.length > 46 ? translated.slice(0, 46).replace(/\s+\S*$/, '') + '…' : translated;
            });
        }
    }
    function ticShareLink(pubId) {
        var base;
        try {
            // En la app nativa el origen es https://localhost: usar el dominio publico para que el enlace funcione fuera
            base = (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_SERVER_URL ? CONFIG.DEFAULT_SERVER_URL.replace(/\/$/, '') : (window.location.origin || '')) + '/home.html';
            if (typeof window.Capacitor === 'undefined' && window.location.protocol.indexOf('http') === 0 && !/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) {
                base = window.location.origin + '/home.html';
            }
        } catch (e) { base = (window.location.origin || '') + '/home.html'; }
        return base + '?tic=' + encodeURIComponent(pubId);
    }
    function renderSendSheet(pubId, friends) {
        if (!sheetEl) return;
        var link = ticShareLink(pubId);
        var html = '<h3>' + esc(CONFIG.translate('tic_send_title', 'Enviar')) + '</h3>' +
            '<button type="button" class="ts-link-row" data-ts="copy-link"><span class="ts-link-icon">🔗</span><span>' + esc(CONFIG.translate('tic_copy_link', 'Copiar enlace')) + '</span></button>';
        if (Array.isArray(friends) && friends.length) {
            html += '<p class="ts-note" style="margin:2px 4px 4px">' + esc(CONFIG.translate('tic_send_to_friend', 'Enviar por chat a:')) + '</p>' +
                '<div class="ts-send-grid">';
            friends.slice(0, 30).forEach(function (f) {
                var fid = f.id || f.userId || f.friendId || f;
                var fname = f.name || f.username || (userCache[fid] && userCache[fid].name) || CONFIG.translate('tic_default_friend', 'amigo');
                html += '<button type="button" class="ts-friend-cell" data-friend="' + esc(fid) + '" title="' + esc(fname) + '">' +
                    '<span class="ts-friend-avatar">' + avatarInner(fname, f.avatar || f.foto || '') + '</span>' +
                    '<span>' + esc(fname) + '</span></button>';
            });
            html += '</div>';
        } else {
            html += '<p class="ts-note" style="margin-top:4px">' + esc(CONFIG.translate('tic_no_friends_to_send', 'Añade amigos para poder enviarles Tics por chat.')) + '</p>';
        }
        html += '<button type="button" class="ts-btn" data-ts="close" style="color:#6B7280;justify-content:center;margin-top:4px">' + esc(CONFIG.translate('tic_cancel', 'Cerrar')) + '</button>';
        var body = setSheetBody(html);
        body.onclick = function (e) {
            var friendBtn = e.target.closest('[data-friend]');
            if (friendBtn) {
                if (friendBtn.classList.contains('sending') || friendBtn.classList.contains('sent')) return;
                friendBtn.classList.add('sending');
                apiCall('POST', '/api/chat/message', { fromUserId: me(), toId: friendBtn.dataset.friend, sharedTicId: pubId }).then(function (r) {
                    friendBtn.classList.remove('sending');
                    if (r.ok) {
                        friendBtn.classList.add('sent');
                        toastMsg(CONFIG.translate('tic_sent', 'Enviado'));
                        setTimeout(closeSheet, 420);
                    } else {
                        toastMsg((r.data && r.data.message) || CONFIG.translate('tic_send_failed', 'No se pudo enviar'));
                    }
                });
                return;
            }
            var b = e.target.closest('[data-ts]');
            if (!b) return;
            if (b.dataset.ts === 'close') return closeSheet();
            if (b.dataset.ts === 'copy-link') {
                var done = function () { toastMsg(CONFIG.translate('tic_link_copied', 'Enlace copiado')); closeSheet(); };
                if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done).catch(done);
                else done();
            }
        };
    }

    window.SocialUI = {
        ticCardHTML: ticCardHTML,
        decode: decodeHtml,
        hydrate: hydrate,
        timeAgo: timeAgo,
        getUser: getUser,
        profileHref: profileHref,
        avatarInner: avatarInner,
        icons: ICON,
        esc: esc,
        setLike: setLike,
        imgFail: imgFail,
        scanImages: scanImages,
        warmImage: warmImage,
        openTicMenu: openTicMenu,
        openOwnMenu: openOwnMenu,
        openUserMenu: openUserMenu,
        openReportComment: openReportComment,
        openHashtag: openHashtag,
        openActivity: openActivity,
        linkifyTags: linkifyTags,
        findPub: findPub,
        closeComments: function (card) {
            if (!card) return;
            var panel = card.querySelector && card.querySelector('.tic-comments');
            if (panel && panel.style.display === 'block') toggleComments(card, false);
        }
    };
    // Hashtags visibles aunque la hoja de estilos aún no se haya creado
    try { if (document.head) ensureTagStyle(); else document.addEventListener('DOMContentLoaded', ensureTagStyle); } catch (e) { }
})();
