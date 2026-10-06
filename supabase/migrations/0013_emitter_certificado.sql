-- NF-FORNERIA-ADM · id da empresa na Focus NFe + validade do certificado digital
--
-- `focus_empresa_id` é o id da empresa no painel da Focus (usado no
-- PUT /v2/empresas/{id} pra subir o certificado). `certificado_valido_ate` é
-- só a data de vencimento devolvida pela Focus — o arquivo .pfx e a senha
-- nunca são gravados no banco.

alter table nf_forneria.emitters
  add column focus_empresa_id text,
  add column certificado_valido_ate timestamptz;
