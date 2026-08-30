# TODO · MVP Faturamento de Franquias (OnChannel)

> Roteiro vivo do projeto. Atualizar conforme o trabalho avança.
> Especificação completa: [MVP_Faturamento_Franquias.md](MVP_Faturamento_Franquias.md) — **v2**: `invoices` agora é só a cobrança (1 boleto/PIX por unidade/mês); o detalhamento por serviço (Call Center/Royalties/Marketing) virou a tabela `invoice_items` (1 a 3 por fatura, cada um com sua própria NFS-e simulada), controlado por `tenants.nfse_mode` (`consolidado` | `separado_por_servico`). A v1 do MD foi eliminada.
> **Divergência do MD (decisão de produto posterior):** o MD (seção 8) previa `simulateBoletoGeneration` gerando boleto/PIX simulado. Na prática o app **não vai gerar boleto** — só permite anexar um boleto já pronto (upload manual). `simulateBoletoGeneration` continua em `src/lib/simulation.ts` mas não é mais chamada em lugar nenhum.
> Design de referência: [MVP_Faturamento_Franquias_OnChannel (1).html](<MVP_Faturamento_Franquias_OnChannel (1).html>)

## ⚠️ Inventário de dados fixos / fictícios

Ler isto **antes** de começar a fase de conectar o Supabase — é o mapa de tudo que precisa ser trocado por dado real, e do que é fictício por definição (não vai deixar de ser simulado só porque o banco existe).

> O repositório GitHub (`grdamasceno/NF-FORNERIA-ADM`) é **público**. Por isso `Arquivos/` (planilha real de faturamento + export real de `unidades`) e `ordem-de-compra-15657.pdf` foram para o `.gitignore` — existem só localmente, não no histórico do git. Qualquer dado gerado a partir deles (ex: `src/data/franquias.json`) precisa ser avaliado individualmente: nomes/endereços de loja (já públicos no site da rede) tudo bem, valores monetários não — por isso `src/data/pendingEmissions.ts` usa valores fictícios em vez dos reais da planilha (ver tabela A).

### A. 100% fictício (números/textos inventados, sem nenhuma correspondência real)

