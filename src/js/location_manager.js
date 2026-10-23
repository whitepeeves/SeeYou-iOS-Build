/**
 * LocationManager - Gestión mejorada de ubicación y precisión GPS
 * Proporciona: suavizado de GPS, múltiples intentos, mejor precisión
 */

class LocationManager {
    constructor() {
        this.lastGPSReading = null;
        this.gpsReadings = [];
        this.maxReadings = 7;
        this.watchId = null;
        this.accuracy = null;
        
        // Kalman filter state
        this.kalmanState = {
            lat: null,
            lng: null,
            latError: 1000,    // Error inicial grande
            lngError: 1000,
            q: 0.0001,         // Ruido del proceso
            r: 25              // Ruido de medición (m²)
        };
    }

    /**
     * Obtiene ubicación actual con mejoras AGRESIVAS de precisión
     * @param {Object} options - { enableHighAccuracy, timeout, maximumAge, attempts }
     * @returns {Promise<{lat, lng, accuracy}>}
     */
    getCurrentLocationImproved(options = {}) {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerryIEMobile|Opera Mini/i.test(navigator.userAgent);
        const config = {
            enableHighAccuracy: true,
            timeout: isMobile ? 5000 : 5000,
            maximumAge: isMobile ? 15000 : 5000,
            attempts: isMobile ? 3 : 3,
            smoothing: true,
            kalman: true,
            ...options
        };

        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation no soportado"));
                return;
            }

            let successCount = 0;
            const readings = [];

            const attempt = () => {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const reading = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                            accuracy: position.coords.accuracy,
                            altitude: position.coords.altitude,
                            timestamp: Date.now()
                        };

                        // Validar que la lectura sea sensata
                        if (this.isValidReading(reading)) {
                            readings.push(reading);
                            successCount++;
                        }

