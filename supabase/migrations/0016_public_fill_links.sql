-- NF-FORNERIA-ADM · links públicos de preenchimento (sem login)
--
-- Primeira superfície de escrita sem autenticação do app. Mitigação: o
-- token (uuid, ~122 bits de entropia) é o único jeito de achar o link — não
-- existe policy nenhuma de leitura/escrita por anon nessa tabela nem nas de
-- faturamento. Todo acesso público passa pela Edge Function
-- `public-fill-values`, que usa service_role e valida token/expiração/
-- revogação antes de ler ou gravar qualquer coisa. `authenticated` só pode
-- criar/listar/revogar links da própria organização (pra gerar o link);
-- nunca usa o token em si pra acessar dado.

create table nf_forneria.public_fill_links (
  token uuid primary key default gen_random_uuid(),
  organization_id uuid not null references nf_forneria.organizations (id) on delete cascade,
  competencia date not null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked boolean not null default false
);

alter table nf_forneria.public_fill_links enable row level security;

create policy "public_fill_links: por organização" on nf_forneria.public_fill_links for all to authenticated
  using (
    nf_forneria.is_superadmin()
    or organization_id = nf_forneria.current_organization()
  )
  with check (
    nf_forneria.is_superadmin()
    or organization_id = nf_forneria.current_organization()
  );

grant select, insert, update on nf_forneria.public_fill_links to authenticated;
