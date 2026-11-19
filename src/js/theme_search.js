/* Buscador de temas anteriores que perdona las faltas de ortografia ("nabidad" encuentra "Navidad").
 *
 * No es un modelo de IA: cada texto y cada busqueda se convierten en vectores de letras sueltas y trios de letras
 * (n-gramas) sobre una version "fonetica" del español (b/v, h muda, ll/y, c/z/s, qu/k, g/j...), y se ordenan por
 * parecido (coseno). Ademas se tolera 1-2 letras de diferencia por palabra, se entiende el principio de una palabra
 * ("navi") y se conocen familias de palabras ("regalos" y "arbol" llevan a Navidad).
 *
 *   SeeYouThemeSearch.rank(query, items, getText) -> items ordenados por parecido (sin los que no tienen que ver)
 */
(function (root) {
    'use strict';

    function stripAccents(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

    function norm(s) { return stripAccents(s).replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim(); }

    // Version fonetica: lo que suena igual se escribe igual.
    function phon(word) {
        var w = stripAccents(word).replace(/ñ/g, 'n').replace(/[^a-z0-9]/g, '');
        w = w.replace(/h/g, '')
            .replace(/ll/g, 'y')
            .replace(/qu([ei])/g, 'k$1').replace(/q/g, 'k')
            .replace(/gu([ei])/g, 'g$1').replace(/g([ei])/g, 'j$1')
            .replace(/c([ei])/g, 's$1').replace(/c/g, 'k')
            .replace(/z/g, 's').replace(/x/g, 'ks')
            .replace(/v/g, 'b').replace(/w/g, 'u')
            .replace(/y$/, 'i')
            .replace(/(.)\1+/g, '$1');
        return w;
    }

    function tokens(s) { return norm(s).split(' ').filter(Boolean); }

    // Familias de palabras: si buscas una, se entienden las demas.
    var FAMILIES = [
        ['navidad', 'navidades', 'navideno', 'navidena', 'nochebuena', 'nochevieja', 'reyes', 'regalo', 'regalos', 'arbol', 'belen', 'turron', 'villancico', 'noel'],
        ['verano', 'playa', 'mar', 'piscina', 'sol', 'vacaciones', 'calor', 'helado', 'arena'],
        ['invierno', 'frio', 'nieve', 'abrigo', 'bufanda'],
        ['comida', 'cena', 'desayuno', 'almuerzo', 'plato', 'restaurante', 'receta', 'cocina', 'postre', 'cafe', 'comer'],
        ['mascota', 'perro', 'gato', 'animal', 'animales'],
        ['amigos', 'amigo', 'amistad', 'colega', 'colegas', 'grupo'],
        ['familia', 'padres', 'madre', 'padre', 'hermano', 'hermana', 'abuelo', 'abuela', 'abuelos'],
        ['pareja', 'novio', 'novia', 'amor', 'cita'],
        ['viaje', 'viajes', 'vacaciones', 'aventura', 'turismo', 'excursion'],
        ['musica', 'cancion', 'canciones', 'concierto', 'playlist', 'cantar'],
        ['naturaleza', 'monte', 'montana', 'bosque', 'rio', 'paisaje', 'campo', 'atardecer', 'puesta de sol'],
        ['deporte', 'gimnasio', 'correr', 'futbol', 'entrenar', 'entrenamiento'],
        ['casa', 'hogar', 'habitacion', 'salon', 'rincon', 'ventana'],
        ['recuerdo', 'recuerdos', 'nostalgia', 'infancia', 'antigua', 'antiguo', 'pasado'],
        ['ciudad', 'calle', 'barrio', 'plaza', 'urbano'],
        ['fiesta', 'cumpleanos', 'celebracion', 'celebrar', 'baile'],
        ['trabajo', 'oficina', 'estudio', 'estudiar', 'clase', 'colegio']
    ].map(function (g) { return g.map(function (w) { return tokens(w).map(phon).join(' '); }); });

    function grams(s) {
        var t = ' ' + s.replace(/\s+/g, ' ') + ' ';
        var m = {};
        for (var n = 2; n <= 3; n++) for (var i = 0; i + n <= t.length; i++) { var g = t.slice(i, i + n); m[g] = (m[g] || 0) + 1; }
        return m;
    }

    function cosine(a, b) {
        var dot = 0, na = 0, nb = 0, k;
        for (k in a) { na += a[k] * a[k]; if (b[k]) dot += a[k] * b[k]; }
        for (k in b) nb += b[k] * b[k];
        return na && nb ? dot / Math.sqrt(na * nb) : 0;
    }

    function lev(a, b, max) {
        if (Math.abs(a.length - b.length) > max) return max + 1;
        var prev = [], cur = [], i, j;
        for (j = 0; j <= b.length; j++) prev[j] = j;
        for (i = 1; i <= a.length; i++) {
            cur[0] = i;
            var best = cur[0];
            for (j = 1; j <= b.length; j++) {
                cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
                if (cur[j] < best) best = cur[j];
            }
            if (best > max) return max + 1;
            var t = prev; prev = cur; cur = t;
        }
        return prev[b.length];
    }

    // Cuanto se parece una palabra buscada a una palabra del texto (0..1), ya en version fonetica.
    function wordScore(q, w) {
        if (q === w) return 1;
        if (q.length >= 3 && w.indexOf(q) === 0) return 0.92;          // "navi" -> "navidad"
        if (w.length >= 4 && q.indexOf(w) === 0 && q.length - w.length <= 2) return 0.85;
        var max = q.length <= 3 ? 0 : q.length <= 5 ? 1 : 2;
        if (max) {
            var d = lev(q, w, max);
            if (d <= max) return 0.9 - 0.12 * d;
        }
        if (q.length >= 4 && w.length >= 4) {
            var c = cosine(grams(q), grams(w));
            if (c >= 0.62) return 0.55 + (c - 0.62) * 0.5;
        }
        return 0;
    }

    function familiesOf(qWord) {
        var out = [];
        FAMILIES.forEach(function (g) {
            for (var i = 0; i < g.length; i++) {
                if (g[i].indexOf(' ') < 0 && wordScore(qWord, g[i]) >= 0.85) { out.push(g); return; }
            }
        });
        return out;
    }

    function prepare(text) {
        var words = tokens(text).map(phon).filter(Boolean);
        return { words: words, joined: words.join(' '), vec: grams(words.join(' ')) };
    }

    function score(qInfo, doc) {
        if (!qInfo.words.length) return 0;
        var total = 0, bestOne = 0;
        for (var i = 0; i < qInfo.words.length; i++) {
            var q = qInfo.words[i], best = 0, j;
            for (j = 0; j < doc.words.length && best < 1; j++) {
                var s = wordScore(q, doc.words[j]);
                if (s > best) best = s;
            }
            if (best < 0.8 && qInfo.fam[i].length) {
                // La palabra buscada pertenece a una familia: vale cualquier palabra de esa familia que aparezca en el texto.
                outer:
                for (var f = 0; f < qInfo.fam[i].length; f++) {
                    var fam = qInfo.fam[i][f];
                    for (var k = 0; k < fam.length; k++) {
                        var fw = fam[k].split(' ')[0];
                        for (j = 0; j < doc.words.length; j++) {
                            if (wordScore(fw, doc.words[j]) >= 0.9) { if (0.72 > best) best = 0.72; break outer; }
                        }
                    }
                }
            }
            total += best;
            if (best > bestOne) bestOne = best;
        }
        // Varias palabras: cuenta la media, pero una sola palabra muy buena ya basta para sugerir el tema ("papa noel" -> Navidad).
        var wordPart = 0.6 * (total / qInfo.words.length) + 0.4 * bestOne;
        var whole = cosine(qInfo.vec, doc.vec);
        return Math.max(wordPart * 0.85 + whole * 0.15, wordPart > 0 ? 0 : whole * 0.6);
    }

    function rank(query, items, getText) {
        var get = getText || function (x) { return String(x); };
        var q = prepare(query);
        if (!q.words.length) return items.slice();
        q.fam = q.words.map(familiesOf);
        var out = [];
        for (var i = 0; i < items.length; i++) {
            var sc = score(q, prepare(get(items[i])));
            if (sc >= 0.42) out.push({ item: items[i], score: sc, order: i });
        }
        out.sort(function (a, b) { return b.score - a.score || a.order - b.order; });
        return out.map(function (r) { return r.item; });
    }

    var api = { rank: rank, phon: phon, norm: norm };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.SeeYouThemeSearch = api;
})(typeof window !== 'undefined' ? window : globalThis);
