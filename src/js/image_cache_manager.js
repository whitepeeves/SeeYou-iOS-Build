/**
 * Image Cache Manager
 * Gestiona el caché de imágenes (fotos de perfil, etc.) para evitar descargas repetidas
 */

class ImageCacheManager {
  constructor() {
    this.CACHE_NAME = 'seeyou-image-cache-v1';
    this.CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 días
    this.MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
    this.loadingImages = new Set();
    this.failedUrls = new Set();
    this.urlToBlobCache = new Map(); // Cache en memoria para acceso rápido
    
    // Limpiar cachés expirados al iniciar
    this.cleanExpiredCache();
  }

  /**
   * Obtener imagen del caché o descargarla
   */
  async getImage(url, options = {}) {
    if (!url) return null;

    // Si ya existe en caché en memoria, retornar
    if (this.urlToBlobCache.has(url)) {
      return this.urlToBlobCache.get(url);
    }

    // Si la URL falló anteriormente, no reintentar de inmediato
    if (this.failedUrls.has(url)) {
      return null;
    }

    try {
      // Intentar obtener del storage
      const cached = await this.getFromStorage(url);
      if (cached) {
        this.urlToBlobCache.set(url, cached);
        return cached;
      }

      // Si no está cacheado, descargar
      if (!this.loadingImages.has(url)) {
        this.loadingImages.add(url);
        try {
          const blob = await this.downloadAndCache(url);
          this.loadingImages.delete(url);
          if (blob) {
            this.urlToBlobCache.set(url, blob);
            return blob;
          }
        } catch (error) {
          this.loadingImages.delete(url);
          this.failedUrls.add(url);
          console.error(`Error descargando imagen: ${url}`, error);
          return null;
        }
      }

      // Si ya se está descargando, esperar
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.loadingImages.has(url)) {
            clearInterval(checkInterval);
            resolve(this.urlToBlobCache.get(url) || null);
          }
        }, 100);
        setTimeout(() => clearInterval(checkInterval), 30000); // Timeout de 30s
      });
    } catch (error) {
      console.error('Error en getImage:', error);
      return null;
    }
  }

  /**
   * Descargar y cachear imagen
   */
  async downloadAndCache(url) {
    try {
      const response = await fetch(url, {
        mode: 'cors',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();

      // Validar tamaño
      if (blob.size > 5 * 1024 * 1024) {
        console.warn(`Imagen muy grande: ${url} (${blob.size} bytes)`);
        return blob;
      }

      // Guardar en storage
      await this.saveToStorage(url, blob);

      return blob;
    } catch (error) {
      console.error(`Error descargando ${url}:`, error);
      return null;
    }
  }

  /**
   * Guardar imagen en IndexedDB
   */
  async saveToStorage(url, blob) {
    try {
      const db = await this.openDB();
      const tx = db.transaction(['images'], 'readwrite');
      const store = tx.objectStore('images');

      await new Promise((resolve, reject) => {
        const request = store.put({
          url,
          blob,
          timestamp: Date.now(),
          size: blob.size
        });
        request.onsuccess = resolve;
        request.onerror = reject;
      });

      // Verificar tamaño total y limpiar si es necesario
      await this.enforceStorageLimit();
    } catch (error) {
      console.warn('Error guardando en storage:', error);
    }
  }

  /**
   * Obtener imagen de IndexedDB
   */
  async getFromStorage(url) {
    try {
      const db = await this.openDB();
      const tx = db.transaction(['images'], 'readonly');
      const store = tx.objectStore('images');

      return new Promise((resolve, reject) => {
        const request = store.get(url);
        request.onsuccess = () => {
          const result = request.result;
          if (result) {
            // Verificar si está expirado
            if (Date.now() - result.timestamp < this.CACHE_EXPIRY) {
              resolve(result.blob);
            } else {
              // Eliminar expirado
              store.delete(url);
              resolve(null);
            }
          } else {
            resolve(null);
          }
        };
        request.onerror = reject;
      });
    } catch (error) {
      console.warn('Error leyendo de storage:', error);
      return null;
    }
  }

  /**
   * Abrir/crear base de datos IndexedDB
   */
  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('SeeYouCache', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('images')) {
          const store = db.createObjectStore('images', { keyPath: 'url' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('size', 'size', { unique: false });
        }
      };
    });
  }

  /**
   * Limpiar cachés expirados
   */
  async cleanExpiredCache() {
    try {
      const db = await this.openDB();
      const tx = db.transaction(['images'], 'readwrite');
      const store = tx.objectStore('images');
      const index = store.index('timestamp');

      const allRecords = await new Promise((resolve, reject) => {
        const request = index.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = reject;
      });

      const now = Date.now();
      for (const record of allRecords) {
        if (now - record.timestamp > this.CACHE_EXPIRY) {
          await new Promise((resolve, reject) => {
            const delRequest = store.delete(record.url);
            delRequest.onsuccess = resolve;
            delRequest.onerror = reject;
          });
        }
      }
    } catch (error) {
      console.warn('Error limpiando caché expirado:', error);
    }
  }

  /**
   * Enforcer límite de almacenamiento
   */
  async enforceStorageLimit() {
    try {
      const db = await this.openDB();
      const tx = db.transaction(['images'], 'readwrite');
      const store = tx.objectStore('images');
      const index = store.index('timestamp');

      const allRecords = await new Promise((resolve, reject) => {
        const request = index.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = reject;
      });

      let totalSize = allRecords.reduce((sum, r) => sum + r.size, 0);

      if (totalSize > this.MAX_CACHE_SIZE) {
        // Ordenar por timestamp (más antiguos primero) y eliminar
        const sorted = allRecords.sort((a, b) => a.timestamp - b.timestamp);

        for (const record of sorted) {
          if (totalSize <= this.MAX_CACHE_SIZE * 0.9) break; // Reducir a 90% del límite

          await new Promise((resolve, reject) => {
            const delRequest = store.delete(record.url);
            delRequest.onsuccess = () => {
              totalSize -= record.size;
              resolve();
            };
            delRequest.onerror = reject;
          });
        }
      }
    } catch (error) {
      console.warn('Error en enforceStorageLimit:', error);
    }
  }

  /**
   * Convertir blob a URL de objeto
   */
  blobToObjectUrl(blob) {
    if (!blob) return null;
    return URL.createObjectURL(blob);
  }

  /**
   * Prefetch de imágenes (pre-descargar)
   */
  async prefetchImages(urls) {
    return Promise.all(
      urls.map(url => this.getImage(url).catch(() => null))
    );
  }

  /**
   * Limpiar caché completo
   */
  async clearCache() {
    try {
      const db = await this.openDB();
      const tx = db.transaction(['images'], 'readwrite');
      const store = tx.objectStore('images');

      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => {
          this.urlToBlobCache.clear();
          this.failedUrls.clear();
          resolve();
        };
        request.onerror = reject;
      });
    } catch (error) {
      console.warn('Error limpiando caché:', error);
      this.urlToBlobCache.clear();
      this.failedUrls.clear();
    }
  }

  /**
   * Obtener estadísticas de caché
   */
  async getCacheStats() {
    try {
      const db = await this.openDB();
      const tx = db.transaction(['images'], 'readonly');
      const store = tx.objectStore('images');

      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const records = request.result;
          const totalSize = records.reduce((sum, r) => sum + r.size, 0);
          resolve({
            count: records.length,
            totalSize,
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
            maxSizeMB: (this.MAX_CACHE_SIZE / 1024 / 1024).toFixed(2)
          });
        };
        request.onerror = reject;
      });
    } catch (error) {
      console.warn('Error obteniendo stats:', error);
      return null;
    }
  }
}

// Instancia global
window.imageCacheManager = new ImageCacheManager();