| Onde | O quê |
|---|---|
| `src/data/mockInvoices.ts` | As 10 faturas do Painel (`mockInvoices`) + seus `invoice_items` (`mockInvoiceItems`, 1 por fatura, tenant fictício em modo `consolidado`). Nomes de unidade batem com a rede real, mas CNPJ (não modelado mais em `Invoice` — só existia no array bruto interno), valor, número de NFS-e por item, status de pagamento/envio e datas de vencimento/pagamento são todos inventados. `boletoCode`/`pixCopiaCola` vêm de `gerarBoletoFalso`/`gerarPixFalso` (mesmo espírito de `src/lib/simulation.ts`, porém hardcoded no array). `monthlyTotals` (série de 6 meses do gráfico de barras) também é inventada. |
| `src/pages/Dashboard.tsx` | Badges de tendência dos KPIs — `"12%"`, `"8%"`, `"2,1%"` fixos no JSX, não calculados a partir de nenhuma série histórica real. |
| Pill "Competência: Junho / 2026" | Aparece fixa no Painel e em Faturamento — não vem de um seletor funcional ainda. |
| `src/data/mockFaturamento.ts` | Histórico de importações e alertas da tela Faturamento. |
| `src/data/mockRelatorios.ts` | Faturamento trimestral, ticket médio e top 5 unidades da tela Relatórios (que também está fora do escopo do MVP — seção 7 do MD). |
| `src/pages/Configuracoes.tsx` | A maioria dos valores exibidos (dias de vencimento, cor primária, tenant) são estáticos no JSX. Exceção: "Emissão de NFS-e por serviço", "Canal de envio", "CNPJs emissores" e "Emissão por marca e serviço" **são funcionais de verdade** (ver `SettingsContext` abaixo) — só não persistem. |
| `src/context/SettingsContext.tsx` | Canal de envio (WhatsApp/e-mail), cadastro de CNPJs emissores e mapeamento marca×serviço → CNPJ continuam só em memória (React Context) — funcionam de verdade dentro da sessão, mas resetam pro padrão a cada reload. Os 3 CNPJs iniciais (Forneria Original Franquias, The Duck Franquias, Forneria Original Callcenter) e o mapeamento (Royalties por marca, Call Center compartilhado, Marketing sem CNPJ) foram semeados a partir do exemplo dado — e **também gravados de verdade** no Supabase via migration 0004 (ver tabela B), só o frontend ainda não lê de lá. **Elegibilidade de serviço (`serviceEligibility`) já tenta persistir de verdade** em `nf_forneria.service_eligibility` (migration 0005) — RLS aberto pra `anon` nessa tabela específica, decisão do usuário (2026-08-30) pra destravar antes do Auth existir. |
| `src/components/layout/CobrandBar.tsx` | Nome do cliente "Forneria Original" fixo; a caixa do logo do cliente é só um bloco navy — nenhuma imagem real de logo do cliente está sendo usada aí (diferente do logo da OnChannel, que já é real). |
| `src/components/layout/Sidebar.tsx` / `CobrandBar.tsx` | Tenant único fixo "Forneria Original" / avatar "FO". Não existe seletor de tenant/marca ainda — mesmo a tela de Franquias já mostrando Forneria **e** The Duck juntas. |
| `src/data/pendingEmissions.ts` | **Só o fallback inicial** da fila de emissão agora — 8 unidades reais (todas marca `Forneria`), valores inventados (mesmo motivo de sempre: dado financeiro, repo público). Assim que o usuário faz upload de uma planilha de verdade em Faturamento (botão "Importar planilha" → preview → "Confirmar importação"), a fila troca pra os dados reais da planilha (valores reais, todas as unidades/marcas — 69 no teste com a planilha real, 66 depois de excluir as "sem cobrança no mês") — só que isso fica em estado local (`useState`), não persiste; recarregar a página volta pro fallback fictício de 8 unidades. |
| `src/pages/Franquias.tsx` (edição) | O modal de edição grava de verdade em `nf_forneria.units` (RLS aberto pra `anon`, migration 0005) — funcional, não fictício. Mas a tabela `units` só tem os campos fiscais novos (CNPJ, endereço estruturado, telefone, e-mail) vazios pra todas as 69 unidades — precisam ser preenchidos um a um pela tela, ninguém populou isso ainda. |
| Faturamento → botão "Boleto" | Upload de arquivo (pdf/png/jpg) por unidade — só guarda o nome do arquivo em estado local (`useState`), não envia a nenhum lugar. Não existe bucket de storage ainda (ver "Próximos passos" → item 1). |
| Faturamento → botão "A pagar" / "Pago ✓" | Status de pagamento por unidade, com undo (clicar de novo volta pra "A pagar") — só estado local, não é uma baixa de pagamento de verdade nem grava em `invoices.payment_status`. |

### B. Real, porém estático (não vem de uma query ao banco ainda)