                        if (successCount >= config.attempts) {
                            // Procesamiento avanzado de lecturas
                            let result;
                            
                            if (config.kalman && readings.length > 1) {
                                result = this.applyKalmanFilter(readings);
                            } else if (config.smoothing && readings.length > 1) {
                                result = this.weightedAverage(readings);
                            } else {
                                const best = readings.reduce((a, b) => 
                                    a.accuracy < b.accuracy ? a : b
                                );
                                result = {
                                    lat: best.lat,
                                    lng: best.lng,
                                    accuracy: best.accuracy
                                };
                            }
                            
                            resolve(result);
                        } else if (successCount < config.attempts) {
                            setTimeout(attempt, 250);
                        }
                    },
                    (error) => {
                        console.warn("GPS error attempt:", error.code, error.message);
                        if (successCount < config.attempts) {
                            // Reintentar después de error con backoff exponencial
                            const backoff = Math.min(500 * Math.pow(1.5, successCount), 2000);
                            setTimeout(attempt, backoff);
                        } else if (readings.length > 0) {
                            // Usar mejor lectura disponible aunque haya errores
                            const best = readings.reduce((a, b) => 
                                a.accuracy < b.accuracy ? a : b
                            );
                            console.log("Using best available reading after errors");
                            resolve({
                                lat: best.lat,
                                lng: best.lng,
                                accuracy: best.accuracy
                            });
                        } else {
                            reject(new Error(`GPS falló después de ${config.attempts} intentos: ${error.message}`));
                        }
                    },
                    {
                        enableHighAccuracy: config.enableHighAccuracy,
                        timeout: config.timeout,
                        maximumAge: config.maximumAge,
                        maxRetries: 3
                    }
                );
            };

            attempt();
        });
    }

    /**
     * Aplica Kalman filter (filtro óptimo para GPS)
     * Reduce ruido significativamente
     */
    applyKalmanFilter(readings) {
        if (!readings.length) return null;

        let state = { ...this.kalmanState };

        for (const reading of readings) {
            // Actualización de predicción (tiempo)
            state.latError += state.q;
            state.lngError += state.q;

            // Actualización de medición (observación)
            const latGain = state.latError / (state.latError + state.r);
            const lngGain = state.lngError / (state.lngError + state.r);

            if (state.lat === null) {
                state.lat = reading.lat;
                state.lng = reading.lng;
            } else {
                state.lat += latGain * (reading.lat - state.lat);
                state.lng += lngGain * (reading.lng - state.lng);
            }

            state.latError = (1 - latGain) * state.latError;
            state.lngError = (1 - lngGain) * state.lngError;
        }

        this.kalmanState = state;

        return {
            lat: state.lat,
            lng: state.lng,
            accuracy: Math.sqrt(state.latError + state.lngError) / 2
        };
    }

    /**
     * Promedia ponderado - da más peso a lecturas precisas
     */
    weightedAverage(readings) {
        if (!readings.length) return null;

        // Encontrar la precisión mínima
        const minAccuracy = Math.min(...readings.map(r => r.accuracy));
        
        // Calcular pesos (inversamente proporcionales a accuracy)
        const weights = readings.map(r => {
            const weight = minAccuracy / r.accuracy;
            return weight;
        });
        
        const totalWeight = weights.reduce((a, b) => a + b, 0);

        let lat = 0, lng = 0;
        for (let i = 0; i < readings.length; i++) {
            lat += readings[i].lat * (weights[i] / totalWeight);
            lng += readings[i].lng * (weights[i] / totalWeight);
        }

        // Accuracy es el promedio ponderado (optimista pero realista)
        let accuracy = 0;
        for (let i = 0; i < readings.length; i++) {
            accuracy += readings[i].accuracy * (weights[i] / totalWeight);
        }

        return { lat, lng, accuracy: Math.max(accuracy, 5) };
    }

    /**
     * Promedia múltiples lecturas de GPS (versión simple)
     */
    averageReadings(readings) {
        if (!readings.length) return null;

        const sum = readings.reduce((acc, reading) => {
            acc.lat += reading.lat;
            acc.lng += reading.lng;
            acc.accuracy += reading.accuracy;
            acc.count = readings.length;
            return acc;
        }, { lat: 0, lng: 0, accuracy: 0, count: 0 });

        return {
            lat: sum.lat / sum.count,
            lng: sum.lng / sum.count,
            accuracy: sum.accuracy / sum.count
        };
    }

    /**
     * Monitorea ubicación en tiempo real con suavizado
     */
    watchLocationSmoothed(callback, options = {}) {
        const config = {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
            smoothingFactor: 0.7,  // Filtro Kalman simplificado
            ...options
        };

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                const newReading = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: Date.now()
                };

                if (this.isValidReading(newReading)) {
                    if (this.lastGPSReading) {
                        // Aplicar suavizado con factor mejor
                        const smoothed = {
                            lat: this.lastGPSReading.lat * config.smoothingFactor + 
                                 newReading.lat * (1 - config.smoothingFactor),
                            lng: this.lastGPSReading.lng * config.smoothingFactor + 
                                 newReading.lng * (1 - config.smoothingFactor),
                            accuracy: Math.min(
                                this.lastGPSReading.accuracy,
                                newReading.accuracy
                            )
                        };
                        this.lastGPSReading = smoothed;
                    } else {
                        this.lastGPSReading = newReading;
                    }

                    this.accuracy = this.lastGPSReading.accuracy;
                    callback(this.lastGPSReading);
                }
            },
            (error) => {
                console.error("Error watchPosition:", error);
                callback(null, error);
            },
            config
        );

        return this.watchId;
    }

    /**
     * Detecta si la ubicación es probable vs improbable
     * Retorna true si es válida, false si parece un salto erróneo
     */
    isValidReading(newReading) {
        if (!this.lastGPSReading) return true;

        const distance = LocationManager.getDistance(
            this.lastGPSReading.lat,
            this.lastGPSReading.lng,
            newReading.lat,
            newReading.lng
        );

        // Si se movió más de 100 metros en menos de 1 segundo, probablemente es error
        const timeDiff = (newReading.timestamp || Date.now()) - 
                        (this.lastGPSReading.timestamp || 0);
        
        // Velocidad máxima realista: 200 km/h = 55 m/s
        const timeDiffSeconds = Math.max(timeDiff / 1000, 1);
        const speed = distance / timeDiffSeconds;

        // Aceptar si:
        // 1. Distancia < 500m (cambio razonable)
        // 2. O velocidad < 200 km/h (55 m/s)
        // 3. Y accuracy es relativamente confiable (<500m)
        const isValidDistance = distance < 500 || speed < 55;
        const isValidAccuracy = newReading.accuracy < 500;

        return isValidDistance && isValidAccuracy;
    }

    /**
     * Calcula distancia entre dos coordenadas (en metros)
     * Fórmula de Haversine
     */
    static getDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000; // Radio de la Tierra en metros
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}

// Exportar para uso global
window.LocationManager = LocationManager;
