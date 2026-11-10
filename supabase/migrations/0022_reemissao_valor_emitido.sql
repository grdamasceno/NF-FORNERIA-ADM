-- NF-FORNERIA-ADM · reemissão após cancelamento + valor realmente emitido
--
-- emission_seq: sobe a cada cancelamento; a ref na Focus ganha o sufixo
--   -r{seq} (a ref cancelada não pode ser reusada).
-- emitted_value: valor com que a NFS-e autorizada saiu, pra detectar nota
--   emitida com valor diferente do atual do faturamento.
-- Notas já autorizadas antes disso ficam com emitted_value nulo (preencha
-- manualmente se quiser o alerta de divergência nelas).

alter table nf_forneria.invoice_items
  add column emission_seq integer not null default 1,
  add column emitted_value numeric;
