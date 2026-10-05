import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { TRPCError } from "@trpc/server";

/**
 * Vault values are encrypted in the app before they reach the database, with
 * AES-256-GCM and a key held only in the server's environment (VAULT_KEY, 32
 * bytes, base64) — see docs/adr/0001. Each value gets its own random IV, and
 * the household id is bound in as associated data so a ciphertext can't be
 * moved into another household's entry.
 *
 * Stored format: `v1.<iv>.<tag>.<ciphertext>` (base64url). The version prefix
 * leaves room to rotate the key or algorithm later.
 */
const VERSION = "v1";

function getKey(): Buffer {
  const raw = process.env.VAULT_KEY;
  const key = raw ? Buffer.from(raw, "base64") : null;
  if (!key || key.length !== 32) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "The Vault isn't set up on this server yet (VAULT_KEY is missing).",
    });
  }
  return key;
}

export function encryptValue(plaintext: string, householdId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  cipher.setAAD(Buffer.from(householdId));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, ciphertext].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decryptValue(stored: string, householdId: string): string {
  const [version, iv, tag, ciphertext] = stored.split(".");
  if (version !== VERSION || !iv || !tag || ciphertext === undefined) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unreadable Vault value." });
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(householdId));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    // Wrong key or tampered data — never include any detail that could echo values.
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Couldn't decrypt this Vault value." });
  }
}
