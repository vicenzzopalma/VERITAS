import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Padrão recomendado para GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Obtém a chave de 32 bytes derivada a partir do segredo configurado no ambiente.
 */
const getEncryptionKey = (): Buffer => {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || "veritas_default_secure_vault_key_32b";
  return crypto.scryptSync(secret, "veritas_salt_pepper_v1", 32);
};

/**
 * Criptografa uma string em repouso usando AES-256-GCM com autenticação de integridade.
 * Formato retornado: iv.authTag.encryptedData (em hexadecimal)
 */
export const encryptData = (text: string): string => {
  if (!text) return text;

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}.${authTag}.${encrypted}`;
};

/**
 * Descriptografa um dado protegido por AES-256-GCM, validando o AuthTag.
 */
export const decryptData = (cipherText: string): string => {
  if (!cipherText || !cipherText.includes(".")) return cipherText;

  try {
    const [ivHex, authTagHex, encryptedHex] = cipherText.split(".");
    if (!ivHex || !authTagHex || !encryptedHex) return cipherText;

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const key = getEncryptionKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    // Se não for possível descriptografar (ex: dado já estava em texto puro), retorna original
    return cipherText;
  }
};
