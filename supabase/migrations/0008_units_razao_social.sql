-- NF-FORNERIA-ADM · razão social da unidade (tomador da NFS-e)
--
-- `units.name` é o nome fantasia (ex: "Bangu"), usado na tela de Franquias.
-- Pra emissão de NFS-e, o tomador precisa da razão social completa da
-- empresa (ex: "Forneria Bangu Pizzaria e Restaurante LTDA - EPP"), que é
-- um dado distinto e não existia em lugar nenhum do schema até agora.
-- Início do levantamento de dado fiscal do tomador (ver TODO.md → seção 8).

alter table nf_forneria.units
  add column razao_social text;
