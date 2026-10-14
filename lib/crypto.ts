import crypto from "node:crypto";

function getKey(): Buffer {
  const hex = process.env.APP_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "APP_ENCRYPTION_KEY ausente ou inválida (esperado hex de 32 bytes / 64 caracteres).",
    );
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64")).join(".");
}

export function decrypt(payload: string): string {
  const parts = typeof payload === "string" ? payload.split(".") : [];
  if (parts.length !== 3 || parts.some((p) => !p)) {
    throw new Error("Payload criptografado inválido: esperado iv.tag.ciphertext.");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  if (iv.length !== 12) {
    throw new Error("Payload criptografado inválido: IV deve ter 12 bytes.");
  }
  if (tag.length !== 16) {
    throw new Error("Payload criptografado inválido: tag deve ter 16 bytes.");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}
