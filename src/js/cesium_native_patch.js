/*
 * SeeYou - parche de red de Cesium para la APK (Capacitor).
 *
 * Problema: con CapacitorHttp activado, Capacitor sustituye XMLHttpRequest. Toda peticion GET
 * con URL absoluta (https://localhost/vendor/cesium/... o los tiles de Esri) se reenvia a la
 * capa nativa de Android. Para los archivos locales de la app eso falla y Cesium lanza
 * "Request has failed" (el mapa se queda sin capas ni marcadores). Para los tiles remotos
 * funciona, pero va mas lento y se salta el service worker (cache de tiles) y la cache del WebView.
 *
 * Solucion: Cesium carga todo con el fetch ORIGINAL del WebView (window.CapacitorWebFetch),
 * asi que los archivos locales cargan directo, los tiles pasan por el service worker y por la
 * cache HTTP, y no se cruzan por el puente nativo.
 */
(function () {
    'use strict';
    var w = window;
    if (typeof Cesium === 'undefined' || !Cesium.Resource || !Cesium.Resource._Implementations) return;
    var nativeFetch = w.CapacitorWebFetch;
    if (typeof nativeFetch !== 'function') return; // web normal: no hace falta
    var impl = Cesium.Resource._Implementations;
    var original = impl.loadWithXhr;
    if (impl.__seeyouPatched) return;
    impl.__seeyouPatched = true;

    function headersToObject(h) {
        var out = {};
        try { h.forEach(function (v, k) { out[k] = v; }); } catch (e) { }
        return out;
    }

    impl.loadWithXhr = function (url, responseType, method, data, headers, deferred, overrideMimeType) {
        var verb = String(method || 'GET').toUpperCase();
        if (verb !== 'GET') {
            // Peticiones con cuerpo: mismo comportamiento que antes (URL local -> relativa para no ir al puente nativo)
            try { if (url.indexOf(location.origin) === 0) url = url.slice(location.origin.length) || '/'; } catch (e) { }
            return original.call(impl, url, responseType, method, data, headers, deferred, overrideMimeType);
        }

        var controller = (typeof AbortController === 'function') ? new AbortController() : null;
        var init = { method: 'GET', credentials: 'omit' };
        if (controller) init.signal = controller.signal;
        var hasHeaders = false, hdrs = {};
        if (headers) {
            for (var k in headers) {
                if (Object.prototype.hasOwnProperty.call(headers, k) && headers[k] !== undefined) { hdrs[k] = headers[k]; hasHeaders = true; }
            }
        }
        if (hasHeaders) init.headers = hdrs;

        nativeFetch.call(w, url, init).then(function (response) {
            var respHeaders = headersToObject(response.headers);
            if (!response.ok) {
                return response.text().catch(function () { return undefined; }).then(function (body) {
                    deferred.reject(new Cesium.RequestErrorEvent(response.status, body, respHeaders));
                });
            }
            var type = responseType || 'text';
            var reader;
            if (type === 'arraybuffer') reader = response.arrayBuffer();
            else if (type === 'blob') reader = response.blob();
            else if (type === 'json') reader = response.text().then(function (t) { return t ? JSON.parse(t) : undefined; });
            else if (type === 'document') reader = response.text().then(function (t) { return new DOMParser().parseFromString(t, overrideMimeType || 'text/html'); });
            else reader = response.text();
            return reader.then(function (value) { deferred.resolve(value); });
        }).catch(function (err) {
            if (controller && controller.signal.aborted) return; // cancelada por Cesium
            deferred.reject(new Cesium.RequestErrorEvent(0, err && err.message, {}));
        });

        return { abort: function () { if (controller) { try { controller.abort(); } catch (e) { } } } };
    };
})();
