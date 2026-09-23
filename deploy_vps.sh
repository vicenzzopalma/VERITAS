#!/bin/bash
# ==============================================================================
# Script de Atualização Automática do VERITAS na VPS
# Executado localmente na VPS ou disparado via GitHub Actions / Webhook
# ==============================================================================
set -e

echo "=================================================="
echo "🚀 [VERITAS] Iniciando processo de atualização..."
echo "📅 Data: $(date)"
echo "=================================================="

# Diretório raiz da aplicação na VPS
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

# 1. Puxar as últimas alterações do GitHub
echo ""
echo "📥 1. Atualizando código via Git..."
git fetch origin main
git reset --hard origin/main

# 1.1 Restaurar banco de dados se não existir ou se solicitado
if [ -f "$APP_DIR/backend/whaticket.sqlite.gz" ]; then
    if [ ! -f "$APP_DIR/backend/whaticket.sqlite" ] || [ "$RESTORE_DB" = "1" ]; then
        echo ""
        echo "📦 Restaurando banco de dados completo (whaticket.sqlite.gz)..."
        gzip -d -c "$APP_DIR/backend/whaticket.sqlite.gz" > "$APP_DIR/backend/whaticket.sqlite"
        echo "✅ Banco de dados descompactado com sucesso!"
    fi
fi

# 2. Atualizar dependências e banco do Backend
echo ""
echo "⚙️ 2. Atualizando Backend..."
cd "$APP_DIR/backend"
npm install --legacy-peer-deps
npx sequelize-cli db:migrate || true

# 3. Compilar o Frontend (React + Vite)
echo ""
echo "⚛️ 3. Compilando Frontend (Produção)..."
cd "$APP_DIR/frontend"
npm install --legacy-peer-deps
npm run build

# 4. Atualizar Gestão de Celulares (CRM)
echo ""
echo "📱 4. Atualizando Gestão de Celulares..."
if [ -d "$APP_DIR/Gestão de celulares" ]; then
    cd "$APP_DIR/Gestão de celulares"
    if [ -d ".git" ]; then
        GIT_TERMINAL_PROMPT=0 git fetch origin main 2>/dev/null && git reset --hard origin/main 2>/dev/null || echo "ℹ️ Gestão de Celulares: Mantido na versão instalada localmente."
    fi
    npm install --legacy-peer-deps || true
fi

# 5. Reiniciar e recarregar os processos no PM2
echo ""
echo "🔄 5. Recarregando serviços no PM2 sem interrupção..."
cd "$APP_DIR"
pm2 reload ecosystem.config.js || pm2 restart ecosystem.config.js
pm2 save

echo ""
echo "=================================================="
echo "✅ [VERITAS] Aplicação atualizada com 100% de sucesso!"
echo "=================================================="
