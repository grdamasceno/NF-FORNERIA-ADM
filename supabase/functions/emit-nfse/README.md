# emit-nfse

Edge Function (Deno) que faz a emissão real de NFS-e via [API da Focus
NFe](https://doc.focusnfe.com.br/). Não é chamada pelo frontend ainda — ver
`TODO.md` → "Integração Focus NFe" para o que falta antes disso.

## Antes de rodar

1. Rodar `supabase/migrations/0003_emitter_credentials.sql` (cria
   `emitter_credentials` e as colunas fiscais em `emitters`/`emitter_mapping`).
2. Preencher, por SQL direto (nunca pela API/anon key — a tabela não tem
   grant nenhum de propósito):
   ```sql
   insert into nf_forneria.emitter_credentials (emitter_id, ambiente, token)
   values ('<uuid do emitter>', 'homologacao', '<token da Focus NFe>');
   ```
3. Preencher `inscricao_municipal` e `codigo_municipio` (código IBGE do
   município, 7 dígitos) em `nf_forneria.emitters` para cada CNPJ emissor.
4. Preencher `item_lista_servico` (código LC 116/2003) em
   `nf_forneria.emitter_mapping` para cada combinação marca×serviço —
   confirmar com o contador antes.

## Deploy no self-hosted (Coolify)

Isto varia conforme como o `supabase/edge-runtime` está montado no seu
stack — geralmente é um volume Docker apontando pra uma pasta de funções
dentro do container. Ajuste o `docker-compose`/serviço no Coolify pra
incluir esta pasta (`supabase/functions/emit-nfse`) no volume de funções, e
garanta que o runtime tem acesso a `SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY` como variáveis de ambiente da função (não do
frontend — essas nunca viram `VITE_*`).

Se o seu setup usa a Supabase CLI para deploy (`supabase functions deploy
emit-nfse --project-ref ...`), ela também funciona contra instâncias
self-hosted configuradas como projeto local (`supabase link`), mas depende
da versão do CLI e de como o self-hosted expõe a API de management —
confirmar se isso está disponível no seu stack antes de tentar.

## Contrato

**POST** `/functions/v1/emit-nfse`

```jsonc
// emitir
{
  "emitterId": "uuid",
  "ambiente": "homologacao", // ou "producao"
  "ref": "identificador único (ex: id do invoice_item)",
  "tomador": {
    "cnpj": "12345678000199", // ou "cpf"
    "razaoSocial": "Forneria Vargem Pequena",
    "endereco": {
      "logradouro": "...", "numero": "...", "bairro": "...",
      "codigoMunicipio": "3304557", "uf": "RJ", "cep": "00000000"
    }
  },
  "servico": { "valor": 1980.5, "discriminacao": "Call Center - Junho/2026", "itemListaServico": "..." }
}

// consultar status de uma emissão já feita
{ "action": "consultar", "emitterId": "uuid", "ambiente": "homologacao", "ref": "..." }
```

Resposta é o corpo retornado pela Focus NFe (`status`: `processando_autorizacao`
| `autorizado` | `erro_autorizacao` | `cancelado`) — ver
[doc.focusnfe.com.br/reference/consultar_nfse](https://doc.focusnfe.com.br/reference/consultar_nfse).
