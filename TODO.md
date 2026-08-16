# TODO · MVP Faturamento de Franquias (OnChannel)

> Roteiro vivo do projeto. Atualizar conforme o trabalho avança.
> Especificação completa: [MVP_Faturamento_Franquias.md](MVP_Faturamento_Franquias.md) — **v2**: `invoices` agora é só a cobrança (1 boleto/PIX por unidade/mês); o detalhamento por serviço (Call Center/Royalties/Marketing) virou a tabela `invoice_items` (1 a 3 por fatura, cada um com sua própria NFS-e simulada), controlado por `tenants.nfse_mode` (`consolidado` | `separado_por_servico`). A v1 do MD foi eliminada.
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
| `src/data/mockEnvios.ts` | Contato (telefone/e-mail) e horário de envio por unidade na tela Envios. |
| `src/data/mockRelatorios.ts` | Faturamento trimestral, ticket médio e top 5 unidades da tela Relatórios (que também está fora do escopo do MVP — seção 7 do MD). |
| `src/pages/Configuracoes.tsx` | Todos os valores exibidos (dias de vencimento, cor primária, toggles) são estáticos no JSX; o formulário não lê nem grava nada. |
| `src/components/layout/CobrandBar.tsx` | Nome do cliente "Forneria Original" fixo; a caixa do logo do cliente é só um bloco navy — nenhuma imagem real de logo do cliente está sendo usada aí (diferente do logo da OnChannel, que já é real). |
| `src/components/layout/Sidebar.tsx` / `CobrandBar.tsx` | Tenant único fixo "Forneria Original" / avatar "FO". Não existe seletor de tenant/marca ainda — mesmo a tela de Franquias já mostrando Forneria **e** The Duck juntas. |
| `src/data/pendingEmissions.ts` | Fila de emissão da tela Faturamento. Nomes das 8 unidades são reais, mas os valores de Call Center/Royalties/Marketing são inventados (originalmente vieram da planilha real — trocados por serem dado financeiro e o repo ser público). |

### B. Real, porém estático (não vem de uma query ao banco ainda)

| Onde | O quê |
|---|---|
| `src/data/franquias.json` (via `src/data/units.ts`) | 69 unidades reais — 56 Forneria + 13 The Duck. Nomes e marca vêm de `Arquivos/Banco Junho 2026 Emissao de boletos.xlsx` (planilha operacional real, abas "Forneria" e "The Duck" — fonte de verdade para o roster, por pedido explícito). Endereço/cidade/horário/imagem só existem para a marca Forneria, casados manualmente contra `Arquivos/unidades_rows.json`. 5 unidades Forneria (Tijuca II, Campo Grande 2, Abolição, Blumenau, Água Verde) e as 13 do The Duck não têm correspondência de endereço — aparecem como "Endereço não cadastrado" na UI. Este `.json` **é commitado** (dado de localização já público no site da rede); o `Arquivos/` que o gerou não é (está no `.gitignore`). |
| `Arquivos/unidades_rows.json` | Export real do Supabase (tabela `unidades`). Hoje só é usado como fonte de enriquecimento pelo script que gerou `franquias.json` — o app não importa mais esse arquivo diretamente. Existe só localmente (`.gitignore`), não no repositório. |
| `Arquivos/Banco Junho 2026 Emissao de boletos.xlsx` | Tem os valores reais de Call Center/Royalties/Marketing de Junho/2026 para as duas marcas. Existe só localmente (`.gitignore` — dado financeiro, repo é público). `src/data/pendingEmissions.ts` foi gerado a partir dela, mas com valores trocados por fictícios antes de commitar (ver tabela A). `mockInvoices.ts` (Painel/Notas Fiscais/Boletos & PIX/Envios) continua 100% fictício — se um dia quiser usar os valores reais de novo, a planilha precisa ser recolocada em `Arquivos/` localmente (não faz parte do repo). |
| `src/assets/logo-onchannel.jpeg` | Logo real da OnChannel, usado no Sidebar. (O logo do *cliente* na CobrandBar continua fictício — ver tabela A.) |

### C. Simulado por definição do MVP (não é "fixo pra trocar depois" — é o comportamento esperado mesmo com o banco conectado, seção 8 do MD)

| Onde | O quê |
|---|---|
| `src/lib/simulation.ts` | `simulateNfseEmission`, `simulateBoletoGeneration`, `simulateWhatsappSend`, `simulateEmailSend` — já marcadas com `// TODO: INTEGRAÇÃO FUTURA`. Continuam simuladas até a Focus NFe / gateway de boleto-PIX / n8n-Chatwoot entrarem de fato. |
| Telas Notas Fiscais, Boletos & PIX, Envios | Mesmo depois de ligadas ao Supabase, vão continuar mostrando NFS-e/boleto/PIX/envio *simulados* — a fonte muda (banco em vez de array fixo), mas o dado em si só deixa de ser fictício quando as integrações da seção 8 do MD forem plugadas. |
| **Faturamento → "Emitir nota fiscal por unidade"** | Fila de emissão (`src/data/pendingEmissions.ts`, 8 unidades). Botões "Emitir" (por linha) e "Emitir lote" (topo) chamam `simulateNfseEmission` de verdade (com o delay simulado), em modo 1 nota consolidada ou até 3 por serviço — mas só atualiza estado local em memória (`useState` em `Faturamento.tsx`); recarregar a página reseta tudo para `pendente`. Nada é persistido ainda. |

