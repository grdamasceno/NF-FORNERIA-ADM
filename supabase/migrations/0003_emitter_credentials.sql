-- NF-FORNERIA-ADM · credenciais Focus NFe + dados fiscais do emissor
--
-- `emitter_credentials` guarda os tokens da Focus NFe por (emitter, ambiente)
-- — homologação e produção têm token diferente. Essa tabela é SENSÍVEL:
-- diferente do resto do schema, ela NÃO recebe grant nenhum pra
-- `anon`/`authenticated` (nem via os defaults herdados da 0001 — por isso o
-- REVOKE explícito abaixo). Só a service_role (usada pela Edge Function
-- `supabase/functions/emit-nfse`, nunca pelo browser) consegue ler.
--
-- `emitters` ganha `inscricao_municipal` e `codigo_municipio` (dados do
-- prestador exigidos pela API — não são segredo, só cadastro fiscal, por
-- isso ficam na tabela pública normal). `emitter_mapping` ganha
-- `item_lista_servico` (código LC 116/2003) e `iss_retido`, que dependem da
-- combinação marca+serviço, não só do emissor — confirmar com o contador
-- antes de preencher de verdade (mesma ressalva da seção 3 do MD).

alter table nf_forneria.emitters
  add column inscricao_municipal text,
  add column codigo_municipio text;

alter table nf_forneria.emitter_mapping
  add column item_lista_servico text,
  add column iss_retido boolean not null default false;

create table nf_forneria.emitter_credentials (
  id uuid primary key default gen_random_uuid(),
  emitter_id uuid not null references nf_forneria.emitters (id) on delete cascade,
  ambiente text not null check (ambiente in ('homologacao', 'producao')),
  token text not null,
  created_at timestamptz not null default now(),
  unique (emitter_id, ambiente)
);

alter table nf_forneria.emitter_credentials enable row level security;
-- Sem CREATE POLICY de propósito: RLS ligado + zero policies + zero grants
-- = ninguém além da service_role (que ignora RLS) consegue ler isto pela API.
revoke all on nf_forneria.emitter_credentials from anon, authenticated, public;
