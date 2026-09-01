-- NF-FORNERIA-ADM · regime tributário do emissor (Simples Nacional ou não)
--
-- A Edge Function `emit-nfse` mandava `optante_simples_nacional: true` FIXO
-- no payload da Focus NFe, independente do emissor de verdade -- bug real
-- achado testando a emissão da Forneria Bangu (Focus rejeitou com E0160:
-- "situação perante o Simples Nacional... não está de acordo com o
-- cadastro"). A FORNERIA ORIGINAL FRANQUIAS LTDA está cadastrada como
-- "Regime Normal" no painel da Focus (confirmado pelo usuário), não Simples
-- Nacional -- por isso o default aqui é `false`. Ajustar depois se algum dos
-- outros 2 emissores for Simples Nacional de verdade.

alter table nf_forneria.emitters
  add column optante_simples_nacional boolean not null default false;