| Onde | O quê |
|---|---|
| `src/data/franquias.json` (via `src/data/units.ts`) | 69 unidades reais — 56 Forneria + 13 The Duck. Nomes e marca vêm de `Arquivos/Banco Junho 2026 Emissao de boletos.xlsx` (planilha operacional real, abas "Forneria" e "The Duck" — fonte de verdade para o roster, por pedido explícito). Endereço/cidade/horário/imagem só existem para a marca Forneria, casados manualmente contra `Arquivos/unidades_rows.json`. 5 unidades Forneria (Tijuca II, Campo Grande 2, Abolição, Blumenau, Água Verde) e as 13 do The Duck não têm correspondência de endereço — aparecem como "Endereço não cadastrado" na UI. Este `.json` **é commitado** (dado de localização já público no site da rede); o `Arquivos/` que o gerou não é (está no `.gitignore`). Continua sendo usado por `Sidebar`/`Configurações` (contagem/lista de marcas) e foi a fonte do seed de `nf_forneria.units` (migration 0006) — mas **a tela de Franquias não lê mais dele**, lê direto do Supabase (ver linha "Franquias.tsx" na tabela A). |
| `Arquivos/unidades_rows.json` | Export real do Supabase (tabela `unidades`). Hoje só é usado como fonte de enriquecimento pelo script que gerou `franquias.json` — o app não importa mais esse arquivo diretamente. Existe só localmente (`.gitignore`), não no repositório. |
| `Arquivos/Banco Junho 2026 Emissao de boletos.xlsx` | Tem os valores reais de Call Center/Royalties/Marketing de Junho/2026 para as duas marcas. Existe só localmente (`.gitignore` — dado financeiro, repo é público). `src/data/pendingEmissions.ts` foi gerado a partir dela, mas com valores trocados por fictícios antes de commitar (ver tabela A). `mockInvoices.ts` (Painel) continua 100% fictício — se um dia quiser usar os valores reais de novo, a planilha precisa ser recolocada em `Arquivos/` localmente (não faz parte do repo). |
| `src/assets/logo-onchannel.jpeg` | Logo real da OnChannel, usado no Sidebar. (O logo do *cliente* na CobrandBar continua fictício — ver tabela A.) |

### C. Simulado por definição do MVP (não é "fixo pra trocar depois" — é o comportamento esperado mesmo com o banco conectado, seção 8 do MD)

| Onde | O quê |
|---|---|
| `src/lib/simulation.ts` | `simulateNfseEmission`, `simulateWhatsappSend`, `simulateEmailSend` — já marcadas com `// TODO: INTEGRAÇÃO FUTURA`. `simulateBoletoGeneration` existe mas não é mais usada (boleto virou upload manual — ver nota no topo do arquivo). A integração real da Focus NFe já existe em paralelo (`supabase/functions/emit-nfse`, seção 8 de "Próximos passos"), mas o botão "Emitir" ainda chama a versão simulada — ainda falta dado fiscal do tomador pra poder trocar. `simulateWhatsappSend`/`simulateEmailSend` continuam simuladas até o n8n/Chatwoot entrar de fato. |
| **Faturamento → "Importar planilha"** | Upload real de `.xlsx` funcional (não é mais fictício) — usa `src/lib/spreadsheetParser.ts` de verdade, com preview antes de confirmar. Testado com a planilha real (`Arquivos/Banco Junho 2026...`): reconheceu as 56 unidades Forneria + 13 The Duck corretamente. O parser tinha um bug real (linha de título antes do cabeçalho + coluna do nome variando por aba + `Array.prototype.map` pulando "buracos" em sparse array) — corrigido nesta rodada. O que ainda é fictício: a importação não persiste em `billing_periods`/`invoices` no Supabase, só substitui o estado local da fila de emissão. |
| **Faturamento → "Emitir nota fiscal por unidade"** | Fila de emissão (`src/data/pendingEmissions.ts` como fallback, ou os dados de uma planilha importada de verdade), com 4 ações lado a lado por linha: **Boleto** (upload manual), **A pagar/Pago** (toggle com undo), **Emitir** e **Enviar**. Um serviço só entra na emissão se estiver habilitado em Configurações **e** tiver um CNPJ emissor mapeado pra marca da unidade — sem CNPJ, fica de fora (igual desabilitado). "Emitir"/"Emitir lote" chamam `simulateNfseEmission` de verdade (com delay simulado); em modo "1 nota" a nota sai no CNPJ comum aos serviços elegíveis — se os elegíveis usam CNPJs diferentes (ex: Royalties e Call Center no exemplo dado), o botão "1 nota" fica **desabilitado**, forçando "até 3 notas" (uma NFS-e não pode sair de dois CNPJs). Depois de emitida, o botão vira "Ver nota fiscal" e revela o(s) número(s) da NFS-e + razão social/CNPJ de quem emitiu, ao clicar. "Enviar" chama `simulateWhatsappSend`/`simulateEmailSend` conforme o canal escolhido em Configurações. Tudo em estado local (`useState` em `Faturamento.tsx`); recarregar a página reseta tudo. Nada é persistido ainda. |

