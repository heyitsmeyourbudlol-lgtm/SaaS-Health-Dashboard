import crypto from "node:crypto";

// Envelope encryption for integration credentials (API keys / OAuth tokens).
// AES-256-GCM with a random IV per record. The key comes from ENCRYPTION_KEY,
// which must decode to 32 bytes (accepts base64 or hex). Never log plaintext.

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY is not set");
  }
  // Try base64 first, then hex, then fall back to a hashed passphrase so dev
  // never crashes on a short key.
  let key = tryDecode(raw, "base64") ?? tryDecode(raw, "hex");
  if (!key) {
    key = crypto.createHash("sha256").update(raw).digest();
  }
  return key;
}

function tryDecode(value: string, encoding: "base64" | "hex"): Buffer | null {
  try {
    const buf = Buffer.from(value, encoding);
    return buf.length === 32 ? buf : null;
  } catch {
    return null;
  }
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // Store as iv:authTag:ciphertext, all base64.
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decrypt(payload: string): string {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted payload");
  }
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function encryptJSON(value: unknown): string {
  return encrypt(JSON.stringify(value));
}

export function decryptJSON<T>(payload: string): T {
  return JSON.parse(decrypt(payload)) as T;
}
