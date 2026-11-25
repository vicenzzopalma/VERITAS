# Fase 0a do negociador autônomo · Parte VERITAS (Item 43)

Data: 25/11/2026. Branch `vicenzzopalma/negociador-fase0a-veritas`. **Sem deploy, sem push, sem PR.** A VPS foi lida apenas (sha256 de arquivos de código; nenhum `.env`, `WppKeys` ou credencial lido).

## 1. Base reconciliada

O branch saiu de `origin/main` `265a0ea` (o `master` local não tinha `RetornoIaController.ts`). Os blobs de `265a0ea` batem byte a byte (CRLF incluso) com `/var/www/VERITAS/backend` na VPS:

| Arquivo | sha256 (base = VPS) |
|---|---|
| `src/controllers/RetornoIaController.ts` | `6b558a8b394507f0cc15201e51bff65d8570ade70082993624f90d315f1f0da7` |
| `src/controllers/MarcelaController.ts` | `fcf82004348a25bdb84c675312fc871c530c5dc7575b978e26b99df6223b82b6` |
| `src/providers/WhatsApp/Implementations/whaileys.ts` | `0e3a329ca2df432b57ed79df9be4a0fb25b14cd6e3ee67eb4b60ae0dfa2c55dc` |
| `src/helpers/marcelaTap.ts` | `ba5b33c357a4e6bffabca59eb786cb0ced7bc818ef19421e9d918b29c3400622` |
| `src/middleware/isMarcelaInternal.ts` | `f145f63bc12e8c6b47ea0ebc3ffac6c6fe176350290bef764846aca7239175a5` |
| `src/routes/retornoIaRoutes.ts` | `ff78e6ebe85704a39f710f1968957e2085e3ec858bf91e6250b2bc2dcdfcce63` |
| `src/routes/marcelaRoutes.ts` | `d8ee6bbdcc5cf6aaf49219696b57e260249b64dd1a12a6b407e132975381def7` |
| `src/routes/index.ts` | `e8b45c3114a97e805e52d58ed94cb5285501d1d3251b5c337cddc927d45581e5` |
| `src/handlers/handleWhatsappEvents.ts` | `86cc4c9a69077cc171924ffd9b776e171e7a6193d3a3cb250998e3bb06f55203` |
| `src/app.ts` | `8d7a296be95368d2b8a3a103d3d227b6d024b3768aa2c8e8c7a47db0eb8fbff7` |
| `package.json` | `33a252123c3dac34dcc80967fd963a245ec2deadbdb268b23c25d9f3a796bd5e` |

`node_modules/whaileys` 6.5.1 local = VPS (`lib/Socket/chats.js` sha256 `2eb8d764…`). O `git status` da VPS ainda mostra esses arquivos como modificados/não rastreados em relação ao HEAD `cb89f54` dela: a árvore em execução é a de `265a0ea`.

## 2. Commits

- `c96c2e8` feat(retorno_ia): mídia, códigos de erro e fonte de arquivadas por conexão.
- commit deste relatório (só `docs/`).

## 3. O que mudou

### 3.1 `POST /internal/retorno-ia/send` (`RetornoIaController.ts`)
- `tipo`: `texto` (padrão quando ausente), `documento`, `imagem`, `audio`. Mídia vem em `base64` + `mimetype` (+ `nome_arquivo`, obrigatório no documento; `texto` vira legenda em documento e imagem; `ptt` opcional no áudio).
- Teto `RETORNO_IA_MAX_MIDIA_BYTES` sobre o tamanho decodificado, conferido antes de alocar o buffer. **Sem a env (padrão) a mídia é recusada** com 403 `ERR_MIDIA_DESLIGADA`.
- Validações: base64 estrito, `image/*` para imagem, `audio/*` para áudio, mimetype bem formado, nome sem barra.
- Resposta de sucesso: `{ ok: true, mensagem_id, tipo }`.
- Erros sempre `{ ok: false, codigo, erro }`, sem detalhe interno:

