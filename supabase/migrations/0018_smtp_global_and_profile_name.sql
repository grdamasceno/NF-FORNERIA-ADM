-- NF-FORNERIA-ADM · SMTP vira global (não por organização) + nome no perfil
--
-- "por enquanto esse smtp deverá atender ao aplicativo todo" — tira o
-- vínculo com organização (que também travava quando o próprio superadmin
-- não tinha organização nenhuma, como no caso real que apareceu: usuário
-- sem org não conseguia nem saber qual SMTP usar). Vira tabela singleton
-- (igual o padrão clássico de "1 linha só", chave boolean sempre true).

alter table nf_forneria.smtp_settings
  drop constraint smtp_settings_pkey,
  drop column organization_id,
  add column singleton boolean not null default true;

alter table nf_forneria.smtp_settings add constraint smtp_settings_singleton_pk primary key (singleton);
alter table nf_forneria.smtp_settings add constraint smtp_settings_singleton_check check (singleton);

-- Nome de exibição do usuário (perfil) — pedido junto com a edição de
-- usuário, pra não ficar só o e-mail na lista.
alter table nf_forneria.profiles add column name text;
