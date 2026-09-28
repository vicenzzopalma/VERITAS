import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import uploadConfig from "../config/upload";

const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
  ".csv": "text/csv"
};

/**
 * Detecta o MIME type real através de magic numbers binários nos primeiros bytes do arquivo.
 */
function detectRealMimeType(filePath: string): string {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);

    // PDF (%PDF)
    if (buf.slice(0, 4).toString("ascii") === "%PDF") {
      return "application/pdf";
    }
    // JPEG
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      return "image/jpeg";
    }
    // PNG
    if (buf.slice(0, 4).toString("hex") === "89504e47") {
      return "image/png";
    }
    // WEBP
    if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") {
      return "image/webp";
    }
    // GIF
    if (buf.slice(0, 3).toString("ascii") === "GIF") {
      return "image/gif";
    }
    // OGG Audio
    if (buf.slice(0, 4).toString("ascii") === "OggS") {
      return "audio/ogg";
    }
    // MP3 (ID3v2 or MPEG sync)
    if (buf.slice(0, 3).toString("ascii") === "ID3" || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) {
      return "audio/mpeg";
    }
    // MP4 Video
    if (buf.slice(4, 8).toString("ascii") === "ftyp") {
      return "video/mp4";
    }
  } catch (err) {
    // Falha silenciosa na leitura do cabeçalho binário
  }

  // Fallback para extensão do arquivo
  const ext = path.extname(filePath).toLowerCase();
  if (MIME_MAP[ext]) {
    return MIME_MAP[ext];
  }

  // Se o nome contiver termos típicos de comprovantes, tratar como PDF
  const baseLower = path.basename(filePath).toLowerCase();
  if (
    baseLower.includes("comprovante") ||
    baseLower.includes("sicredi") ||
    baseLower.includes("sicoob") ||
    baseLower.includes("pix") ||
    baseLower.includes("boleto")
  ) {
    return "application/pdf";
  }

  return "application/octet-stream";
}

/**
 * Localiza o arquivo físico correspondente na pasta de uploads, resolvendo variações
 * como arquivos que começam com ponto (dotfiles), sem extensão ou com URL codificada.
 */
function findPhysicalFile(rawFilename: string): string | null {
  const publicDir = uploadConfig.directory;
  let decodedName = rawFilename;
  try {
    decodedName = decodeURIComponent(rawFilename);
  } catch {
    decodedName = rawFilename;
  }

  // Prevenção estrita de Path Traversal
  const baseCandidate = path.basename(decodedName);
  if (!baseCandidate || baseCandidate === "." || baseCandidate === "..") {
    return null;
  }

  const directPath = path.join(publicDir, baseCandidate);
  if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    return directPath;
  }

  // Tentativa 1: Arquivo salvo como dotfile (começando com ponto)
  if (!baseCandidate.startsWith(".")) {
    const dotPath = path.join(publicDir, `.${baseCandidate}`);
    if (fs.existsSync(dotPath) && fs.statSync(dotPath).isFile()) {
      return dotPath;
    }
  } else {
    // Tentativa 2: Arquivo sem o ponto inicial
    const noDotPath = path.join(publicDir, baseCandidate.substring(1));
    if (fs.existsSync(noDotPath) && fs.statSync(noDotPath).isFile()) {
      return noDotPath;
    }
  }

  // Tentativa 3: Se foi solicitado com .pdf mas no disco está sem extensão
  if (baseCandidate.toLowerCase().endsWith(".pdf")) {
    const withoutPdf = baseCandidate.slice(0, -4);
    const p1 = path.join(publicDir, withoutPdf);
    if (fs.existsSync(p1) && fs.statSync(p1).isFile()) return p1;
    const p2 = path.join(publicDir, `.${withoutPdf}`);
    if (fs.existsSync(p2) && fs.statSync(p2).isFile()) return p2;
  } else {
    // Tentativa 4: Se foi solicitado sem .pdf mas no disco tem .pdf
    const withPdf = `${baseCandidate}.pdf`;
    const p1 = path.join(publicDir, withPdf);
    if (fs.existsSync(p1) && fs.statSync(p1).isFile()) return p1;
    const p2 = path.join(publicDir, `.${withPdf}`);
    if (fs.existsSync(p2) && fs.statSync(p2).isFile()) return p2;
  }

  return null;
}

export const publicMediaHandler = (req: Request, res: Response, next: NextFunction): void => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return next();
  }

  const rawPath = req.path.replace(/^\//, "");
  if (!rawPath) {
    return next();
  }

  const physicalPath = findPhysicalFile(rawPath);
  if (!physicalPath) {
    return next();
  }

  try {
    const stat = fs.statSync(physicalPath);
    if (!stat.isFile()) {
      return next();
    }

    const mimeType = detectRealMimeType(physicalPath);
    const fileName = path.basename(physicalPath);

    // Headers profissionais para renderização correta de PDFs, imagens e áudios
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Accept-Ranges", "bytes");

    // Gerenciamento de Range requests para streaming de áudio e vídeo
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

      if (start >= stat.size || end >= stat.size) {
        res.setHeader("Content-Range", `bytes */${stat.size}`);
        res.status(416).end();
        return;
      }

      const chunksize = end - start + 1;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
      res.setHeader("Content-Length", chunksize);
      res.status(206);

      if (req.method === "HEAD") {
        res.end();
        return;
      }

      const stream = fs.createReadStream(physicalPath, { start, end });
      stream.pipe(res);
    } else {
      res.setHeader("Content-Length", stat.size);
      res.status(200);

      if (req.method === "HEAD") {
        res.end();
        return;
      }

      const stream = fs.createReadStream(physicalPath);
      stream.pipe(res);
    }
  } catch (err) {
    next(err);
  }
};
