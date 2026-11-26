# Fase 0a do negociador autônomo · Parte VERITAS (Item 43)

Data: 25/11/2026, atualizado em 26/11/2026 com as correções da revisão independente (seção 8). Branch `vicenzzopalma/negociador-fase0a-veritas`. **Sem deploy, sem push, sem PR.** A VPS foi lida apenas (sha256 de arquivos de código; nenhum `.env`, `WppKeys` ou credencial lido).

## 1. Base reconciliada

O branch saiu de `origin/main` `265a0ea` (o `master` local não tinha `RetornoIaController.ts`). Os blobs de `265a0ea` batem byte a byte com `/var/www/VERITAS/backend` na VPS:

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
- `3892355` docs: este relatório.
- `6cd51c6` fix(retorno_ia): ressalvas da revisão independente (I1 a I4, M3, M4, M6, M7, M8).
- commit seguinte: relatório da revisão (`docs/relatorios/revisao-independente-2026-11-25.md`) e esta atualização.

## 3. O que mudou

### 3.1 `POST /internal/retorno-ia/send` (`RetornoIaController.ts`)
- `tipo`: `texto` (padrão quando ausente), `documento`, `imagem`, `audio`. Mídia vem em `base64` + `mimetype` (+ `nome_arquivo`, obrigatório no documento; `texto` vira legenda em documento e imagem; `ptt` opcional no áudio).
- Teto `RETORNO_IA_MAX_MIDIA_BYTES` sobre o tamanho decodificado, conferido antes de alocar o buffer. **Sem a env (padrão) a mídia é recusada** com 403 `ERR_MIDIA_DESLIGADA`.
- Validações: base64 estrito; mimetype em lista branca por tipo (documento: pdf, jpeg, png, txt, doc/docx, xls/xlsx; imagem: jpeg, png, webp; áudio: ogg, opus, mpeg, mp4, aac, amr); nome sem barra nem caractere de controle e, se tiver extensão, só as da lista.
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
| 409 | `ERR_ARQUIVADA` | trava ligada, fonte válida e jid arquivado (seção 8, I4) | não |
| **503** | **`ERR_WAPP_NOT_INITIALIZED`** | `getWbot` falhou antes do envio: nada saiu | **sim** (como o Item #22) |
| 500 | `ERR_ENVIO_FALHOU` | `sendMessage` lançou | não (pode ser incerto) |
| 502 | `ERR_SEM_MENSAGEM_ID` | envio sem `key.id` | **não** (pode ter saído) |

- Continua restrita a `RETORNO_IA_CONEXOES`, ao token e aos IPs, direto no socket (não marca ticket como lido).
- Compatível com `enviar_veritas` (`bot/retorno_ia.py`), que manda `{whatsappId, numero, texto, delay}`: mesmo fluxo (presença `composing`, espera, `{ text }`), mesma resposta de sucesso.

### 3.2 Fonte de arquivadas (`helpers/retornoIaArquivo.ts`, ligada em `whaileys.ts`)
- **Tap** `chats.update`: só `{id, archived}` booleano, sem `@g.us`. Atualiza o mapa em memória, mas **não renova a idade**. O mapa nunca perde um `archived: true` sem um `false` explícito, nem no snapshot completo.
- **keyData**: nas conexões cobertas, o `keyData` base64 das `app-state-sync-key` vira bytes (mesma correção do Item #21; o ramo da Marcela ficou intocado, o novo é um `else if`).
- **Ciclo**: ligado uma vez no `connection open` de uma conexão coberta. Primeira execução após `RETORNO_IA_ARQUIVO_INICIO_S`, depois a cada `RETORNO_IA_ARQUIVO_INTERVALO_S`. Uma conexão por vez:
  - primeira vez no processo, ou depois de falha: **snapshot completo** (zera só `app-state-sync-version/regular_low`, `resyncAppState(["regular_low"], false)`; se a versão não voltar, a anterior é restaurada). O resultado é mesclado ao mapa;
  - depois: **incremental** a partir da versão salva, com merge.
  - Sincronização boa = sem exceção, sem timeout (`RETORNO_IA_ARQUIVO_TIMEOUT_MS`), sem `failed to sync state` de `regular_low` **desta conexão** (logger filho por conexão), com versão presente depois e com o **buffer de eventos do socket livre** ao final. Só ela renova `ultima_sync_ok`.
  - Qualquer falha (no ciclo ou fora dele) põe `ultimo_erro` e derruba `valida` na hora.
- Só leitura: não desloga, não pede QR, não envia mensagem.
- Conexões cobertas = `RETORNO_IA_ARQUIVO_CONEXOES` ∩ `RETORNO_IA_CONEXOES`. Vazia por padrão: nada roda.

### 3.3 `GET /internal/retorno-ia/arquivadas[?conexao=N]`
Mesmo `autorizar` (token + IPs). Conexão fora da cobertura: 403 `ERR_CONEXAO_NAO_LIBERADA`. Resposta:

```json
{ "ok": true, "agora": "…", "validade_s": 600,
  "conexoes": [ { "conexao": 23, "ultima_sync_ok": "…" , "idade_s": 42, "valida": true,
                  "ultimo_erro": null, "arquivadas": ["…@s.whatsapp.net", "…@lid"] } ] }
```

`valida` = houve sincronização boa há no máximo `RETORNO_IA_ARQUIVO_VALIDADE_S` (600 s), **nenhuma falha depois dela** (`ultimo_erro: null`) e o relógio não voltou para antes dela. Resposta com `Cache-Control: no-store`. **Contrato para o robô:** `valida: false`, conexão ausente ou falha na consulta = o chip não recebe nada (fail-closed). A trava do lado do robô (`retorno_ia.arquivadas()` e a porta final) fica no repositório do PA FIXA, fora deste branch.

## 4. Envs novas (todas desligadas ou vazias por padrão)

| Env | Padrão | Efeito |
|---|---|---|
| `RETORNO_IA_MAX_MIDIA_BYTES` | vazia (0) | mídia recusada. Sugestão ao ligar: `5242880` (o `express.json` global é de 10 MB, então o teto útil fica em ~7 MB decodificados) |
| `RETORNO_IA_ARQUIVO_CONEXOES` | vazia | fonte de arquivadas desligada. Para ligar: `23,28,161,25,40,53,71,114,142,1,16` |
| `RETORNO_IA_ARQUIVO_VALIDADE_S` | 600 | idade máxima para `valida` |
| `RETORNO_IA_ARQUIVO_INTERVALO_S` | 300 | intervalo do ciclo |
| `RETORNO_IA_ARQUIVO_INICIO_S` | 90 | espera após o primeiro `open` |
| `RETORNO_IA_ARQUIVO_TIMEOUT_MS` | 45000 | timeout de cada resync |
| `RETORNO_IA_TRAVA_ARQUIVADAS` | vazia | `1` liga a trava server-side da rota de envio (seção 8, I4) |

## 5. Testes

`backend/src/__tests__/unit/RetornoIa/` (jest + ts-jest, padrão do repositório, sem banco e sem rede):
- `RetornoIaSend.spec.ts` (24): texto antigo sem `tipo` e com `tipo: null`, conexão fora da lista negada, 503 `ERR_WAPP_NOT_INITIALIZED`, 500 sem vazar detalhe, 502 sem `key.id`, validações, mídia desligada, documento, imagem, áudio, teto exato e +1 byte (413), svg/html/exe recusados, nome com caractere de controle ou `.html` recusado, autorização, rota de arquivadas (sem sync = inválida, conexão fora negada, `no-store`) e a trava I4 (409 com fonte válida, envia sem fonte, desligada por padrão, conexão não coberta).
- `RetornoIaArquivo.spec.ts` (22): o socket falso agora imita o buffer de eventos do whaileys 6.5.1 (`buffer()`/`flush()`, `resyncAppState` como `createBufferedFunction`). Cobre lista vazia por padrão, `keyData`, filtro sem grupos, snapshot completo, **buffer já aberto por terceiro** e **emissão adiada** (I1), merge fail-closed, incremental, heartbeat 600/601 s, **falha depois de um OK** e falha fora do ciclo (I2), relógio voltando (M3), filtro de coleção e **falha no logger de outra conexão** com pino real (I3), repasse ao `info` do logger base (M4), timeout, restauração de versão, sonda do buffer, `situacaoArquivo` e ciclo serial e idempotente.

Resultado em 26/11: `npx jest src/__tests__/unit/RetornoIa src/__tests__/unit/WhatsApp` = **4 suítes, 63 testes OK** (46 novos e 17 existentes). Com `--runInBand --detectOpenHandles`: 46 OK, sem handle aberto. `eslint` sem erro nos arquivos tocados. `tsc --noEmit`: nenhum erro nos arquivos tocados (os que aparecem já existiam em `whaileys.ts`, `wwebjs.ts`, `config/` e `WhatsAppController.ts`). As suítes `User/*` dependem de banco e não foram rodadas. Lacuna que continua: não há teste de integração dos ganchos dentro de `whaileys.ts` (o módulo não sobe sem banco); as peças que ele chama são testadas isoladamente.

## 6. Pacote pronto para publicar (NÃO executado)

Arquivos (sha256 dos blobs do commit `6cd51c6`, finais de linha LF como na produção; a tabela anterior, de `c96c2e8`, foi substituída):

| Arquivo | sha256 |
|---|---|
| `src/controllers/RetornoIaController.ts` | `6afebec0e1b27fa8f7bb47de9160b41c3611311bf925ca9ddda0e8a620e125a5` |
| `src/helpers/retornoIaArquivo.ts` (novo) | `8c371cd8a657ef51ae4e60baf5794fb2203c3ea3e31158ba1dc73688b709bfab` |
| `src/providers/WhatsApp/Implementations/whaileys.ts` | `56f1820d958ac9cfeab65aa0fc0bb80f246bdb2dbaad57a32ac1d8db983d9907` |
| `src/routes/retornoIaRoutes.ts` | `54821119263dd7596678674d9348f0f3762ca08e9408b3f4c770b514b4e60560` |

Em 26/11 a VPS continuava com os sha256 da base (seção 1) e sem o helper novo.

Passos propostos, depois da revisão e da autorização do dono:
1. Conferir de novo que os 4 arquivos da VPS ainda têm os sha256 da base (seção 1; o helper novo não pode existir).
2. Backup em `/opt/pafixa/backups/negociador-fase0a-veritas-<data>/veritas/` dos 3 arquivos existentes e do `.env` (cópia, sem imprimir).
3. Copiar os 4 arquivos e conferir os sha256 da tabela acima.
4. **Primeira publicação sem env nova**: `pm2 restart veritas-backend` fora do pico. Conferir sessões CONNECTED antes e depois (no restart de 24/11, 7 sessões foram para QR), `/internal/retorno-ia/send` só texto respondendo igual e `GET /internal/retorno-ia/arquivadas` com `conexoes: []`.
5. Depois, ligar por etapa: `RETORNO_IA_ARQUIVO_CONEXOES` com um chip (ex.: `23`), restart, ler a rota após ~2 min (`valida: true`, `ultimo_erro: null`). Acompanhar por algumas horas a taxa de `ultimo_erro` (`ERR_BUFFER_PENDENTE`, `ERR_SYNC_FALHOU`, `ERR_FALHA_POSTERIOR`) e só então a lista toda. `RETORNO_IA_TRAVA_ARQUIVADAS=1` depois que a fonte estiver estável. `RETORNO_IA_MAX_MIDIA_BYTES` só quando o robô souber mandar mídia.

Rollback proposto: restaurar os 3 arquivos do backup, apagar `src/helpers/retornoIaArquivo.ts`, remover do `.env` as envs da seção 4, `pm2 restart veritas-backend`. O `regular_low` alterado pelo snapshot é estado normal do app-state (o próprio whaileys o reescreve a cada `server_sync`); nada a desfazer no `WppKeys`.

Atenção: o deploy automático faz `git reset --hard origin/main` na VPS. Se este branch for para a `main`, usar `[skip ci]` e publicar manualmente como acima, ou garantir que a VPS esteja igual à `main`.

## 7. O que o bot VERITAS precisa revisar

1. **Mudanças de contrato sem env** (exigidas pelo item): `getWbot` sem sessão passa de 500 para 503; envio sem `key.id` passa de 200 para 502; todas as respostas de erro ganham `codigo`; `tipo` desconhecido agora é 400 (antes era ignorado e saía texto). O cliente atual trata qualquer não 2xx como falha sem repetição, então só muda o texto `HTTP 503` na auditoria dele.
2. **Decodificar o `keyData` destrava todo o app-state** das conexões cobertas, não só o `regular_low`: `server_sync` de outras coleções passa a aplicar ações (fixar, silenciar, contatos). `contacts.upsert` cai no handler do CRM e pode atualizar nome de contato (`CreateOrUpdateContactService`). É o mesmo efeito já em produção nas conexões 1, 22 e 135 da Marcela.
3. **Snapshot completo na primeira sync de cada conexão por processo** (zera a versão `regular_low`, como a rota de resync do Item #21). Com 11 chips, o primeiro ciclo após cada restart faz 11 snapshots, um por vez.
4. **Falhas de sync por conexão** (corrigido em 26/11): cada conexão coberta recebe um logger filho; só a falha de `regular_low` dela conta. As conexões não cobertas continuam com o logger base, sem mudança. O filho repassa ao `info` atual do base, então a rota de resync da Marcela segue vendo as falhas da conexão 1.
5. **Conexão 1** está no tap da Marcela (`veritas4632`) e no `retorno_ia`: o resync periódico também chega ao robô da Marcela como `chats.update` (mesmos dados, mais frequentes).
6. **Estado só em memória**: após restart, nenhum chip é válido até o primeiro ciclo (~90 s + ~5 s por chip). Fail-closed por desenho. O mapa só cresce com `true` e só perde com `false` explícito: conversa apagada no aparelho pode ficar travada até o próximo restart (lado seguro).
7. **Sonda do buffer**: no fim de cada sync o ciclo abre e fecha o buffer de eventos do socket. Se outro o segura (ex.: drenagem da fila offline), a sync é recusada (`ERR_BUFFER_PENDENTE`) e tentada no próximo ciclo. Em conexão com fila offline longa, a fonte pode ficar inválida por mais tempo (lado seguro).
8. **jids `@lid`** aparecem na lista de arquivadas: o robô precisa resolver por `LidMappings` antes de comparar com o telefone.
9. **Teto efetivo de mídia** limitado pelo `express.json` global de 10 MB (base64 infla 4/3).
10. **Lado do robô (fora deste branch)**: `enviar_veritas` com `tipo`/`base64`; `arquivadas()` consumindo a rota com fail-closed por chip (`valida`); retry só para `ERR_WAPP_NOT_INITIALIZED`; nunca reenviar em `ERR_SEM_MENSAGEM_ID` ou `ERR_ENVIO_FALHOU`.

## 8. Correções da revisão independente (26/11/2026)

A revisão (`docs/relatorios/revisao-independente-2026-11-25.md`, mantida no commit) deu "pronto com ressalvas". Tudo abaixo está em `6cd51c6`.

| Achado | Correção | Teste |
|---|---|---|
| **I1** snapshot aceito com lista vazia quando o buffer de eventos já estava aberto | `sondarBuffer`: depois do resync, com o ouvinte ainda ligado, `ev.buffer()` só abre se ninguém segura o buffer (aí fecha na hora); se outro segura, `ERR_BUFFER_PENDENTE` e a idade não renova. Além disso o snapshot completo **mescla** em vez de substituir: `archived: true` só sai com `false` explícito | buffer aberto por terceiro; emissão adiada; merge fail-closed; sonda |
| **I2** `valida` verdadeira depois de sync que falhou | `valida` exige `ultimo_erro === null`. Falha de `regular_low` a qualquer hora (`registrarFalhaSync`) marca `ERR_FALHA_POSTERIOR` e derruba `valida` na hora | falha depois de um OK dentro de 600 s; falha fora do ciclo |
| **I3** observador global invalidando por ruído de outras conexões | sai o embrulho do logger global. Conexão coberta recebe `loggerArquivoDaConexao` (filho do pino) no `makeWASocket`; só conta `failed to sync state` com `name === "regular_low"` | pino real com dois filhos; coleção diferente não conta |
| **I4** rota de envio sem trava de arquivadas | `RETORNO_IA_TRAVA_ARQUIVADAS=1` (desligada por padrão): conexão coberta + fonte válida + `numero@s.whatsapp.net` arquivado = 409 `ERR_ARQUIVADA`, sem tocar o socket. Sem fonte válida a rota **não decide**. Não vê `@lid`: complementa o robô, não o substitui | 409; não arquivada envia; sem fonte envia; desligada e não coberta |
| **M3** relógio voltando | `agora` antes de `ultima_sync_ok` = inválida | relógio 1 h para trás |
| **M4** corrida com a rota da Marcela | não há mais troca do `logger.info` global por este código; o filho chama o `info` atual do base | repasse ao `info` embrulhado |
| **M6** mimetype só sintático e nome com controle | lista branca por tipo, extensões permitidas, nome sem `\x00-\x1f`/`\x7f` | svg, html, exe, `\n` no nome, `.html` |
| **M7** sem `Cache-Control` | `no-store` na rota de arquivadas | header |
| **M8** lacunas de teste | socket falso com buffer real e os casos acima; `tipo: null`; ciclo idempotente | 46 testes |

Não alterado de propósito: **M1** (502 sem `key.id`, quase impossível, dívida para o cliente novo), **M2** (compatível), **M5** (efeito de decodificar o `keyData`, já documentado no item 2 da seção 7; nada desloga nem marca ticket como lido) e o saneamento de `ext` em `handleWhatsappEvents.ts` (preexistente; a lista branca de extensões na rota já fecha o caminho do robô).

Correção de um dado deste relatório: a versão de 25/11 dizia que os arquivos eram CRLF. São **LF** na base, na VPS e nos commits; a contagem anterior estava errada. Os sha256 não mudam com isso.
