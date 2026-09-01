-- NF-FORNERIA-ADM · grant de schema pra service_role
--
-- A migration 0001 deu `usage on schema nf_forneria` só pra `anon`/
-- `authenticated` — a `service_role` (usada pela Edge Function `emit-nfse`,
-- nunca pelo browser) nunca recebeu isso. `service_role` ignora RLS (tem
-- BYPASSRLS), mas ainda precisa do GRANT básico de schema/tabela, que é
-- independente de RLS. Sem isso: "permission denied for schema nf_forneria"
-- mesmo em tabelas sem RLS nenhuma bloqueando.
--
-- `alter default privileges` garante que tabelas criadas em migrations
-- futuras também já nascem acessíveis pra service_role, sem precisar
-- lembrar de repetir este grant toda vez.

grant usage on schema nf_forneria to service_role;
grant select, insert, update, delete on all tables in schema nf_forneria to service_role;

alter default privileges in schema nf_forneria
  grant select, insert, update, delete on tables to service_role;
