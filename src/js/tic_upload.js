/* SeeYou · Subida de Tics
 * - compressImage(file): reduce la foto (máx. 2560 px, JPEG) antes de enviarla: menos datos = subida mucho más rápida.
 * - post(url, formData, { onProgress }): envía con progreso real (XMLHttpRequest del navegador).
 *   En la APK, CapacitorHttp sustituye a fetch/XHR y no da progreso ni sube ficheros grandes con eficacia,
 *   así que se usa el XHR original del WebView (CapacitorWebXMLHttpRequest) y, si falla, se recurre a fetch.
 * - newRequestId(): identificador único por publicación. El servidor lo usa para NO duplicar un Tic
 *   si el usuario pulsa dos veces o si se reintenta un envío.
 */
(function (global) {
    'use strict';

    var MAX_SIDE = 2400;   // igual que el máximo que guarda el servidor: la foto no se redimensiona dos veces
    var JPEG_QUALITY = 0.93;
    var SKIP_BELOW_BYTES = 700 * 1024;

    function newRequestId() {
        try { if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID(); } catch (e) { }
        return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    }

    function loadBitmap(file) {
        if (global.createImageBitmap) {
            return global.createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return loadViaImg(file); });
        }
        return loadViaImg(file);
    }

    function loadViaImg(file) {
        return new Promise(function (resolve, reject) {
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
            img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
            img.src = url;
        });
    }

    function toBlob(canvas, type, quality) {
        return new Promise(function (resolve) {
            try { canvas.toBlob(function (b) { resolve(b); }, type, quality); } catch (e) { resolve(null); }
        });
    }

    // Devuelve un File más ligero, o el original si no compensa / no se puede procesar.
    function compressImage(file) {
        try {
            if (!file || !/^image\//i.test(file.type || '') || /gif|svg/i.test(file.type)) return Promise.resolve(file);
            return loadBitmap(file).then(function (bmp) {
                var w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
                if (!w || !h) return file;
                var scale = Math.min(1, MAX_SIDE / Math.max(w, h));
                if (scale === 1 && file.size < SKIP_BELOW_BYTES) { if (bmp.close) bmp.close(); return file; }
                var canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(w * scale));
                canvas.height = Math.max(1, Math.round(h * scale));
                var ctx = canvas.getContext('2d');
                ctx.fillStyle = '#fff';               // los PNG con transparencia pasan a JPEG sobre fondo blanco
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
                if (bmp.close) bmp.close();
                return toBlob(canvas, 'image/jpeg', JPEG_QUALITY).then(function (blob) {
                    canvas.width = canvas.height = 1;  // libera memoria
                    if (!blob || (scale === 1 && blob.size >= file.size)) return file;
                    var name = (file.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg';
                    try { return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified || Date.now() }); }
                    catch (e) { blob.name = name; return blob; }
                });
            }).catch(function () { return file; });
        } catch (e) {
            return Promise.resolve(file);
        }
    }

    function parseJson(text) { try { return JSON.parse(text); } catch (e) { return null; } }

    // Cabeceras de sesión para la API propia (el XHR de la subida no pasa por el envoltorio de fetch)
    function authHeaders() {
        var h = {};
        try {
            var t = global.localStorage.getItem('seeYou_auth_token');
            if (t) h['Authorization'] = 'Bearer ' + t;
            h['X-Device-Fingerprint'] = global.localStorage.getItem('seeYou_device_fingerprint') || (global.navigator.userAgent + '||' + global.navigator.platform);
        } catch (e) { }
        return h;
    }

    function xhrPost(url, formData, opts) {
        return new Promise(function (resolve, reject) {
            var XHR = global.CapacitorWebXMLHttpRequest || global.XMLHttpRequest;
            var xhr = new XHR();
            xhr.open('POST', url, true);
            var hdrs = authHeaders();
            Object.keys(hdrs).forEach(function (k) { try { xhr.setRequestHeader(k, hdrs[k]); } catch (e) { } });
            xhr.timeout = opts.timeoutMs || 180000;
            if (xhr.upload) {
                xhr.upload.onprogress = function (e) {
                    if (e && e.lengthComputable && opts.onProgress) opts.onProgress(e.loaded, e.total);
                };
                xhr.upload.onload = function () { if (opts.onUploadDone) opts.onUploadDone(); };
            }
            xhr.onload = function () { resolve({ status: xhr.status, data: parseJson(xhr.responseText) }); };
            xhr.onerror = function () { reject(new Error('network')); };
            xhr.ontimeout = function () { reject(new Error('timeout')); };
            xhr.onabort = function () { reject(new Error('abort')); };
            xhr.send(formData);
        });
    }

    function fetchPost(url, formData) {
        var ctl = global.AbortController ? new AbortController() : null;
        var timer = ctl ? setTimeout(function () { ctl.abort(); }, 240000) : null;   // sin limite, un envio colgado dejaba el boton de publicar bloqueado para siempre
        return fetch(url, { method: 'POST', body: formData, headers: authHeaders(), signal: ctl ? ctl.signal : undefined }).then(function (r) {
            if (timer) clearTimeout(timer);
            return r.text().then(function (t) { return { status: r.status, data: parseJson(t) }; });
        }, function (e) { if (timer) clearTimeout(timer); throw e; });
    }

    // Progreso real por XHR; si el envío falla por red se reintenta con fetch (el servidor evita duplicados).
    function post(url, formData, opts) {
        opts = opts || {};
        return xhrPost(url, formData, opts).catch(function (err) {
            if (err && err.message === 'abort') throw err;
            if (opts.onProgress) opts.onProgress(null, null);
            return fetchPost(url, formData);
        });
    }

    global.TicUpload = { compressImage: compressImage, post: post, newRequestId: newRequestId };
})(window);
