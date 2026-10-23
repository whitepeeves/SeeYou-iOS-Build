/**
 * GPS Configuration & Calibration
 * Permite ajustar la precisión del GPS según el dispositivo y ubicación
 */

class GPSCalibrator {
    constructor() {
        this.knownLocations = this.loadKnownLocations();
        this.calibrationData = this.loadCalibrationData();
    }

    /**
     * Guardar ubicación conocida (casa, trabajo, etc.)
     * Se usa para auto-calibración
     */
    saveKnownLocation(name, lat, lng, accuracy = null) {
        const location = {
            name,
            lat,
            lng,
            accuracy,
            timestamp: Date.now(),
            deviceModel: this.getDeviceInfo()
        };

        this.knownLocations.push(location);
        localStorage.setItem('gps_known_locations', JSON.stringify(this.knownLocations));
        return location;
    }

    /**
     * Cargar ubicaciones conocidas
     */
    loadKnownLocations() {
        try {
            const data = localStorage.getItem('gps_known_locations');
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    /**
     * Cargar datos de calibración
     */
    loadCalibrationData() {
        try {
            const data = localStorage.getItem('gps_calibration_data');
            return data ? JSON.parse(data) : {};
        } catch (e) {
            return {};
        }
    }

    /**
     * Obtener información del dispositivo
     */
    getDeviceInfo() {
        return {
            userAgent: navigator.userAgent,
            language: navigator.language,
            onLine: navigator.onLine,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
    }

    /**
     * Calcular offset promedio entre GPS y ubicación real
     * Se usa para corregir futuras lecturas
     */
    calibrateFromKnownLocation(lat, lng) {
        if (this.knownLocations.length === 0) {
            console.warn("No hay ubicaciones conocidas para calibración");
            return null;
        }

        // Buscar la ubicación conocida más cercana
        let nearestLocation = null;
        let minDistance = Infinity;

        for (const known of this.knownLocations) {
            const distance = this.getDistance(lat, lng, known.lat, known.lng);
            if (distance < minDistance) {
                minDistance = distance;
                nearestLocation = known;
            }
        }

        if (!nearestLocation || minDistance > 500) {
            console.warn("No hay ubicación conocida cercana");
            return null;
        }

        // Calcular el offset
        const offset = {
            latOffset: nearestLocation.lat - lat,
            lngOffset: nearestLocation.lng - lng,
            distance: minDistance,
            knownLocation: nearestLocation.name,
            timestamp: Date.now()
        };

        // Guardar para análisis
        this.calibrationData.lastOffset = offset;
        localStorage.setItem('gps_calibration_data', JSON.stringify(this.calibrationData));

        return offset;
    }

    /**
     * Aplicar calibración a una lectura de GPS
     */
    applyCorrectionOffset(lat, lng) {
        if (!this.calibrationData.lastOffset) return { lat, lng };

        const offset = this.calibrationData.lastOffset;
        const timeSinceCalibration = Date.now() - offset.timestamp;

        // Si la calibración tiene más de 1 hora, usar solo 50% de corrección
        const correctionFactor = timeSinceCalibration > 3600000 ? 0.5 : 1.0;

        return {
            lat: lat + (offset.latOffset * correctionFactor),
            lng: lng + (offset.lngOffset * correctionFactor)
        };
    }

    /**
     * Calcular distancia entre dos puntos
     */
    getDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000;
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
     * Obtener sugerencia de calibración
     */
    getSuggestion() {
        if (this.knownLocations.length === 0) {
            return "Guarda tu casa o trabajo para auto-calibración de GPS";
        }

        const lastCalibration = this.calibrationData.lastOffset?.timestamp || 0;
        const timeSinceCalibration = Date.now() - lastCalibration;

        if (timeSinceCalibration > 86400000) {
            return "Calibración vieja - guarda tu ubicación actual para mejorar precisión";
        }

        return null;
    }

    /**
     * Estadísticas de precisión
     */
    getAccuracyStats() {
        if (this.knownLocations.length === 0) {
            return { count: 0, avgAccuracy: null, minAccuracy: null, maxAccuracy: null };
        }

        const accuracies = this.knownLocations
            .filter(loc => loc.accuracy !== null)
            .map(loc => loc.accuracy);

        if (accuracies.length === 0) {
            return { count: this.knownLocations.length, avgAccuracy: null };
        }

        return {
            count: this.knownLocations.length,
            avgAccuracy: accuracies.reduce((a, b) => a + b, 0) / accuracies.length,
            minAccuracy: Math.min(...accuracies),
            maxAccuracy: Math.max(...accuracies)
        };
    }

    /**
     * Limpiar datos de calibración
     */
    clearCalibrationData() {
        this.calibrationData = {};
        this.knownLocations = [];
        localStorage.removeItem('gps_known_locations');
        localStorage.removeItem('gps_calibration_data');
    }
}

// Exportar globalmente
window.GPSCalibrator = GPSCalibrator;
