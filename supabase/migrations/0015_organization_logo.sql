-- NF-FORNERIA-ADM · logo do cliente (organização) na barra de co-branding
--
-- Guardado como data URL base64 direto na coluna (igual o padrão já usado
-- pro certificado A1 no upload pra Focus) — evita depender de um bucket do
-- Supabase Storage configurado no self-hosted. Logo de ícone é pequeno,
-- cabe tranquilo num `text`.

alter table nf_forneria.organizations
  add column logo_url text;
