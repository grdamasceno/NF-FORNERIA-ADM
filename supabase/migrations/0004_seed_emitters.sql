-- NF-FORNERIA-ADM · seed dos tenants/emitters/mapeamento reais
--
-- Espelha o cenário real já hardcoded como default em
-- src/context/SettingsContext.tsx (DEFAULT_EMITTERS/DEFAULT_MAPPING), agora
-- gravado de verdade no Supabase. Nenhum segredo aqui — razão social e CNPJ
-- são dado de cadastro público. Tokens de homologação/produção vão à parte,
-- direto em `emitter_credentials` (ver README de
-- supabase/functions/emit-nfse), nunca por aqui.
--
-- Idempotente: pode rodar mais de uma vez sem duplicar.

-- 1) Tenants (marcas) — sem unique constraint em `name` (migration 0001),
-- por isso o guard via `where not exists` em vez de `on conflict`.
insert into nf_forneria.tenants (name)
select v.name from (values ('Forneria Original'), ('The Duck')) as v(name)
where not exists (select 1 from nf_forneria.tenants t where t.name = v.name);

-- 2) Emitters (CNPJs emissores) — já tem unique(cnpj) da migration 0002.
insert into nf_forneria.emitters (razao_social, cnpj) values
  ('Forneria Original Franquias LTDA', '34.104.005/0001-86'),
  ('The Duck Franquias LTDA', '62.588.733/0001-46'),
  ('Forneria Original Callcenter LTDA', '34.104.037/0001-81')
on conflict (cnpj) do nothing;

-- 3) Emitter mapping (marca x serviço -> emissor): Royalties com CNPJ por
-- marca, Call Center compartilhado pelas duas. Marketing fica de fora por
-- enquanto (sem emissor definido ainda).
insert into nf_forneria.emitter_mapping (tenant_id, service_type, emitter_id)
select t.id, m.service_type, e.id
from (values
  ('Forneria Original', 'royalties',   '34.104.005/0001-86'),
  ('The Duck',          'royalties',   '62.588.733/0001-46'),
  ('Forneria Original', 'call_center', '34.104.037/0001-81'),
  ('The Duck',          'call_center', '34.104.037/0001-81')
) as m(tenant_name, service_type, emitter_cnpj)
join nf_forneria.tenants  t on t.name = m.tenant_name
join nf_forneria.emitters e on e.cnpj = m.emitter_cnpj
on conflict (tenant_id, service_type) do update set emitter_id = excluded.emitter_id;
