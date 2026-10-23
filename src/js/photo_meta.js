/* SeeYou · Metadatos de las fotos (fecha en que se hizo y lugar)
 *
 * Lee los datos EXIF de la foto elegida para proponer automaticamente la fecha real
 * y el lugar donde se hizo (util con fotos antiguas). Usa la libreria exifr si esta
 * disponible (tambien lee HEIC) y, si no, un lector propio de JPEG que funciona sin conexion.
 */
(function (global) {
    'use strict';

    var DAY_MS = 24 * 3600 * 1000;
    var MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    var fileCache = typeof WeakMap === 'function' ? new WeakMap() : null;
    var placeCache = {};

    // ---------------------------------------------------------------- lector JPEG propio

    function parseExifDate(str) {
        var m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(str || '').trim());
        if (!m) return null;
        var y = Number(m[1]);
        if (!y || Number(m[2]) < 1 || Number(m[3]) < 1) return null; // "0000:00:00 00:00:00"
        var d = new Date(y, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
        return isFinite(d.getTime()) ? d : null;
    }

    function readJpegExif(buffer) {
        var view = new DataView(buffer);
        var len = view.byteLength;
        if (len < 4 || view.getUint16(0) !== 0xFFD8) return null;
        var pos = 2;
        var tiff = -1;
        while (pos + 4 <= len) {
            if (view.getUint8(pos) !== 0xFF) break;
            var marker = view.getUint8(pos + 1);
            if (marker === 0xDA || marker === 0xD9) break; // datos de imagen: ya no hay mas cabeceras
            var size = view.getUint16(pos + 2);
            if (marker === 0xE1 && pos + 10 <= len &&
                view.getUint32(pos + 4) === 0x45786966 && view.getUint16(pos + 8) === 0) { // "Exif\0\0"
                tiff = pos + 10;
                break;
            }
            pos += 2 + size;
        }
        if (tiff < 0 || tiff + 8 > len) return null;
        var little = view.getUint16(tiff) === 0x4949;
        if (!little && view.getUint16(tiff) !== 0x4D4D) return null;

        function u16(o) { return view.getUint16(o, little); }
        function u32(o) { return view.getUint32(o, little); }
        function readIfd(rel) {
            var out = {};
            var o = tiff + rel;
            if (o + 2 > len) return out;
            var n = u16(o);
            for (var i = 0; i < n; i++) {
                var e = o + 2 + i * 12;
                if (e + 12 > len) break;
                out[u16(e)] = { type: u16(e + 2), count: u32(e + 4), at: e + 8 };
            }
            return out;
        }
        function dataOffset(entry, unit) {
            return entry.count * unit <= 4 ? entry.at : tiff + u32(entry.at);
        }
        function ascii(entry) {
            if (!entry || entry.type !== 2) return '';
            var o = dataOffset(entry, 1);
            var s = '';
            for (var i = 0; i < entry.count && o + i < len; i++) {
                var c = view.getUint8(o + i);
                if (c === 0) break;
                s += String.fromCharCode(c);
            }
            return s;
        }
        function rationals(entry, n) {
            if (!entry || entry.type !== 5 || entry.count < n) return null;
            var o = dataOffset(entry, 8);
            var out = [];
            for (var i = 0; i < n; i++) {
                if (o + i * 8 + 8 > len) return null;
                var den = u32(o + i * 8 + 4);
                out.push(den ? u32(o + i * 8) / den : 0);
            }
            return out;
        }
        function coordinate(refEntry, valEntry) {
            var v = rationals(valEntry, 3);
            if (!v) return null;
            var deg = v[0] + v[1] / 60 + v[2] / 3600;
            var ref = ascii(refEntry).charAt(0).toUpperCase();
            return (ref === 'S' || ref === 'W') ? -deg : deg;
        }

        var ifd0 = readIfd(u32(tiff + 4));
        var result = { date: null, lat: null, lng: null, camera: null };
        var exifIfd = ifd0[0x8769] ? readIfd(u32(ifd0[0x8769].at)) : {};
        result.date = parseExifDate(ascii(exifIfd[0x9003])) || parseExifDate(ascii(exifIfd[0x9004]));
        var make = ascii(ifd0[0x010F]).trim();
        var model = ascii(ifd0[0x0110]).trim();
        result.camera = model || make || null;
        if (ifd0[0x8825]) {
            var gps = readIfd(u32(ifd0[0x8825].at));
            var lat = coordinate(gps[1], gps[2]);
            var lng = coordinate(gps[3], gps[4]);
            if (lat != null && lng != null && isFinite(lat) && isFinite(lng) && !(lat === 0 && lng === 0) &&
                Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
                result.lat = lat;
                result.lng = lng;
            }
        }
        return result;
    }

    // ---------------------------------------------------------------- lectura

    function toBuffer(blob) {
        if (blob.arrayBuffer) return blob.arrayBuffer();
        return new Promise(function (resolve, reject) {
            var r = new FileReader();
            r.onload = function () { resolve(r.result); };
            r.onerror = reject;
            r.readAsArrayBuffer(blob);
        });
    }

    function readWithExifr(file) {
        if (!global.exifr || typeof global.exifr.parse !== 'function') return Promise.resolve(null);
        return global.exifr.parse(file, { gps: true, exif: true, tiff: true, xmp: false, icc: false, iptc: false, jfif: false })
            .then(function (m) {
                if (!m) return null;
                var date = m.DateTimeOriginal || m.CreateDate || null;
                if (date && !(date instanceof Date)) date = new Date(date);
                if (date && !isFinite(date.getTime())) date = null;
                return {
                    date: date,
                    lat: Number.isFinite(m.latitude) ? m.latitude : null,
                    lng: Number.isFinite(m.longitude) ? m.longitude : null,
                    camera: m.Model || m.Make || null
                };
            }).catch(function () { return null; });
    }

    function readOwn(file) {
        return toBuffer(file.slice(0, 512 * 1024)).then(readJpegExif).catch(function () { return null; });
    }

    // Devuelve { date: Date|null, lat, lng, camera }. Nunca rechaza la promesa.
    function read(file) {
        if (!file || typeof file.slice !== 'function') return Promise.resolve({ date: null, lat: null, lng: null, camera: null });
        if (fileCache && fileCache.has(file)) return fileCache.get(file);
        var job = readWithExifr(file).then(function (a) {
            if (a && (a.date || a.lat != null)) return a;
            return readOwn(file).then(function (b) { return b || a; });
        }).then(function (r) {
            return r || { date: null, lat: null, lng: null, camera: null };
        }).catch(function () { return { date: null, lat: null, lng: null, camera: null }; });
        if (fileCache) fileCache.set(file, job);
        return job;
    }

    // Solo se propone la fecha si la foto es de otro dia (una foto de hoy ya cuenta como hoy).
    function isBackdated(date) {
        return !!date && isFinite(date.getTime()) && date.getTime() < Date.now() - DAY_MS && date.getTime() <= Date.now();
    }

    // ---------------------------------------------------------------- lugar

    function cityFromAddress(a) {
        a = a || {};
        return a.city || a.town || a.village || a.municipality || a.hamlet || a.suburb || a.county || '';
    }

    // Nombre del lugar (Nominatim / OpenStreetMap). Devuelve { name, city } o null si no hay conexion.
    function place(lat, lng) {
        var key = lat.toFixed(4) + ',' + lng.toFixed(4);
        if (placeCache[key]) return placeCache[key];
        var controller = typeof AbortController === 'function' ? new AbortController() : null;
        var timer = setTimeout(function () { if (controller) controller.abort(); }, 5000);
        var job = fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&zoom=16&addressdetails=1',
            controller ? { signal: controller.signal } : undefined)
            .then(function (r) { return r.json(); })
            .then(function (d) {
                clearTimeout(timer);
                if (!d || !d.display_name) return null;
                return { name: String(d.display_name).slice(0, 200), city: String(cityFromAddress(d.address)).slice(0, 80) };
            }).catch(function () {
                clearTimeout(timer);
                delete placeCache[key];
                return null;
            });
        placeCache[key] = job;
        return job;
    }

    // Todo junto para publicar: { customDate: ISO|'' , location: {lat,lng,name,city}|null }
    function readForPublish(file) {
        return read(file).then(function (m) {
            var out = { customDate: '', location: null };
            if (isBackdated(m.date)) out.customDate = m.date.toISOString();
            if (m.lat == null || m.lng == null) return out;
            var loc = { lat: m.lat, lng: m.lng, name: 'Ubicación de la foto' };
            return place(m.lat, m.lng).then(function (p) {
                if (p) { loc.name = p.name; if (p.city) loc.city = p.city; }
                out.location = loc;
                return out;
            });
        });
    }

    function shortDate(d) {
        return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getFullYear();
    }

    // Texto breve para avisar al usuario de lo que se ha detectado.
    function describe(file) {
        return read(file).then(function (m) {
            var parts = [];
            if (isBackdated(m.date)) parts.push('Fecha de la foto: ' + shortDate(m.date));
            if (m.lat != null && m.lng != null) {
                return place(m.lat, m.lng).then(function (p) {
                    parts.push('Lugar: ' + (p ? (p.city || p.name.split(',')[0]) : 'ubicación GPS de la foto'));
                    return parts.join(' · ');
                });
            }
            return parts.join(' · ');
        });
    }

    global.PhotoMeta = {
        read: read,
        place: place,
        isBackdated: isBackdated,
        readForPublish: readForPublish,
        describe: describe,
        _readJpegExif: readJpegExif
    };
})(window);
