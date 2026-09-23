#!/bin/bash
# ==============================================================================
# VERITAS - Script de Instalação e Inicialização Automática Completa na VPS
# ==============================================================================
set -e

echo "======================================================================"
echo "🚀 [VERITAS] INICIANDO INSTALAÇÃO AUTOMÁTICA COMPLETA NA VPS"
echo "📅 $(date)"
echo "======================================================================"

# 1. Configurar Firewall básico e garantir portas abertas
echo ""
echo "🔓 [1/8] Verificando e liberando portas do sistema (22, 80, 443, 6001, 6002)..."
if command -v ufw >/dev/null 2>&1; then
    ufw allow 22/tcp || true
    ufw allow 80/tcp || true
    ufw allow 443/tcp || true
    ufw allow 6001/tcp || true
    ufw allow 6002/tcp || true
    ufw allow 3000/tcp || true
fi

# 2. Atualizar repositórios do sistema
echo ""
echo "📦 [2/8] Atualizando pacotes do Ubuntu Linux..."
export DEBIAN_FRONTEND=noninteractive
apt update -y
apt install -y git curl wget build-essential nginx certbot python3-certbot-nginx gzip

# 3. Instalar Node.js 20 LTS e PM2 global
echo ""
echo "🟢 [3/8] Instalando Node.js 20 LTS e PM2..."
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d'.' -f1)" != "v20" ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
npm install -g pm2

# 4. Clonar ou atualizar os repositórios do VERITAS e PhoneGestorage
echo ""
echo "📥 [4/8] Baixando a versão mais recente do VERITAS e Gestão de Celulares..."
mkdir -p /var/www
if [ -d "/var/www/VERITAS/.git" ]; then
    cd /var/www/VERITAS
    git fetch origin main
    git reset --hard origin/main
else
    rm -rf /var/www/VERITAS
    git clone https://github.com/vicenzzopalma/VERITAS.git /var/www/VERITAS
    cd /var/www/VERITAS
fi

# Clonar ou atualizar Gestão de Celulares (CRM)
if [ -d "/var/www/VERITAS/Gestão de celulares/.git" ]; then
    cd "/var/www/VERITAS/Gestão de celulares"
    git fetch origin main
    git reset --hard origin/main
else
    rm -rf "/var/www/VERITAS/Gestão de celulares"
    git clone https://github.com/vicenzzopalma/PhoneGestorage.git "/var/www/VERITAS/Gestão de celulares"
fi

chmod +x /var/www/VERITAS/deploy_vps.sh

# 5. Restaurar banco de dados completo (140k+ mensagens)
echo ""
echo "🗄️ [5/8] Verificando e restaurando banco de dados SQLite com histórico completo..."
if [ -f "/var/www/VERITAS/backend/whaticket.sqlite.gz" ]; then
    if [ ! -f "/var/www/VERITAS/backend/whaticket.sqlite" ]; then
        echo "   Descompactando whaticket.sqlite.gz..."
        gzip -d -k /var/www/VERITAS/backend/whaticket.sqlite.gz
    else
        echo "   Banco de dados whaticket.sqlite já existe. Mantendo preservado."
    fi
fi

# Criar .env de produção no backend
cat << 'EOF' > /var/www/VERITAS/backend/.env
PORT=6002
WHATSAPP_PROVIDER=whaileys
LOG_LEVEL=info
WHAILEYS_LOG_LEVEL=error
DB_DIALECT=sqlite
DB_STORAGE=/var/www/VERITAS/backend/whaticket.sqlite
JWT_SECRET=esfera_secret_jwt_key_12345
JWT_REFRESH_SECRET=esfera_refresh_jwt_key_54321
BACKEND_URL=http://localhost:6002
FRONTEND_URL=http://localhost:6001
PROXY_PORT=6002
REDIS_URL=
EOF

# 6. Instalar dependências, compilar e preparar aplicações
echo ""
echo "⚙️ [6/8] Instalando dependências e compilando aplicações..."
cd /var/www/VERITAS/backend
npm install --legacy-peer-deps

cd /var/www/VERITAS/frontend
npm install --legacy-peer-deps
if [ ! -d "/var/www/VERITAS/frontend/build" ] || [ ! -f "/var/www/VERITAS/frontend/build/index.html" ]; then
    npm run build
fi

cd "/var/www/VERITAS/Gestão de celulares"
npm install --legacy-peer-deps

# 7. Iniciar serviços com PM2
echo ""
echo "🚀 [7/8] Iniciando microsserviços via PM2..."
cd /var/www/VERITAS
pm2 delete all || true
pm2 start ecosystem.config.js --only "crm-celulares,veritas-backend,veritas-frontend,veritas-sync-agent"
pm2 save
pm2 startup systemd -u root --hp /root || true

# 8. Configurar Nginx (Reverse Proxy na porta 80)
echo ""
echo "🌐 [8/8] Configurando Nginx para roteamento na porta 80 (HTTP)..."
cat << 'EOF' > /etc/nginx/sites-available/veritas
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:6001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/veritas /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx && systemctl enable nginx

# Obter IP IPv4 da VPS
IPV4_ADDR=$(curl -4 -s ifconfig.me || hostname -I | awk '{print $1}')

echo ""
echo "======================================================================"
echo "🎉 [VERITAS] INSTALAÇÃO CONCLUÍDA COM 100% DE SUCESSO!"
echo "======================================================================"
echo "📡 Acesse o VERITAS pelo navegador em:"
echo "👉 http://${IPV4_ADDR}/"
echo ""
echo "📊 Status dos Serviços PM2:"
pm2 status
echo "======================================================================"
