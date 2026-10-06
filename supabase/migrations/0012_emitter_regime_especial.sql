-- NF-FORNERIA-ADM · regime especial de tributação do emissor
--
-- A Focus NFe diferencia Simples Nacional ME/EPP de MEI pelo campo
-- `regime_especial_tributacao` (1 microempresa municipal, 2 estimativa,
-- 3 sociedade de profissionais, 4 cooperativa, 5 MEI, 6 ME/EPP Simples
-- Nacional). Sem ele o emissor de Simples era tratado como MEI (E0313).
-- Null = não informar (ex: Regime Normal / Lucro Presumido).

alter table nf_forneria.emitters
  add column regime_especial_tributacao text
  check (regime_especial_tributacao in ('1', '2', '3', '4', '5', '6'));