## Concluído — estrutura inicial do projeto

- [x] Scaffold Vite + React + TypeScript
- [x] Tailwind configurado com os tokens de cor/tipografia do HTML de referência
- [x] Layout: `Sidebar`, `CobrandBar`, `PageHeader`, `AppShell` + rotas (react-router)
- [x] Dashboard (Painel): 4 KPIs, gráfico emitido×recebido, donut de status, tabela de franquias — com dados fictícios
- [x] Modelo de dados TypeScript espelhando o schema Supabase v2 (`tenants` com `nfse_mode`, `units`, `billing_periods`, `invoices`, `invoice_items`)
- [x] Parser de planilha `.xlsx` com mapeamento por nome de cabeçalho (seção 3 do MD)
- [x] Funções simuladas de NFS-e / boleto-PIX / WhatsApp / e-mail, com `// TODO: INTEGRAÇÃO FUTURA` nos pontos de plugue real (seção 8 do MD)
- [x] Cliente Supabase **conectado** — self-hosted, schema `nf_forneria`, `.env` preenchido, tabelas criadas e alcançáveis via API (ver seção 1 de "Próximos passos"); ainda sem Auth/policies, então nenhuma tela lê/escreve nele de verdade ainda — todas continuam nos dados mock/estáticos do inventário acima
- [x] Sidebar com 5 telas: Painel, Franquias, Faturamento, Relatórios, Configurações. Notas Fiscais/Boletos & PIX/Envios existiram como páginas próprias em algum momento, mas foram **removidas** — o conteúdo delas (NFS-e, boleto, status de pagamento, envio) foi consolidado direto nas ações por linha da tabela de Faturamento (ver abaixo), então virou redundante manter telas separadas
- [x] Tela de Franquias com **69 unidades reais** das duas marcas (Forneria + The Duck), extraídas de `Arquivos/Banco Junho 2026 Emissao de boletos.xlsx` e enriquecidas com endereço via `Arquivos/unidades_rows.json` → `src/data/franquias.json` / `src/data/units.ts`; filtro por marca (Forneria/The Duck/Todas), busca por nome/cidade/endereço e filtro por estado; badge do sidebar calculado a partir desses dados
- [x] Franquias agora lê **de verdade do Supabase** (`nf_forneria.units`, seedado com as 69 unidades via migration 0006) em vez do JSON estático, e tem **edição funcional** por unidade (modal com nome, CNPJ, telefone, e-mail, endereço estruturado — logradouro/número/bairro/CEP/código do município IBGE/UF — e status ativa/inativa), gravando via `update` no Supabase. RLS aberto pra `anon` só nessa tabela (migration 0005, decisão do usuário)
- [x] Faturamento → "Importar planilha" ficou **funcional de verdade**: upload de `.xlsx`, preview por marca/aba antes de confirmar (com alertas e contagem de "sem cobrança no mês"), e ao confirmar substitui a fila de emissão pelos dados reais da planilha. Corrigido um bug real do parser nessa mesma rodada (ver tabela C do inventário)
- [x] Configurações → toggle de elegibilidade de serviço agora **persiste de verdade** em `nf_forneria.service_eligibility` (migration 0005), lido ao carregar a página
- [x] Logo real da OnChannel (`Arquivos/logoonchannelquadrada.jpeg` → `src/assets/logo-onchannel.jpeg`) ao lado do texto "OnChannel" no Sidebar
- [x] Selo `SimBadge` ("SIMULADO") reutilizável para deixar claro visualmente o que é fictício/simulado, usado em Faturamento, Relatórios e Configurações
- [x] Faturamento → "Emitir nota fiscal por unidade": fila de emissão com 8 unidades (`src/data/pendingEmissions.ts`), com 4 ações lado a lado por linha — **Boleto** (upload manual, app não gera boleto), **A pagar/Pago** (toggle com undo), **Emitir** (1 nota consolidada ou até 3 por serviço, só dos serviços habilitados, `simulateNfseEmission` de verdade com delay) e **Enviar** (`simulateWhatsappSend`/`simulateEmailSend` conforme canal escolhido). "Emitir lote" no topo dispara emissão de todas as pendentes de uma vez. Só falta persistir, é só estado local por enquanto
- [x] `src/context/SettingsContext.tsx`: elegibilidade de NFS-e por serviço (Call Center/Royalties/Marketing) e canal de envio (WhatsApp/e-mail), configuráveis em Configurações e aplicados de verdade na tela Faturamento (coluna do serviço desabilitado aparece riscada); estado em memória, não persiste
- [x] Configurações → "CNPJs emissores" + "Emissão por marca e serviço": cadastro de CNPJs (razão social + CNPJ, adicionar/remover) e mapeamento marca×serviço → CNPJ, semeado com o cenário real dado (Royalties com CNPJ próprio por marca, Call Center compartilhado pelas duas). Faturamento usa esse mapeamento pra decidir quem emite cada nota, mostra CNPJ+razão social ao lado do número da NFS-e em "Ver nota fiscal", e **desabilita "1 nota"** quando os serviços elegíveis de uma unidade caem em CNPJs diferentes (não dá pra consolidar duas notas de CNPJs distintos numa só)

