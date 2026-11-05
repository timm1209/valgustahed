-- Valgustähed: kasutajad, rollid ja tehtud tööd Supabase'is
-- Käivita: Supabase → SQL Editor → New query → kleebi kogu fail → Run.
-- Võib käivitada ka korduvalt (olemasolevad andmed jäävad alles).

-- ===================== KASUTAJAD =====================
create table if not exists public.kasutajad (
  id       uuid primary key references auth.users (id) on delete cascade,
  email    text not null default '',
  nimi     text not null default '',
  roll     text not null default 'kasutaja',
  aktiivne boolean not null default true,
  loodud   timestamptz not null default now()
);

-- rollid: admin, kasutaja, müük (muuk)
alter table public.kasutajad drop constraint if exists kasutajad_roll_check;
alter table public.kasutajad add constraint kasutajad_roll_check check (roll in ('admin', 'kasutaja', 'muuk'));

-- kas praegune kasutaja on aktiivne / admin (security definer: ei sõltu tabeli enda reeglitest)
create or replace function public.on_aktiivne() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.kasutajad where id = auth.uid() and aktiivne);
$$;
create or replace function public.on_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.kasutajad where id = auth.uid() and aktiivne and roll = 'admin');
$$;

-- uue Supabase'i kasutaja juurde tehakse kohe kasutaja rida (nimi ja roll tulevad loomisel kaasa antud andmetest)
create or replace function public.uus_kasutaja() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.kasutajad (id, email, nimi, roll)
  values (new.id, coalesce(new.email, ''),
          coalesce(nullif(new.raw_user_meta_data ->> 'nimi', ''), split_part(coalesce(new.email, ''), '@', 1)),
          case when new.raw_user_meta_data ->> 'roll' in ('admin', 'muuk') then new.raw_user_meta_data ->> 'roll' else 'kasutaja' end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists uus_kasutaja on auth.users;
create trigger uus_kasutaja after insert on auth.users for each row execute function public.uus_kasutaja();

-- juba olemasolevad Supabase'i kasutajad saavad ka rea
insert into public.kasutajad (id, email, nimi)
select id, coalesce(email, ''), split_part(coalesce(email, ''), '@', 1) from auth.users
on conflict (id) do nothing;

alter table public.kasutajad enable row level security;
drop policy if exists "kasutajad lugemine" on public.kasutajad;
drop policy if exists "kasutajad admin muudab" on public.kasutajad;
create policy "kasutajad lugemine" on public.kasutajad for select to authenticated using (id = auth.uid() or public.on_aktiivne());
create policy "kasutajad admin muudab" on public.kasutajad for update to authenticated using (public.on_admin()) with check (public.on_admin());
-- kasutajaid luuakse ja kustutatakse serverifunktsiooniga "kasutajad" (vt supabase/functions/kasutajad/index.ts)
revoke all on public.kasutajad from anon;
grant select, update on public.kasutajad to authenticated;

-- ===================== GRUPPIDE ÕIGUSED =====================
-- mida iga grupp näeb ja teha tohib (admin näeb ja tohib alati kõike); muudab admin rakenduses: Kasutajad ja õigused → Õigused
create table if not exists public.rollid (
  roll    text primary key check (roll in ('admin', 'kasutaja', 'muuk')),
  nimi    text not null default '',
  oigused jsonb not null default '{}'::jsonb
);
insert into public.rollid (roll, nimi, oigused) values
  ('admin', 'Admin', '{}'::jsonb),
  ('kasutaja', 'Kasutaja', '{"p_sisend":true,"p_tellimus":true,"p_osad":true,"p_esipind":true,"p_kulg":true,"p_tagapind":true,"p_valgustus":true,"p_raam":true,"p_avad":true,"p_led":true,"p_profiil":true,"p_raport":true,"p_eksport":true,"t_dxf":true,"t_projekt":true,"t_tood_vaata":true,"t_tood_salvesta":true,"t_tood_kustuta":true,"t_tooriistad":true,"t_3d":true,"t_kliendi_pdf":true,"t_mall":true}'::jsonb),
  ('muuk', 'Müük', '{"p_sisend":true,"p_tellimus":true,"p_osad":true,"p_esipind":true,"p_kulg":true,"p_tagapind":true,"p_valgustus":true,"p_raam":false,"p_avad":false,"p_led":false,"p_profiil":false,"p_raport":true,"p_eksport":false,"t_dxf":true,"t_projekt":false,"t_tood_vaata":true,"t_tood_salvesta":true,"t_tood_kustuta":false,"t_tooriistad":false,"t_3d":true,"t_kliendi_pdf":true,"t_mall":false}'::jsonb)
on conflict (roll) do nothing;

-- kas praegusel kasutajal on õigus k (admin: alati)
create or replace function public.on_oigus(k text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.kasutajad u left join public.rollid r on r.roll = u.roll
    where u.id = auth.uid() and u.aktiivne
      and (u.roll = 'admin' or coalesce((r.oigused ->> k)::boolean, false))
  );
$$;

alter table public.rollid enable row level security;
drop policy if exists "rollid lugemine" on public.rollid;
drop policy if exists "rollid admin muudab" on public.rollid;
create policy "rollid lugemine" on public.rollid for select to authenticated using (public.on_aktiivne());
create policy "rollid admin muudab" on public.rollid for update to authenticated using (public.on_admin()) with check (public.on_admin());
revoke all on public.rollid from anon;
grant select, update on public.rollid to authenticated;

-- ===================== TÖÖD =====================
create table if not exists public.tood (
  id         uuid primary key default gen_random_uuid(),
  nimi       text not null default '',
  tellimus   text not null default '',
  kuju_arv   integer not null default 0,
  data       jsonb not null,                                   -- kogu töö (sama mis projektifail)
  loodud     timestamptz not null default now(),
  muudetud   timestamptz not null default now(),
  loonud_uid uuid default auth.uid(),
  loonud     text default (auth.jwt() ->> 'email'),
  muutnud    text default (auth.jwt() ->> 'email')
);
alter table public.tood add column if not exists loonud_nimi text not null default '';
alter table public.tood add column if not exists muutnud_uid uuid;
alter table public.tood add column if not exists muutnud_nimi text not null default '';
create index if not exists tood_muudetud_idx on public.tood (muudetud desc);

-- tegija ja muutja nimi tulevad Valgustähtede kasutajast, aeg serverist
create or replace function public.tood_tegija() returns trigger
language plpgsql security definer set search_path = public as $$
declare k record;
begin
  select nimi, email into k from public.kasutajad where id = auth.uid();
  if tg_op = 'INSERT' then
    new.loodud := now();
    new.loonud_uid := auth.uid();
    new.loonud := coalesce(k.email, auth.jwt() ->> 'email', '');
    new.loonud_nimi := coalesce(k.nimi, '');
  else
    new.loodud := old.loodud; new.loonud_uid := old.loonud_uid; new.loonud := old.loonud; new.loonud_nimi := old.loonud_nimi;
  end if;
  new.muudetud := now();
  new.muutnud_uid := auth.uid();
  new.muutnud := coalesce(k.email, auth.jwt() ->> 'email', '');
  new.muutnud_nimi := coalesce(k.nimi, '');
  return new;
end $$;
drop trigger if exists tood_muudetud on public.tood;
drop trigger if exists tood_tegija on public.tood;
create trigger tood_tegija before insert or update on public.tood for each row execute function public.tood_tegija();

-- tööd: vaatamine, salvestamine ja kustutamine vastavalt grupi õigustele (admin: kõik)
alter table public.tood enable row level security;
drop policy if exists "tood lugemine"    on public.tood;
drop policy if exists "tood lisamine"    on public.tood;
drop policy if exists "tood muutmine"    on public.tood;
drop policy if exists "tood kustutamine" on public.tood;
create policy "tood lugemine"    on public.tood for select to authenticated using (public.on_oigus('t_tood_vaata') or public.on_oigus('t_tood_salvesta'));
create policy "tood lisamine"    on public.tood for insert to authenticated with check (public.on_oigus('t_tood_salvesta'));
create policy "tood muutmine"    on public.tood for update to authenticated using (public.on_oigus('t_tood_salvesta')) with check (public.on_oigus('t_tood_salvesta'));
create policy "tood kustutamine" on public.tood for delete to authenticated using (public.on_oigus('t_tood_kustuta'));
revoke all on public.tood from anon;
grant select, insert, update, delete on public.tood to authenticated;

-- ===================== ESIMENE ADMIN =====================
-- Pärast seda, kui oled oma kasutaja loonud (Authentication → Users → Add user), tee end adminiks:
--   update public.kasutajad set roll = 'admin', nimi = 'Timo Pajo' where email = 'sinu@epost.ee';
