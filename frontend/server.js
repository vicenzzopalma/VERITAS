const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const zlib = require("zlib");

process.on("uncaughtException", (err) => {
    console.error("Uncaught exception in server.js:", err.message);
});
process.on("unhandledRejection", (err) => {
    console.error("Unhandled rejection in server.js:", err);
});

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
    ".ttf": "font/ttf",
    ".pdf": "application/pdf"
};

function sendCompressed(req, res, filePath, contentType, cacheControl) {
    const acceptEncoding = req.headers["accept-encoding"] || "";
    const isCompressible = contentType.includes("text") || 
                           contentType.includes("javascript") || 
                           contentType.includes("json") || 
                           contentType.includes("css") ||
                           contentType.includes("svg");

    const headers = {
        "Content-Type": contentType,
        "Cache-Control": cacheControl
    };

    if (isCompressible && acceptEncoding.includes("gzip")) {
        headers["Content-Encoding"] = "gzip";
        res.writeHead(200, headers);
        const rawStream = fs.createReadStream(filePath);
        const gzip = zlib.createGzip({ level: 6 });
        rawStream.pipe(gzip).pipe(res);
    } else {
        const stat = fs.statSync(filePath);
        headers["Content-Length"] = stat.size;
        res.writeHead(200, headers);
        fs.createReadStream(filePath).pipe(res);
    }
}

const server = http.createServer((req, res) => {
    const parsedUrl = req.url.split("?")[0];

    // Rotas Executivas do Relatório & Dashboard
    if (parsedUrl === "/dashboard" || parsedUrl === "/dashboard.html" || parsedUrl === "/dashboard_veritas.html") {
        const dashPath = path.join(BUILD_DIR, "dashboard.html");
        if (fs.existsSync(dashPath)) {
            return sendCompressed(req, res, dashPath, "text/html", "no-cache");
        }
    }

    if (parsedUrl === "/relatorio" || parsedUrl === "/relatorio.pdf" || parsedUrl === "/relatorio_veritas_executivo.pdf") {
        const pdfPath = path.join(BUILD_DIR, "relatorio_veritas_executivo.pdf");
        if (fs.existsSync(pdfPath)) {
            res.writeHead(200, {
                "Content-Type": "application/pdf",
                "Content-Disposition": "inline; filename=\"relatorio_veritas_executivo.pdf\"",
                "Cache-Control": "public, max-age=3600"
            });
            return fs.createReadStream(pdfPath).pipe(res);
        }
    }

    if (parsedUrl === "/relatorio.html" || parsedUrl === "/relatorio_veritas.html") {
        const htmlPath = path.join(BUILD_DIR, "relatorio_veritas.html");
        if (fs.existsSync(htmlPath)) {
            return sendCompressed(req, res, htmlPath, "text/html", "no-cache");
        }
    }

    const isStaticAsset = parsedUrl.startsWith("/assets/") || 
                          parsedUrl.endsWith(".png") || 
                          parsedUrl.endsWith(".ico") || 
                          parsedUrl.endsWith(".json") || 
                          parsedUrl.endsWith(".js") || 
                          parsedUrl.endsWith(".css") || 
                          parsedUrl.endsWith(".mp3") || 
                          parsedUrl.endsWith(".woff2") || 
                          parsedUrl.endsWith(".ttf") ||
                          parsedUrl.endsWith(".pdf");

    const filePath = path.join(BUILD_DIR, parsedUrl);

    // 1. Arquivos estáticos físicos do frontend
    if (isStaticAsset && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";
        const cacheControl = parsedUrl.startsWith("/assets/")
            ? "public, max-age=31536000, immutable"
            : "public, max-age=86400";

        return sendCompressed(req, res, filePath, contentType, cacheControl);
    }

    // 2. Arquivos brutos do backend que nunca devem retornar index.html
    const isBackendFileOrRaw = parsedUrl.startsWith("/public/") || 
                               parsedUrl.startsWith("/audit/export") || 
                               parsedUrl.startsWith("/socket.io/");

    // 3. Se for navegação direta de página no navegador (HTML / SPA), serve index.html
    const acceptsHtml = req.headers.accept && req.headers.accept.includes("text/html");

    if ((req.method === "GET" || req.method === "HEAD") && acceptsHtml && !isBackendFileOrRaw) {
        const indexPath = path.join(BUILD_DIR, "index.html");
        if (fs.existsSync(indexPath)) {
            return sendCompressed(req, res, indexPath, "text/html", "no-cache, no-store, must-revalidate");
        }
    }

    // 4. Chamadas de API / Backend (REST, AJAX Fetch, WebSocket, Arquivos Públicos)
    const proxyHeaders = { ...req.headers };
    proxyHeaders.host = `127.0.0.1:${BACKEND_PORT}`;

    const proxyReq = http.request({
        hostname: "127.0.0.1",
        port: BACKEND_PORT,
        path: req.url,
        method: req.method,
        headers: proxyHeaders
    }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
    });

    proxyReq.on("error", (err) => {
        console.error("Erro no Proxy:", err.message);
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Backend indisponível" }));
    });

    if (req.method === "GET" || req.method === "HEAD") {
        proxyReq.end();
    } else {
        req.pipe(proxyReq, { end: true });
    }
    return;
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
    console.log(`Whaticket Frontend + Proxy Integrado rodando em http://localhost:${PORT} (com Gzip e Cache Imutável)`);
});
