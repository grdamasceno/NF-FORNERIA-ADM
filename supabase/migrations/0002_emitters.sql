-- NF-FORNERIA-ADM · CNPJs emissores + mapeamento marca×serviço
-- Espelha o que já está funcional no frontend em memória
-- (src/context/SettingsContext.tsx: `emitters` + `emitterMapping`),
-- configurável na tela Configurações e usado na emissão em Faturamento.
--
-- Nuance de modelagem: neste schema, "marca" (Forneria / The Duck) É o
-- `tenant_id` (ver 0001_init_schema.sql — `tenants.name`). Mas um mesmo CNPJ
-- pode emitir pelas duas marcas ao mesmo tempo (ex: no exemplo real que
-- gerou este seed, "Forneria Original Callcenter LTDA" emite o Call Center
-- de Forneria E de The Duck) — por isso `emitters` não pertence a um único
-- tenant; só `emitter_mapping` é que é por tenant (marca) + serviço.
--
-- IMPORTANTE (self-hosted): mesma observação da 0001 sobre PGRST_DB_SCHEMAS
-- — já deve estar resolvido se a 0001 já está rodando, nada novo a fazer aí.

create table nf_forneria.emitters (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null,
  cnpj text not null,
  created_at timestamptz not null default now(),
  unique (cnpj)
);

-- 1 emissor por (tenant/marca, serviço). `emitter_id` nulo = serviço sem
-- CNPJ configurado ainda (não entra na emissão — ver
-- src/pages/Faturamento.tsx `eligibleServices`).
create table nf_forneria.emitter_mapping (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references nf_forneria.tenants (id) on delete cascade,
  service_type text not null
    check (service_type in ('royalties', 'marketing', 'call_center')),
  emitter_id uuid references nf_forneria.emitters (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, service_type)
);

-- Registro histórico de qual CNPJ emitiu cada NFS-e — snapshot no momento da
-- emissão, independente do `emitter_mapping` mudar depois (mesmo espírito do
-- `emitter` guardado em cada `EmittedItem` no frontend).
alter table nf_forneria.invoice_items
  add column emitter_id uuid references nf_forneria.emitters (id);

create index emitter_mapping_tenant_id_idx on nf_forneria.emitter_mapping (tenant_id);
create index invoice_items_emitter_id_idx on nf_forneria.invoice_items (emitter_id);

alter table nf_forneria.emitters enable row level security;
alter table nf_forneria.emitter_mapping enable row level security;

grant usage on schema nf_forneria to anon, authenticated;
grant select, insert, update, delete on nf_forneria.emitters, nf_forneria.emitter_mapping to authenticated;
grant select on nf_forneria.emitters, nf_forneria.emitter_mapping to anon;
