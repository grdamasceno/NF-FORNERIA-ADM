-- NF-FORNERIA-ADM · conteúdo do boleto anexado (pra visualizar/baixar)
--
-- Até aqui só `boleto_file_name` era salvo — o arquivo em si nunca era
-- guardado, então não tinha como abrir de novo. Fica como data URL base64
-- direto na coluna (mesmo raciocínio do logo/certificado: o Storage do
-- self-hosted está com o passo de criar bucket quebrado). A listagem de
-- faturas NÃO seleciona essa coluna — só é lida sob demanda ao clicar em
-- Ver/Baixar.

alter table nf_forneria.invoices add column boleto_file_data text;
