# MVP · Faturamento de Franquias (OnChannel)

> Documento de especificação para desenvolvimento no Claude Code.
> Stack alvo: **React + TypeScript + Supabase**, seguindo o layout de referência
> `MVP_Faturamento_Franquias_OnChannel.html`.

---

## 1. Objetivo do MVP

Permitir que o diretor da rede **suba uma planilha (.xlsx)** já preenchida com os valores
de cobrança do mês (Call Center, Royalties, Marketing por unidade) e que o sistema:

1. Leia e interprete a planilha automaticamente.
2. Gere, para cada franquia, uma **fatura simulada** (NFS-e + boleto/PIX simulados).
3. Exiba tudo num painel visual (dashboard) igual ao HTML de referência, com KPIs,
   gráficos e tabela de franquias.

**Este MVP NÃO emite nota fiscal real.** Toda emissão de NFS-e e geração de
boleto/PIX é **simulada** (dados fake com formato plausível). O ponto de integração
real com a **Focus NFe** (emissão) e o gateway de boleto/PIX fica marcado no código
como TODO, pronto para ser plugado depois — ver seção 8.

No futuro (fora deste MVP), o preenchimento deixará de ser via planilha e passará a
ser direto no sistema (formulário/CRUD). Por isso, a modelagem de dados já deve ser
pensada para representar "fatura da unidade no mês" independente da origem (hoje:
importação de planilha; amanhã: input manual).

---

## 2. Fluxo do usuário

1. **Login** (diretor/admin da rede) — autenticação via Supabase Auth.
2. **Selecionar competência** (mês/ano) — ex: Junho/2026.
3. **Upload da planilha** (`.xlsx`) na tela de Faturamento (botão "Importar planilha",
   já existe no layout de referência).
4. **Pré-visualização dos dados extraídos** antes de confirmar:
   - Lista de unidades identificadas, valores por componente (Call Center, Royalties,
     Marketing), valor total calculado.
   - Alertas de inconsistência (ex: unidade sem nenhum valor, linha não reconhecida,
     valor negativo).
5. **Confirmar importação** → sistema grava as faturas do mês no banco (Supabase) com
   status inicial `pendente_emissao`.
6. **"Emitir lote" (simulado)** → sistema gera para cada fatura:
   - Número de NFS-e simulado (ex: `NFS-e 001284`, sequencial fake).
   - Boleto/PIX simulado (código de barras fake + copia-e-cola PIX fake).
   - Muda status para `emitida`.
7. **Envio automático (simulado)** por WhatsApp/e-mail — não dispara mensagem real
   neste MVP, apenas marca o "canal" como enviado (✓/pendente) na tabela, preparando
   o gancho para a automação real via n8n/Chatwoot mais adiante.
8. **Painel (dashboard)** exibe o mês selecionado: KPIs, gráfico emitido × recebido,
   donut de status de pagamento, tabela detalhada por franquia — layout idêntico ao
   HTML de referência.
9. **Baixa de pagamento** (manual, MVP simples): o diretor marca uma fatura como
   "Paga" manualmente (ainda sem conciliação bancária automática).

---

## 3. Mapeamento da planilha → dados do sistema

A planilha de referência (`Banco_Junho_2026_Emissao_de_boletos.xlsx`) tem **uma aba
por rede/marca** (ex: `Forneria`, `The Duck`). Cada aba segue este padrão de colunas
(a ordem pode variar levemente entre abas, então o parser deve buscar pelo **nome do
cabeçalho**, não pela posição fixa da coluna):

| Coluna na planilha | Campo no sistema | Observação |
|---|---|---|
| Nome da loja / primeira coluna | `unit_name` | Nome da franquia |
| `CALL CENTER` | `call_center_value` | Numérico, célula vazia = 0 |
| `ROYALTS` | `royalties_value` | Numérico, célula vazia = 0 |
| `Marketing` | `marketing_value` | Numérico, célula vazia = 0 |
| Linha de totais (última linha) | — | **Ignorar** ao importar (não é uma unidade) |

Cada um desses 3 valores lidos da planilha vira, na importação, um `invoice_item`
candidato (Call Center, Royalties, Marketing). Se o tenant estiver em modo
`consolidado`, os 3 são somados em 1 item só na hora de gerar a fatura; se estiver em
`separado_por_servico`, cada um vira seu próprio `invoice_item` com NFS-e simulada
independente. Ver seção 4 para o modelo completo.

**Regra assumida (confirmar com o contador antes de ligar a integração real):**
Royalties, Marketing e Call Center podem ter **códigos de serviço e alíquotas de ISS
diferentes**, então a quantidade de **notas fiscais** geradas por unidade/mês é uma
decisão fiscal, não técnica. O modelo de dados (seção 4) já foi desenhado para
suportar os dois cenários sem precisar de redesenho:

