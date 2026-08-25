const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 6001;
const BACKEND_PORT = 6002;
const BUILD_DIR = path.join(__dirname, "build");

const MIME_TYPES = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf"
};

const server = http.createServer((req, res) => {
    const parsedUrl = req.url.split("?")[0];
    const isStaticAsset = parsedUrl.startsWith("/assets/") || 
                          parsedUrl.endsWith(".png") || 
                          parsedUrl.endsWith(".ico") || 
                          parsedUrl.endsWith(".json") || 
                          parsedUrl.endsWith(".js") || 
                          parsedUrl.endsWith(".css") || 
                          parsedUrl.endsWith(".mp3") || 
                          parsedUrl.endsWith(".woff2") || 
                          parsedUrl.endsWith(".ttf");

    const filePath = path.join(BUILD_DIR, parsedUrl);

    // 1. Arquivos estáticos físicos do frontend
    if (isStaticAsset && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": contentType });
        return fs.createReadStream(filePath).pipe(res);
    }

    // 2. Chamadas de API / Backend
    const isApiRequest = req.method !== "GET" || 
                         req.headers.authorization || 
                         req.headers.accept?.includes("application/json") ||
                         parsedUrl.startsWith("/auth") ||
                         parsedUrl.startsWith("/whatsapp") ||
                         parsedUrl.startsWith("/tickets") ||
                         parsedUrl.startsWith("/messages") ||
                         parsedUrl.startsWith("/contacts") ||
                         parsedUrl.startsWith("/users") ||
                         parsedUrl.startsWith("/queue") ||
                         parsedUrl.startsWith("/settings") ||
                         parsedUrl.startsWith("/quick") ||
                         parsedUrl.startsWith("/audit/") ||
                         parsedUrl.startsWith("/audit?") ||
                         parsedUrl === "/audit/devices" ||
                         parsedUrl === "/audit/messages" ||
                         parsedUrl === "/audit/export" ||
                         parsedUrl.startsWith("/public/") ||
                         parsedUrl.startsWith("/socket.io");

    if (isApiRequest) {
        const proxyReq = http.request({
            hostname: "127.0.0.1",
            port: BACKEND_PORT,
            path: req.url,
            method: req.method,
            headers: req.headers
        }, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
        });

        proxyReq.on("error", (err) => {
            console.error("Erro no Proxy:", err.message);
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Backend indisponível" }));
        });

        req.pipe(proxyReq, { end: true });
        return;
    }

    // 3. SPA Fallback (index.html) para rotas de navegação (/login, /tickets, /connections, etc.)
    const indexPath = path.join(BUILD_DIR, "index.html");
    if (fs.existsSync(indexPath)) {
        res.writeHead(200, { "Content-Type": "text/html" });
        return fs.createReadStream(indexPath).pipe(res);
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
});

// Proxy WebSocket (Socket.io)
server.on("upgrade", (req, socket, head) => {
    socket.on("error", () => socket.destroy());

    const proxySocket = http.request({
        hostname: "127.0.0.1",
        port: BACKEND_PORT,
        path: req.url,
        method: req.method,
        headers: req.headers
    });
    proxySocket.on("upgrade", (proxyRes, remoteSocket, proxyHead) => {
        remoteSocket.on("error", () => socket.destroy());
        socket.write(`HTTP/1.1 101 Switching Protocols\r\n` +
            Object.entries(proxyRes.headers).map(([k, v]) => `${k}: ${v}`).join("\r\n") + `\r\n\r\n`);
        remoteSocket.pipe(socket);
        socket.pipe(remoteSocket);
    });
    proxySocket.on("error", () => socket.destroy());
    proxySocket.end();
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Whaticket Frontend + Proxy Integrado rodando em http://localhost:${PORT}`);
});