| HTTP | `codigo` | Quando | Reenviar? |
|---|---|---|---|
| 503 | `ERR_ROTA_DESLIGADA` | sem `RETORNO_IA_INTERNAL_TOKEN` | não |
| 403 | `ERR_ORIGEM_NAO_PERMITIDA` | IP fora de `MARCELA_ALLOWED_IPS` | não |
| 401 | `ERR_TOKEN_INVALIDO` | header `x-retorno-ia-token` errado | não |
| 403 | `ERR_CONEXAO_NAO_LIBERADA` | `whatsappId` fora de `RETORNO_IA_CONEXOES` | não |
| 400 | `ERR_NUMERO_INVALIDO`, `ERR_TIPO_INVALIDO`, `ERR_TEXTO_INVALIDO`, `ERR_MIDIA_INVALIDA`, `ERR_MIMETYPE_INVALIDO`, `ERR_NOME_ARQUIVO_INVALIDO` | pedido inválido | não |
| 403 | `ERR_MIDIA_DESLIGADA` | mídia sem teto configurado | não |
| 413 | `ERR_MIDIA_GRANDE` | acima do teto | não |
| **503** | **`ERR_WAPP_NOT_INITIALIZED`** | `getWbot` falhou antes do envio: nada saiu | **sim** (como o Item #22) |
| 500 | `ERR_ENVIO_FALHOU` | `sendMessage` lançou | não (pode ser incerto) |
| 502 | `ERR_SEM_MENSAGEM_ID` | envio sem `key.id` | **não** (pode ter saído) |

- Continua restrita a `RETORNO_IA_CONEXOES`, ao token e aos IPs, direto no socket (não marca ticket como lido).
- Compatível com `enviar_veritas` (`bot/retorno_ia.py`), que manda `{whatsappId, numero, texto, delay}`: mesmo fluxo (presença `composing`, espera, `{ text }`), mesma resposta de sucesso.

### 3.2 Fonte de arquivadas (`helpers/retornoIaArquivo.ts`, ligada em `whaileys.ts`)
- **Tap** `chats.update`: só `{id, archived}` booleano, sem `@g.us`. Atualiza o mapa em memória, mas **não renova a idade**.
- **keyData**: nas conexões cobertas, o `keyData` base64 das `app-state-sync-key` vira bytes (mesma correção do Item #21; o ramo da Marcela ficou intocado, o novo é um `else if`).
- **Ciclo**: ligado uma vez no `connection open` de uma conexão coberta. Primeira execução após `RETORNO_IA_ARQUIVO_INICIO_S`, depois a cada `RETORNO_IA_ARQUIVO_INTERVALO_S`. Uma conexão por vez:
  - primeira vez no processo, ou depois de falha: **snapshot completo** (zera só `app-state-sync-version/regular_low`, `resyncAppState(["regular_low"], false)`; se a versão não voltar, a anterior é restaurada). O resultado substitui o mapa;
  - depois: **incremental** a partir da versão salva, com merge.
  - Sincronização boa = sem exceção, sem timeout (`RETORNO_IA_ARQUIVO_TIMEOUT_MS`), sem `failed to sync state` no logger do whaileys e com versão presente depois. Só ela renova `ultima_sync_ok`.
- Só leitura: não desloga, não pede QR, não envia mensagem.
- Conexões cobertas = `RETORNO_IA_ARQUIVO_CONEXOES` ∩ `RETORNO_IA_CONEXOES`. Vazia por padrão: nada roda.

### 3.3 `GET /internal/retorno-ia/arquivadas[?conexao=N]`
Mesmo `autorizar` (token + IPs). Conexão fora da cobertura: 403 `ERR_CONEXAO_NAO_LIBERADA`. Resposta:

```json
{ "ok": true, "agora": "…", "validade_s": 600,
  "conexoes": [ { "conexao": 23, "ultima_sync_ok": "…" , "idade_s": 42, "valida": true,
                  "ultimo_erro": null, "arquivadas": ["…@s.whatsapp.net", "…@lid"] } ] }
```

`valida` = houve sincronização boa há no máximo `RETORNO_IA_ARQUIVO_VALIDADE_S` (600 s). **Contrato para o robô:** `valida: false`, conexão ausente ou falha na consulta = o chip não recebe nada (fail-closed). A trava do lado do robô (`retorno_ia.arquivadas()` e a porta final) fica no repositório do PA FIXA, fora deste branch.

## 4. Envs novas (todas desligadas ou vazias por padrão)

| Env | Padrão | Efeito |
|---|---|---|
| `RETORNO_IA_MAX_MIDIA_BYTES` | vazia (0) | mídia recusada. Sugestão ao ligar: `5242880` (o `express.json` global é de 10 MB, então o teto útil fica em ~7 MB decodificados) |
| `RETORNO_IA_ARQUIVO_CONEXOES` | vazia | fonte de arquivadas desligada. Para ligar: `23,28,161,25,40,53,71,114,142,1,16` |
| `RETORNO_IA_ARQUIVO_VALIDADE_S` | 600 | idade máxima para `valida` |
| `RETORNO_IA_ARQUIVO_INTERVALO_S` | 300 | intervalo do ciclo |
| `RETORNO_IA_ARQUIVO_INICIO_S` | 90 | espera após o primeiro `open` |
| `RETORNO_IA_ARQUIVO_TIMEOUT_MS` | 45000 | timeout de cada resync |

## 5. Testes

`backend/src/__tests__/unit/RetornoIa/` (jest + ts-jest, padrão do repositório, sem banco e sem rede):
- `RetornoIaSend.spec.ts` (16): texto antigo sem `tipo`, conexão fora da lista negada, 503 `ERR_WAPP_NOT_INITIALIZED`, 500 sem vazar detalhe, 502 sem `key.id`, validações, mídia desligada, documento, imagem, áudio (`ptt` e `recording`), teto exato e +1 byte (413), autorização (token, IP, rota desligada), rota de arquivadas (sem sync = inválida; conexão fora negada).
- `RetornoIaArquivo.spec.ts` (11): lista vazia por padrão e interseção, decodificação do `keyData`, filtro sem grupos, snapshot completo, incremental com merge, heartbeat 600 s válido e 601 s inválido, conexão não iniciada, `failed to sync state`, timeout, restauração da versão, ciclo serial.

Resultado: `npx jest src/__tests__/unit/RetornoIa src/__tests__/unit/WhatsApp` = **4 suítes, 44 testes OK** (27 novos + 17 existentes). Com `--runInBand --detectOpenHandles` nas suítes novas: 27 OK, nenhum handle aberto. `eslint` limpo nos arquivos novos. `tsc --noEmit` só acusa 3 erros preexistentes em `whaileys.ts` (linhas da base que não foram tocadas). As suítes `User/*` dependem de banco e não foram rodadas.

## 6. Pacote pronto para publicar (NÃO executado)

Arquivos (sha256 dos blobs do commit `c96c2e8`, CRLF como na produção):

| Arquivo | sha256 |
|---|---|
| `src/controllers/RetornoIaController.ts` | `846f21e62404a6cd024598be0aeea7057f2ecc4619a2d01da1d9311aa7fcb180` |
| `src/helpers/retornoIaArquivo.ts` (novo) | `fa440da1241cc9dbb53ba4a8b2fae666afe45756597d3daba1476f30c76f93ed` |
| `src/providers/WhatsApp/Implementations/whaileys.ts` | `eabc4e35e217909e539d03440da15be3d332b2da955677b26d3526a5a2c59c66` |
| `src/routes/retornoIaRoutes.ts` | `54821119263dd7596678674d9348f0f3762ca08e9408b3f4c770b514b4e60560` |

Passos propostos, depois da revisão e da autorização do dono:
1. Conferir de novo que os 4 arquivos da VPS ainda têm os sha256 da base (seção 1; o helper novo não pode existir).
2. Backup em `/opt/pafixa/backups/negociador-fase0a-veritas-<data>/veritas/` dos 3 arquivos existentes e do `.env` (cópia, sem imprimir).
3. Copiar os 4 arquivos e conferir os sha256 da tabela acima.
4. **Primeira publicação sem env nova**: `pm2 restart veritas-backend` fora do pico. Conferir sessões CONNECTED antes e depois (no restart de 24/11, 7 sessões foram para QR), `/internal/retorno-ia/send` só texto respondendo igual e `GET /internal/retorno-ia/arquivadas` com `conexoes: []`.
5. Depois, ligar por etapa: `RETORNO_IA_ARQUIVO_CONEXOES` com um chip (ex.: `23`), restart, ler a rota após ~2 min (`valida: true`, `ultimo_erro: null`), e só então a lista toda. `RETORNO_IA_MAX_MIDIA_BYTES` só quando o robô souber mandar mídia.

Rollback proposto: restaurar os 3 arquivos do backup, apagar `src/helpers/retornoIaArquivo.ts`, remover do `.env` as envs da seção 4, `pm2 restart veritas-backend`. O `regular_low` alterado pelo snapshot é estado normal do app-state (o próprio whaileys o reescreve a cada `server_sync`); nada a desfazer no `WppKeys`.

Atenção: o deploy automático faz `git reset --hard origin/main` na VPS. Se este branch for para a `main`, usar `[skip ci]` e publicar manualmente como acima, ou garantir que a VPS esteja igual à `main`.

## 7. O que o bot VERITAS precisa revisar

1. **Mudanças de contrato sem env** (exigidas pelo item): `getWbot` sem sessão passa de 500 para 503; envio sem `key.id` passa de 200 para 502; todas as respostas de erro ganham `codigo`; `tipo` desconhecido agora é 400 (antes era ignorado e saía texto). O cliente atual trata qualquer não 2xx como falha sem repetição, então só muda o texto `HTTP 503` na auditoria dele.
2. **Decodificar o `keyData` destrava todo o app-state** das conexões cobertas, não só o `regular_low`: `server_sync` de outras coleções passa a aplicar ações (fixar, silenciar, contatos). `contacts.upsert` cai no handler do CRM e pode atualizar nome de contato (`CreateOrUpdateContactService`). É o mesmo efeito já em produção nas conexões 1, 22 e 135 da Marcela.
3. **Snapshot completo na primeira sync de cada conexão por processo** (zera a versão `regular_low`, como a rota de resync do Item #21). Com 11 chips, o primeiro ciclo após cada restart faz 11 snapshots, um por vez.
4. **Observador de falhas no logger do whaileys** é global: uma falha de outra conexão durante a janela invalida a sync em curso. Erro só para o lado seguro (fonte inválida, robô não envia). A rota da Marcela também troca `logger.info` temporariamente; se ela rodar no meio do ciclo, o observador é reinstalado na próxima sincronização.
5. **Conexão 1** está no tap da Marcela (`veritas4632`) e no `retorno_ia`: o resync periódico também chega ao robô da Marcela como `chats.update` (mesmos dados, mais frequentes).
6. **Estado só em memória**: após restart, nenhum chip é válido até o primeiro ciclo (~90 s + ~5 s por chip). Fail-closed por desenho.
7. **jids `@lid`** aparecem na lista de arquivadas: o robô precisa resolver por `LidMappings` antes de comparar com o telefone.
8. **Teto efetivo de mídia** limitado pelo `express.json` global de 10 MB (base64 infla 4/3).
9. **Lado do robô (fora deste branch)**: `enviar_veritas` com `tipo`/`base64`; `arquivadas()` consumindo a rota com fail-closed por chip (`valida`); retry só para `ERR_WAPP_NOT_INITIALIZED`; nunca reenviar em `ERR_SEM_MENSAGEM_ID` ou `ERR_ENVIO_FALHOU`.
