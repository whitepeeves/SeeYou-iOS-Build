/**
 * MapLayersManager - Gestiona capas de mapas de alta calidad con Cesium.js
 * Proporciona proveedores mejorados: Mapbox, Google, OpenStreetMap
 */

class MapLayersManager {
    /**
     * Crea una capa de Mapbox de alta resolución
     * @param {string} mapboxToken - Token de Mapbox (requerido)
     * @param {string} style - 'satellite', 'streets', 'outdoors', 'light', 'dark'
     * @returns {Cesium.ImageryLayer}
     */
    static createMapboxLayer(mapboxToken, style = 'satellite') {
        const styles = {
            satellite: 'mapbox/satellite-v9',
            streets: 'mapbox/streets-v11',
            outdoors: 'mapbox/outdoors-v11',
            light: 'mapbox/light-v10',
            dark: 'mapbox/dark-v10'
        };

        const selectedStyle = styles[style] || styles.satellite;
        
        return new Cesium.ImageryLayer(
            new Cesium.UrlTemplateImageryProvider({
                url: `https://api.mapbox.com/styles/v1/${selectedStyle}/static/` +
                     `{bbox}/512x512?access_token=${mapboxToken}`,
                minimumLevel: 0,
                maximumLevel: 19,
                credit: '© Mapbox'
            })
        );
    }

    /**
     * Crea una capa de Google Maps (requiere API key)
     * @param {string} googleApiKey - Google Maps API Key
     * @param {string} type - 'satellite', 'roadmap', 'terrain', 'hybrid'
     * @returns {Cesium.ImageryLayer}
     */
    static createGoogleLayer(googleApiKey, type = 'satellite') {
        const types = {
            satellite: 's',
            roadmap: 'm',
            terrain: 't',
            hybrid: 'y'
        };

        const selectedType = types[type] || types.satellite;

        return new Cesium.ImageryLayer(
            new Cesium.UrlTemplateImageryProvider({
                url: `https://mt{s}.googleapis.com/vt/lyrs=${selectedType}` +
                     `&x={x}&y={y}&z={z}&key=${googleApiKey}`,
                subdomains: ['0', '1', '2', '3'],
                minimumLevel: 0,
                maximumLevel: 21,
                credit: '© Google'
            })
        );
    }

    /**
     * Crea capas de OpenStreetMap mejoradas
     * @param {string} provider - 'osm', 'osmblackandwhite', 'osmhy'
     * @returns {Cesium.ImageryLayer}
     */
    static createOSMLayer(provider = 'osm') {
        const providers = {
            osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            osmblackandwhite: 'https://tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png',
            osmde: 'https://tiles.openstreetmap.de/tiles/osmde/{z}/{x}/{y}.png',
            osmfr: 'https://tiles.openstreetmap.fr/osmfr/{z}/{x}/{y}.png'
        };

        const url = providers[provider] || providers.osm;

        return new Cesium.ImageryLayer(
            new Cesium.UrlTemplateImageryProvider({
                url: url,
                minimumLevel: 0,
                maximumLevel: 19,
                credit: '© OpenStreetMap contributors'
            })
        );
    }

    /**
     * Crea capas de Bing Maps (mejor calidad que ArcGIS)
     * @param {string} bingKey - Bing Maps API Key
     * @param {string} imagerySet - 'Aerial', 'AerialWithLabels', 'Road'
     * @returns {Cesium.ImageryLayer}
     */
    static createBingLayer(bingKey, imagerySet = 'Aerial') {
        return new Cesium.ImageryLayer(
            new Cesium.BingMapsImageryProvider({
                url: 'https://dev.virtualearth.net',
                key: bingKey,
                mapStyle: Cesium.BingMapsStyle[imagerySet]
            })
        );
    }

