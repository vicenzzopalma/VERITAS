const path = require("path");

module.exports = {
  apps: [
    {
      name: "crm-celulares",
      cwd: path.resolve(__dirname, "Gestão de celulares"),
      script: "server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    },
    {
      name: "veritas-backend",
      cwd: path.resolve(__dirname, "backend"),
      script: "node_modules/ts-node/dist/bin.js",
      args: "--transpile-only src/server.ts",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "development",
        PORT: 6002
      }
    },
    {
      name: "veritas-frontend",
      cwd: path.resolve(__dirname, "frontend"),
      script: "server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 6001
      }
    },
    {
      name: "ngrok-tunnel",
      cwd: path.resolve(__dirname, "Gestão de celulares"),
      script: "tunnel.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M"
    },
    {
      name: "veritas-sync-agent",
      cwd: path.resolve(__dirname, "Gestão de celulares", "integracoes", "veritas-agent"),
      script: "veritas-sync-agent.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        WHATICKET_DB_PATH: path.resolve(__dirname, "backend", "whaticket.sqlite"),
        CRM_URL: "http://127.0.0.1:3000",
        VERITAS_SYNC_TOKEN: "esfera_veritas_sync_secret_2026",
        SYNC_INTERVAL: "10"
      }
    }
  ]
};
