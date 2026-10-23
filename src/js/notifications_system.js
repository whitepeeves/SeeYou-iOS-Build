(function () {
  const STORAGE_KEY = 'seeyou_notifications_seen';
  const LEADER_KEY_PREFIX = 'seeyou_notifications_leader:';
  const FOREGROUND_POLL_MS = 2 * 60 * 1000;
  const BACKGROUND_POLL_MS = 5 * 60 * 1000;
  const LEADER_LEASE_MS = 3 * 60 * 1000;
  const DAILY_NOTIFICATION_IDS = Array.from({ length: 31 }, (_, index) => 7000 + index);
  const NATIVE_CHANNEL_ID = 'seeyou_notifications';
  const state = {
    currentUserId: null,
    pollTimeoutId: null,
    leaseIntervalId: null,
    visibilityHandler: null,
    tabId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    seenIds: new Set(),
    permissionRequested: false,
    nativeNotifications: null,
    pushNotifications: null,
    pushListenerRegistered: false,
    browserDailyTimer: null
  };

  async function ensureNativeChannel(nativeNotifications) {
    if (!nativeNotifications || typeof nativeNotifications.createChannel !== 'function') return;
    await nativeNotifications.createChannel({
      id: NATIVE_CHANNEL_ID,
      name: 'Notificaciones de SeeYou',
      description: 'Mensajes y avisos de SeeYou',
      importance: 5,
      sound: 'default',
      visibility: 1
    });
  }

  function getMadridDateAt(hour, date) {
    const dayParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Madrid',
      year: 'numeric', month: '2-digit', day: '2-digit', hour12: false
    }).formatToParts(date);
    const dayValues = {};
    dayParts.forEach((part) => { if (part.type !== 'literal') dayValues[part.type] = Number(part.value); });
    // Hora de pared objetivo (p. ej. 10:00 de Madrid) tomada como si fuera UTC. Cada pasada corrige el desfase respecto a ESE objetivo:
    // antes se restaba el desfase sobre el valor ya corregido, y la segunda pasada lo restaba otra vez (la notificacion salia a las 6:00 en vez de las 10:00).
    const target = Date.UTC(dayValues.year, dayValues.month - 1, dayValues.day, hour, 0, 0);
    let timestamp = target;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Madrid',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).formatToParts(new Date(timestamp));
      const values = {};
      parts.forEach((part) => { if (part.type !== 'literal') values[part.type] = Number(part.value); });
      const madridAsUtc = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
      timestamp = target - (madridAsUtc - timestamp);
    }
    return new Date(timestamp);
  }

  function getThemeForDate(date) {
    if (typeof getDailyThemeForDate === 'function') return getDailyThemeForDate(date);
    if (typeof getTodayThemeObject === 'function') return getTodayThemeObject();
    return null;
  }

  function getDailyNotifications() {
    const notifications = [];
    const today = new Date();
    for (let index = 0; index < 31; index += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      const atTen = getMadridDateAt(10, date);
      if (atTen <= new Date()) continue;
      const theme = getThemeForDate(atTen);
      if (!theme) continue;
      notifications.push({
        id: DAILY_NOTIFICATION_IDS[index],
        title: 'Nuevo tema del día',
        body: theme.theme,
        schedule: { at: atTen, allowWhileIdle: true },
        extra: { url: new URL('home.html', window.location.href).toString(), type: 'daily_theme' },
        sound: 'default',
        channelId: NATIVE_CHANNEL_ID,
        smallIcon: 'ic_stat_seeyou'
      });
    }
    return notifications;
  }

  async function scheduleDailyThemeNotifications() {
    const nativeNotifications = getNativeNotifications();
    if (!nativeNotifications) return;
    try {
      await ensureNativeChannel(nativeNotifications);
      await nativeNotifications.cancel({ notifications: DAILY_NOTIFICATION_IDS.map((id) => ({ id })) });
      const notifications = getDailyNotifications();
      if (notifications.length) await nativeNotifications.schedule({ notifications });
      console.log('[SeeYou] Temas diarios programados:', notifications.map((item) => item.schedule.at.toISOString()));
    } catch (error) {
      console.warn('No se pudieron programar los temas diarios:', error);
    }
  }

  function scheduleBrowserDailyThemeNotification() {
    if (state.nativeNotifications || !('Notification' in window) || Notification.permission !== 'granted') return;
    if (state.browserDailyTimer) clearTimeout(state.browserDailyTimer);
    const now = new Date();
    const next = getMadridDateAt(10, now);
    if (next <= now) next.setDate(next.getDate() + 1);
    state.browserDailyTimer = setTimeout(() => {
      const theme = getThemeForDate(new Date());
      if (theme) {
        new Notification('Nuevo tema del día', {
          body: theme.theme,
          icon: new URL('logotipo.png', window.location.href).toString(),
          data: { url: new URL('home.html', window.location.href).toString() }
        });
      }
      scheduleBrowserDailyThemeNotification();
    }, Math.max(1000, next.getTime() - now.getTime()));
  }

  // En iPhone el objeto Capacitor.Plugins puede no traer el modulo aunque este instalado: se pide con registerPlugin como alternativa.
  const pluginCache = {};
  function getCapacitorPlugin(name) {
    const cap = window.Capacitor;
    if (!cap) return null;
    if (cap.Plugins && cap.Plugins[name]) return cap.Plugins[name];
    if (pluginCache[name]) return pluginCache[name];
    try {
      if (typeof cap.registerPlugin === 'function' && (typeof cap.isPluginAvailable !== 'function' || cap.isPluginAvailable(name))) {
        pluginCache[name] = cap.registerPlugin(name);
        return pluginCache[name];
      }
    } catch (e) { /* sin modulo nativo */ }
    return null;
  }

  function getNativeNotifications() {
    return getCapacitorPlugin('LocalNotifications');
  }

  function getPushNotifications() {
    return getCapacitorPlugin('PushNotifications');
  }

  // Aviso de diagnostico (solo app nativa): llega a los registros del servidor como [PushDiag] para saber por que no se activan los avisos.
  function pushDiag(stage, extra) {
    try {
      const cap = window.Capacitor;
      if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return;
      const authToken = localStorage.getItem('seeYou_auth_token');
      let apiBaseUrl = '';
      try { apiBaseUrl = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) || ''; } catch (e) { }
      if (!authToken || !apiBaseUrl) return;
      const info = {
        stage,
        platform: typeof cap.getPlatform === 'function' ? cap.getPlatform() : '?',
        plugins: Object.keys(cap.Plugins || {}).slice(0, 20),
        push: Boolean(getPushNotifications()),
        local: Boolean(getNativeNotifications()),
        extra: extra === undefined ? null : String(extra && extra.message ? extra.message : (typeof extra === 'object' ? JSON.stringify(extra) : extra)).slice(0, 300)
      };
      fetch(`${apiBaseUrl}/api/push/diag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(info),
        keepalive: true
      }).catch(() => {});
    } catch (e) { /* el diagnostico nunca debe romper la app */ }
  }

  async function registerPushNotifications(userId) {
    const pushNotifications = getPushNotifications();
    if (!pushNotifications || !userId || state.pushListenerRegistered) {
      if (!pushNotifications) pushDiag('sin-modulo-push');
      return;
    }
    state.pushNotifications = pushNotifications;
    try {
      const permission = await pushNotifications.requestPermissions();
      pushDiag('permiso', permission && permission.receive);
      if (permission.receive !== 'granted') return;
      // El canal tiene que existir ANTES de que llegue el primer aviso: si no, Android usa uno por defecto sin sonido ni aviso emergente.
      try { await ensureNativeChannel(getNativeNotifications() || pushNotifications); } catch (e) { }
      if (!state.pushListenerRegistered) {
        state.pushListenerRegistered = true;
        await pushNotifications.addListener('registrationError', (error) => { pushDiag('error-registro', error); });
        await pushNotifications.addListener('registration', async ({ value }) => {
          pushDiag('token-recibido', value ? `len ${String(value).length}` : 'vacio');
          const authToken = localStorage.getItem('seeYou_auth_token');
          // CONFIG es un const de config.js: no cuelga de window.CONFIG, asi que esta
          // comprobacion fallaba siempre en la app nativa y el token de notificaciones push
          // nunca llegaba a registrarse en el servidor.
          let apiBaseUrl = '';
          try { apiBaseUrl = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) || ''; } catch (e) { }
          try { localStorage.setItem('seeYou_push_token', value || ''); } catch (e) { } // para poder quitarlo al cerrar sesion
          if (!authToken || !value || !apiBaseUrl) return;
          await fetch(`${apiBaseUrl}/api/push/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify({ token: value, platform: (window.Capacitor && typeof window.Capacitor.getPlatform === 'function' && window.Capacitor.getPlatform() === 'ios') ? 'ios' : 'android' })
          });
        });
        await pushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
          const targetUrl = notification?.data?.url || notification?.data?.link;
          // Solo se navega a rutas de la propia app: un aviso con una URL externa no debe llevar el WebView a otra web.
          try {
            if (targetUrl && new URL(String(targetUrl), window.location.href).origin === window.location.origin) window.location.href = targetUrl;
          } catch (e) { /* URL no valida: se ignora */ }
        });
      }
      await pushNotifications.register();
    } catch (error) {
      console.warn('No se pudieron activar las notificaciones push:', error);
      pushDiag('excepcion', error);
    }
  }

  function loadSeenIds() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      state.seenIds = new Set(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      state.seenIds = new Set();
    }
  }

  function saveSeenIds() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.seenIds].slice(-200)));
    } catch (error) {
      console.warn('No se pudo guardar el estado de notificaciones:', error);
    }
  }

  function getLeaderKey(userId) {
    return `${LEADER_KEY_PREFIX}${userId}`;
  }

  function claimPollingLeader(userId) {
    try {
      const key = getLeaderKey(userId);
      const current = JSON.parse(localStorage.getItem(key) || 'null');
      const now = Date.now();
      if (current && current.tabId !== state.tabId && Number(current.expiresAt) > now) return false;
      localStorage.setItem(key, JSON.stringify({ tabId: state.tabId, expiresAt: now + LEADER_LEASE_MS }));
      return true;
    } catch (error) {
      return true;
    }
  }

  function releasePollingLeader() {
    if (!state.currentUserId) return;
    try {
      const key = getLeaderKey(state.currentUserId);
      const current = JSON.parse(localStorage.getItem(key) || 'null');
      if (current?.tabId === state.tabId) localStorage.removeItem(key);
    } catch (error) {}
  }

  function schedulePoll(userId, delay = 0) {
    if (state.pollTimeoutId) clearTimeout(state.pollTimeoutId);
    state.pollTimeoutId = setTimeout(async () => {
      if (state.currentUserId !== userId || !claimPollingLeader(userId)) {
        schedulePoll(userId, BACKGROUND_POLL_MS);
        return;
      }
      await poll(userId);
      const nextDelay = document.visibilityState === 'visible' ? FOREGROUND_POLL_MS : BACKGROUND_POLL_MS;
      schedulePoll(userId, nextDelay);
    }, Math.max(0, delay));
  }

  async function requestPermission() {
    state.nativeNotifications = getNativeNotifications();
    if (state.nativeNotifications) {
      const permission = await state.nativeNotifications.requestPermissions();
      return permission.display === 'granted';
    }

    if (!('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  document.addEventListener('click', () => {
    if (state.permissionRequested) return;
    state.permissionRequested = true;
    requestPermission().then(scheduleBrowserDailyThemeNotification).catch(() => {});
  }, { once: true });

  function registerNativeNotificationEvents() {
    const nativeNotifications = getNativeNotifications();
    if (!nativeNotifications || state.nativeNotifications === nativeNotifications) return;
    state.nativeNotifications = nativeNotifications;
    const listener = nativeNotifications.addListener('localNotificationActionPerformed', (event) => {
      const url = event.notification?.extra?.url;
      if (url) window.location.href = url;
    });
    Promise.resolve(listener).catch(() => {});
  }

  function buildNotificationTitle(item) {
    return item.title || `Mensaje de ${item.fromUserName || item.fromUser?.name || item.fromUser?.username || item.fromUser?.usuario || 'un usuario'}`;
  }

  function buildNotificationBody(item) {
    if (item.text) return item.text;
    if (item.title) return item.title;
    return 'Tienes un nuevo mensaje';
  }

  function getGenericNotificationContent(item) {
    const senderName = item.fromUserName || item.fromUser?.name || item.fromUser?.username || item.fromUser?.usuario || 'Un usuario';
    const content = {
      friend_request: [`Solicitud de amistad`, `${senderName} te ha enviado una solicitud de amistad.`],
      friend_accepted: [`Solicitud aceptada`, `${senderName} ha aceptado tu solicitud de amistad.`],
      request_accepted: [`Solicitud aceptada`, `${senderName} ha aceptado tu solicitud.`],
      new_upload: [`Nueva publicación`, `${senderName} ha publicado una foto.`],
      publication: [`Nueva publicación`, `${senderName} ha publicado una foto.`]
    };
    return content[item.type] || [buildNotificationTitle(item), buildNotificationBody(item)];
  }

  function openRelevantPage() {
    const currentPath = window.location.pathname.split('/').pop() || 'home.html';
    const targetPage = currentPath.endsWith('chat.html') ? currentPath : 'chat.html';
    if (window.location.pathname.endsWith('/' + targetPage)) {
      window.focus();
      return;
    }

    const url = new URL(targetPage, window.location.href);
    window.location.href = url.toString();
  }

  function getNotificationUrl(item) {
    const url = new URL('chat.html', window.location.href);
    if (item.fromUserId) url.searchParams.set('userId', item.fromUserId);
    return url.toString();
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    return navigator.serviceWorker.register('sw.js?v=6', { updateViaCache: 'none' }).catch((error) => {
      console.warn('No se pudo registrar el service worker:', error);
      return null;
    });
  }

  function notify(item) {
    if (!item) {
      return;
    }

    const senderName = item.fromUserName || item.fromUser?.name || item.fromUser?.username || item.fromUser?.usuario || 'Un usuario';
    const isPhoto = item.type === 'chat_message' && (!item.text || item.text === '📷 Envió una foto');
    const genericContent = getGenericNotificationContent(item);
    const title = item.type === 'chat_message'
      ? (isPhoto ? `${senderName} te ha enviado una foto` : `Mensaje de ${senderName}`)
      : genericContent[0];
    const body = item.type === 'chat_message'
      ? (isPhoto ? 'Toca para abrir el chat' : buildNotificationBody(item))
      : genericContent[1];
    const nativeNotifications = getNativeNotifications();

    if (nativeNotifications) {
      Promise.resolve(ensureNativeChannel(nativeNotifications))
        .then(() => nativeNotifications.schedule({
          notifications: [{
            id: Math.abs(String(item.id).split('').reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0)),
            title,
            body,
            extra: { url: item.type === 'chat_message' ? getNotificationUrl(item) : new URL('home.html', window.location.href).toString() },
            sound: 'default',
            channelId: NATIVE_CHANNEL_ID,
            smallIcon: 'ic_stat_seeyou'
          }]
        }))
        .catch((error) => console.warn('No se pudo mostrar la notificación Android:', error));
      return;
    }

    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const avatar = item.fromUserAvatar || item.fromUser?.avatar || item.fromUser?.foto || 'logotipo.png';

    const options = {
      body,
      icon: avatar,
      tag: item.id,
      renotify: true,
      data: { url: item.type === 'chat_message' ? getNotificationUrl(item) : new URL('home.html', window.location.href).toString() }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => registration.showNotification(title, options))
        .catch(() => {
          const notification = new Notification(title, options);
          notification.onclick = () => {
            notification.close();
            openRelevantPage();
          };
        });
    } else {
      const notification = new Notification(title, options);
      notification.onclick = () => {
        notification.close();
        openRelevantPage();
      };
    }
  }

  async function poll(userId) {
    // CONFIG es un const de config.js: no cuelga de window.CONFIG, asi que esta comprobacion
    // fallaba siempre en la app nativa y las notificaciones nunca se comprobaban ahi.
    let apiBaseUrl = '';
    try { apiBaseUrl = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) || ''; } catch (e) { }
    if (!userId || !apiBaseUrl) {
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/notificaciones/${encodeURIComponent(userId)}?unread=1`);
      if (!response.ok) {
        return;
      }

      const items = await response.json();
      const incoming = Array.isArray(items) ? items.filter((item) => item && !item.read) : [];
      const MAX_AGE_MS = 6 * 60 * 60 * 1000; // lo antiguo no se vuelve a avisar (p. ej. tras reinstalar o borrar datos)
      incoming.forEach((item) => {
        if (!item || !item.id) return;
        if (state.seenIds.has(String(item.id))) return;
        state.seenIds.add(String(item.id));
        saveSeenIds();
        const ts = Date.parse(item.createdAt || item.created_at || '');
        if (Number.isFinite(ts) && Date.now() - ts > MAX_AGE_MS) return;
        notify(item);
      });
      // Ya se han mostrado: se marcan como leidas en el servidor para que no vuelvan a llegar a ningun dispositivo.
      if (incoming.length) {
        fetch(`${apiBaseUrl}/api/notificaciones/user/${encodeURIComponent(userId)}/read-all`, { method: 'PUT' }).catch(() => {});
      }
    } catch (error) {
      console.warn('Error consultando notificaciones:', error);
    }
  }

  function startPolling(userId) {
    loadSeenIds();
    state.currentUserId = userId;
    if (!userId) return;

    registerServiceWorker();
    registerNativeNotificationEvents();
    registerPushNotifications(userId);

    requestPermission().then((granted) => {
      if (granted) {
        scheduleDailyThemeNotifications();
        scheduleBrowserDailyThemeNotification();
      }
    }).catch(() => {});

    if (state.pollTimeoutId) clearTimeout(state.pollTimeoutId);
    if (state.leaseIntervalId) clearInterval(state.leaseIntervalId);
    if (state.visibilityHandler) document.removeEventListener('visibilitychange', state.visibilityHandler);

    state.visibilityHandler = () => {
      if (document.visibilityState === 'visible') schedulePoll(userId, 0);
    };
    document.addEventListener('visibilitychange', state.visibilityHandler);
    state.leaseIntervalId = setInterval(() => {
      if (claimPollingLeader(userId)) schedulePoll(userId, FOREGROUND_POLL_MS);
    }, LEADER_LEASE_MS / 2);
    schedulePoll(userId, 0);
  }

  function stopPolling() {
    if (state.pollTimeoutId) clearTimeout(state.pollTimeoutId);
    if (state.leaseIntervalId) clearInterval(state.leaseIntervalId);
    if (state.visibilityHandler) document.removeEventListener('visibilitychange', state.visibilityHandler);
    state.pollTimeoutId = null;
    state.leaseIntervalId = null;
    state.visibilityHandler = null;
    releasePollingLeader();
  }

  setTimeout(() => pushDiag('carga'), 4000);

  window.notificationsSystem = {
    startPolling,
    stopPolling,
    requestPermission,
    poll
  };
})();
