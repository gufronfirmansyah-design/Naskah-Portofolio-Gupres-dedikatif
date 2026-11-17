window.GtkApi = {
  async request(action, payload = {}, token = '') {
    const config = window.PORTOFOLIO_CONFIG;
    if (!config || !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(config.apiUrl)) {
      throw new Error('Alamat layanan belum valid. Hubungi panitia.');
    }
    const controller = new AbortController();
    const timeout = ['saveBestPractice', 'savePortofolioItem'].includes(action) ? config.uploadTimeoutMs : config.requestTimeoutMs;
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        credentials: 'omit', redirect: 'follow', signal: controller.signal,
        body: JSON.stringify({ action, token, payload })
      });
      if (!response.ok) throw new Error('Layanan gagal merespons (HTTP ' + response.status + ').');
      let data;
      try { data = await response.json(); }
      catch (_) { throw new Error('Respons layanan bukan JSON. Panitia perlu memeriksa URL dan akses deployment Apps Script.'); }
      if (!data || typeof data.success !== 'boolean') throw new Error('Format respons layanan tidak sesuai aplikasi portofolio.');
      if (!data.success && /APP_CONFIG is not defined/.test(data.message || '')) {
        throw new Error('Konfigurasi backend belum tersedia pada versi aktif. Panitia perlu memperbarui deployment Apps Script.');
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Waktu tunggu layanan habis. Jika sedang menyimpan, periksa data sebelum mengirim ulang.');
      if (error instanceof TypeError) throw new Error('Tidak dapat menghubungi layanan. Periksa internet atau akses deployment Apps Script.');
      throw error;
    } finally { clearTimeout(timer); }
  }
};

