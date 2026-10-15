-- NF-FORNERIA-ADM · persistência real da fila de faturamento/emissão
--
-- Até aqui `Faturamento.tsx` guardava a fila (valores preenchidos/importados,
-- status de emissão, boleto, pagamento, envio) só em `useState` do React —
-- sumia ao trocar de página ou dar F5 (achado real testando emissão em
-- produção, 2026-10-15). O schema de `billing_periods`/`invoices`/
-- `invoice_items` já existe desde a 0001 (seção 4 do MD v2), mas ficou sem
-- RLS/policy (0007 deixou de propósito, "nenhuma tela ainda escreve nelas de
-- verdade") e sem os campos que a emissão REAL (não simulada) precisa
-- guardar (número da nota já existia, mas não URL do DANFSe/erro/emissor).

-- Um invoice por unidade×competência (upsert nessa chave evita duplicar ao
-- reimportar/repreencher o mesmo mês).
alter table nf_forneria.invoices
  add constraint invoices_billing_period_unit_unique unique (billing_period_id, unit_id),
  add column if not exists boleto_file_name text;

-- Um invoice_item por invoice×serviço (upsert nessa chave). `nfse_status`
-- era só pendente/simulada/falha (de quando tudo era simulado) — agora
-- reflete o retorno real da Focus NFe.
alter table nf_forneria.invoice_items
  add constraint invoice_items_invoice_service_unique unique (invoice_id, service_type),
  drop constraint invoice_items_nfse_status_check,
  add constraint invoice_items_nfse_status_check check (nfse_status in ('pendente', 'autorizada', 'falha')),
  add column if not exists url_danfse text,
  add column if not exists error_message text,
  add column if not exists emitter_id uuid references nf_forneria.emitters (id);

create policy "billing_periods: por organização (via tenant)" on nf_forneria.billing_periods for all to authenticated
  using (
    nf_forneria.is_superadmin()
    or tenant_id in (select id from nf_forneria.tenants where organization_id = nf_forneria.current_organization())
  )
  with check (
    nf_forneria.is_superadmin()
    or tenant_id in (select id from nf_forneria.tenants where organization_id = nf_forneria.current_organization())
  );

create policy "invoices: por organização (via unit -> tenant)" on nf_forneria.invoices for all to authenticated
  using (
    nf_forneria.is_superadmin()
    or unit_id in (
      select u.id from nf_forneria.units u
      join nf_forneria.tenants t on t.id = u.tenant_id
      where t.organization_id = nf_forneria.current_organization()
    )
  )
  with check (
    nf_forneria.is_superadmin()
    or unit_id in (
      select u.id from nf_forneria.units u
      join nf_forneria.tenants t on t.id = u.tenant_id
      where t.organization_id = nf_forneria.current_organization()
    )
  );

create policy "invoice_items: por organização (via invoice -> unit -> tenant)" on nf_forneria.invoice_items for all to authenticated
  using (
    nf_forneria.is_superadmin()
    or invoice_id in (
      select i.id from nf_forneria.invoices i
      join nf_forneria.units u on u.id = i.unit_id
      join nf_forneria.tenants t on t.id = u.tenant_id
      where t.organization_id = nf_forneria.current_organization()
    )
  )
  with check (
    nf_forneria.is_superadmin()
    or invoice_id in (
      select i.id from nf_forneria.invoices i
      join nf_forneria.units u on u.id = i.unit_id
      join nf_forneria.tenants t on t.id = u.tenant_id
      where t.organization_id = nf_forneria.current_organization()
    )
  );

grant select, insert, update, delete on nf_forneria.billing_periods, nf_forneria.invoices, nf_forneria.invoice_items to authenticated;
