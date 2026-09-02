module.exports = {
  apps: [
    {
      name: "veritas-backend",
      cwd: "d:\\whaticket\\backend",
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
      cwd: "d:\\whaticket\\frontend",
      script: "server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 6001
      }
    }
  ]
};
