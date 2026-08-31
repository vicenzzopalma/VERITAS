import path from "path";
import multer from "multer";
import AppError from "../errors/AppError";

const publicFolder = path.resolve(__dirname, "..", "..", "public");

const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".sh", ".php", ".phtml", ".py",
  ".js", ".vbs", ".msi", ".dll", ".com", ".scr", ".bin",
  ".cgi", ".jar", ".apk", ".pl", ".wsf", ".hta"
]);

export default {
  directory: publicFolder,

  storage: multer.diskStorage({
    destination: publicFolder,
    filename(req, file, cb) {
      // Remove caracteres perigosos do nome
      const safeExt = path.extname(file.originalname).toLowerCase();
      const sanitizedBase = path
        .basename(file.originalname, safeExt)
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .substring(0, 50);

      const fileName = `${new Date().getTime()}_${sanitizedBase}${safeExt}`;
      return cb(null, fileName);
    }
  }),

  limits: {
    fileSize: 50 * 1024 * 1024 // Limite estrito de 50 MB por upload
  },

  fileFilter: (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (BLOCKED_EXTENSIONS.has(ext)) {
      return cb(new AppError("Tipo de arquivo executável ou potencialmente perigoso não permitido.", 400));
    }

    return cb(null, true);
  }
};
