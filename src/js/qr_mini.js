/*
 * SeeYou - generador de codigos QR (sin dependencias, funciona sin conexion dentro de la APK).
 * Modo byte, correccion de errores M, versiones 1 a 10 (hasta 213 caracteres): de sobra para un enlace de invitacion.
 *
 *   SeeYouQR.svg('https://...', { size: 220, margin: 2, fg: '#0B1F3A', bg: '#fff' })  -> cadena SVG
 *   SeeYouQR.matrix('texto')                                                            -> array de filas de 0/1
 */
(function (root) {
    'use strict';

    // Bytes de datos totales (con correccion) y de datos por version, nivel M
    var RAW_CODEWORDS = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
    var EC_PER_BLOCK = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
    var NUM_BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
    var ALIGN = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

    // ---- aritmetica de Reed-Solomon en GF(256) ----
    var EXP = new Array(512), LOG = new Array(256);
    (function () {
        var x = 1, i;
        for (i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
        for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
    })();
    function mul(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }
    function divisor(degree) {
        var result = [], i, j, root = 1;
        for (i = 0; i < degree; i++) result.push(0);
        result[degree - 1] = 1;
        for (i = 0; i < degree; i++) {
            for (j = 0; j < degree; j++) {
                result[j] = mul(result[j], root);
                if (j + 1 < degree) result[j] ^= result[j + 1];
            }
            root = mul(root, 2);
        }
        return result;
    }
    function remainder(data, div) {
        var result = div.map(function () { return 0; });
        data.forEach(function (b) {
            var factor = b ^ result.shift();
            result.push(0);
            div.forEach(function (coef, i) { result[i] ^= mul(coef, factor); });
        });
        return result;
    }

    function utf8(text) {
        var out = [], i, c;
        var s = unescape(encodeURIComponent(String(text)));
        for (i = 0; i < s.length; i++) { c = s.charCodeAt(i); out.push(c); }
        return out;
    }
    function dataCapacityBytes(version) {
        var v = version - 1;
        return RAW_CODEWORDS[v] - EC_PER_BLOCK[v] * NUM_BLOCKS[v];
    }

    function buildCodewords(bytes, version) {
        var bits = [];
        function put(value, len) { for (var i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1); }
        put(4, 4); // modo byte
        put(bytes.length, version < 10 ? 8 : 16);
        bytes.forEach(function (b) { put(b, 8); });
        var capBits = dataCapacityBytes(version) * 8;
        put(0, Math.min(4, capBits - bits.length));
        while (bits.length % 8) bits.push(0);
        var data = [], i;
        for (i = 0; i < bits.length; i += 8) {
            var byte = 0;
            for (var j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
            data.push(byte);
        }
        for (var pad = 0xEC; data.length < dataCapacityBytes(version); pad ^= 0xEC ^ 0x11) data.push(pad);
        return data;
    }

    function addEcAndInterleave(data, version) {
        var v = version - 1;
        var numBlocks = NUM_BLOCKS[v], ecLen = EC_PER_BLOCK[v], raw = RAW_CODEWORDS[v];
        var numShort = numBlocks - (raw % numBlocks);
        var shortLen = Math.floor(raw / numBlocks);
        var div = divisor(ecLen), blocks = [], k = 0, i;
        for (i = 0; i < numBlocks; i++) {
            var dat = data.slice(k, k + shortLen - ecLen + (i < numShort ? 0 : 1));
            k += dat.length;
            var ecc = remainder(dat, div);
            if (i < numShort) dat.push(0);
            blocks.push(dat.concat(ecc));
        }
        var result = [], j;
        for (i = 0; i < blocks[0].length; i++) {
            for (j = 0; j < blocks.length; j++) {
                if (i !== shortLen - ecLen || j >= numShort) result.push(blocks[j][i]);
            }
        }
        return result;
    }

    function bit(x, i) { return ((x >>> i) & 1) !== 0; }

    function makeMatrix(version, codewords, forcedMask) {
        var size = version * 4 + 17, x, y, i, j;
        var modules = [], isFn = [];
        for (y = 0; y < size; y++) { modules.push(new Array(size).fill(false)); isFn.push(new Array(size).fill(false)); }
        function setFn(cx, cy, dark) { modules[cy][cx] = dark; isFn[cy][cx] = true; }

        for (i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
        function finder(cx, cy) {
            for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
                var dist = Math.max(Math.abs(dx), Math.abs(dy)), xx = cx + dx, yy = cy + dy;
                if (xx >= 0 && xx < size && yy >= 0 && yy < size) setFn(xx, yy, dist !== 2 && dist !== 4);
            }
        }
        finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
        var pos = ALIGN[version - 1], n = pos.length;
        for (i = 0; i < n; i++) for (j = 0; j < n; j++) {
            if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
            for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) setFn(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }

        function drawFormat(mask) {
            var data = (0 << 3) | mask; // nivel M = 00
            var rem = data;
            for (var r = 0; r < 10; r++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
            var bits = ((data << 10) | rem) ^ 0x5412;
            for (var b = 0; b <= 5; b++) setFn(8, b, bit(bits, b));
            setFn(8, 7, bit(bits, 6)); setFn(8, 8, bit(bits, 7)); setFn(7, 8, bit(bits, 8));
            for (b = 9; b < 15; b++) setFn(14 - b, 8, bit(bits, b));
            for (b = 0; b < 8; b++) setFn(size - 1 - b, 8, bit(bits, b));
            for (b = 8; b < 15; b++) setFn(8, size - 15 + b, bit(bits, b));
            setFn(8, size - 8, true);
        }
        drawFormat(0);
        if (version >= 7) {
            var rem = version;
            for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
            var vbits = (version << 12) | rem;
            for (i = 0; i < 18; i++) {
                var color = bit(vbits, i), a = size - 11 + (i % 3), b2 = Math.floor(i / 3);
                setFn(a, b2, color); setFn(b2, a, color);
            }
        }

        // datos en zigzag
        var idx = 0;
        for (var right = size - 1; right >= 1; right -= 2) {
            if (right === 6) right = 5;
            for (var vert = 0; vert < size; vert++) {
                for (j = 0; j < 2; j++) {
                    x = right - j;
                    var upward = ((right + 1) & 2) === 0;
                    y = upward ? size - 1 - vert : vert;
                    if (!isFn[y][x] && idx < codewords.length * 8) {
                        modules[y][x] = bit(codewords[idx >>> 3], 7 - (idx & 7));
                        idx++;
                    }
                }
            }
        }

        function applyMask(mask) {
            for (y = 0; y < size; y++) for (x = 0; x < size; x++) {
                var inv;
                switch (mask) {
                    case 0: inv = (x + y) % 2 === 0; break;
                    case 1: inv = y % 2 === 0; break;
                    case 2: inv = x % 3 === 0; break;
                    case 3: inv = (x + y) % 3 === 0; break;
                    case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
                    case 5: inv = (x * y) % 2 + (x * y) % 3 === 0; break;
                    case 6: inv = ((x * y) % 2 + (x * y) % 3) % 2 === 0; break;
                    default: inv = ((x + y) % 2 + (x * y) % 3) % 2 === 0;
                }
                if (!isFn[y][x] && inv) modules[y][x] = !modules[y][x];
            }
        }

        function penalty() {
            var total = 0, run, prev, c, r;
            for (r = 0; r < size; r++) {
                for (var pass = 0; pass < 2; pass++) {
                    run = 0; prev = null;
                    for (c = 0; c < size; c++) {
                        var cur = pass ? modules[c][r] : modules[r][c];
                        if (cur === prev) { run++; if (run === 5) total += 3; else if (run > 5) total++; } else { prev = cur; run = 1; }
                    }
                }
            }
            for (r = 0; r < size - 1; r++) for (c = 0; c < size - 1; c++) {
                var v0 = modules[r][c];
                if (v0 === modules[r][c + 1] && v0 === modules[r + 1][c] && v0 === modules[r + 1][c + 1]) total += 3;
            }
            var pat = [true, false, true, true, true, false, true, false, false, false, false];
            var pat2 = pat.slice().reverse();
            function matches(get, start, p) { for (var k = 0; k < 11; k++) if (get(start + k) !== p[k]) return false; return true; }
            for (r = 0; r < size; r++) for (c = 0; c <= size - 11; c++) {
                if (matches(function (k) { return modules[r][k]; }, c, pat) || matches(function (k) { return modules[r][k]; }, c, pat2)) total += 40;
                if (matches(function (k) { return modules[k][r]; }, c, pat) || matches(function (k) { return modules[k][r]; }, c, pat2)) total += 40;
            }
            var dark = 0;
            for (r = 0; r < size; r++) for (c = 0; c < size; c++) if (modules[r][c]) dark++;
            total += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
            return total;
        }

        var best = typeof forcedMask === 'number' ? forcedMask : 0, bestScore = Infinity;
        if (typeof forcedMask !== 'number') {
            for (var m = 0; m < 8; m++) {
                applyMask(m); drawFormat(m);
                var score = penalty();
                if (score < bestScore) { bestScore = score; best = m; }
                applyMask(m); // deshacer
            }
        }
        applyMask(best); drawFormat(best);
        return modules.map(function (row) { return row.map(function (v) { return v ? 1 : 0; }); });
    }

    function matrix(text, opts) {
        var bytes = utf8(text), version = 0, v;
        for (v = 1; v <= 10; v++) {
            var need = 4 + (v < 10 ? 8 : 16) + bytes.length * 8;
            if (need <= dataCapacityBytes(v) * 8) { version = v; break; }
        }
        if (!version) throw new Error('Texto demasiado largo para el QR');
        var data = buildCodewords(bytes, version);
        return makeMatrix(version, addEcAndInterleave(data, version), opts && opts.mask);
    }

    function svg(text, opts) {
        opts = opts || {};
        var m = matrix(text, opts), n = m.length, margin = opts.margin == null ? 2 : opts.margin;
        var size = opts.size || 220, fg = opts.fg || '#0B1F3A', bg = opts.bg || '#ffffff';
        var d = '', y, x, start;
        for (y = 0; y < n; y++) {
            x = 0;
            while (x < n) {
                if (m[y][x]) { start = x; while (x < n && m[y][x]) x++; d += 'M' + (start + margin) + ' ' + (y + margin) + 'h' + (x - start) + 'v1h-' + (x - start) + 'z'; } else x++;
            }
        }
        var total = n + margin * 2;
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '" width="' + size + '" height="' + size + '" shape-rendering="crispEdges" role="img" aria-label="Codigo QR">' +
            '<rect width="' + total + '" height="' + total + '" fill="' + bg + '"/><path d="' + d + '" fill="' + fg + '"/></svg>';
    }

    root.SeeYouQR = { matrix: matrix, svg: svg };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.SeeYouQR;
})(typeof window !== 'undefined' ? window : globalThis);