## Concluído — estrutura inicial do projeto

- [x] Scaffold Vite + React + TypeScript
- [x] Tailwind configurado com os tokens de cor/tipografia do HTML de referência
- [x] Layout: `Sidebar`, `CobrandBar`, `PageHeader`, `AppShell` + rotas (react-router)
- [x] Dashboard (Painel): 4 KPIs, gráfico emitido×recebido, donut de status, tabela de franquias — com dados fictícios
- [x] Modelo de dados TypeScript espelhando o schema Supabase v2 (`tenants` com `nfse_mode`, `units`, `billing_periods`, `invoices`, `invoice_items`)
- [x] Parser de planilha `.xlsx` com mapeamento por nome de cabeçalho (seção 3 do MD)
- [x] Funções simuladas de NFS-e / boleto-PIX / WhatsApp / e-mail, com `// TODO: INTEGRAÇÃO FUTURA` nos pontos de plugue real (seção 8 do MD)
- [x] Cliente Supabase **conectado** — self-hosted, schema `nf_forneria`, `.env` preenchido, tabelas criadas e alcançáveis via API (ver seção 1 de "Próximos passos"); ainda sem Auth/policies, então nenhuma tela lê/escreve nele de verdade ainda — todas continuam nos dados mock/estáticos do inventário acima
- [x] Todas as telas da sidebar implementadas (com conteúdo fictício onde ainda não há dado real — ver inventário acima): Painel, Franquias, Faturamento, Notas Fiscais, Boletos & PIX, Envios, Relatórios, Configurações
- [x] Tela de Franquias com **69 unidades reais** das duas marcas (Forneria + The Duck), extraídas de `Arquivos/Banco Junho 2026 Emissao de boletos.xlsx` e enriquecidas com endereço via `Arquivos/unidades_rows.json` → `src/data/franquias.json` / `src/data/units.ts`; filtro por marca (Forneria/The Duck/Todas), busca por nome/cidade/endereço e filtro por estado; badge do sidebar calculado a partir desses dados
- [x] Logo real da OnChannel (`Arquivos/logoonchannelquadrada.jpeg` → `src/assets/logo-onchannel.jpeg`) ao lado do texto "OnChannel" no Sidebar
- [x] Selo `SimBadge` ("SIMULADO") reutilizável para deixar claro visualmente o que é fictício/simulado, usado em Notas Fiscais, Boletos & PIX, Envios, Relatórios e Configurações
- [x] Faturamento → "Emitir nota fiscal por unidade": fila de emissão com 8 unidades reais (`src/data/pendingEmissions.ts`, valores de Junho/2026), botão "Emitir" por linha e "Emitir lote" no topo, escolha entre 1 nota consolidada ou até 3 por serviço, chamando `simulateNfseEmission` de verdade (com delay) — só falta persistir, é só estado local por enquanto

## Próximos passos

### 1. Infra / dados
- [x] Decisão: usar o Supabase **self-hosted** já existente, em schema próprio `nf_forneria` (não `public`) — mantém isolado de outros apps no mesmo Postgres. Não é o projeto cloud "site forneria" (`kqsnhpiprdznmjhvgvao`), que continua só com `unidades`/storage.
- [x] Migration inicial pronta em `supabase/migrations/0001_init_schema.sql` — cria `nf_forneria.{tenants,units,billing_periods,invoices,invoice_items}`, RLS ligado (sem policy ainda) e GRANTs pra `anon`/`authenticated`
- [x] `src/lib/supabase.ts` aponta pro schema `nf_forneria` (`db: { schema: 'nf_forneria' }`)
- [x] Migration rodada no self-hosted via Supabase Studio SQL Editor — as 5 tabelas existem
- [x] Schema `nf_forneria` exposto no PostgREST (`PGRST_DB_SCHEMAS` no Coolify, ao lado de `public,storage,graphql_public,ordem_de_compra,bitcoitos,taskflow` — outros apps no mesmo Postgres)
- [x] `.env` preenchido com `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` do self-hosted — **conexão testada e confirmada** (2026-08-16): `supabase.from('tenants'|'units'|'billing_periods'|'invoices'|'invoice_items').select('*')` retorna `200` com `[]` (vazio porque RLS bloqueia tudo sem policy, não porque está quebrado)
- [ ] Criar policies de RLS quando o Auth entrar (hoje RLS está ligado sem nenhuma policy = tudo bloqueado por padrão, inclusive pra escrita — nenhuma tela ainda grava no banco de verdade)
- [ ] Configurar Supabase Auth (login do diretor/admin)
- [ ] Storage bucket para guardar a planilha original importada
- [ ] Trocar `src/data/units.ts` (JSON estático) por query à tabela `unidades` — essa tabela mora no projeto cloud "site forneria", não no self-hosted; decidir se o app lê de dois Supabase diferentes ou se `unidades` é replicada/migrada para `nf_forneria`
- [ ] **Ganho rápido antes do Supabase:** trocar os valores fictícios de `src/data/mockInvoices.ts` pelos valores reais de Call Center/Royalties/Marketing de `Arquivos/Banco Junho 2026 Emissao de boletos.xlsx` (já sabemos parsear as duas abas — ver seção 3 do MD, `src/lib/spreadsheetParser.ts` e o exemplo em `src/data/pendingEmissions.ts`)

