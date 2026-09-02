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
