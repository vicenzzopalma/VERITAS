# 📜 REGRAS CRÍTICAS E IMUTÁVEIS DO SISTEMA — VERITAS

---

## 1. REGRA SUPREMA DE EXIBIÇÃO DE CONTATOS (NÚMERO DE TELEFONE SEMPRE)
- **REGRA ABSOLUTA:** Todo contato individual (pessoa física / jurídica), **tenha nome salvo na agenda ou NÃO tenha nome**, terá como exibição **SEMPRE E EXCLUSIVAMENTE O NÚMERO DE TELEFONE FORMATADO** (ex: `+55 (41) 99118-9892`, `+55 (62) 8264-3034`, `(41) 99118-9892`).
- **Nomes de pessoas** (ex: "Sandro Marcelo Grun", "Caroline Azevedo", "Adilson", "Arthur", "Débora D C", etc.) **NUNCA** devem substituir o número de telefone nas listagens laterais, conversas ativas, tickets ou auditoria. O operador e auditor precisam identificar imediatamente o número do cliente!
- **NADA DE TEXTOS GENÉRICOS:** Fica estritamente proibido exibir textos como `"Contato WhatsApp"` ou `"Contato Privado"`.
- **Única Exceção:** **GRUPOS DO WHATSAPP** (identificados por `isGroup = 1`, `@g.us` ou prefixo `120363...`), que devem exibir o nome/título do grupo (ex: *"Equipe Lucas"*, *"SEARA X REALESS"*).

---

## 2. RESOLUÇÃO COMPULSÓRIA DE LIDs PARA NÚMERO REAL
- **PROIBIÇÃO DE LIDs BRUTOS:** Fica terminantemente proibido exibir identificadores internos extensos do WhatsApp (LIDs de 14 a 16 dígitos como `114972399030308`, `34024747753588`, `196035225845862`).
- **Mecanismos de Resolução no Backend:**
  1. Extração contínua de `pnJid`, `senderPn`, `participantPn` e `peerRecipientPn` nas mensagens recebidas e enviadas.
  2. Sincronização via `messaging-history.set`, `contacts.upsert`, `contacts.update` e `chats.upsert` para mapear `LID ↔ Telefone Real`.
  3. Mapeamento bidirecional e mesclagem defensiva de contatos no banco de dados (`Contacts` e `Tickets`).
  4. Varredura e enriquecimento constante do store das conexões ativas do WhatsApp para conversão dos LIDs legados em telefones reais (+55...).

---

## 3. IMUTABILIDADE ABSOLUTA DE IDENTIDADE E NOMES DE DISPOSITIVOS
- **Soberania do Operador:** O nome atribuído pelo usuário a um smartphone (ex: "ANA 2255", "ARTHUR 1827", "STHEFANNY 6542") torna-se **100% imutável e perpétuo**.
- **Proibição Total de Scripts Destrutivos:** Fica estritamente proibido a qualquer IA, agente, rotina de descoberta ou script executar renomeações em lote, reatribuição de nomes genéricos ou resets de nomes em massa.
- **Preservação de Vínculo:** Toda rotina de auditoria, reconexão de rede (USB / Wi-Fi / 4G) ou sincronização com a VPS deve apenas ler e preservar o nome existente vinculado ao Hardware ID (`EsferaDeviceId`) / WhatsApp ID.
- **Modificação Exclusiva:** A única forma legítima de alterar o nome de um aparelho é através do clique e confirmação manual do operador no modal de configurações.

---

## 4. MODO AUDITOR SILENCIOSO & ANTI-DELETE ABSOLUTO
- Os operadores atendem e conversam normalmente através dos smartphones físicos ou WhatsApp Web.
- O sistema opera como uma **caixa-preta de auditoria**:
  - Grava todas as conversas em tempo real.
  - Baixa e persiste todas as mídias (áudios, imagens, vídeos, documentos).
  - Mantém mensagens apagadas (*"Apagar para todos"*) **100% intactas e legíveis** no banco de dados e no disco com sinalização visual de auditoria (`isDeleted = true`).