## Próximos passos

### 1. Infra / dados
- [x] Decisão: usar o Supabase **self-hosted** já existente, em schema próprio `nf_forneria` (não `public`) — mantém isolado de outros apps no mesmo Postgres. Não é o projeto cloud "site forneria" (`kqsnhpiprdznmjhvgvao`), que continua só com `unidades`/storage.
- [x] Migration inicial pronta em `supabase/migrations/0001_init_schema.sql` — cria `nf_forneria.{tenants,units,billing_periods,invoices,invoice_items}`, RLS ligado (sem policy ainda) e GRANTs pra `anon`/`authenticated`
- [x] `src/lib/supabase.ts` aponta pro schema `nf_forneria` (`db: { schema: 'nf_forneria' }`)
- [x] Migration rodada no self-hosted via Supabase Studio SQL Editor — as 5 tabelas existem
- [x] Schema `nf_forneria` exposto no PostgREST (`PGRST_DB_SCHEMAS` no Coolify, ao lado de `public,storage,graphql_public,ordem_de_compra,bitcoitos,taskflow` — outros apps no mesmo Postgres)
- [x] `.env` preenchido com `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` do self-hosted — **conexão testada e confirmada** (2026-08-16): `supabase.from('tenants'|'units'|'billing_periods'|'invoices'|'invoice_items').select('*')` retorna `200` com `[]` (vazio porque RLS bloqueia tudo sem policy, não porque está quebrado)
- [ ] Criar policies de RLS quando o Auth entrar (hoje RLS está ligado sem nenhuma policy = tudo bloqueado por padrão em quase todo o schema, exceto as 2 tabelas abertas pra `anon` — ver 0005)
- [ ] **Rodar `0005_units_and_eligibility.sql` e `0006_seed_units.sql` no self-hosted** — testado no navegador (2026-08-30): sem elas, Configurações (toggle de serviço) e Franquias (edição) dão erro `Could not find the table` / banner de erro. Código já está correto, só falta aplicar (mesmo passo de sempre: Supabase Studio → SQL Editor)
- [ ] ⚠️ **Decisão de segurança tomada em 2026-08-30, revisar quando o Auth existir:** `nf_forneria.units` e `nf_forneria.service_eligibility` têm RLS aberto pra `anon` (leitura E escrita) — as únicas exceções no schema todo. Trocar essas policies de `anon` pra `authenticated` assim que o login existir.
- [ ] Configurar Supabase Auth (login do diretor/admin)
- [ ] Storage bucket para guardar a planilha original importada
- [ ] Trocar `src/data/units.ts` (JSON estático) por query à tabela `unidades` — essa tabela mora no projeto cloud "site forneria", não no self-hosted; decidir se o app lê de dois Supabase diferentes ou se `unidades` é replicada/migrada para `nf_forneria`
- [ ] **Ganho rápido antes do Supabase:** trocar os valores fictícios de `src/data/mockInvoices.ts` pelos valores reais de Call Center/Royalties/Marketing de `Arquivos/Banco Junho 2026 Emissao de boletos.xlsx` (já sabemos parsear as duas abas — ver seção 3 do MD, `src/lib/spreadsheetParser.ts` e o exemplo em `src/data/pendingEmissions.ts`)
- [x] Migration `supabase/migrations/0002_emitters.sql` pronta — cria `nf_forneria.emitters` (CNPJ, não pertence a um tenant só — o mesmo CNPJ pode emitir por mais de uma marca, como o Call Center do exemplo real) e `nf_forneria.emitter_mapping` (tenant/marca × service_type → emitter, 1 por combinação), + coluna `emitter_id` em `invoice_items` (snapshot de quem emitiu cada nota). RLS ligado sem policy, GRANTs iguais à 0001.
- [ ] Rodar `0002_emitters.sql` no self-hosted (mesmo processo da 0001 — Supabase Studio SQL Editor)
- [ ] Trocar `src/context/SettingsContext.tsx` (`emitters`/`emitterMapping` em memória) por essas tabelas quando o Faturamento/Configurações ligarem no Supabase de verdade

