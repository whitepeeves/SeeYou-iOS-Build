/* SeeYou · Autocompletado de menciones "@usuario" en comentarios, descripción de Tics y chats de grupo. */
(function () {
    'use strict';

    var friendsCache = null;
    var friendsCacheAt = 0;

    // CONFIG es un const de config.js: no cuelga de window.CONFIG.
    function apiBase() { try { return (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) || ''; } catch (e) { return ''; } }
    function me() { try { return localStorage.getItem('current_user_id') || ''; } catch (e) { return ''; } }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function loadFriends() {
        var uid = me();
        if (!uid) return Promise.resolve([]);
        if (friendsCache && (Date.now() - friendsCacheAt) < 60000) return Promise.resolve(friendsCache);
        return fetch(apiBase() + '/api/friends/' + encodeURIComponent(uid))
            .then(function (r) { return r.ok ? r.json() : []; })
            .then(function (list) {
                friendsCache = Array.isArray(list) ? list.filter(function (u) { return u && u.username; }) : [];
                friendsCacheAt = Date.now();
                return friendsCache;
            })
            .catch(function () { return []; });
    }

    function currentMentionQuery(input) {
        var value = input.value || '';
        var pos = typeof input.selectionStart === 'number' ? input.selectionStart : value.length;
        var before = value.slice(0, pos);
        var m = before.match(/(?:^|\s)@([A-Za-z0-9_.]{0,30})$/);
        return m ? m[1] : null;
    }

    function replaceMentionQuery(input, username) {
        var value = input.value || '';
        var pos = typeof input.selectionStart === 'number' ? input.selectionStart : value.length;
        var before = value.slice(0, pos);
        var after = value.slice(pos);
        var replaced = before.replace(/@([A-Za-z0-9_.]{0,30})$/, '@' + username + ' ');
        input.value = replaced + after;
        var newPos = replaced.length;
        try { input.setSelectionRange(newPos, newPos); } catch (e) { }
        input.focus();
        // Que cualquier binding externo (contador de caracteres, autosize...) se entere del cambio.
        try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) { }
    }

    function closeDropdown(input) {
        if (input._mentionDropdown) {
            input._mentionDropdown.remove();
            input._mentionDropdown = null;
        }
    }

    function showDropdown(input, matches) {
        closeDropdown(input);
        if (!matches.length) return;
        var dd = document.createElement('div');
        dd.className = 'mention-dropdown';
        dd.style.cssText = 'position:fixed;z-index:99999;background:#fff;border:1px solid #d7dbe8;' +
            'border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.16);max-height:220px;overflow-y:auto;';

        matches.slice(0, 6).forEach(function (u) {
            var row = document.createElement('div');
            row.className = 'mention-dropdown-row';
            row.style.cssText = 'padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:14px;';
            var avatar = u.avatar || u.foto || '';
            row.innerHTML =
                (avatar ? '<img src="' + esc(avatar) + '" style="width:26px;height:26px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.remove()">' : '') +
                '<span style="font-weight:600;">' + esc(u.name || u.username) + '</span>' +
                '<span style="color:#9aa0ab;font-size:12px;">@' + esc(u.username) + '</span>';
            row.addEventListener('mouseenter', function () { row.style.background = '#f2f4f8'; });
            row.addEventListener('mouseleave', function () { row.style.background = ''; });
            row.addEventListener('mousedown', function (e) {
                e.preventDefault();
                replaceMentionQuery(input, u.username);
                closeDropdown(input);
            });
            dd.appendChild(row);
        });

        var rect = input.getBoundingClientRect();
        var ddHeight = Math.min(220, matches.length * 42 + 8);
        var openAbove = rect.top > ddHeight + 8;
        dd.style.left = Math.max(8, rect.left) + 'px';
        dd.style.width = Math.max(220, rect.width) + 'px';
        dd.style.top = openAbove ? (rect.top - ddHeight - 6) + 'px' : (rect.bottom + 6) + 'px';

        document.body.appendChild(dd);
        input._mentionDropdown = dd;
    }

    function handleInput(input) {
        var query = currentMentionQuery(input);
        if (query === null) { closeDropdown(input); return; }
        loadFriends().then(function (friends) {
            // El cuadro pudo perder el foco (o cambiar el texto) mientras llegaba la respuesta.
            if (currentMentionQuery(input) !== query) return;
            var q = query.toLowerCase();
            var matches = friends.filter(function (u) {
                var uname = (u.username || '').toLowerCase();
                var name = (u.name || '').toLowerCase();
                return uname.indexOf(q) === 0 || (q.length > 0 && name.indexOf(q) === 0);
            });
            showDropdown(input, matches);
        });
    }

    function bind(el) {
        if (!el || el._mentionBound) return;
        el._mentionBound = true;
        el.addEventListener('input', function () { handleInput(el); });
        el.addEventListener('blur', function () { setTimeout(function () { closeDropdown(el); }, 150); });
        el.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeDropdown(el);
        });
    }

    function attach(selector) {
        document.querySelectorAll(selector).forEach(bind);
        document.addEventListener('focusin', function (e) {
            if (e.target && e.target.matches && e.target.matches(selector)) bind(e.target);
        });
    }

    window.MentionsUI = { attach: attach, bind: bind };

    function start() {
        // Cuadro de comentarios de cada Tic (se crean dinámicamente al abrir el panel de comentarios)
        attach('.tic-comment-input');
        // Descripción al publicar un Tic
        attach('#create-post-caption');
        // Mensajes de chat (individuales y de grupo)
        attach('#chat-message-input');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