- **Consolidado:** 1 nota por unidade, com o valor total (Call Center + Royalties +
  Marketing somados).
- **Separado:** até 3 notas por unidade (uma por tipo de serviço).

Em ambos os casos, **o boleto/PIX continua sendo 1 único por unidade/mês** — a
cobrança é sempre consolidada, só a quantidade de NFS-e por trás dela pode variar.

**Nome da rede/marca** = nome da aba da planilha (define o tenant/whitelabel a ser
aplicado, como já ocorre no `--client-logo` do HTML de referência).

### Validações no parser
- Ignorar linhas totalmente vazias.
- Ignorar a linha de totais (identificável por não ter nome de unidade válido, ou por
  ser a última linha com apenas números).
- Tratar célula vazia/NaN como `0`, nunca como erro.
- Se `call_center_value + royalties_value + marketing_value === 0`, marcar a unidade
  como "sem cobrança no mês" (não gerar fatura, mas listar no resumo de importação).
- Nome da unidade sem padronização de caixa (ex: `BARRA` vs `Botafogo`) — normalizar
  para exibição (title case), mas manter nome original como referência interna.

---

## 4. Modelo de dados (Supabase / Postgres)

```sql
-- Redes / marcas (tenants — multi-cliente / whitelabel)
tenants (
  id uuid pk,
  name text,              -- ex: "Forneria Original", "The Duck"
  logo_url text,
  primary_color text,     -- suporte ao whitelabel do layout
  created_at timestamptz
)

-- Franquias / unidades
units (
  id uuid pk,
  tenant_id uuid fk -> tenants.id,
  name text,               -- ex: "Forneria Barra da Tijuca"
  cnpj text,                -- pode ficar nulo no MVP (planilha não traz CNPJ)
  active boolean default true,
  created_at timestamptz
)

-- Competências (mês de referência do faturamento)
billing_periods (
  id uuid pk,
  tenant_id uuid fk -> tenants.id,
  reference_month date,    -- ex: 2026-06-01
  source_file_name text,   -- nome da planilha importada
  imported_at timestamptz,
  imported_by uuid fk -> auth.users.id
)

-- Fatura por unidade/mês (o que vira a cobrança — sempre 1 boleto/PIX por unidade)
invoices (
  id uuid pk,
  billing_period_id uuid fk -> billing_periods.id,
  unit_id uuid fk -> units.id,
  total_value numeric,               -- soma de todos os invoice_items
  payment_method text default 'boleto_pix',
  boleto_code text,                  -- simulado
  pix_copia_cola text,                -- simulado
  payment_status text,               -- 'paga' | 'a_vencer' | 'atraso' | 'pendente'
  due_date date,
  paid_at timestamptz,
  whatsapp_sent boolean default false,
  email_sent boolean default false,
  status text,                        -- 'pendente_emissao' | 'emitida' | 'enviada' | 'paga' | 'falha'
  created_at timestamptz
)

-- Itens da fatura (1 a N por invoice — permite consolidar OU separar por serviço)
invoice_items (
  id uuid pk,
  invoice_id uuid fk -> invoices.id,
  service_type text,       -- 'royalties' | 'marketing' | 'call_center' | 'consolidado'
  service_code text,       -- código de serviço (LC 116/2003) — para integração real futura
  value numeric,
  nfse_number text,        -- simulado, ex: "NFS-e 001284"
  nfse_status text,        -- 'pendente' | 'simulada' | 'falha'
  created_at timestamptz
)
```

**Como isso resolve consolidado × separado:** ao gerar a fatura de uma unidade, o
sistema decide (por configuração do tenant, ver `tenants.nfse_mode` abaixo) se cria
**1 item** (`service_type = 'consolidado'`, valor = soma dos 3) ou **3 itens**
(um por `service_type`, cada um com sua própria NFS-e simulada). O `invoices.total_value`
e o boleto **não mudam** em nenhum dos dois casos — só a quantidade de `invoice_items`
(e, consequentemente, de NFS-e) varia. Adicionar em `tenants`:

```sql
tenants (
  ...,
  nfse_mode text default 'consolidado'  -- 'consolidado' | 'separado_por_servico'
)
```

---

## 5. Telas (seguindo o layout do HTML de referência)

### 5.1 Painel (Dashboard) — tela principal, já prototipada no HTML
- Sidebar com navegação: Painel, Franquias, Faturamento, Notas Fiscais,
  Boletos & PIX, Envios, Relatórios, Configurações.
- Barra de co-branding (whitelabel) no topo.
- Seletor de competência (mês/ano).
- 4 KPIs: Faturamento emitido, Recebido, Em aberto, Inadimplência (%).
- Gráfico de barras: emitido × recebido por mês.
- Donut: status de pagamento (pagas / a vencer / em atraso).
- Tabela de franquias do mês: unidade, valor, NFS-e (simulada), status de pagamento,
  canal de envio (WhatsApp/e-mail), status geral.