    /**
     * Crea capas de ArcGIS mejoradas (alta resolución)
     * @param {string} type - 'satellite', 'streets', 'ocean', 'natgeo'
     * @returns {Cesium.ImageryLayer}
     */
    static createArcGISLayer(type = 'satellite') {
        const urls = {
            satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            streets: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
            ocean: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean_Basemap/MapServer/tile/{z}/{y}/{x}',
            natgeo: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
            topo: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
        };

        const url = urls[type] || urls.satellite;

        return new Cesium.ImageryLayer(
            new Cesium.UrlTemplateImageryProvider({
                url: url,
                minimumLevel: 0,
                maximumLevel: 19,
                hasAlphaChannel: false,
                credit: '© Esri'
            })
        );
    }

    /**
     * Crea capas ESRI más detalladas
     * @returns {Cesium.ImageryLayer}
     */
    static createESRIDetailedLayer() {
        return new Cesium.ImageryLayer(
            new Cesium.UrlTemplateImageryProvider({
                url: 'https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                minimumLevel: 0,
                maximumLevel: 20,
                credit: '© Esri'
            })
        );
    }

    /**
     * Crea un mapa optimizado para picking/selector de ubicación
     * Combina múltiples capas para máxima claridad
     */
    static setupOptimalMapPicker(viewer, options = {}) {
        const config = {
            primaryProvider: 'mapbox', // 'mapbox', 'google', 'arcgis', 'bing', 'osm'
            mapboxToken: null,
            googleKey: null,
            bingKey: null,
            enableHighRes: true,
            ...options
        };

        // Limpiar capas existentes
        while (viewer.imageryLayers.length > 0) {
            viewer.imageryLayers.removeAt(0);
        }

        // Agregar capa principal según el proveedor
        let mainLayer = null;
        switch (config.primaryProvider) {
            case 'mapbox':
                if (config.mapboxToken) {
                    mainLayer = MapLayersManager.createMapboxLayer(config.mapboxToken, 'satellite');
                } else {
                    mainLayer = MapLayersManager.createArcGISLayer('satellite');
                }
                break;
            case 'google':
                if (config.googleKey) {
                    mainLayer = MapLayersManager.createGoogleLayer(config.googleKey, 'satellite');
                } else {
                    mainLayer = MapLayersManager.createArcGISLayer('satellite');
                }
                break;
            case 'bing':
                if (config.bingKey) {
                    mainLayer = MapLayersManager.createBingLayer(config.bingKey, 'Aerial');
                } else {
                    mainLayer = MapLayersManager.createArcGISLayer('satellite');
                }
                break;
            case 'osm':
                mainLayer = MapLayersManager.createOSMLayer('osm');
                break;
            case 'arcgis':
            default:
                mainLayer = MapLayersManager.createArcGISLayer('satellite');
        }

        if (mainLayer) {
            viewer.imageryLayers.add(mainLayer);
        }

        // Agregar capas alternativas para toggle
        const streetLayer = MapLayersManager.createArcGISLayer('streets');
        streetLayer.show = false;
        viewer.imageryLayers.add(streetLayer);

        const topoLayer = MapLayersManager.createArcGISLayer('topo');
        topoLayer.show = false;
        viewer.imageryLayers.add(topoLayer);

        // Configurar visualización optimizada
        viewer.scene.globe.baseColor = Cesium.Color.BLACK;
        viewer.scene.globe.maximumScreenSpaceError = 2; // Mejor calidad (fue 4)
        viewer.scene.globe.enableLighting = true;
        viewer.scene.atmosphere.enabled = true;
        viewer.camera.percentageChanged = 0.01;

        // Configurar controles para móvil - permitir arrastrar/deslizar
        viewer.scene.screenSpaceCameraController.enableRotate = true;
        viewer.scene.screenSpaceCameraController.enableTranslate = true;
        viewer.scene.screenSpaceCameraController.enableZoom = true;
        viewer.scene.screenSpaceCameraController.enableTilt = true;

        return { mainLayer, streetLayer, topoLayer };
    }
}

// Exportar globalmente
window.MapLayersManager = MapLayersManager;
