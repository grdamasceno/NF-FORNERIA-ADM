-- NF-FORNERIA-ADM · elegibilidade de serviço persistida + cadastro completo de units
--
-- Duas mudanças de postura em relação às migrations anteriores:
--
-- 1) `service_eligibility` (nova) e `units` (já existia, vazia) passam a
--    aceitar leitura/escrita da role `anon` — decisão explícita do usuário
--    (2026-08-30) pra destravar o app antes do Supabase Auth existir. Só
--    essas duas: dado financeiro/sensível (`invoices`, `emitter_credentials`,
--    etc.) continua 100% bloqueado. Revisar isso quando o Auth entrar —
--    trocar as policies de `anon` pra `authenticated`.
-- 2) `units` ganha os campos "essenciais" pro cadastro de franquia: contato
--    (telefone, email) e endereço estruturado (logradouro/número/bairro/
--    cep/código do município IBGE/uf) — o `endereco` livre que já existia
--    (seção abaixo) continua servindo de fallback de exibição enquanto o
--    estruturado não é preenchido pela tela de edição.

alter table nf_forneria.units
  add column cidade text,
  add column estado text,
  add column uf text,
  add column endereco text,
  add column logradouro text,
  add column numero text,
  add column bairro text,
  add column cep text,
  add column codigo_municipio text,
  add column telefone text,
  add column email text,
  add column horario text,
  add column imagem text;

create table nf_forneria.service_eligibility (
  service_type text primary key check (service_type in ('royalties', 'marketing', 'call_center')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into nf_forneria.service_eligibility (service_type, enabled) values
  ('call_center', true),
  ('marketing', true),
  ('royalties', true)
on conflict (service_type) do nothing;

-- GRANTs extras pra anon (só nestas duas tabelas — o resto do schema
-- continua só com SELECT, herdado da 0001).
grant insert, update on nf_forneria.units to anon;
grant select, insert, update on nf_forneria.service_eligibility to anon;
grant select, insert, update on nf_forneria.service_eligibility to authenticated;

-- Policies — RLS já estava ligado (0001) sem nenhuma policy; sem isto o
-- GRANT acima não basta, RLS continuaria negando tudo.
create policy "anon read/write units" on nf_forneria.units
  for all to anon using (true) with check (true);

create policy "authenticated read/write units" on nf_forneria.units
  for all to authenticated using (true) with check (true);

alter table nf_forneria.service_eligibility enable row level security;

create policy "anon read/write service_eligibility" on nf_forneria.service_eligibility
  for all to anon using (true) with check (true);

create policy "authenticated read/write service_eligibility" on nf_forneria.service_eligibility
  for all to authenticated using (true) with check (true);