### 2. Fluxo de importação de planilha (seção 5.2 do MD)
- [x] Tela de upload de `.xlsx` (usa `src/lib/spreadsheetParser.ts`, agora corrigido — testado com a planilha real)
- [x] Preview dos dados extraídos por unidade + totalizadores + contagem "sem cobrança no mês" (`ImportPreviewModal.tsx`)
- [x] Lista de alertas/inconsistências antes de confirmar (já geradas pelo parser, mostradas no preview)
- [ ] Bloquear reimportação da mesma competência (hoje: importar de novo simplesmente substitui a fila inteira, sem perguntar nada)
- [ ] Persistir `billing_period` + `invoices` + `invoice_items` (1 ou 3 por fatura, conforme `tenant.nfse_mode`) no Supabase ao confirmar — hoje só troca o estado local (`useState`) de `Faturamento.tsx`
- [ ] Bundle da tela cresceu bastante (`xlsx` inteira entrou no bundle principal, ~920kB) — considerar `import()` dinâmico de `spreadsheetParser.ts` só quando o usuário clicar em "Importar planilha"

### 3. Emissão em lote — simulada (seção 5.3 do MD)
- [x] UI de emissão por unidade em Faturamento, com escolha de modo (consolidada/separada), filtro por serviço elegível e feedback visual de "Emitindo…" — ver `src/pages/Faturamento.tsx` e tabela C do inventário
- [ ] Trocar a fila fixa de 8 unidades (`pendingEmissions.ts`) pelas faturas `pendente_emissao` reais da competência selecionada (Supabase)
- [ ] Persistir o resultado (`invoice_items` com `nfse_number`, status da fatura → `emitida`) em vez de só estado local em memória

### 4. Envio automático — simulado (seção 2, passo 7 do MD)
- [x] Botão "Enviar" em Faturamento chama `simulateWhatsappSend`/`simulateEmailSend` de verdade, conforme o canal escolhido em Configurações (`SettingsContext`) — só falta persistir
- [ ] Atualizar `invoices.status` para `enviada` no Supabase (hoje só muda um estado local em `Faturamento.tsx`, não mexe em `mockInvoices`/status geral da fatura)

### 5. Detalhe da fatura (seção 5.4 do MD)
- [ ] Página de detalhe por unidade: listar os `invoice_items` da fatura (1 se `consolidado`, até 3 se `separado_por_servico`) com breakdown Call Center / Royalties / Marketing
- [ ] Exibir NFS-e simulada por item + boleto anexado, com aviso visual "SIMULADO" onde aplicável (reaproveitar `SimBadge`)
- [x] Baixa manual de pagamento — botão "A pagar"/"Pago ✓" com undo, direto na linha da unidade em Faturamento (ver tabela C do inventário); falta persistir
- [ ] Histórico de envio (WhatsApp/e-mail) — hoje só mostra o último estado (enviado ou não), não um histórico

