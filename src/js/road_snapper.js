/**
 * RoadSnapper - Atrae coordenadas GPS a carreteras y espacios públicos
 * Usa OpenStreetMap para "enclavar" ubicaciones en vías públicas
 * Evita que salten entre casas privadas
 */

class RoadSnapper {
    constructor(options = {}) {
        this.cache = new Map();  // Cache de carreteras por zona
        this.maxCacheSize = 100;
        this.overpassUrl = 'https://overpass-api.de/api/interpreter';
        this.snapThreshold = 100;  // Metros máximo para buscar carretera
        this.enabled = true;
        this.debugMode = false;

        // Tipos de vías públicas permitidas
        this.allowedWayTypes = {
            // Carreteras principales
            motorway: true,
            trunk: true,
            primary: true,
            secondary: true,
            tertiary: true,
            
            // Vías locales
            residential: true,
            living_street: true,
            unclassified: true,
            service: true,
            walkway: true,
            footway: true,
            path: true,
            track: true,
            
            // Spaces públicos
            plaza: true,
            square: true,
            public_place: true,
            
            // Transporte público
            bus_stop: true,
            parking: true,
            amenity: true
        };

        // Tipos a evitar (privados)
        this.blockedTypes = {
            building: true,
            house: true,
            residential_building: true,
            private_way: true,
            private_road: true
        };
    }

    /**
     * Enclavar coordenada a carretera más cercana
     * @param {number} lat - Latitud
     * @param {number} lng - Longitud
     * @returns {Promise<{lat, lng, method, distance, confidence}>}
     */
    async snapToRoad(lat, lng) {
        if (!this.enabled) {
            return { lat, lng, method: 'original', distance: 0, confidence: 0 };
        }

        try {
            // Cargar carreteras cercanas
            const roads = await this.getNearbyRoads(lat, lng, this.snapThreshold);
            
            if (!roads || roads.length === 0) {
                // No hay carretera cercana, devolver original
                return {
                    lat, lng,
                    method: 'no_road_found',
                    distance: 0,
                    confidence: 0
                };
            }

            // Encontrar el punto de carretera más cercano
            const snappedPoint = this.findClosestPointOnRoads(lat, lng, roads);

            if (!snappedPoint) {
                return {
                    lat, lng,
                    method: 'snap_failed',
                    distance: 0,
                    confidence: 0
                };
            }

            return {
                lat: snappedPoint.lat,
                lng: snappedPoint.lng,
                method: 'snapped_to_road',
                distance: snappedPoint.distance,
                confidence: Math.max(0, 100 - (snappedPoint.distance * 2))
            };

        } catch (error) {
            console.error('Error en snapToRoad:', error);
            return {
                lat, lng,
                method: 'error',
                distance: 0,
                confidence: 0
            };
        }
    }

    /**
     * Obtener carreteras cercanas de OpenStreetMap
     * Usa Overpass API con caché local
     */
    async getNearbyRoads(lat, lng, radiusMeters) {
        const cacheKey = this.getCacheKey(lat, lng, radiusMeters);

        // Verificar caché
        if (this.cache.has(cacheKey)) {
            if (this.debugMode) console.log('📍 Usando carreteras de caché');
            return this.cache.get(cacheKey);
        }

        try {
            // Construir query Overpass (buscar formas/vías públicas)
            const radiusDegrees = radiusMeters / 111000;  // Aprox. metros a grados
            const query = `
                [bbox:${lat - radiusDegrees},${lng - radiusDegrees},${lat + radiusDegrees},${lng + radiusDegrees}];
                (
                    way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|living_street|unclassified|service|pedestrian|path|footway|cycleway|track"];
                    way["amenity"~"parking|bus_station"];
                    way["leisure"~"park"];
                    way["public_transport"];
                );
                out geom;
            `;

            if (this.debugMode) console.log('🔍 Consultando Overpass API...');

            const response = await this.queryOverpass(query);
            
            if (!response || !response.elements) {
                return [];
            }

            // Convertir formas a puntos
            const roads = this.extractRoadPoints(response.elements);

            // Guardar en caché
            this.cacheRoads(cacheKey, roads);

            if (this.debugMode) {
                console.log(`✓ Obtenidas ${roads.length} carreteras`);
            }

            return roads;

        } catch (error) {
            console.error('Error obteniendo carreteras:', error);
            return [];
        }
    }

    /**
     * Hacer query a Overpass API
     */
    async queryOverpass(query) {
        try {
            const response = await fetch(((typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) ? CONFIG.API_BASE_URL : '') + '/api/road-snapper', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query })
            });

            if (!response.ok) {
                const errorBody = await response.text().catch(() => '');
                throw new Error(`HTTP ${response.status}${errorBody ? `: ${errorBody}` : ''}`);
            }

            return await response.json();

        } catch (error) {
            console.error('Error en Overpass:', error);
            return null;
        }
    }

    /**
     * Extraer puntos de geometría de vías
     */
    extractRoadPoints(elements) {
        const points = [];

        for (const element of elements) {
            if (element.type === 'way' && element.geometry) {
                for (const coord of element.geometry) {
                    points.push({
                        lat: coord.lat,
                        lng: coord.lon,
                        wayId: element.id,
                        type: element.tags?.highway || element.tags?.amenity || 'unknown'
                    });
                }
            }
        }

        return points;
    }

    /**
     * Encontrar el punto de carretera más cercano
     * Algoritmo simple pero eficiente
     */
    findClosestPointOnRoads(lat, lng, roads) {
        if (!roads || roads.length === 0) return null;

        let closest = null;
        let minDistance = Infinity;

        for (const road of roads) {
            const distance = this.getDistance(lat, lng, road.lat, road.lng);
            
            if (distance < minDistance) {
                minDistance = distance;
                closest = {
                    lat: road.lat,
                    lng: road.lng,
                    distance: distance,
                    type: road.type
                };
            }
        }

        return minDistance <= this.snapThreshold ? closest : null;
    }

    /**
     * Calcular distancia entre dos puntos (Haversine)
     */
    getDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000; // Radio Tierra en metros
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Generar clave de caché
     */
    getCacheKey(lat, lng, radius) {
        // Redondear a 2 decimales (~1km)
        const latRounded = Math.round(lat * 100) / 100;
        const lngRounded = Math.round(lng * 100) / 100;
        return `${latRounded},${lngRounded},${radius}`;
    }

    /**
     * Guardar carreteras en caché
     */
    cacheRoads(key, roads) {
        // Limpiar caché si es muy grande
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, roads);
    }

    /**
     * Procesar un lote de ubicaciones
     */
    async snapMultiple(locations) {
        const results = [];
        
        for (const loc of locations) {
            const snapped = await this.snapToRoad(loc.lat, loc.lng);
            results.push(snapped);
        }

        return results;
    }

    /**
     * Habilitar/deshabilitar snapping
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /**
     * Cambiar radio de búsqueda
     */
    setSnapThreshold(meters) {
        this.snapThreshold = meters;
    }

    /**
     * Limpiar caché
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Obtener estadísticas
     */
    getStats() {
        return {
            cacheSize: this.cache.size,
            enabled: this.enabled,
            threshold: this.snapThreshold,
            debugMode: this.debugMode
        };
    }

    /**
     * Activar modo debug
     */
    setDebugMode(debug) {
        this.debugMode = debug;
        if (debug) {
            console.log('🔧 RoadSnapper Debug Mode ON');
            console.log('Stats:', this.getStats());
        }
    }
}

// Exportar globalmente
window.RoadSnapper = RoadSnapper;
