# Revisão independente · Item 43 · Branch VERITAS da Fase 0a

Data: 25 e 26/11/2026. Revisor: portão independente, só leitura. Sem commit, push ou deploy; este arquivo não foi commitado.

Alvo: `vicenzzopalma/negociador-fase0a-veritas` (`c96c2e8`, `3892355`) contra `265a0ea`. Cliente: `E:\PAFIXA-ATENDIMENTO` `121f2a7:bot/retorno_ia.py`. whaileys 6.5.1 lido em `D:\VERITAS\backend\node_modules/whaileys/lib`.

Testes: rodei `jest src/__tests__/unit/RetornoIa` num worktree temporário (já removido): **2 suítes, 27 testes OK**.

## Achados

### I1 · Importante · Snapshot completo pode ser aceito como "válido" com a lista de arquivadas vazia ou incompleta (fail-open)
- Evidência: `backend/src/helpers/retornoIaArquivo.ts:237-260` (ouvinte local ligado só durante a janela) e `:285-292` (`estado.arquivadas = vistos` e `ultimaSyncOk = agora()`); whaileys `Socket/chats.js:322` (`resyncAppState` é `ev.createBufferedFunction`) e `Utils/event-buffer.js:44-52,122-133`: se o socket **já estava em buffer** quando o resync começa, `buffer()` devolve `false` e o resync **não faz flush**. Os `chats.update` do snapshot ficam retidos até quem abriu o buffer soltá-lo.
- Cenário: chip coberto processando uma tarefa em buffer lenta (fila offline, a mesma classe de trava que motivou `installEventBufferTaskTimeout`). O resync termina, os 3 s de espera passam, o `ev.off` remove o ouvinte, `vistos` está vazio, nenhum erro foi visto e a versão existe. Resultado: `valida: true`, `arquivadas: []`. O robô, seguindo o contrato "válida = pode enviar", manda resposta para conversa arquivada. O mapa só se corrige quando o buffer for liberado (via `registrarChatsUpdate`), o que pode levar dezenas de segundos ou mais. O mesmo vale para o primeiro snapshot depois de um restart.
- Nada nos testes pega isso: o socket falso emite `chats.update` de forma síncrona dentro do `resyncAppState` (`RetornoIaArquivo.spec.ts:46-57`).
- Correção sugerida (escolher uma ou combinar):
  1. no snapshot completo, **mesclar** com o mapa anterior em vez de substituir (um `archived:true` antigo só cai quando chega um `archived:false` explícito); isso é fail-closed;
  2. depois do resync, se `wbot.ev.isBuffering?.()` (ou equivalente) estiver verdadeiro, tratar como `ERR_BUFFER_PENDENTE` e não renovar a idade;
  3. snapshot completo com `vistos.size === 0` numa conexão que já teve arquivadas = falha (`ERR_SNAPSHOT_VAZIO`) até ser confirmado por um segundo snapshot.
  Depois, um teste com emissão adiada (depois do `ev.off`).

### I2 · Importante · `valida` continua verdadeira depois de uma sincronização que falhou
- Evidência: `retornoIaArquivo.ts:200-207` (`falhar` não mexe em `ultimaSyncOk`) e `:372-379` (`valida` depende só da idade).
- Cenário: a sync das 10:00 dá certo; a das 10:05 falha (timeout, `failed to sync state`, socket caído). Até 10:10 a rota responde `valida: true` com `ultimo_erro` preenchido. O plano diz "sem sincronização boa = não enviar", e o desenho escolhido aqui é só por idade. Se o robô olhar apenas `valida`, ele envia em cima de uma fonte que acabou de falhar, possivelmente com um mapa parcialmente mesclado (`:275`).
- Correção sugerida: `valida = idade <= validade && ultimoErro === null`, ou expor `valida_estrita` e documentar no contrato que o robô exige as duas. Testar "falha depois de um OK dentro de 600 s".

