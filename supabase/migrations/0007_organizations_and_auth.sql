-- NF-FORNERIA-ADM · organizações, perfis de usuário e RLS real por papel
--
-- Introduz o nível acima de `tenants` (marca): `organizations` (a empresa
-- cliente da OnChannel — hoje só "Grupo Original", contendo as marcas
-- Forneria Original e The Duck). Dois papéis:
-- - `admin`: usa tudo, mas só vê/mexe na própria organização.
-- - `superadmin`: enxerga e administra todas as organizações (multi-cliente,
--   pensando em outros grupos futuros).
--
-- Isso substitui as policies "abertas pra anon" da migration 0005 em
-- `units`/`service_eligibility` (removidas aqui) por RLS de verdade restrita
-- a `authenticated`, filtrada por organização. **A partir desta migration,
-- o app exige login — sem sessão, nada carrega.**
--
-- `billing_periods`/`invoices`/`invoice_items`/`emitter_credentials` não
-- ganham policy nesta migration (continuam bloqueadas por padrão) — nenhuma
-- tela ainda escreve nelas de verdade; ver TODO.md quando isso mudar.

create table nf_forneria.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

insert into nf_forneria.organizations (name) values ('Grupo Original');

alter table nf_forneria.tenants add column organization_id uuid references nf_forneria.organizations (id);
update nf_forneria.tenants set organization_id = (select id from nf_forneria.organizations where name = 'Grupo Original');
alter table nf_forneria.tenants alter column organization_id set not null;

alter table nf_forneria.emitters add column organization_id uuid references nf_forneria.organizations (id);
update nf_forneria.emitters set organization_id = (select id from nf_forneria.organizations where name = 'Grupo Original');
alter table nf_forneria.emitters alter column organization_id set not null;

-- `service_eligibility` era só (service_type) global — vira (organization_id,
-- service_type), uma linha por organização.
alter table nf_forneria.service_eligibility add column organization_id uuid references nf_forneria.organizations (id);
update nf_forneria.service_eligibility set organization_id = (select id from nf_forneria.organizations where name = 'Grupo Original');
alter table nf_forneria.service_eligibility alter column organization_id set not null;
alter table nf_forneria.service_eligibility drop constraint service_eligibility_pkey;
alter table nf_forneria.service_eligibility add primary key (organization_id, service_type);

-- Perfil de cada usuário do Supabase Auth (criado via Studio → Authentication
-- → Add user; o perfil em si é inserido à parte, ver README da migration).
create table nf_forneria.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'superadmin')),
  organization_id uuid references nf_forneria.organizations (id),
  created_at timestamptz not null default now(),
  constraint admin_requires_organization check (role = 'superadmin' or organization_id is not null)
);

-- Funções auxiliares (security definer: leem `profiles` sem re-disparar RLS
-- de `profiles`, evitando recursão nas policies que as usam).
create or replace function nf_forneria.current_role()
returns text language sql stable security definer set search_path = nf_forneria as $$
  select role from nf_forneria.profiles where id = auth.uid()
$$;

create or replace function nf_forneria.current_organization()
returns uuid language sql stable security definer set search_path = nf_forneria as $$
  select organization_id from nf_forneria.profiles where id = auth.uid()
$$;

create or replace function nf_forneria.is_superadmin()
returns boolean language sql stable security definer set search_path = nf_forneria as $$
  select coalesce((select role = 'superadmin' from nf_forneria.profiles where id = auth.uid()), false)
$$;

-- Remove as policies abertas pra anon (migration 0005) — a partir de agora é
-- authenticated + regra de organização.
drop policy if exists "anon read/write units" on nf_forneria.units;
drop policy if exists "anon read/write service_eligibility" on nf_forneria.service_eligibility;
drop policy if exists "authenticated read/write units" on nf_forneria.units;
drop policy if exists "authenticated read/write service_eligibility" on nf_forneria.service_eligibility;
revoke insert, update on nf_forneria.units from anon;
revoke select, insert, update on nf_forneria.service_eligibility from anon;

alter table nf_forneria.organizations enable row level security;
alter table nf_forneria.profiles enable row level security;

create policy "profiles: usuário vê o próprio" on nf_forneria.profiles for select to authenticated
  using (id = auth.uid() or nf_forneria.is_superadmin());

create policy "organizations: superadmin tudo, admin só a própria" on nf_forneria.organizations for select to authenticated
  using (nf_forneria.is_superadmin() or id = nf_forneria.current_organization());
create policy "organizations: só superadmin escreve" on nf_forneria.organizations for all to authenticated
  using (nf_forneria.is_superadmin()) with check (nf_forneria.is_superadmin());

create policy "tenants: por organização" on nf_forneria.tenants for all to authenticated
  using (nf_forneria.is_superadmin() or organization_id = nf_forneria.current_organization())
  with check (nf_forneria.is_superadmin() or organization_id = nf_forneria.current_organization());

create policy "emitters: por organização" on nf_forneria.emitters for all to authenticated
  using (nf_forneria.is_superadmin() or organization_id = nf_forneria.current_organization())
  with check (nf_forneria.is_superadmin() or organization_id = nf_forneria.current_organization());

create policy "service_eligibility: por organização" on nf_forneria.service_eligibility for all to authenticated
  using (nf_forneria.is_superadmin() or organization_id = nf_forneria.current_organization())
  with check (nf_forneria.is_superadmin() or organization_id = nf_forneria.current_organization());

create policy "units: por organização (via tenant)" on nf_forneria.units for all to authenticated
  using (
    nf_forneria.is_superadmin()
    or tenant_id in (select id from nf_forneria.tenants where organization_id = nf_forneria.current_organization())
  )
  with check (
    nf_forneria.is_superadmin()
    or tenant_id in (select id from nf_forneria.tenants where organization_id = nf_forneria.current_organization())
  );

create policy "emitter_mapping: por organização (via tenant)" on nf_forneria.emitter_mapping for all to authenticated
  using (
    nf_forneria.is_superadmin()
    or tenant_id in (select id from nf_forneria.tenants where organization_id = nf_forneria.current_organization())
  )
  with check (
    nf_forneria.is_superadmin()
    or tenant_id in (select id from nf_forneria.tenants where organization_id = nf_forneria.current_organization())
  );

grant select, insert, update on nf_forneria.organizations, nf_forneria.profiles to authenticated;
grant select, insert, update on nf_forneria.tenants, nf_forneria.emitters, nf_forneria.service_eligibility to authenticated;
