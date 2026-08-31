# 📜 REGRAS CRÍTICAS E IMUTÁVEIS DO SISTEMA — VERITAS

## 1. REGRA SUPREMA DE EXIBIÇÃO DE CONTATOS (NÚMERO DE TELEFONE SEMPRE)
- **REGRA ABSOLUTA:** Todo contato individual (pessoa física / jurídica), **tenha nome salvo na agenda ou NÃO tenha nome**, terá como exibição **SEMPRE E EXCLUSIVAMENTE O NÚMERO DE TELEFONE FORMATADO** (ex: `+55 (41) 99118-9892`, `+55 (62) 8264-3034`, `(41) 99118-9892`).
- **Nomes de pessoas** (ex: "Sandro Marcelo Grun", "Caroline Azevedo", "Adilson", etc.) **NUNCA** devem ser exibidos no lugar do número de telefone nas listas de Tickets, Chat, Auditoria ou Mensagens. O operador precisa ver o número do cliente!
- **Única Exceção:** **GRUPOS DO WHATSAPP** (identificados por `isGroup = 1`, `@g.us` ou prefixo `120363...`), que devem exibir o nome/título do grupo (ex: *"Equipe Lucas"*, *"SEARA X REALESS"*, *"Pack de Figurinhas 🫣"*).
- **PROIBIÇÃO DE LIDs BRUTOS NA INTERFACE:** Fica terminantemente proibido exibir identificadores internos extensos do WhatsApp (LIDs de 14 a 16 dígitos como `114972399030308`, `34024747753588`, `196035225845862`). Todo contato com LID deve ser resolvido para o seu número de telefone real (+55 ...).

## 2. IMUTABILIDADE ABSOLUTA DE IDENTIDADE E NOMES DE DISPOSITIVOS
- **Soberania do Operador:** O nome atribuído pelo usuário a um smartphone (ex: "ANA 2255", "ARTHUR 1827", "STHEFANNY 6542") torna-se 100% imutável e perpétuo.
- Fica estritamente proibido a qualquer IA, agente, rotina de descoberta ou script executar renomeações em lote, reatribuição de nomes genéricos ou resets de nomes em massa.
- Toda rotina de auditoria, reconexão de rede (USB / Wi-Fi / 4G) ou sincronização com a VPS deve apenas ler e preservar o nome existente vinculado ao Hardware ID (EsferaDeviceId) / WhatsApp ID.
- A única forma legítima de alterar o nome de um aparelho é através do clique e confirmação manual do operador no modal de configurações.

## 3. MODO AUDITOR SILENCIOSO & ANTI-DELETE ABSOLUTO
- Os operadores atendem e conversam normalmente através dos smartphones físicos ou WhatsApp Web.
- O sistema opera como uma caixa-preta de auditoria: grava conversas, baixa mídias e mantém mensagens apagadas ("Apagar para todos") 100% intactas e legíveis no banco de dados e no disco com a sinalização visual de auditoria.