### I3 · Importante (disponibilidade, não segurança) · O observador de falhas é global e fica sujeito ao ruído das outras conexões
- Evidência: `retornoIaArquivo.ts:133-153` e `whaileys.ts:91-93`: um único `whaileyLogger` serve todas as sessões. Qualquer `failed to sync state` na janela invalida a sync em curso (`:270`).
- Cenário: as conexões que **não** estão na Marcela nem no `RETORNO_IA_ARQUIVO_CONEXOES` continuam com o `keyData` em base64, então todo `server_sync` delas falha com HMAC e o whaileys repete até 5 vezes, logando a cada tentativa. Com muitos chips ativos, a sync de um chip coberto tende a ser marcada como falha com frequência. Cada falha força um snapshot completo no ciclo seguinte (`:205`, `:228`), o que gera mais snapshots e mais falhas. O efeito é que a fonte fica inválida com frequência e o robô para de responder. O lado é seguro, mas pode deixar o produto travado.
- Correção sugerida: casar a falha com a conexão (o whaileys loga `{ name }` sem sessão; dá para usar um `logger.child` por sessão, se o `makeWASocket` aceitar um logger por socket) ou só contar falha quando a coleção for `regular_low` (`args[0].name === "regular_low"`). Medir no piloto de 1 chip (passo 5 do autor) a taxa de `ultimo_erro`.

### I4 · Importante · A rota de envio não aplica a trava de arquivadas, e este branch amplia o que sai por ela
- Evidência: `RetornoIaController.ts:237-305`: nenhuma consulta a `retratoArquivo`. `tipo` documento, imagem e áudio passam a sair pelo mesmo caminho.
- Cenário: a regra "não mandar para conversa arquivada" depende 100% do robô. No `121f2a7`, `arquivadas(cfg)` lê `chats_arquivados` do banco da Marcela (`retorno_ia.py:469-494`), que **não** cobre os 11 chips do retorno_ia (a fonte nova ainda não é consumida). Publicar o branch não piora isso (mídia fica desligada sem env), mas a porta final continua só no cliente.
- Correção sugerida (defesa em profundidade, atrás de env): em conexão coberta, recusar com `ERR_ARQUIVADA` (409) se o jid estiver arquivado e com `ERR_FONTE_INVALIDA` (503) se a fonte não estiver válida. Atenção ao `@lid`: a checagem do servidor só vê `numero@s.whatsapp.net`, então ela complementa o robô e não o substitui.

### M1 · Menor · 502 `ERR_SEM_MENSAGEM_ID` muda a gravação no robô atual
- Evidência: `RetornoIaController.ts:283-291`. No `121f2a7`, `_postar` (`retorno_ia.py:1040-1053`) transforma qualquer HTTPError em `(False, "HTTP 502")`.
- Efeito linha a linha:
  - RESPOSTA (`:1148-1154`): antes `ENVIADO` com id vazio, agora `FALHA`. Não há reenvio automático ("FALHA nunca é repetida sozinha", `:1092`), mas fica gravado errado se a mensagem saiu.
  - REPASSE (`:1195-1203`): `FALHA` no primeiro destino, `INCERTO` nos seguintes. Mesmo comportamento de antes para erros; o caso 200-sem-id antes contava como enviado.
  - Confirmação do SAIR (`:1170-1177`): antes `confirmar(..., True, None)` marcava confirmado; agora `confirmar(..., False)` → `optout_enviado` (`servico.py:1308-1321`) não chama `marcar_confirmado`. O **SAIR não se perde**: ele é registrado antes, por `optout_bot` (`:1162`). Mas se o devedor mandar SAIR de novo, o robô pode mandar uma segunda confirmação.
- Probabilidade: quase nula (o whaileys sempre gera `key.id`). Aceitável sem mudar o robô; registrar como dívida para o cliente novo.

