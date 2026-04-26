import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function getKey() {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY is required to store provider API keys.");
  }

  const key = Buffer.from(raw, "base64");
  if (key.length === 32) {
    return key;
  }

  const utf8Key = Buffer.from(raw, "utf8");
  if (utf8Key.length === 32) {
    return utf8Key;
  }

  throw new Error("CREDENTIAL_ENCRYPTION_KEY must decode to 32 bytes.");
}

export function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64")).join(".");
}

export function decryptSecret(payload: string) {
  const [iv, tag, encrypted] = payload.split(".").map((part) => Buffer.from(part, "base64"));
  if (!iv || !tag || !encrypted) {
    throw new Error("Invalid encrypted provider secret.");
  }

  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
