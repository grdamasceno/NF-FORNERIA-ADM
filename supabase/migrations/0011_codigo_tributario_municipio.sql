-- NF-FORNERIA-ADM · código de tributação municipal por marca×serviço
--
-- Achado real testando a emissão (2026-09-02, resposta do suporte da Focus
-- NFe pro erro E0312): além do código de tributação NACIONAL
-- (`item_lista_servico`, já existia), o Ambiente Nacional de NFS-e também
-- pode exigir o código de tributação MUNICIPAL (`codigo_tributario_municipio`
-- no payload da Focus) — um código diferente, específico de cada prefeitura,
-- que não tem relação numérica com o nacional. Mesma lógica do
-- `item_lista_servico`: depende de cada marca×serviço, então fica em
-- `emitter_mapping`, editável pela tela de Configurações.

alter table nf_forneria.emitter_mapping
  add column codigo_tributario_municipio text;