### M2 · Menor · 500 → 503 em `getWbot` não muda nada no robô atual
- Evidência: `RetornoIaController.ts:258-264`. No cliente, 500 e 503 são o mesmo `FALHA "HTTP 5xx"`; não há retry. O "sim, reenviar" da tabela do autor só vale para o cliente futuro. `tipo` ausente continua sendo texto; o cliente nunca manda `tipo`. Sucesso ganha só o campo `tipo`. **Compatível.** Observação preexistente: timeout de 60 s no `_postar` vira `FALHA` mesmo que a mensagem tenha saído (não é deste branch).

### M3 · Menor · Idade calculada com relógio de parede; um salto para trás faz a fonte parecer recente
- Evidência: `retornoIaArquivo.ts:292` (`Date.now`) e `:373-374` (`Math.max(0, …)`).
- Cenário: um ajuste de NTP que atrase o relógio 1 h depois de uma sync OK faz `idade_s` ficar presa em 0, e `valida` fica verdadeira por 1 h + 600 s. Fuso não é problema (epoch e ISO UTC). Depois de um restart, `estados` começa vazio e `valida` é falsa (correto, coberto por `RetornoIaSend.spec.ts:322`).
- Correção: guardar `performance.now()`/`process.hrtime.bigint()` para a idade e usar o relógio de parede só na exibição; ou tratar `agora < ok` como inválido.

### M4 · Menor · Corrida com a rota manual de resync da Marcela
- Evidência: `MarcelaController.ts:170-193`: ela salva `logger.info`, troca e **restaura o valor salvo** no `finally`. Se ela começar antes da instalação do observador e terminar durante uma janela do ciclo, o observador some no meio da sync. Na prática o risco é baixo, porque a falha irrecuperável zera a versão e cai em `ERR_SEM_VERSAO` (`:262-271`). Há outro ponto na conexão 1 (Marcela e retorno_ia): dois resyncs que zeram `regular_low` ao mesmo tempo. Não desloga ninguém (o whaileys só refaz o snapshot, até 5 vezes), mas evite rodar a rota da Marcela durante o ciclo.
- Correção: na rota da Marcela, restaurar só se `loggerSocket.info` ainda for o wrapper dela; ou fazer as duas usarem o mesmo observador.

### M5 · Menor · Efeitos laterais de decodificar o `keyData` (já em produção nas conexões 1, 22 e 135)
- Evidência: `whaileys.ts:423-426`. Com as chaves certas, o `server_sync` de todas as coleções passa a funcionar nos 11 chips: `contactAction` → `contacts.upsert` → `CreateOrUpdateContactService` (`whaileys.ts:1497-1524`) passa a gravar o nome da agenda do chip no CRM; `starAction` → `messages.update` (ignorado, sem `status`); `deleteMessageForMe` → `messages.delete` (sem handler); `markChatAsRead` → `chats.update` com `unreadCount` (os dois handlers filtram só `archived`). **Nada marca ticket como lido nem envia mensagem.** O código novo não loga chaves nem mutações; com `WHAILEYS_LOG_LEVEL=trace` o whaileys loga mutações, mas isso é preexistente.
- Sessões: nenhum caminho novo chama `logout`, `end` ou reinicia o socket. O único `logout` do whaileys nessa área (`chats.js:725`, "myAppStateKeyId not synced") é no histórico do pareamento e não é tocado. `bad decrypt`/HMAC em laço fica limitado a 5 tentativas por resync. Durante cada resync o buffer de eventos do socket fica preso (até o timeout de 45 s, e o resync continua depois do timeout porque não é cancelável). Nas conexões da Marcela, só a 1 está na lista proposta.