### 6. Dashboard e telas fictícias → dados reais
- [ ] Trocar `src/data/mockInvoices.ts` (`mockInvoices` + `mockInvoiceItems`) por dados reais do Supabase (`invoices` + `invoice_items`), filtrados por competência
- [ ] Seletor de competência (mês/ano) funcional no topo do Painel/Faturamento (hoje é só um pill fixo)
- [ ] Calcular inadimplência e badges de tendência a partir de dado real (`due_date < hoje` e não paga → `atraso`)
- [ ] Trocar `mockFaturamento.ts` (histórico de importação) por query em `billing_periods`
- [ ] Persistir `SettingsContext` (elegibilidade de NFS-e por serviço, canal de envio, CNPJs emissores e mapeamento marca×serviço) em vez de resetar a cada reload — provavelmente uma tabela `emitters` + `emitter_mapping` (ou coluna de config) por `tenant`
- [ ] Validar CNPJ de verdade (dígito verificador) ao cadastrar em "CNPJs emissores" — hoje aceita qualquer texto
- [ ] Trazer unidades `The Duck` pra fila de emissão (`pendingEmissions.ts` hoje só tem Forneria) pra exercitar o mapeamento de CNPJ por marca de ponta a ponta
- [ ] Upload de boleto: ligar a um bucket de Storage de verdade (hoje só guarda o nome do arquivo em memória)
- [ ] Configurações: persistir os demais campos (hoje só exibidos) — a começar por dias de vencimento do boleto/PIX

### 7. Multi-tenant / whitelabel
- [ ] Seletor de rede (Forneria / The Duck) trocando o tenant ativo no Sidebar/CobrandBar — hoje só a tela de Franquias distingue as duas marcas (via filtro), o resto do app continua fixo em "Forneria Original"
- [ ] Logo/cor do cliente dinâmicos a partir de `tenant.logo_url` / `tenant.primary_color` (hoje a caixa do logo do cliente na CobrandBar é um placeholder sem imagem)

### 8. Integração real com a Focus NFe (seção 8 do MD)
Já existem 3 CNPJs cadastrados na Focus NFe com token de homologação e produção — este item é sobre ligar o `simulateNfseEmission` fictício à API de verdade.

