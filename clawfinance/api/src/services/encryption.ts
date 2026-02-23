import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Field-level encryption service for sensitive data at rest.
 * Uses AES-256-GCM with a key derived from DB_ENCRYPTION_KEY via scrypt.
 * Each encrypted value gets its own random salt and IV.
 */
export class FieldEncryption {
  private masterKey: string;

  constructor(masterKey?: string) {
    const key = masterKey ?? process.env.DB_ENCRYPTION_KEY;
    if (!key) {
      throw new Error("DB_ENCRYPTION_KEY is required for field encryption");
    }
    this.masterKey = key;
  }

  private deriveKey(salt: Buffer): Buffer {
    return scryptSync(this.masterKey, salt, KEY_LENGTH);
  }

  /**
   * Encrypt a plaintext string. Returns a base64 string containing salt + iv + authTag + ciphertext.
   */
  encrypt(plaintext: string): string {
    const salt = randomBytes(SALT_LENGTH);
    const key = this.deriveKey(salt);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Pack: salt(16) + iv(16) + authTag(16) + ciphertext(N)
    const packed = Buffer.concat([salt, iv, authTag, encrypted]);
    return packed.toString("base64");
  }

  /**
   * Decrypt a base64-encoded encrypted string back to plaintext.
   */
  decrypt(encryptedBase64: string): string {
    const packed = Buffer.from(encryptedBase64, "base64");

    if (packed.length < SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error("Invalid encrypted data: too short");
    }

    const salt = packed.subarray(0, SALT_LENGTH);
    const iv = packed.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = packed.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = packed.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

    const key = this.deriveKey(salt);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString("utf8");
  }

  /**
   * Encrypt a value only if it's not already encrypted (idempotent).
   */
  encryptIfNeeded(value: string): string {
    try {
      // Try decrypting — if it works, the value is already encrypted
      this.decrypt(value);
      return value;
    } catch {
      return this.encrypt(value);
    }
  }

  /**
   * Decrypt a value, returning the original if decryption fails
   * (for backwards compatibility with unencrypted data).
   */
  decryptSafe(value: string | null): string | null {
    if (!value) return null;
    try {
      return this.decrypt(value);
    } catch {
      return value; // Return as-is if not encrypted
    }
  }
}

// Singleton instance — lazily initialized
let instance: FieldEncryption | null = null;

export function getEncryption(): FieldEncryption {
  if (!instance) {
    instance = new FieldEncryption();
  }
  return instance;
}
