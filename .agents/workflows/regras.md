---
description: regra de I.A
---

Use sempre a lógica, se uma coisa não condiz com lógica de uso, não coloque, se faz, coloque.

---

# 🤖 DIRETRIZES OPERACIONAIS DE GIT & DEPLOY PARA IAs

Quando uma IA for realizar alterações, commits ou pushes neste projeto, deve seguir rigorosamente as regras abaixo:

### 1. 🛡️ Proteção Absoluta de Dados Sensíveis
- **PROIBIDO COMMITAR BANCOS DE DADOS:** Arquivos `*.sqlite`, `*.sqlite3`, `*.db`, `*.wal`, `*.shm`, `*.gz`, `*.zip` ou dumps **NUNCA** devem ser adicionados ao Git.
- **PROIBIDO COMMITAR CREDENCIAIS:** Arquivos `.env`, chaves privadas, senhas reais de operadores em documentações (`.md`) ou tokens de API.
- O `.gitignore` é lei e deve ser preservado. O banco real de produção com as 140k+ mensagens reside e persiste com segurança **exclusivamente na VPS em `/var/www/VERITAS/backend/whaticket.sqlite`**.

### 2. 🔍 Inspeção Obrigatória Antes do Commit
- Antes de comitar, execute `git status`.
- Nunca use `git add .` ou `git add -A` sem antes inspecionar a lista de arquivos alterados e não rastreados.
- Adicione apenas arquivos de código-fonte que fazem parte da alteração específica.

### 3. 🚀 Esteira de Deploy Contínuo (CI/CD Automático para a VPS)
- O projeto possui integração contínua configurada:
  - O repositório oficial é `https://github.com/vicenzzopalma/VERITAS`.
  - Ao fazer `git push origin main`, o workflow `.github/workflows/deploy.yml` conecta via SSH na VPS oficial (`187.77.243.224`).
  - O script `/var/www/VERITAS/deploy_vps.sh` é executado na VPS: puxa o código, atualiza dependências, recompila o frontend (`npm run build`) e recarrega os microsserviços no PM2 sem interrupção.
- Não altere ou delete os scripts `deploy_vps.sh` e `.github/workflows/deploy.yml`.

### 4. 📱 Submódulo / Repositório Secundário (PhoneGestorage)
- A pasta `Gestão de celulares` possui seu próprio repositório Git (`https://github.com/vicenzzopalma/PhoneGestorage`).
- Alterações dentro desta pasta devem ser commitadas e enviadas para o seu respectivo repositório (`git -C "Gestão de celulares" ...`).
