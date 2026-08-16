-- NF-FORNERIA-ADM · schema inicial
-- Modelo de dados descrito em MVP_Faturamento_Franquias.md (seção 4, v2).
-- Roda num Supabase self-hosted, em schema próprio (nf_forneria) em vez de
-- `public`, para não colidir com outros apps no mesmo Postgres.
--
-- IMPORTANTE (self-hosted): depois de rodar isto, o PostgREST precisa expor
-- o schema `nf_forneria` na API (env PGRST_DB_SCHEMAS do seu stack Supabase,
-- ex: "public,nf_forneria") e a role usada pelo PostgREST precisa de
-- USAGE no schema + SELECT/INSERT/UPDATE/DELETE nas tabelas (ver GRANTs no
-- final deste arquivo). Sem isso a API responde como se as tabelas não
-- existissem, mesmo com a migration aplicada corretamente.

create schema if not exists nf_forneria;

create table nf_forneria.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  primary_color text,
  nfse_mode text not null default 'consolidado'
    check (nfse_mode in ('consolidado', 'separado_por_servico')),
  created_at timestamptz not null default now()
);

create table nf_forneria.units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references nf_forneria.tenants (id) on delete cascade,
  name text not null,
  cnpj text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table nf_forneria.billing_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references nf_forneria.tenants (id) on delete cascade,
  reference_month date not null,
  source_file_name text,
  imported_at timestamptz,
  imported_by uuid references auth.users (id),
  unique (tenant_id, reference_month)
);

create table nf_forneria.invoices (
  id uuid primary key default gen_random_uuid(),
  billing_period_id uuid not null references nf_forneria.billing_periods (id) on delete cascade,
  unit_id uuid not null references nf_forneria.units (id),
  total_value numeric not null default 0,
  payment_method text not null default 'boleto_pix',
  boleto_code text,
  pix_copia_cola text,
  payment_status text not null default 'pendente'
    check (payment_status in ('paga', 'a_vencer', 'atraso', 'pendente')),
  due_date date,
  paid_at timestamptz,
  whatsapp_sent boolean not null default false,
  email_sent boolean not null default false,
  status text not null default 'pendente_emissao'
    check (status in ('pendente_emissao', 'emitida', 'enviada', 'paga', 'atraso', 'falha')),
  created_at timestamptz not null default now()
);

create table nf_forneria.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references nf_forneria.invoices (id) on delete cascade,
  service_type text not null
    check (service_type in ('royalties', 'marketing', 'call_center', 'consolidado')),
  service_code text,
  value numeric not null default 0,
  nfse_number text,
  nfse_status text not null default 'pendente'
    check (nfse_status in ('pendente', 'simulada', 'falha')),
  created_at timestamptz not null default now()
);

create index invoices_billing_period_id_idx on nf_forneria.invoices (billing_period_id);
create index invoices_unit_id_idx on nf_forneria.invoices (unit_id);
create index invoice_items_invoice_id_idx on nf_forneria.invoice_items (invoice_id);
create index units_tenant_id_idx on nf_forneria.units (tenant_id);

-- Row Level Security: por padrão nega tudo; ajustar policies quando o
-- Supabase Auth (login do diretor/admin) estiver configurado (seção 1 do
-- TODO.md). Deixado ligado desde já para não expor dado por engano via
-- anon key enquanto não há policy nenhuma.
alter table nf_forneria.tenants enable row level security;
alter table nf_forneria.units enable row level security;
alter table nf_forneria.billing_periods enable row level security;
alter table nf_forneria.invoices enable row level security;
alter table nf_forneria.invoice_items enable row level security;

-- Acesso da role usada pelo PostgREST (authenticator/anon/authenticated —
-- ajuste o nome da role conforme seu stack self-hosted).
grant usage on schema nf_forneria to anon, authenticated;
grant select, insert, update, delete on all tables in schema nf_forneria to authenticated;
grant select on all tables in schema nf_forneria to anon;
alter default privileges in schema nf_forneria
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema nf_forneria
  grant select on tables to anon;