### M6 · Menor · Mídia: o mimetype é só sintático, e o eco grava a extensão do nome sem sanear
- Evidência: `RetornoIaController.ts:45-46,153-187`; `handleWhatsappEvents.ts:113` (`ext` do nome original sem filtro), gravado em `public/`.
- Pontos:
  - documento aceita qualquer mimetype (`text/html`, `application/x-msdownload`), e um `nome_arquivo` "x.html" vira `public/x.<rand>.html` no eco. A classe já existe para documento recebido de cliente, mas agora pode sair pelo robô;
  - não há verificação do conteúdo (imagem "image/jpeg" com bytes quaisquer);
  - o nome bloqueia só `/ \ \0` (aceita `\n` e outros controles);
  - path traversal real: não há (barras bloqueadas; o whaileys usa arquivo temporário com nome aleatório).
  DoS: o teto útil é o `express.json` de 10 MB, que limita o pior caso; `replace(/\s+/g)` e a regex rodam antes do teto, de forma linear, aceitável. Payload acima de 10 MB volta como 413 do express, sem `codigo`.
- Correção: lista branca de mimetypes por tipo (pdf, jpeg/png/webp, ogg/opus/mpeg) e de extensões; recusar caracteres de controle no nome; no `saveMediaFile`, sanear `ext` para `[a-z0-9]{1,8}`.

### M7 · Menor · Rota GET de arquivadas
- Evidência: `RetornoIaController.ts:307-328`, `retornoIaRoutes.ts` (mesmo `autorizar`). Exige token e IP, compara o token com `tokenMatches`, e conexão fora da lista volta 403. Expõe números de telefone e LIDs de todas as conexões cobertas, mas só para o cliente interno autenticado. A diferença de status permite enumerar quais conexões estão cobertas, o que só é possível com o token. Sem `Cache-Control: no-store`; sugiro adicionar. O IP vem de `req.socket.remoteAddress`: atrás de proxy reverso, vale o IP do proxy (preexistente). Os jids `@lid` precisam ser resolvidos pelo robô.

### M8 · Menor · Lacunas de teste (os 27 passam, mas o mock é permissivo)
- O socket falso emite `chats.update` de forma síncrona (`RetornoIaArquivo.spec.ts:46-57`), então I1 não é testável hoje.
- Faltam testes para: falha depois de um OK dentro de 600 s (I2); falha de outra conexão ou de outra coleção no logger (I3); emissão depois do `ev.off`; relógio voltando (M3); restauração do `logger.info` pela rota da Marcela (M4); os ganchos de `whaileys.ts` (decodificação, `chats.update` e ciclo só nas conexões cobertas, no-op com env vazia), que não têm nenhum teste de integração; o ciclo não religa depois de reconexão (`iniciarCicloArquivo` idempotente: ok, mas sem teste em `whaileys.ts`); `tipo: null`, mimetype `image/svg+xml`, nome com controle.

## Respostas diretas às perguntas
1. **Compatibilidade:** o robô `121f2a7` trata 500, 502 e 503 como `FALHA`, sem repetição. Nada causa reenvio e o SAIR continua registrado. A única gravação diferente é no 200-sem-id, que vira 502 (M1, quase impossível). **Publicar sem mudar o robô é seguro.**
2. **Segurança:** não encontrei vazamento de chave nem log de conteúdo. A rota GET está protegida. Mídia tem ressalvas (M6), mas fica desligada por padrão.
3. **Sessões:** nada desloga, reinicia ou troca o estado da sessão. O resync serial prende o buffer de eventos durante a janela, e há ruído de falha entre conexões (I3, M4, M5).
4. **Fail-closed:** depois de um restart a fonte começa inválida (correto). Há fail-open em I1 (snapshot sem eventos) e I2 (válida depois de falha); a idade usa relógio de parede (M3).
5. **Regras inegociáveis:** nada marca ticket como lido. A rota não barra conversa arquivada (I4); continua dependendo do robô.
6. **Testes:** os 27 passam, mas não cobrem I1, I2, I3 nem os ganchos de `whaileys.ts` (M8).

## Veredito
**Pronto com ressalvas:** pode ir para a revisão do bot VERITAS e ser publicado **com as envs novas vazias** (o comportamento é igual ao de produção). Antes de ligar `RETORNO_IA_ARQUIVO_CONEXOES` ou de o robô passar a confiar em `valida`, é preciso corrigir I1 e I2 e tratar I3.
