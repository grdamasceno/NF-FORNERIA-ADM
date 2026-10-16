-- NF-FORNERIA-ADM · cancelamento de NFS-e pelo sistema
--
-- nfse_status ganha 'cancelada'; guarda quando e por quê (a justificativa
-- também vai pra Focus/prefeitura, aqui fica só como histórico local).

alter table nf_forneria.invoice_items
  drop constraint invoice_items_nfse_status_check,
  add constraint invoice_items_nfse_status_check check (nfse_status in ('pendente', 'autorizada', 'falha', 'cancelada')),
  add column canceled_at timestamptz,
  add column cancel_reason text;