### 5.2 Importar planilha (novo, não existe no HTML de referência)
- Upload de `.xlsx`.
- Preview dos dados extraídos por unidade, com totalizadores.
- Lista de alertas/inconsistências antes de confirmar.
- Botão "Confirmar importação".

### 5.3 Emitir lote (simulado)
- Lista das faturas `pendente_emissao` da competência selecionada.
- Botão "Emitir lote" → gera NFS-e e boleto/PIX simulados para todas de uma vez.
- Feedback visual de progresso (mesmo sendo simulado, deve simular um pequeno delay
  para parecer processamento real — importante para você já validar a UX que vai
  usar quando a integração real entrar).

### 5.4 Detalhe da fatura (unidade)
- Dados da unidade, breakdown Call Center / Royalties / Marketing.
- Número da NFS-e simulada, boleto/PIX simulados (com aviso visual "SIMULADO").
- Botão "Marcar como paga" (baixa manual).
- Histórico de envio (WhatsApp/e-mail).

---

## 6. Regras de negócio (MVP)

- **Uma competência (mês) por importação.** Reimportar a mesma competência deve
  perguntar se o diretor quer **substituir** os dados anteriores ou **ignorar**
  duplicados (decisão de produto simples: MVP pode só bloquear reimportação do
  mesmo mês e exigir exclusão manual antes).
- **Status da fatura** segue o fluxo:
  `pendente_emissao` → `emitida` (simulado) → `enviada` (simulado) → `paga` (manual)
  ou → `atraso` (calculado automaticamente quando `due_date < hoje` e não paga).
- **Inadimplência (%)** = valor total em atraso / valor total emitido no mês.
- **Vencimento (`due_date`)** padrão: 10 dias corridos após a emissão simulada
  (ajustável — parametrizar, não deixar hardcoded).

---

## 7. Fora do escopo deste MVP

- Emissão real de NFS-e (integração Focus NFe).
- Geração real de boleto/PIX (integração com banco/gateway de pagamento).
- Conciliação bancária automática.
- Envio real de WhatsApp/e-mail (fica só o registro do status de envio).
- Preenchimento manual dos valores direto no sistema (planejado para próxima fase).
- Cadastro de CNPJ/dados fiscais completos da unidade (pode ser campo simples por
  enquanto).
- Múltiplos usuários/permissões granulares (MVP = 1 perfil "diretor/admin").

---

## 8. Pontos de integração futura (deixar preparado no código)

Marcar claramente no código (comentário `// TODO: INTEGRAÇÃO FUTURA`) os pontos onde
hoje existe uma função "simulada" que futuramente vira chamada real:

- `simulateNfseEmission(invoice)` → futuramente chama a **API da Focus NFe**.
- `simulateBoletoGeneration(invoice)` → futuramente chama o gateway de
  boleto/PIX escolhido.
- `simulateWhatsappSend(invoice)` → futuramente dispara via **n8n/Chatwoot (Baileys)**.
- `simulateEmailSend(invoice)` → futuramente integra com provedor de e-mail.

Cada função simulada deve ter uma assinatura (parâmetros de entrada/saída) já
compatível com o que a API real provavelmente vai exigir, para reduzir retrabalho.

---

## 9. Stack técnica

- **Frontend:** React + TypeScript, componentes seguindo fielmente o visual do HTML
  de referência (cores, tipografia Montserrat/Inter, cards, sidebar).
- **Gráficos:** Chart.js (mesma lib usada no HTML de referência).
- **Backend/dados:** Supabase (Postgres + Auth + Storage para guardar a planilha
  original importada).
- **Parsing da planilha:** biblioteca client-side ou edge function Supabase
  (ex: `xlsx`/`sheetjs`) para ler o `.xlsx` e popular as tabelas.
- **Deploy:** Coolify (ambiente já usado por Cleópatra).

---

## 10. Critérios de aceite do MVP

- [ ] Diretor consegue subir a planilha `.xlsx` de uma competência.
- [ ] Sistema extrai corretamente unidade + Call Center + Royalties + Marketing,
      ignorando linha de totais e tratando células vazias como zero.
- [ ] Preview mostra todas as unidades antes de confirmar a importação.
- [ ] Após confirmar, dashboard reflete os dados: KPIs, gráfico, donut e tabela.
- [ ] "Emitir lote" gera NFS-e e boleto/PIX simulados (visualmente claros como
      simulação) e muda status das faturas.
- [ ] É possível marcar uma fatura como paga manualmente e o dashboard atualiza
      (recebido, inadimplência).
- [ ] Layout visual bate com o HTML de referência (cores, componentes, disposição).
- [ ] Multi-tenant funcional: dá pra trocar de rede (Forneria / The Duck) e ver
      dados/whitelabel isolados.
