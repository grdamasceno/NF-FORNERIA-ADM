-- NF-FORNERIA-ADM · SMTP próprio do app (não depende do GOTRUE_SMTP_* do
-- self-hosted, que na prática não estava entregando o e-mail de reset).
--
-- Mesma lógica de sigilo de `emitter_credentials`: tabela SEM grant nenhum
-- pra anon/authenticated — só a service_role (dentro das Edge Functions
-- smtp-settings/manage-users/request-password-reset) lê/escreve. A tela de
-- Configurações nunca recebe a senha de volta, só confirma "configurado".

create table nf_forneria.smtp_settings (
  organization_id uuid primary key references nf_forneria.organizations (id) on delete cascade,
  host text not null,
  port integer not null,
  username text not null,
  password text not null,
  from_email text not null,
  from_name text,
  use_tls boolean not null default true,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table nf_forneria.smtp_settings enable row level security;
revoke all on nf_forneria.smtp_settings from anon, authenticated, public;
