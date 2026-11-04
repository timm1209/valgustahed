-- Valgustähed: kasutajad, rollid ja tehtud tööd Supabase'is
-- Käivita: Supabase → SQL Editor → New query → kleebi kogu fail → Run.
-- Võib käivitada ka korduvalt (olemasolevad andmed jäävad alles).

-- ===================== KASUTAJAD =====================
create table if not exists public.kasutajad (
  id       uuid primary key references auth.users (id) on delete cascade,
  email    text not null default '',
  nimi     text not null default '',
  roll     text not null default 'kasutaja' check (roll in ('admin', 'kasutaja')),
  aktiivne boolean not null default true,
  loodud   timestamptz not null default now()
);

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
          case when new.raw_user_meta_data ->> 'roll' = 'admin' then 'admin' else 'kasutaja' end)
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

-- kõik aktiivsed kasutajad näevad, lisavad, muudavad ja kustutavad kõiki töid
alter table public.tood enable row level security;
drop policy if exists "tood lugemine"    on public.tood;
drop policy if exists "tood lisamine"    on public.tood;
drop policy if exists "tood muutmine"    on public.tood;
drop policy if exists "tood kustutamine" on public.tood;
create policy "tood lugemine"    on public.tood for select to authenticated using (public.on_aktiivne());
create policy "tood lisamine"    on public.tood for insert to authenticated with check (public.on_aktiivne());
create policy "tood muutmine"    on public.tood for update to authenticated using (public.on_aktiivne()) with check (public.on_aktiivne());
create policy "tood kustutamine" on public.tood for delete to authenticated using (public.on_aktiivne());
revoke all on public.tood from anon;
grant select, insert, update, delete on public.tood to authenticated;

-- ===================== ESIMENE ADMIN =====================
-- Pärast seda, kui oled oma kasutaja loonud (Authentication → Users → Add user), tee end adminiks:
--   update public.kasutajad set roll = 'admin', nimi = 'Timo Pajo' where email = 'sinu@epost.ee';