- [x] Pesquisada a API real da Focus NFe (2026-08-27): `POST /v2/nfse?ref=...` (Basic Auth, token como usuário, senha em branco), assíncrona — devolve `processando_autorizacao` e só fica `autorizado`/`erro_autorizacao` depois, consultável em `GET /v2/nfse/{ref}`. Bases: `https://homologacao.focusnfe.com.br` / `https://api.focusnfe.com.br`.
- [x] Migration `supabase/migrations/0003_emitter_credentials.sql` pronta — cria `emitter_credentials` (token por emissor×ambiente, **sem grant nenhum pra `anon`/`authenticated`**, só a `service_role` lê) e colunas fiscais (`emitters.inscricao_municipal`/`codigo_municipio`, `emitter_mapping.item_lista_servico`/`iss_retido`)
- [x] Edge Function `supabase/functions/emit-nfse/index.ts` pronta — monta o payload real, chama a Focus NFe com o token lido via `service_role`, faz um polling curto e devolve o resultado (ou `processando` se a Focus NFe demorar). Ver `supabase/functions/emit-nfse/README.md` pro contrato e passo a passo.
- [x] Migration `0003_emitter_credentials.sql` rodada no self-hosted (2026-08-29) — confirmado via API: `emitters`/`emitter_mapping` já respondem com as colunas fiscais novas, e `emitter_credentials` retorna `401 permission denied` pra anon key (bloqueio funcionando como esperado)
- [x] Migration `supabase/migrations/0004_seed_emitters.sql` pronta e rodada no self-hosted (2026-08-29) — `tenants` (Forneria Original, The Duck), `emitters` (os 3 CNPJs) e `emitter_mapping` gravados de verdade no banco (confirmado pelo usuário via SQL Editor: Royalties por marca, Call Center compartilhado — bate com o seed do frontend)
- [x] Tokens de **homologação** dos 3 CNPJs inseridos em `emitter_credentials` via SQL direto (2026-08-29)
- [ ] Tokens de **produção** dos 3 CNPJs ainda pendentes em `emitter_credentials` (mesmo processo, `ambiente = 'producao'`)
- [ ] Preencher `inscricao_municipal`/`codigo_municipio` dos 3 emissores e `item_lista_servico`/`iss_retido` de cada combinação marca×serviço (confirmar códigos LC 116/2003 com o contador)
- [ ] **Bloqueio real:** dado fiscal do TOMADOR (a unidade franqueada) não existe em lugar nenhum do app — nem `franquias.json` nem `pendingEmissions.ts` têm CNPJ/endereço fiscal completo das unidades. Sem isso a Edge Function recusa a emissão (validação, não fabrica dado fiscal falso). **Em levantamento (2026-08-27)** — usuário ainda não sabe se é 1 CNPJ por loja ou 1 CNPJ podendo cobrir várias lojas (franqueado dono de mais de uma unidade); vai ficar claro pelo próprio levantamento (CNPJ repetido em mais de uma linha = por franqueado). Campos a levantar por unidade: CNPJ/CPF, razão social, logradouro+número, bairro, CEP, cidade/UF, e-mail (opcional). **Não precisa levantar código do município (IBGE)** — dá pra derivar depois a partir de cidade/UF, que já existe em `franquias.json`.
- [ ] Depois do levantamento: se o CNPJ se repetir entre lojas, criar uma entidade separada (`franqueados`/`tomadores`) com `units` apontando pra ela (em vez de CNPJ direto na unidade) — decidir só depois de ver o dado real, não antes
- [ ] Hoje `Faturamento`/`pendingEmissions.ts` (8 unidades fictícias) e `Franquias`/`franquias.json` (69 unidades reais) são datasets **desconectados** — precisa unificar antes do tomador fazer sentido de ponta a ponta (a fila de emissão real vai ter que vir das 69 unidades reais, não de uma lista solta)
- [ ] Deploy da Edge Function no self-hosted (depende de como o `edge-runtime` está montado no Coolify — ver README da função)
- [ ] **Ainda não conectado ao frontend**: o botão "Emitir" em Faturamento continua chamando `simulateNfseEmission` (fictício). Só trocar pela chamada real (`fetch` pro endpoint da Edge Function) depois do tomador ter dado fiscal — emitir NFS-e de verdade (mesmo em homologação) tem efeito colateral real na conta da Focus NFe, não é algo pra ligar sem essa base pronta

## Critérios de aceite do MVP (seção 10 do MD)

- [ ] Diretor consegue subir a planilha `.xlsx` de uma competência
- [ ] Sistema extrai corretamente unidade + Call Center + Royalties + Marketing, ignorando totais e tratando vazio como zero
- [ ] Preview mostra todas as unidades antes de confirmar a importação
- [ ] Após confirmar, dashboard reflete os dados: KPIs, gráfico, donut e tabela
- [ ] "Emitir lote" gera NFS-e simulada e muda status das faturas — ⚠️ **divergente do MD**: boleto/PIX não é mais gerado, é upload manual (ver nota no topo do arquivo)
- [ ] É possível marcar uma fatura como paga manualmente e o dashboard atualiza
- [ ] Layout visual bate com o HTML de referência
- [ ] Multi-tenant funcional (Forneria / The Duck) com dados/whitelabel isolados

## Fora do escopo deste MVP (seção 7 do MD)

- Emissão real de NFS-e (Focus NFe), geração real de boleto/PIX, conciliação bancária automática
- Envio real de WhatsApp/e-mail
- Preenchimento manual dos valores direto no sistema (fase futura)
- Cadastro fiscal completo por unidade
- Múltiplos usuários/permissões granulares

## Como rodar

```bash
npm install
cp .env.example .env   # preencher com credenciais do Supabase quando existirem
npm run dev
```
