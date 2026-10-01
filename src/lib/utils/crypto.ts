import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getEnv } from "./env";
import { createLogger } from "./logger";

const log = createLogger("crypto");
let warnedAboutDevKey = false;

function encryptionKey(): Buffer {
  const raw = getEnv().ENCRYPTION_KEY;
  if (!raw) {
    // Development convenience only — getEnv() refuses to start production without a key.
    if (!warnedAboutDevKey) {
      log.warn("ENCRYPTION_KEY is not set; using an insecure development key");
      warnedAboutDevKey = true;
    }
    return createHash("sha256").update("mailmind-insecure-development-key").digest();
  }
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64)");
  return key;
}

/** AES-256-GCM. Output: base64url(iv).base64url(tag).base64url(ciphertext) */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, ciphertext] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !ciphertext) throw new Error("Malformed encrypted payload");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