### 2. Fluxo de importação de planilha (seção 5.2 do MD)
- [ ] Tela de upload de `.xlsx` (usa `src/lib/spreadsheetParser.ts`)
- [ ] Preview dos dados extraídos por unidade + totalizadores
- [ ] Lista de alertas/inconsistências antes de confirmar (já geradas pelo parser)
- [ ] Bloquear reimportação da mesma competência (MVP: exigir exclusão manual antes)
- [ ] Persistir `billing_period` + `invoices` + `invoice_items` (1 ou 3 por fatura, conforme `tenant.nfse_mode`) no Supabase ao confirmar

### 3. Emissão em lote — simulada (seção 5.3 do MD)
- [x] UI de emissão por unidade em Faturamento, com escolha de modo (consolidada/separada) e feedback visual de "Emitindo…" — ver `src/pages/Faturamento.tsx` e tabela C do inventário
- [ ] Trocar a fila fixa de 8 unidades (`pendingEmissions.ts`) pelas faturas `pendente_emissao` reais da competência selecionada (Supabase)
- [ ] Chamar também `simulateBoletoGeneration` (1x por fatura) junto da emissão de NFS-e — hoje só a NFS-e é simulada nessa tela
- [ ] Persistir o resultado (`invoice_items` com `nfse_number`, status da fatura → `emitida`) em vez de só estado local em memória

### 4. Envio automático — simulado (seção 2, passo 7 do MD)
- [ ] Marcar canal (WhatsApp/e-mail) como enviado via `simulateWhatsappSend` / `simulateEmailSend`
- [ ] Atualizar status da fatura para `enviada`

### 5. Detalhe da fatura (seção 5.4 do MD)
- [ ] Página de detalhe por unidade: listar os `invoice_items` da fatura (1 se `consolidado`, até 3 se `separado_por_servico`) com breakdown Call Center / Royalties / Marketing
- [ ] Exibir NFS-e simulada por item + boleto/PIX simulados (1 por fatura) com aviso visual "SIMULADO" (reaproveitar `SimBadge`)
- [ ] Botão "Marcar como paga" (baixa manual) — hoje só existe visualmente (desabilitado) em Boletos & PIX
- [ ] Histórico de envio (WhatsApp/e-mail)

### 6. Dashboard e telas fictícias → dados reais
- [ ] Trocar `src/data/mockInvoices.ts` (`mockInvoices` + `mockInvoiceItems`) por dados reais do Supabase (`invoices` + `invoice_items`), filtrados por competência
- [ ] Seletor de competência (mês/ano) funcional no topo do Painel/Faturamento (hoje é só um pill fixo)
- [ ] Calcular inadimplência e badges de tendência a partir de dado real (`due_date < hoje` e não paga → `atraso`)
- [ ] Trocar `mockFaturamento.ts` (histórico de importação) por query em `billing_periods`
- [ ] Trocar `mockEnvios.ts` por um registro real de envio (tabela `sends` ou colunas de timestamp em `invoices`)
- [ ] Configurações: persistir os campos (hoje só exibidos) — a começar por dias de vencimento do boleto/PIX

### 7. Multi-tenant / whitelabel
- [ ] Seletor de rede (Forneria / The Duck) trocando o tenant ativo no Sidebar/CobrandBar — hoje só a tela de Franquias distingue as duas marcas (via filtro), o resto do app continua fixo em "Forneria Original"
- [ ] Logo/cor do cliente dinâmicos a partir de `tenant.logo_url` / `tenant.primary_color` (hoje a caixa do logo do cliente na CobrandBar é um placeholder sem imagem)

## Critérios de aceite do MVP (seção 10 do MD)

- [ ] Diretor consegue subir a planilha `.xlsx` de uma competência
- [ ] Sistema extrai corretamente unidade + Call Center + Royalties + Marketing, ignorando totais e tratando vazio como zero
- [ ] Preview mostra todas as unidades antes de confirmar a importação
- [ ] Após confirmar, dashboard reflete os dados: KPIs, gráfico, donut e tabela
- [ ] "Emitir lote" gera NFS-e e boleto/PIX simulados e muda status das faturas
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
