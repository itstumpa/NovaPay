import { beforeAll, describe, expect, it } from "@jest/globals";
import { decrypt, encrypt, sha256 } from "../../utils/encryption";

// ── Unit tests: no DB needed, testing pure logic ──────────────────────

describe("Encryption Utils", () => {
  // Set up required env vars before tests
  beforeAll(() => {
    process.env.MASTER_ENCRYPTION_KEY =
      "4a8f2c1d9e6b3f7a5c2d8e4b1f9a3c7e5d2b8f4a1c9e6b3f7a5c2d8e4b1f9a";
    process.env.DATA_ENCRYPTION_KEY =
      "1b9e7d4a2f8c5b3e9d6a4f2b8e5c3a7f9d1b4e8a2c6f3b9e7d4a2f8c5b3e9d";
  });

  it("should encrypt and decrypt a value correctly", () => {
    const original = "+8801712345678";
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it("encrypted value should never equal plaintext", () => {
    const plain = "sensitive-phone-number";
    expect(encrypt(plain)).not.toBe(plain);
  });

  it("same value encrypted twice should produce different ciphertext (random IV)", () => {
    const val = "test-value";
    expect(encrypt(val)).not.toBe(encrypt(val));
  });

  it("sha256 should produce consistent hash", () => {
    const hash1 = sha256("hello");
    const hash2 = sha256("hello");
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("sha256 of different inputs should differ", () => {
    expect(sha256("aaa")).not.toBe(sha256("bbb"));
  });

  it("should throw on invalid encrypted format", () => {
    expect(() => decrypt("not:valid")).toThrow();
  });
});

describe("Idempotency Key Logic", () => {
  it("same request body should produce same hash", () => {
    const body = {
      receiverEmail: "bob@example.com",
      amount: 100,
      currency: "USD",
    };
    const h1 = sha256(JSON.stringify(body));
    const h2 = sha256(JSON.stringify(body));
    expect(h1).toBe(h2);
  });

  it("different payloads should produce different hashes (Scenario E detection)", () => {
    const body1 = {
      receiverEmail: "bob@example.com",
      amount: 500,
      currency: "USD",
    };
    const body2 = {
      receiverEmail: "bob@example.com",
      amount: 800,
      currency: "USD",
    };
    expect(sha256(JSON.stringify(body1))).not.toBe(
      sha256(JSON.stringify(body2)),
    );
  });
});
