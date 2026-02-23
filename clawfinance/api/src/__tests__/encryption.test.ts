import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/db.js", () => ({
  pool: { query: vi.fn(), on: vi.fn() },
}));

// Set env var before importing
process.env.DB_ENCRYPTION_KEY = "test-super-secret-encryption-key-32chars!";

import { FieldEncryption } from "../services/encryption.js";

describe("FieldEncryption", () => {
  let enc: FieldEncryption;

  beforeEach(() => {
    enc = new FieldEncryption("test-encryption-key-for-unit-tests");
  });

  it("encrypts and decrypts a string", () => {
    const plaintext = "Hello, sensitive data!";
    const encrypted = enc.encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.length).toBeGreaterThan(plaintext.length);

    const decrypted = enc.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext each time (random salt/IV)", () => {
    const plaintext = "Same input";
    const encrypted1 = enc.encrypt(plaintext);
    const encrypted2 = enc.encrypt(plaintext);
    expect(encrypted1).not.toBe(encrypted2);

    // But both decrypt to same value
    expect(enc.decrypt(encrypted1)).toBe(plaintext);
    expect(enc.decrypt(encrypted2)).toBe(plaintext);
  });

  it("fails to decrypt with wrong key", () => {
    const enc2 = new FieldEncryption("different-key-aaaaaaaaaaaaaaaaaaa");
    const encrypted = enc.encrypt("secret");
    expect(() => enc2.decrypt(encrypted)).toThrow();
  });

  it("handles empty string", () => {
    const encrypted = enc.encrypt("");
    expect(enc.decrypt(encrypted)).toBe("");
  });

  it("handles unicode", () => {
    const plaintext = "金融データ 💰";
    const encrypted = enc.encrypt(plaintext);
    expect(enc.decrypt(encrypted)).toBe(plaintext);
  });

  it("decryptSafe returns null for null input", () => {
    expect(enc.decryptSafe(null)).toBeNull();
  });

  it("decryptSafe returns original for non-encrypted data", () => {
    expect(enc.decryptSafe("just a plain string")).toBe("just a plain string");
  });

  it("encryptIfNeeded skips already encrypted values", () => {
    const plaintext = "test value";
    const encrypted = enc.encrypt(plaintext);
    const reEncrypted = enc.encryptIfNeeded(encrypted);
    // Should return the same value (already encrypted)
    expect(reEncrypted).toBe(encrypted);
  });
});