---

## 5. REQUISITOS DE ALTA PERFORMANCE & ARQUITETURA HPC
- Todo processamento crítico e pipelines de alta taxa de mensagens/logs devem seguir arquitetura HPC:
  - Runtime CPU dispatching (detecção de SSE4.2 / AVX2 / AVX-512 em C++/Rust quando aplicável).
  - Zero-copy buffers e estruturas lock-free onde houver gargalos de I/O e parsing.
  - Manutenção dos serviços gerenciados pelo PM2 com persistência de sessões sem quedas de conexão.

---

## 6. GOVERNANÇA DE GIT, SEGURANÇA DE DADOS E DEPLOY NA VPS (CI/CD)
Toda IA, agente ou desenvolvedor que for realizar alterações e executar `git push` DEVE seguir obrigatoriamente as diretrizes abaixo:

1. **BLINDAGEM ABSOLUTA DE DADOS SENSÍVEIS (PROIBIÇÃO DE BANCOS E TOKENS):**
   - **NUNCA adicionar ao Git:** Arquivos de banco de dados (`*.sqlite`, `*.sqlite3`, `*.db`, `*.wal`, `*.shm`), arquivos compactados (`*.gz`, `*.zip`, `*.tar`), arquivos `.env`, senhas reais em arquivos markdown ou tokens de autenticação.
   - **Banco de Dados Real:** O banco de dados de produção contendo as 140.000+ mensagens, contatos e sessões reside **exclusivamente na VPS** em `/var/www/VERITAS/backend/whaticket.sqlite`. Nunca deve ser commitado no repositório público.
   - **Validação Pré-Commit Obrigatória:** Antes de qualquer commit, a IA deve inspecionar o `git status` para garantir que nenhum arquivo temporário, sensível ou dump foi incluído no stage.

2. **FLUXO DE DEPLOY CONTÍNUO (CI/CD AUTOMÁTICO VIA GITHUB ACTIONS):**
   - Ao executar `git push origin main` no repositório `VERITAS`, o workflow [`.github/workflows/deploy.yml`] é acionado automaticamente.
   - O GitHub Actions conecta via SSH na VPS oficial (`187.77.243.224`), executa o comando encadeado:
     ```bash
     cd /var/www/VERITAS && git fetch origin main && git reset --hard origin/main && bash deploy_vps.sh
     ```
   - O script [`deploy_vps.sh`] atualiza o código, recompila o frontend Vite em produção e recarrega os microsserviços no PM2 com zero downtime.
   - **Imutabilidade do Pipeline:** Fica proibido quebrar ou remover os scripts [`deploy_vps.sh`] e [`.github/workflows/deploy.yml`].

3. **PASSO A PASSO MANDATÓRIO PARA A IA AO FAZER ALTERAÇÕES E PUSH:**
   - **Passo 1:** Realizar as modificações necessárias no código.
   - **Passo 2:** Executar `git status` e verificar linha por linha se nenhum arquivo sensível (`.env`, `.sqlite`, logs, mídias) foi tocado.
   - **Passo 3:** Adicionar especificamente os arquivos modificados (ex: `git add src/...`).
   - **Passo 4:** Criar o commit semântico (ex: `git commit -m "feat/fix: descricao"`).
   - **Passo 5:** Fazer o push para o GitHub (`git push origin main`).
   - **Passo 6:** O deploy na VPS é 100% automático. Não há necessidade de acessar a VPS via SSH para dar reload manual.

4. **ESTRUTURA DUAL DE REPOSITÓRIOS:**
   - **Repositório Principal (VERITAS):** `https://github.com/vicenzzopalma/VERITAS` (Backend Baileys + Frontend React).
   - **Repositório do WhatsApp Control (CRM):** `https://github.com/vicenzzopalma/PhoneGestorage` (pasta `Gestão de celulares`). Alterações dentro deste submódulo devem ser commitadas e enviadas para o seu repositório dedicado.
