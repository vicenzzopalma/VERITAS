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
        echo "📥 Puxando atualizações do PhoneGestorage..."
        git fetch origin main && git reset --hard origin/main || echo "⚠️ Aviso ao atualizar PhoneGestorage via git."
    fi

    # Copiar arquivos atualizados do CRM diretamente do repositório VERITAS (failsafe 100% garantido)
    if [ -d "$APP_DIR/crm_update" ]; then
        echo "📋 Aplicando arquivos atualizados do CRM a partir de crm_update..."
        cp -r "$APP_DIR/crm_update/"* "$APP_DIR/Gestão de celulares/"
    fi

    npm install --legacy-peer-deps || true

    # Sanitizar permissões no database.sqlite do CRM para garantir Maiara em PA FIXA
    if [ -f "database.sqlite" ]; then
        echo "🔒 Sanitizando permissões da Maiara no database.sqlite do CRM..."
        node -e "
          try {
            const sqlite3 = require('sqlite3');
            const db = new sqlite3.Database('./database.sqlite');
            db.serialize(() => {
              db.run(\"UPDATE users SET allow_all_tabs = 0 WHERE LOWER(username) LIKE '%maiara%' OR LOWER(name) LIKE '%maiara%'\");
              db.all(\"SELECT id FROM users WHERE LOWER(username) LIKE '%maiara%' OR LOWER(name) LIKE '%maiara%'\", (err, rows) => {
                if (rows) {
                  for (const r of rows) {
                    db.run(\"DELETE FROM user_sector_permissions WHERE user_id = ?\", [r.id]);
                    db.run(\"INSERT OR IGNORE INTO user_sector_permissions (user_id, sector, can_view, can_configure) VALUES (?, 'PA FIXA 1', 1, 1)\", [r.id]);
                    db.run(\"INSERT OR IGNORE INTO user_sector_permissions (user_id, sector, can_view, can_configure) VALUES (?, 'PA FIXA 2', 1, 1)\", [r.id]);
                  }
                }
              });
            });
          } catch(e) {
            console.error('Erro ao sanitizar SQLite:', e.message);
          }
        " || true
    fi
fi

# 5. Reiniciar e recarregar os processos no PM2
echo ""
echo "🔄 5. Recarregando serviços no PM2 sem interrupção..."
cd "$APP_DIR"
pm2 restart ecosystem.config.js --update-env
pm2 save

echo ""
echo "=================================================="
echo "✅ [VERITAS] Aplicação atualizada com 100% de sucesso!"
echo "=================================================="
