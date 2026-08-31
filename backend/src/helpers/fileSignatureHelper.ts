import fs from "fs";
import path from "path";

/**
 * Validação profunda de arquivos via Magic Numbers (Assinatura binária real de cabeçalho).
 * Previne ataques de extensão forjada (ex: script PHP ou EXE renomeado para .jpg/.png).
 */

interface SignatureCheck {
  exts: string[];
  validate: (buffer: Buffer) => boolean;
}

const SIGNATURE_RULES: SignatureCheck[] = [
  // PDF: %PDF-
  {
    exts: [".pdf"],
    validate: (b: Buffer) => b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46
  },
  // PNG: \x89PNG\r\n\x1a\n
  {
    exts: [".png"],
    validate: (b: Buffer) =>
      b.length >= 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 &&
      b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A
  },
  // JPEG: \xFF\xD8\xFF
  {
    exts: [".jpg", ".jpeg"],
    validate: (b: Buffer) => b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF
  },
  // GIF: GIF87a ou GIF89a
  {
    exts: [".gif"],
    validate: (b: Buffer) =>
      b.length >= 6 &&
      b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 &&
      (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61
  },
  // WEBP: RIFF....WEBP
  {
    exts: [".webp"],
    validate: (b: Buffer) =>
      b.length >= 12 &&
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  },
  // OGG: OggS
  {
    exts: [".ogg", ".oga", ".opus"],
    validate: (b: Buffer) => b.length >= 4 && b[0] === 0x4F && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53
  },
  // MP3: ID3 ou Sync frame \xFF\xFB, \xFF\xF3, \xFF\xF2
  {
    exts: [".mp3"],
    validate: (b: Buffer) =>
      (b.length >= 3 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) ||
      (b.length >= 2 && b[0] === 0xFF && (b[1] === 0xFB || b[1] === 0xF3 || b[1] === 0xF2))
  },
  // MP4 / M4A / MOV: ftyp em offset 4..8
  {
    exts: [".mp4", ".m4a", ".mov"],
    validate: (b: Buffer) =>
      b.length >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70
  },
  // ZIP / DOCX / XLSX / PPTX: PK\x03\x04
  {
    exts: [".zip", ".docx", ".xlsx", ".pptx"],
    validate: (b: Buffer) => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4B && b[2] === 0x03 && b[3] === 0x04
  }
];

/**
 * Inspeciona o arquivo salvo no disco e valida se os magic numbers condizem com a extensão.
 * Se for inválido ou forjado, deleta o arquivo e retorna false.
 */
export const validateFileMagicNumber = async (filePath: string): Promise<boolean> => {
  try {
    if (!fs.existsSync(filePath)) return false;

    const ext = path.extname(filePath).toLowerCase();
    const rule = SIGNATURE_RULES.find(r => r.exts.includes(ext));

    // Se não for um dos formatos binários restritos (ex: .txt, .csv, .vcf), faz validação de texto puro
    if (!rule) {
      if ([".txt", ".csv", ".vcf"].includes(ext)) {
        const buffer = Buffer.alloc(1024);
        const fd = fs.openSync(filePath, "r");
        const bytesRead = fs.readSync(fd, buffer, 0, 1024, 0);
        fs.closeSync(fd);

        // Verifica se contém bytes nulos típicos de executáveis
        for (let i = 0; i < bytesRead; i++) {
          if (buffer[i] === 0) return false;
        }
        return true;
      }
      return true;
    }

    const buffer = Buffer.alloc(32);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buffer, 0, 32, 0);
    fs.closeSync(fd);

    const isValid = rule.validate(buffer);
    if (!isValid) {
      // Exclui imediatamente arquivo forjado
      try {
        fs.unlinkSync(filePath);
      } catch {}
      return false;
    }

    return true;
  } catch (err) {
    return false;
  }
};
