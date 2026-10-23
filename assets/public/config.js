const CONFIG = {
  DEFAULT_SERVER_URL: 'https://seeyouonline.net',
  serverUrl: null,
  async initServer() {
    const saved = localStorage.getItem('seeYouServerUrl');
    const candidates = [saved, window.location.origin, 'https://seeyouonline.net', 'http://127.0.0.1:3000', 'http://localhost:3000'];
    for (const candidate of candidates.filter(Boolean)) {
      try {
        const response = await fetch(`${candidate}/api/ping`, { method: 'GET' });
        if (response.ok) {
          this.serverUrl = candidate;
          localStorage.setItem('seeYouServerUrl', candidate);
          return candidate;
        }
      } catch (error) {
      }
    }
    const localNetworks = ['192.168.1.', '10.0.', '10.250.10.'];
    for (const prefix of localNetworks) {
      for (let i = 1; i <= 254; i += 25) {
        const candidate = `http://${prefix}${i}:3000`;
        try {
          const response = await fetch(`${candidate}/api/ping`, { method: 'GET' });
          if (response.ok) {
            this.serverUrl = candidate;
            localStorage.setItem('seeYouServerUrl', candidate);
            return candidate;
          }
        } catch (error) {
        }
      }
    }
    this.serverUrl = this.DEFAULT_SERVER_URL;
    return this.serverUrl;
  }
};

async function getServerUrl() {
  if (CONFIG.serverUrl) {
    return CONFIG.serverUrl;
  }
  return CONFIG.initServer();
}
