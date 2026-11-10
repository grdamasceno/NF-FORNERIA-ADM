-- NF-FORNERIA-ADM · observação por nota (ex: desconto) que entra na
-- descrição da NFS-e no momento da emissão.

alter table nf_forneria.invoice_items
  add column observacao text;
