

    let APP_STATE = {
      token: sessionStorage.getItem('gtk_portofolio_token') || '',
      user: readStoredUser(),
      bootstrap: null,
      activeSection: 'bp',
      activeComp: 'A'
    };

    const KOMPONEN_META = {
      'A': { title: 'A. Kepengurusan Aktif PGRI', max: 10, desc: 'Maksimal 10 poin. Ambil satu jabatan aktif dengan poin tertinggi.' },
      'B': { title: 'B. Pelatihan & Pengembangan Diri', max: 30, desc: 'Maksimal 30 poin. Pelatihan mandiri Ruang GTK 2 poin/topik (sub-batas maks 8 poin).' },
      'C': { title: 'C. Buku & Artikel Jurnal Terbit', max: 20, desc: 'Maksimal 20 poin. Dipilih paling banyak 2 karya berbeda dengan poin tertinggi.' },
      'D': { title: 'D. Pengurus / Panitia Inti MGMP, KKG, Kombel', max: 10, desc: 'Maksimal 10 poin. Ambil satu peran/kegiatan inti tertinggi yang terbukti dilaksanakan.' },
      'E': { title: 'E. Pembimbing Murid dalam Lomba', max: 20, desc: 'Maksimal 20 poin. Dipilih paling banyak 2 lomba berbeda dengan skor tertinggi.' },
      'F': { title: 'F. Prestasi / Penghargaan Individu', max: 10, desc: 'Maksimal 10 poin. Ambil satu prestasi tertinggi yang relevan (skor mentah >10 dibatasi 10).' }
    };

    function readStoredUser() {
      try { return JSON.parse(sessionStorage.getItem('gtk_portofolio_user') || 'null'); }
      catch (_) { sessionStorage.removeItem('gtk_portofolio_user'); return null; }
    }
    function callGasApi(action, payload = {}) {
      return window.GtkApi.request(action, payload, APP_STATE.token);
    }

    window.addEventListener('DOMContentLoaded', async () => {
      if (APP_STATE.token && APP_STATE.user) {
        await loadBootstrap();
      } else {
        showView('login');
      }
    });

    function showToast(msg, type = 'info') {
      const container = document.getElementById('toast-container');
      const colors = {
        success: 'bg-emerald-600 text-white border-emerald-500',
        error: 'bg-rose-600 text-white border-rose-500',
        info: 'bg-slate-900 text-white border-slate-700'
      };
      const el = document.createElement('div');
      el.className = `pointer-events-auto px-4 py-3.5 rounded-2xl shadow-xl border text-xs font-semibold transition-all fade-in ${colors[type] || colors.info}`;
      el.textContent = msg;
      container.appendChild(el);
      setTimeout(() => {
        el.classList.add('opacity-0');
        setTimeout(() => el.remove(), 300);
      }, 4200);
    }

    function setLoading(show, text = 'Memproses permintaan...') {
      const el = document.getElementById('global-loader');
      document.getElementById('loader-text').textContent = text;
      el.classList.toggle('hidden', !show);
    }

    function closeModal(id) {
      document.getElementById(id).classList.add('hidden');
    }

    function openConfirm(title, msg, needInput, onConfirm) {
      document.getElementById('confirm-title').textContent = title;
      document.getElementById('confirm-msg').textContent = msg;
      const inpWrap = document.getElementById('confirm-input-wrap');
      const inp = document.getElementById('confirm-input');
      inp.value = '';
      inpWrap.classList.toggle('hidden', !needInput);

      const okBtn = document.getElementById('confirm-ok-btn');
      okBtn.onclick = () => {
        const val = inp.value;
        if (needInput && !val.trim()) {
          showToast('Alasan wajib diisi.', 'error');
          return;
        }
        closeModal('modal-confirm');
        onConfirm(val);
      };
      document.getElementById('modal-confirm').classList.remove('hidden');
    }

    function showView(viewName) {
      ['login', 'peserta', 'verifikator', 'admin'].forEach(v => {
        document.getElementById('view-' + v).classList.add('hidden');
      });
      document.getElementById('view-' + viewName).classList.remove('hidden');
      const nav = document.getElementById('app-navbar');
      if (viewName === 'login') {
        nav.classList.add('hidden');
      } else {
        nav.classList.remove('hidden');
        document.getElementById('nav-user-name').textContent = APP_STATE.user?.nama || '';
        document.getElementById('nav-user-role').textContent = APP_STATE.user?.peran || '';
      }
    }

    // ==================== AUTH ====================
    let loginBusy = false;
    async function handleLogin(e) {
      e.preventDefault();
      if (loginBusy) return;
      loginBusy = true;
      document.getElementById('login-error').classList.add('hidden');
      const u = document.getElementById('login-username').value;
      const p = document.getElementById('login-password').value;
      setLoading(true, 'Memverifikasi akun ke server...');
      try {
        const res = await callGasApi('loginUser', { username: u, password: p });
        setLoading(false);
        if (!res.success) {
          showBootstrapError(res.message || 'Login ditolak server.');
          return;
        }
        APP_STATE.token = res.token;
        APP_STATE.user = res.user;
        sessionStorage.setItem('gtk_portofolio_token', res.token);
        sessionStorage.setItem('gtk_portofolio_user', JSON.stringify(res.user));
        if (await loadBootstrap()) showToast('Selamat datang, ' + res.user.nama, 'success');
      } catch (err) {
        setLoading(false);
        showBootstrapError(err.message);
      } finally { loginBusy = false; setLoading(false); }
    }

    function handleLogout() {
      callGasApi('logoutUser').catch(() => {});
      sessionStorage.removeItem('gtk_portofolio_token');
      sessionStorage.removeItem('gtk_portofolio_user');
      APP_STATE = { token: '', user: null, bootstrap: null, activeSection: 'bp', activeComp: 'A' };
      showView('login');
      showToast('Anda telah keluar dari sistem.');
    }

    async function loadBootstrap() {
      setLoading(true, 'Memuat data portofolio...');
      try {
        const res = await callGasApi('getAppBootstrapData');
        setLoading(false);
        if (!res.success) {
          showToast(res.message, 'error');
          showView('login');
          showBootstrapError(res.message || 'Dashboard gagal dimuat.');
          return false;
        }
        if (!['Peserta', 'Verifikator', 'Super Admin'].includes(res.peran)) throw new Error('Peran akun tidak dikenali: ' + res.peran);
        APP_STATE.bootstrap = res;
        if (res.peran === 'Peserta') {
          renderPesertaDashboard();
          showView('peserta');
        } else if (res.peran === 'Verifikator') {
          renderVerifikatorQueue();
          showView('verifikator');
        } else if (res.peran === 'Super Admin') {
          renderAdminDashboard();
          showView('admin');
        }
        document.getElementById('login-error').classList.add('hidden');
        document.getElementById('retry-dashboard').classList.add('hidden');
        return true;
      } catch (err) {
        setLoading(false);
        showView('login');
        showBootstrapError('Gagal memuat dashboard: ' + err.message);
        return false;
      }
    }

    function showBootstrapError(message) {
      const box = document.getElementById('login-error');
      box.textContent = message;
      box.classList.remove('hidden');
      document.getElementById('retry-dashboard').classList.toggle('hidden', !APP_STATE.token);
    }

    // ==================== PESERTA RENDERING ====================
    function renderPesertaDashboard() {
      const { profil, bestPractice, isian, statusPortofolio, kalkulasi, jadwal } = APP_STATE.bootstrap;
      document.getElementById('pst-nama').textContent = profil.nama;
      document.getElementById('pst-kta').textContent = profil.no_kta;
      document.getElementById('pst-kategori').textContent = profil.kategori;
      document.getElementById('pst-jenjang').textContent = profil.jenjang;
      document.getElementById('pst-sekolah').textContent = profil.asal_sekolah;
      document.getElementById('pst-cabang').textContent = profil.utusan_cabang;
      document.getElementById('pst-jabatan').textContent = profil.jabatan;

      const stBadge = document.getElementById('pst-status-badge');
      stBadge.textContent = statusPortofolio.status_pengiriman + (statusPortofolio.status_kunci === 'TERKUNCI' ? ' (TERKUNCI)' : '');
      stBadge.className = statusPortofolio.status_pengiriman === 'TERKIRIM'
        ? 'px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200'
        : 'px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-200';

      document.getElementById('pst-total-skor').textContent = kalkulasi.totalSkor;
      document.getElementById('pst-penilaian-status').textContent = kalkulasi.statusPenilaian;
      document.getElementById('pst-sched-pengisian').textContent = jadwal.pengisianAktif ? 'BUKA (' + jadwal.raw.JADWAL_PENGISIAN_SELESAI + ')' : 'TUTUP';
      document.getElementById('pst-sched-revisi').textContent = jadwal.revisiAktif ? 'BUKA (' + jadwal.raw.JADWAL_REVISI_SELESAI + ')' : 'TUTUP';

      const hasBP = bestPractice && bestPractice.judul_best_practice && (bestPractice.file_id || bestPractice.link_video);
      const badgeBP = document.getElementById('badge-bp-status');
      badgeBP.textContent = hasBP ? 'Tersimpan' : 'Belum Diisi';
      document.getElementById('badge-porto-count').textContent = `${isian.length} Bukti`;

      document.getElementById('bp-judul').value = bestPractice ? bestPractice.judul_best_practice : '';
      document.getElementById('bp-link-video').value = bestPractice ? bestPractice.link_video : '';
      document.getElementById('bp-file').value = '';
      document.getElementById('bp-current-file-info').textContent = (bestPractice && bestPractice.nama_file)
        ? 'Berkas tersimpan: ' + bestPractice.nama_file
        : '';

      const savedActions = document.getElementById('bp-saved-actions');
      const btnPrevBP = document.getElementById('btn-preview-bp');
      const btnVidBP = document.getElementById('btn-open-video-bp');
      if (bestPractice && (bestPractice.file_id || bestPractice.link_video)) {
        savedActions.classList.remove('hidden');
        btnPrevBP.classList.toggle('hidden', !bestPractice.file_id);
        if (bestPractice.link_video) {
          btnVidBP.href = bestPractice.link_video;
          btnVidBP.classList.remove('hidden');
        } else {
          btnVidBP.classList.add('hidden');
        }
      } else {
        savedActions.classList.add('hidden');
      }

      const scoreCards = document.getElementById('pst-score-cards');
      scoreCards.innerHTML = ['A', 'B', 'C', 'D', 'E', 'F'].map(k => {
        const val = kalkulasi['skor' + k];
        const max = KOMPONEN_META[k].max;
        const pct = Math.min(100, Math.round((val / max) * 100));
        const count = isian.filter(i => i.komponen === k).length;
        return `
          <div onclick="switchPesertaSection('portofolio'); switchPesertaTab('${k}');"
            class="cursor-pointer bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:border-blue-400 transition">
            <div class="flex justify-between items-center text-xs font-bold text-slate-600">
              <span>Komponen ${k}</span>
              <span class="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] text-slate-600">${count} bukti</span>
            </div>
            <div class="mt-2 flex items-baseline gap-1">
              <span class="text-2xl font-extrabold text-slate-900">${val}</span>
              <span class="text-xs font-semibold text-slate-400">/ ${max}</span>
            </div>
            <div class="w-full h-1.5 bg-slate-100 rounded-full mt-2.5 overflow-hidden">
              <div class="h-full bg-blue-600 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }).join('');

      const tabsEl = document.getElementById('pst-tabs');
      const tabs = ['A', 'B', 'C', 'D', 'E', 'F'];
      tabsEl.innerHTML = tabs.map(t => {
        const active = APP_STATE.activeComp === t;
        return `
          <button onclick="switchPesertaTab('${t}')"
            class="px-4 py-2.5 text-xs font-bold rounded-t-xl border-t border-x transition ${
              active ? 'bg-white text-blue-700 border-slate-200 -mb-px shadow-2xs' : 'bg-slate-100/70 text-slate-600 border-transparent hover:bg-slate-200/70'
            }">
            Komponen ${t}
          </button>
        `;
      }).join('');

      switchPesertaSection(APP_STATE.activeSection);
      switchPesertaTab(APP_STATE.activeComp);
    }

    function switchPesertaSection(sec) {
      APP_STATE.activeSection = sec;
      ['bp', 'portofolio', 'submit'].forEach(s => {
        document.getElementById('pst-section-' + s).classList.toggle('hidden', s !== sec);
        const btn = document.getElementById('sec-btn-' + s);
        if (s === sec) {
          btn.className = 'flex-1 min-w-[200px] py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center justify-center gap-2 bg-blue-600 text-white shadow-sm';
        } else {
          btn.className = 'flex-1 min-w-[200px] py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center justify-center gap-2 text-slate-600 hover:bg-slate-100';
        }
      });
      if (sec === 'submit') {
        renderPesertaSummary();
      }
    }

    function switchPesertaTab(tab) {
      APP_STATE.activeComp = tab;
      const { isian, statusPortofolio, jadwal } = APP_STATE.bootstrap;

      document.querySelectorAll('#pst-tabs button').forEach(btn => {
        const isBtnActive = btn.textContent.trim() === 'Komponen ' + tab;
        btn.className = `px-4 py-2.5 text-xs font-bold rounded-t-xl border-t border-x transition ${
          isBtnActive ? 'bg-white text-blue-700 border-slate-200 -mb-px shadow-2xs' : 'bg-slate-100/70 text-slate-600 border-transparent hover:bg-slate-200/70'
        }`;
      });

      const meta = KOMPONEN_META[tab];
      document.getElementById('pst-comp-title').textContent = meta.title;
      document.getElementById('pst-comp-desc').textContent = meta.desc;

      const canAdd = statusPortofolio.status_pengiriman === 'DRAF' && statusPortofolio.status_kunci !== 'TERKUNCI' && jadwal.pengisianAktif;
      document.getElementById('btn-tambah-bukti').classList.toggle('hidden', !canAdd);

      const items = isian.filter(i => i.komponen === tab);
      const container = document.getElementById('pst-items-container');
      if (items.length === 0) {
        container.innerHTML = `<div class="text-center py-10 text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">Belum ada bukti kegiatan yang diunggah pada Komponen ${tab}. Jika tidak memiliki bukti pada komponen ini, Anda dapat langsung menuju tab komponen lain atau halaman <strong>Ringkasan & Submit</strong>.</div>`;
        return;
      }

      container.innerHTML = items.map(item => {
        const badgeColors = {
          'Menunggu': 'bg-slate-100 text-slate-700 border-slate-200',
          'Diterima': 'bg-emerald-50 text-emerald-700 border-emerald-200',
          'Perlu Revisi': 'bg-amber-50 text-amber-800 border-amber-200',
          'Ditolak': 'bg-rose-50 text-rose-700 border-rose-200'
        };
        const canEdit = statusPortofolio.status_kunci !== 'TERKUNCI' && (
          (statusPortofolio.status_pengiriman === 'DRAF' && jadwal.pengisianAktif) ||
          (statusPortofolio.status_pengiriman === 'TERKIRIM' && item.status_verifikasi === 'Perlu Revisi' && jadwal.revisiAktif)
        );
        const canDelete = statusPortofolio.status_pengiriman === 'DRAF' && statusPortofolio.status_kunci !== 'TERKUNCI' && jadwal.pengisianAktif;

        return `
          <div class="p-4 sm:p-5 rounded-2xl border border-slate-200/90 hover:border-blue-300 bg-white transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
            <div class="space-y-1.5">
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-lg border text-[11px] font-extrabold ${badgeColors[item.status_verifikasi] || 'bg-slate-100'}">
                  ${item.status_verifikasi}
                </span>
                <span class="text-xs font-bold text-blue-700">${item.klasifikasi_sah || item.klasifikasi_klaim}</span>
                <span class="text-[11px] text-slate-400 font-medium">• Berkas v${item.versi_berkas}</span>
                ${item.is_duplikat === 'YA' ? '<span class="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-md text-[10px] font-bold">Duplikat (0 Poin)</span>' : ''}
              </div>
              <h4 class="text-sm font-extrabold text-slate-900">${item.nama_kegiatan}</h4>
              <p class="text-xs text-slate-500">Penyelenggara: <strong class="font-semibold text-slate-700">${item.penyelenggara || '-'}</strong> • Tanggal: <strong class="font-semibold text-slate-700">${item.tanggal_kegiatan || '-'}</strong></p>
              ${item.catatan_verifikator ? `<div class="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950"><strong>Catatan Verifikator:</strong> ${item.catatan_verifikator}</div>` : ''}
            </div>
            <div class="flex flex-wrap items-center gap-2 shrink-0">
              <button onclick="previewFile('${item.id_isian}', '${item.nama_file}')"
                class="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition">
                Lihat Bukti
              </button>
              ${canEdit ? `<button onclick='openModalIsian(${JSON.stringify(item)})' class="px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition">Edit / Ganti Berkas</button>` : ''}
              ${canDelete ? `<button onclick="confirmDeleteIsian('${item.id_isian}')" class="px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition">Hapus</button>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    function renderPesertaSummary() {
      const { bestPractice, isian, statusPortofolio, kalkulasi, jadwal } = APP_STATE.bootstrap;
      document.getElementById('submit-total-poin-badge').textContent = `${kalkulasi.totalSkor} / 100 Poin`;

      const hasBP = bestPractice && bestPractice.judul_best_practice && (bestPractice.file_id || bestPractice.link_video);
      const bpBox = document.getElementById('submit-bp-status-box');
      if (hasBP) {
        bpBox.className = 'p-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 text-xs text-emerald-950 space-y-1';
        bpBox.innerHTML = `
          <div class="font-extrabold text-emerald-800 flex items-center gap-1.5">
            <span>&#10003; Naskah Best Practice / Karya Sudah Tersimpan (Syarat Wajib Terpenuhi)</span>
          </div>
          <p><strong>Judul:</strong> ${bestPractice.judul_best_practice}</p>
          <p><strong>Berkas Naskah:</strong> ${bestPractice.nama_file || '-'} | <strong>Link Video:</strong> ${bestPractice.link_video || '-'}</p>
        `;
      } else {
        bpBox.className = 'p-4 rounded-2xl border border-rose-200 bg-rose-50/80 text-xs text-rose-950 space-y-1';
        bpBox.innerHTML = `
          <div class="font-extrabold text-rose-800">&#9888; Naskah Best Practice / Link Video Belum Diisi</div>
          <p>Anda wajib mengisi dan menyimpan Naskah Best Practice (atau Link Video untuk kategori GTK Berdedikasi) pada <strong>Tab 1</strong> sebelum melakukan Submit Kirim Final.</p>
        `;
      }

      const rows = ['A', 'B', 'C', 'D', 'E', 'F'].map(k => {
        const count = isian.filter(i => i.komponen === k).length;
        return `
          <tr class="border-b border-slate-100">
            <td class="p-3 font-bold text-slate-800">${KOMPONEN_META[k].title}</td>
            <td class="p-3 text-center text-slate-600">${count > 0 ? count + ' berkas' : '<span class="text-slate-400 italic">Tidak ada (0 poin)</span>'}</td>
            <td class="p-3 text-center font-extrabold text-slate-900">${kalkulasi['skor' + k]} / ${KOMPONEN_META[k].max}</td>
          </tr>
        `;
      }).join('');

      document.getElementById('pst-summary-table').innerHTML = `
        <div class="overflow-hidden rounded-2xl border border-slate-200">
          <table class="w-full text-xs text-left">
            <thead class="bg-slate-100 text-slate-700">
              <tr>
                <th class="p-3">Komponen Portofolio</th>
                <th class="p-3 text-center">Status Bukti</th>
                <th class="p-3 text-center">Skor Terhitung</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot class="bg-blue-50/90 font-extrabold">
              <tr>
                <td class="p-3.5 text-slate-900" colspan="2">TOTAL POIN PORTOFOLIO (${kalkulasi.statusPenilaian.toUpperCase()})</td>
                <td class="p-3.5 text-center text-blue-700 text-base">${kalkulasi.totalSkor} / 100</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;

      const btnKirim = document.getElementById('btn-kirim-final');
      if (statusPortofolio.status_pengiriman === 'TERKIRIM') {
        btnKirim.disabled = true;
        btnKirim.textContent = 'Sudah Dikirim Final pada ' + statusPortofolio.waktu_pengiriman;
        btnKirim.className = 'px-7 py-3 bg-slate-200 text-slate-500 font-bold rounded-xl text-sm cursor-not-allowed';
      } else if (!jadwal.pengisianAktif) {
        btnKirim.disabled = true;
        btnKirim.textContent = 'Jadwal Pengisian Ditutup';
        btnKirim.className = 'px-7 py-3 bg-slate-200 text-slate-500 font-bold rounded-xl text-sm cursor-not-allowed';
      } else {
        btnKirim.disabled = false;
        btnKirim.textContent = 'Submit & Kirim Final Sekarang';
        btnKirim.className = 'px-7 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 transition text-sm';
      }
    }

    // SIMPAN BEST PRACTICE
    function handleSaveBestPractice(e) {
      e.preventDefault();
      const judul = document.getElementById('bp-judul').value.trim();
      const linkVideo = document.getElementById('bp-link-video').value.trim();
      const fileInput = document.getElementById('bp-file');
      const file = fileInput.files[0];

      if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          const base64Data = evt.target.result.split(',')[1];
          sendBestPracticePayload(judul, linkVideo, {
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            base64: base64Data
          });
        };
        reader.readAsDataURL(file);
      } else {
        sendBestPracticePayload(judul, linkVideo, null);
      }
    }

    async function sendBestPracticePayload(judul, linkVideo, fileData) {
      setLoading(true, 'Menyimpan Naskah Best Practice ke Drive & Spreadsheet...');
      try {
        const res = await callGasApi('saveBestPractice', {
          judul_best_practice: judul,
          link_video: linkVideo,
          fileData: fileData
        });
        setLoading(false);
        if (!res.success) {
          showToast(res.message, 'error');
          return;
        }
        showToast(res.message, 'success');
        loadBootstrap();
      } catch (err) {
        setLoading(false);
        showToast('Gagal menyimpan Best Practice: ' + err.message, 'error');
      }
    }

    async function previewBestPracticeFile(targetIdPeserta = '') {
      setLoading(true, 'Membuka naskah Best Practice...');
      try {
        const res = await callGasApi('getBestPracticeFilePreview', { id_peserta: targetIdPeserta });
        setLoading(false);
        if (!res.success) return showToast(res.message, 'error');

        document.getElementById('preview-title').textContent = res.fileName;
        const body = document.getElementById('preview-body');
        const dataUrl = `data:${res.mimeType};base64,${res.base64}`;
        if (res.mimeType === 'application/pdf') {
          body.innerHTML = `<iframe src="${dataUrl}" class="w-full h-[75vh] rounded-xl border"></iframe>`;
        } else if (res.mimeType.startsWith('image/')) {
          body.innerHTML = `<img src="${dataUrl}" class="max-h-[75vh] max-w-full object-contain rounded-xl shadow" />`;
        } else {
          body.innerHTML = `
            <div class="text-center space-y-3 p-6">
              <p class="text-sm font-bold text-slate-800">Berkas Dokumen (${res.fileName})</p>
              <a href="${dataUrl}" download="${res.fileName}" class="inline-block px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl">
                Unduh Berkas Naskah
              </a>
            </div>
          `;
        }
        document.getElementById('modal-preview').classList.remove('hidden');
      } catch (err) {
        setLoading(false);
        showToast(err.message, 'error');
      }
    }

    // MODAL TAMBAH / EDIT ISIAN
    function openModalIsian(editItem = null) {
      const komp = APP_STATE.activeComp;
      const rubrikKomp = APP_STATE.bootstrap.rubrik.filter(r => r.komponen === komp);
      const jenisUnik = [...new Set(rubrikKomp.map(r => r.jenis_kegiatan))];

      document.getElementById('inp-komponen').value = komp;
      document.getElementById('inp-id-isian').value = editItem ? editItem.id_isian : '';
      document.getElementById('modal-isian-title').textContent = editItem
        ? `Perbarui Bukti - Komponen ${komp}`
        : `Tambah Bukti - Komponen ${komp}`;

      const selJenis = document.getElementById('inp-jenis');
      selJenis.innerHTML = jenisUnik.map(j => `<option value="${j}">${j}</option>`).join('');
      if (editItem) selJenis.value = editItem.jenis_kegiatan;

      onJenisChange(editItem ? editItem.klasifikasi_klaim : null);

      document.getElementById('inp-nama-kegiatan').value = editItem ? editItem.nama_kegiatan : '';
      document.getElementById('inp-tanggal').value = editItem ? editItem.tanggal_kegiatan : '';
      document.getElementById('inp-penyelenggara').value = editItem ? editItem.penyelenggara : '';
      document.getElementById('inp-keterangan').value = editItem ? editItem.keterangan : '';
      document.getElementById('inp-file').value = '';
      document.getElementById('inp-file').required = !editItem;
      document.getElementById('file-req-star').textContent = editItem ? '(Opsional jika tidak ganti berkas)' : '*';

      document.getElementById('modal-isian').classList.remove('hidden');
    }

    function onJenisChange(selectedKlas = null) {
      const komp = document.getElementById('inp-komponen').value;
      const jenis = document.getElementById('inp-jenis').value;
      const filtered = APP_STATE.bootstrap.rubrik.filter(r => r.komponen === komp && r.jenis_kegiatan === jenis);

      const selKlas = document.getElementById('inp-klasifikasi');
      selKlas.innerHTML = filtered.map(r => `<option value="${r.klasifikasi}">${r.klasifikasi} (${r.poin} Poin)</option>`).join('');
      if (selectedKlas) selKlas.value = selectedKlas;
      onKlasifikasiChange();
    }

    function onKlasifikasiChange() {
      const komp = document.getElementById('inp-komponen').value;
      const klas = document.getElementById('inp-klasifikasi').value;
      const found = APP_STATE.bootstrap.rubrik.find(r => r.komponen === komp && r.klasifikasi === klas);
      document.getElementById('inp-panduan-box').innerHTML = `<strong>Ketentuan Bukti Wajib:</strong> ${found ? found.panduan : ''}`;
    }

    function handleSaveIsian(e) {
      e.preventDefault();
      const fileInput = document.getElementById('inp-file');
      const file = fileInput.files[0];

      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          showToast('Ukuran berkas melebihi batas maksimal 5 MB!', 'error');
          return;
        }
        const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        if (!allowed.includes(file.type)) {
          showToast('Format berkas wajib PDF, JPG, atau PNG.', 'error');
          return;
        }
        const reader = new FileReader();
        reader.onload = function(evt) {
          const base64Data = evt.target.result.split(',')[1];
          submitIsianPayload({
            fileName: file.name,
            mimeType: file.type,
            base64: base64Data
          });
        };
        reader.readAsDataURL(file);
      } else {
        submitIsianPayload(null);
      }
    }

    async function submitIsianPayload(fileData) {
      const payload = {
        id_isian: document.getElementById('inp-id-isian').value,
        komponen: document.getElementById('inp-komponen').value,
        jenis_kegiatan: document.getElementById('inp-jenis').value,
        klasifikasi_klaim: document.getElementById('inp-klasifikasi').value,
        nama_kegiatan: document.getElementById('inp-nama-kegiatan').value,
        tanggal_kegiatan: document.getElementById('inp-tanggal').value,
        penyelenggara: document.getElementById('inp-penyelenggara').value,
        keterangan: document.getElementById('inp-keterangan').value,
        fileData: fileData
      };

      setLoading(true, 'Mengunggah berkas & menyimpan ke Drive...');
      try {
        const res = await callGasApi('savePortofolioItem', payload);
        setLoading(false);
        if (!res.success) {
          showToast(res.message, 'error');
          return;
        }
        closeModal('modal-isian');
        showToast(res.message, 'success');
        loadBootstrap();
      } catch (err) {
        setLoading(false);
        showToast('Gagal menyimpan: ' + err.message, 'error');
      }
    }

    function confirmDeleteIsian(idIsian) {
      openConfirm('Hapus Draf Kegiatan', 'Apakah Anda yakin ingin menghapus item kegiatan ini?', false, async () => {
        setLoading(true, 'Menghapus item...');
        try {
          const res = await callGasApi('deletePortofolioItem', { id_isian: idIsian });
          setLoading(false);
          if (!res.success) return showToast(res.message, 'error');
          showToast(res.message, 'success');
          loadBootstrap();
        } catch (err) {
          setLoading(false);
          showToast(err.message, 'error');
        }
      });
    }

    function confirmSubmitFinal() {
      const { bestPractice } = APP_STATE.bootstrap;
      const hasBP = bestPractice && bestPractice.judul_best_practice && (bestPractice.file_id || bestPractice.link_video);
      if (!hasBP) {
        showToast('Naskah Best Practice (atau Link Video GTK Berdedikasi) wajib diisi dan disimpan sebelum Submit Kirim!', 'error');
        switchPesertaSection('bp');
        return;
      }
      const checked = document.getElementById('chk-konfirmasi-portofolio').checked;
      if (!checked) {
        showToast('Silakan centang kotak Konfirmasi Pernyataan Peserta terlebih dahulu.', 'error');
        return;
      }

      openConfirm(
        'Submit & Kirim Final',
        'Naskah Best Practice dan data Portofolio yang sudah dikirim final akan diteruskan ke Tim Verifikator. Lanjutkan?',
        false,
        async () => {
          setLoading(true, 'Mengirim final data...');
          try {
            const res = await callGasApi('submitFinalPortofolio');
            setLoading(false);
            if (!res.success) return showToast(res.message, 'error');
            showToast(res.message, 'success');
            loadBootstrap();
          } catch (err) {
            setLoading(false);
            showToast(err.message, 'error');
          }
        }
      );
    }

    // ==================== PRATINJAU BERKAS PRIVAT ====================
    async function previewFile(idIsian, fileName) {
      setLoading(true, 'Membuka berkas aman dari Drive...');
      try {
        const res = await callGasApi('getPrivateFilePreview', { id_isian: idIsian });
        setLoading(false);
        if (!res.success) {
          showToast(res.message, 'error');
          return;
        }
        document.getElementById('preview-title').textContent = res.fileName || fileName;
        const body = document.getElementById('preview-body');
        const dataUrl = `data:${res.mimeType};base64,${res.base64}`;
        if (res.mimeType === 'application/pdf') {
          body.innerHTML = `<iframe src="${dataUrl}" class="w-full h-[75vh] rounded-xl border"></iframe>`;
        } else {
          body.innerHTML = `<img src="${dataUrl}" class="max-h-[75vh] max-w-full object-contain rounded-xl shadow" />`;
        }
        document.getElementById('modal-preview').classList.remove('hidden');
      } catch (err) {
        setLoading(false);
        showToast('Gagal memuat pratinjau: ' + err.message, 'error');
      }
    }

    // ==================== VERIFIKATOR RENDERING ====================
    function renderVerifikatorQueue() {
      const { queue, rubrik } = APP_STATE.bootstrap;
      const filterStatus = document.getElementById('verif-filter-status').value;
      const search = document.getElementById('verif-search').value.toLowerCase();
      const container = document.getElementById('verif-queue-container');

      const filteredQueue = queue.filter(q => {
        const matchSearch = q.profil.nama.toLowerCase().includes(search) || q.profil.no_kta.includes(search);
        if (!matchSearch) return false;
        if (filterStatus === 'ALL') return true;
        return q.items.some(i => i.status_verifikasi === filterStatus);
      });

      if (filteredQueue.length === 0) {
        container.innerHTML = `<div class="bg-white p-10 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">Tidak ada antrean bukti sesuai filter yang dipilih.</div>`;
        return;
      }

      container.innerHTML = filteredQueue.map(q => {
        const itemsToShow = filterStatus === 'ALL' ? q.items : q.items.filter(i => i.status_verifikasi === filterStatus);
        return `
          <div class="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
            <div class="bg-slate-50 px-6 py-4 border-b flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 class="text-sm font-extrabold text-slate-900">${q.profil.nama} <span class="text-xs font-semibold text-slate-500">(KTA: ${q.profil.no_kta})</span></h3>
                <p class="text-xs text-slate-500 mt-0.5">${q.profil.kategori} • ${q.profil.jenjang} • ${q.profil.asal_sekolah} (${q.profil.utusan_cabang})</p>
                ${q.bestPractice ? `<p class="text-xs text-blue-800 font-semibold mt-1">Best Practice: "${q.bestPractice.judul_best_practice}" ${q.bestPractice.file_id ? `<button onclick="previewBestPracticeFile('${q.profil.id_peserta}')" class="underline ml-1 text-blue-600">[Lihat Naskah]</button>` : ''} ${q.bestPractice.link_video ? `<a href="${q.bestPractice.link_video}" target="_blank" class="underline ml-1 text-rose-600">[Buka Video]</a>` : ''}</p>` : ''}
              </div>
              <span class="px-3 py-1 rounded-full text-xs font-extrabold ${q.status.status_pengiriman === 'TERKIRIM' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'}">
                Status Peserta: ${q.status.status_pengiriman}
              </span>
            </div>
            <div class="p-6 space-y-4">
              ${itemsToShow.map(item => {
                const rubrikOptions = rubrik
                  .filter(r => r.komponen === item.komponen)
                  .map(r => `<option value="${r.klasifikasi}" ${(item.klasifikasi_sah || item.klasifikasi_klaim) === r.klasifikasi ? 'selected' : ''}>${r.klasifikasi} (${r.poin} Poin)</option>`)
                  .join('');

                return `
                  <div class="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/40 space-y-3.5 text-xs">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span class="px-2.5 py-0.5 bg-blue-600 text-white font-bold rounded-md text-[11px]">Komponen ${item.komponen}</span>
                        <span class="ml-2 font-extrabold text-slate-900 text-sm">${item.nama_kegiatan}</span>
                        <p class="text-slate-500 mt-1">Klaim Peserta: <strong class="text-slate-800">${item.klasifikasi_klaim}</strong> | Penyelenggara: ${item.penyelenggara} (${item.tanggal_kegiatan})</p>
                        ${item.keterangan ? `<p class="text-slate-500 mt-0.5">Keterangan: ${item.keterangan}</p>` : ''}
                      </div>
                      <button onclick="previewFile('${item.id_isian}', '${item.nama_file}')"
                        class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-2xs">
                        Buka Dokumen Bukti (v${item.versi_berkas})
                      </button>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-4 gap-3 pt-3.5 border-t border-slate-200">
                      <div>
                        <label class="block font-bold text-slate-700 mb-1">Klasifikasi Sah Rubrik</label>
                        <select id="ver-klas-${item.id_isian}" class="w-full p-2.5 border rounded-xl bg-white">${rubrikOptions}</select>
                      </div>
                      <div>
                        <label class="block font-bold text-slate-700 mb-1">Keputusan Verifikasi</label>
                        <select id="ver-stat-${item.id_isian}" class="w-full p-2.5 border rounded-xl bg-white font-bold">
                          <option value="Diterima" ${item.status_verifikasi === 'Diterima' ? 'selected' : ''}>Diterima</option>
                          <option value="Perlu Revisi" ${item.status_verifikasi === 'Perlu Revisi' ? 'selected' : ''}>Perlu Revisi</option>
                          <option value="Ditolak" ${item.status_verifikasi === 'Ditolak' ? 'selected' : ''}>Ditolak</option>
                        </select>
                      </div>
                      <div>
                        <label class="block font-bold text-slate-700 mb-1">Catatan (Wajib jika Revisi/Tolak)</label>
                        <input type="text" id="ver-cat-${item.id_isian}" value="${item.catatan_verifikator || ''}" placeholder="Catatan pemeriksaan..."
                          class="w-full p-2.5 border rounded-xl bg-white" />
                      </div>
                      <div class="flex flex-col justify-between">
                        <label class="inline-flex items-center gap-1.5 mt-1 cursor-pointer">
                          <input type="checkbox" id="ver-dup-${item.id_isian}" ${item.is_duplikat === 'YA' ? 'checked' : ''} class="rounded text-rose-600" />
                          <span class="text-rose-700 font-bold">Tandai Kegiatan Duplikat</span>
                        </label>
                        <button onclick="submitVerifikasi('${item.id_isian}')"
                          class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl mt-2 shadow-2xs">
                          Simpan Keputusan
                        </button>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('');
    }

    async function submitVerifikasi(idIsian) {
      const payload = {
        id_isian: idIsian,
        klasifikasi_sah: document.getElementById('ver-klas-' + idIsian).value,
        status_verifikasi: document.getElementById('ver-stat-' + idIsian).value,
        catatan: document.getElementById('ver-cat-' + idIsian).value,
        is_duplikat: document.getElementById('ver-dup-' + idIsian).checked
      };

      setLoading(true, 'Menyimpan hasil pemeriksaan...');
      try {
        const res = await callGasApi('saveVerificationDecision', payload);
        setLoading(false);
        if (!res.success) return showToast(res.message, 'error');
        showToast(res.message, 'success');
        loadBootstrap();
      } catch (err) {
        setLoading(false);
        showToast('Error: ' + err.message, 'error');
      }
    }

    // ==================== SUPER ADMIN RENDERING ====================
    function switchAdminTab(tabName) {
      ['rekap', 'jadwal', 'peserta', 'penugasan', 'log'].forEach(t => {
        document.getElementById('adm-panel-' + t).classList.add('hidden');
        const btn = document.getElementById('adm-tab-' + t);
        btn.className = 'adm-tab-btn px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100';
      });
      document.getElementById('adm-panel-' + tabName).classList.remove('hidden');
      document.getElementById('adm-tab-' + tabName).className = 'adm-tab-btn px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white shadow-2xs';
    }

    function renderAdminDashboard() {
      renderAdminRekap();
      const { jadwal, adminData } = APP_STATE.bootstrap;

      const keys = [
        'STATUS_PENGISIAN', 'JADWAL_PENGISIAN_MULAI', 'JADWAL_PENGISIAN_SELESAI',
        'STATUS_REVISI', 'JADWAL_REVISI_MULAI', 'JADWAL_REVISI_SELESAI',
        'STATUS_VERIFIKASI', 'JADWAL_VERIFIKASI_MULAI', 'JADWAL_VERIFIKASI_SELESAI'
      ];
      keys.forEach(k => {
        const el = document.getElementById('set-' + k);
        if (el) el.value = jadwal.raw[k] || '';
      });

      document.getElementById('adm-users-tbody').innerHTML = adminData.users.map(u => `
        <tr>
          <td class="p-3 font-mono">${u.id_pengguna}</td>
          <td class="p-3 font-bold">${u.nama}</td>
          <td class="p-3">${u.username}</td>
          <td class="p-3">${u.peran}</td>
          <td class="p-3">${u.aktif}</td>
        </tr>
      `).join('');

      const verifs = adminData.users.filter(u => u.peran === 'Verifikator');
      document.getElementById('tgs-verif').innerHTML = verifs.map(v => `<option value="${v.id_pengguna}">${v.nama} (${v.username})</option>`).join('');
      document.getElementById('tgs-peserta').innerHTML = '<option value="ALL">Semua Peserta (ALL)</option>' +
        adminData.rekap.map(r => `<option value="${r.id_peserta}">${r.nama} (${r.no_kta})</option>`).join('');

      document.getElementById('adm-tgs-tbody').innerHTML = adminData.penugasan.map(t => `
        <tr>
          <td class="p-3 font-mono">${t.id_penugasan}</td>
          <td class="p-3 font-bold">${t.id_verifikator}</td>
          <td class="p-3">${t.id_peserta}</td>
          <td class="p-3">${t.komponen}</td>
          <td class="p-3">${t.aktif}</td>
        </tr>
      `).join('');

      document.getElementById('adm-log-tbody').innerHTML = adminData.logs.map(l => `
        <tr>
          <td class="p-3 whitespace-nowrap">${l.waktu}</td>
          <td class="p-3 font-bold">${l.id_pengguna}</td>
          <td class="p-3">${l.peran}</td>
          <td class="p-3 font-bold text-blue-700">${l.tindakan}</td>
          <td class="p-3">${l.sasaran}</td>
          <td class="p-3 text-slate-600">${l.alasan}</td>
        </tr>
      `).join('');
    }

    function renderAdminRekap() {
      const katFilter = document.getElementById('adm-filter-kategori').value;
      const list = APP_STATE.bootstrap.adminData.rekap.filter(r => !katFilter || r.kategori === katFilter);

      document.getElementById('adm-rekap-tbody').innerHTML = list.map(r => {
        const isLocked = r.status_kunci === 'TERKUNCI';
        return `
          <tr class="hover:bg-slate-50/80">
            <td class="p-3">
              <div class="font-extrabold text-slate-900">${r.nama}</div>
              <div class="text-[11px] text-slate-500">KTA: ${r.no_kta} | ${r.asal_sekolah} (${r.utusan_cabang})</div>
            </td>
            <td class="p-3">
              <div class="font-bold text-slate-800">${r.kategori}</div>
              <div class="text-[11px] text-slate-500">${r.jenjang}</div>
            </td>
            <td class="p-3 max-w-[200px]">
              <div class="font-semibold text-slate-800 truncate" title="${r.judul_bp || '-'}">${r.judul_bp || '<span class="text-slate-400 italic">Belum diisi</span>'}</div>
              <div class="flex gap-2 mt-0.5 text-[10px]">
                ${r.berkas_bp === 'ADA' ? `<button onclick="previewBestPracticeFile('${r.id_peserta}')" class="text-blue-600 font-bold underline">Naskah</button>` : ''}
                ${r.link_video_bp ? `<a href="${r.link_video_bp}" target="_blank" class="text-rose-600 font-bold underline">Video</a>` : ''}
              </div>
            </td>
            <td class="p-3 text-center font-bold">${r.status_pengiriman}</td>
            <td class="p-3 text-center">${r.menunggu} / ${r.perlu_revisi} / <span class="text-emerald-600 font-bold">${r.diterima}</span> / <span class="text-rose-600">${r.ditolak}</span></td>
            <td class="p-3 text-center">${r.skor_a}</td>
            <td class="p-3 text-center">${r.skor_b}</td>
            <td class="p-3 text-center">${r.skor_c}</td>
            <td class="p-3 text-center">${r.skor_d}</td>
            <td class="p-3 text-center">${r.skor_e}</td>
            <td class="p-3 text-center">${r.skor_f}</td>
            <td class="p-3 text-center font-extrabold text-blue-700 bg-blue-50/50 text-sm">${r.total_skor}</td>
            <td class="p-3 text-center space-y-1">
              <div class="text-[11px] font-bold">${r.status_penilaian}</div>
              <button onclick="toggleLockPeserta('${r.id_peserta}', '${isLocked ? 'TERBUKA' : 'TERKUNCI'}')"
                class="px-2.5 py-1 rounded-lg text-[10px] font-bold ${isLocked ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'}">
                ${isLocked ? 'Buka Kunci' : 'Kunci Nilai'}
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    function toggleLockPeserta(idPeserta, targetState) {
      const isUnlock = targetState === 'TERBUKA';
      openConfirm(
        isUnlock ? 'Buka Kunci Penilaian' : 'Kunci Penilaian Peserta',
        isUnlock ? 'Tuliskan alasan pembukaan kembali kunci penilaian peserta ini (wajib dicatat di log):' : 'Kunci hasil penilaian peserta ini agar tidak dapat diubah lagi?',
        isUnlock,
        async (alasan) => {
          setLoading(true, 'Memperbarui status kunci...');
          try {
            const res = await callGasApi('adminToggleLockPeserta', { id_peserta: idPeserta, lock_state: targetState, alasan: alasan });
            setLoading(false);
            if (!res.success) return showToast(res.message, 'error');
            showToast(res.message, 'success');
            loadBootstrap();
          } catch (err) {
            setLoading(false);
            showToast(err.message, 'error');
          }
        }
      );
    }

    async function handleSaveSettings(e) {
      e.preventDefault();
      const map = {};
      [
        'STATUS_PENGISIAN', 'JADWAL_PENGISIAN_MULAI', 'JADWAL_PENGISIAN_SELESAI',
        'STATUS_REVISI', 'JADWAL_REVISI_MULAI', 'JADWAL_REVISI_SELESAI',
        'STATUS_VERIFIKASI', 'JADWAL_VERIFIKASI_MULAI', 'JADWAL_VERIFIKASI_SELESAI'
      ].forEach(k => {
        map[k] = document.getElementById('set-' + k).value;
      });

      setLoading(true, 'Menyimpan pengaturan jadwal...');
      try {
        const res = await callGasApi('adminUpdateSettings', map);
        setLoading(false);
        if (!res.success) return showToast(res.message, 'error');
        showToast(res.message, 'success');
        loadBootstrap();
      } catch (err) {
        setLoading(false);
        showToast(err.message, 'error');
      }
    }

    async function handleAddPeserta(e) {
      e.preventDefault();
      const data = {
        no_kta: document.getElementById('add-kta').value,
        nama: document.getElementById('add-nama').value,
        asal_sekolah: document.getElementById('add-sekolah').value,
        utusan_cabang: document.getElementById('add-cabang').value,
        kategori: document.getElementById('add-kategori').value,
        jenjang: document.getElementById('add-jenjang').value,
        jabatan: document.getElementById('add-jabatan').value
      };
      setLoading(true, 'Menambahkan peserta...');
      try {
        const res = await callGasApi('adminAddPeserta', data);
        setLoading(false);
        if (!res.success) return showToast(res.message, 'error');
        e.target.reset();
        showToast(res.message, 'success');
        loadBootstrap();
      } catch (err) {
        setLoading(false);
        showToast(err.message, 'error');
      }
    }

    async function handleSyncPeserta() {
      setLoading(true, 'Menyinkronkan akun dari sheet PROFIL_PESERTA...');
      try {
        const res = await callGasApi('adminSyncPesertaAccounts');
        setLoading(false);
        if (!res.success) return showToast(res.message, 'error');
        showToast(res.message, 'success');
        loadBootstrap();
      } catch (err) {
        setLoading(false);
        showToast(err.message, 'error');
      }
    }

    async function handleAddPenugasan(e) {
      e.preventDefault();
      const data = {
        id_verifikator: document.getElementById('tgs-verif').value,
        id_peserta: document.getElementById('tgs-peserta').value,
        komponen: document.getElementById('tgs-komponen').value
      };
      setLoading(true, 'Menyimpan penugasan...');
      try {
        const res = await callGasApi('adminAddPenugasan', data);
        setLoading(false);
        if (!res.success) return showToast(res.message, 'error');
        showToast(res.message, 'success');
        loadBootstrap();
      } catch (err) {
        setLoading(false);
        showToast(err.message, 'error');
      }
    }

    function exportRekapCSV() {
      const rows = APP_STATE.bootstrap.adminData.rekap;
      const headers = ['ID_Peserta', 'No_KTA_PGRI', 'Nama', 'Asal_Sekolah', 'Utusan_Cabang', 'Kategori', 'Jenjang', 'Judul_Best_Practice', 'Berkas_BP', 'Link_Video_BP', 'Status_Pengiriman', 'Menunggu', 'Perlu_Revisi', 'Diterima', 'Ditolak', 'Skor_A', 'Skor_B', 'Skor_C', 'Skor_D', 'Skor_E', 'Skor_F', 'Total_Skor', 'Status_Penilaian', 'Status_Kunci'];
      const csvLines = [headers.join(',')];
      rows.forEach(r => {
        const vals = [
          r.id_peserta, r.no_kta, r.nama, r.asal_sekolah, r.utusan_cabang, r.kategori, r.jenjang,
          r.judul_bp, r.berkas_bp, r.link_video_bp,
          r.status_pengiriman, r.menunggu, r.perlu_revisi, r.diterima, r.ditolak,
          r.skor_a, r.skor_b, r.skor_c, r.skor_d, r.skor_e, r.skor_f, r.total_skor, r.status_penilaian, r.status_kunci
        ].map(v => `"${String(v || '').replace(/"/g, '""')}"`);
        csvLines.push(vals.join(','));
      });
      const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rekap_Portofolio_GTK_Kapuas_2026_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    }

