/**
 * Remembered-credential storage.
 *
 * Threat model, stated plainly because "encrypted" is a claim that needs one:
 *
 * 1. **In the packaged desktop app this is genuinely secure storage.**
 *    `electron.safeStorage` hands the ciphertext to the OS keychain — DPAPI on
 *    Windows, Keychain on macOS, libsecret/kwallet on Linux. The key never
 *    enters JavaScript, so an XSS bug in the renderer cannot read the
 *    password, only the encrypted blob. That is the strongest thing available
 *    here and it is what the desktop build uses.
 *
 * 2. **In a plain browser it is obfuscation, not security.** Web Crypto gives us
 *    AES-GCM, but a browser cannot keep a decryption secret from the same
 *    JavaScript context that would run the attack, so the key has to live
 *    client-side too. That stops shoulder-surfing, casual disk inspection and
 *    the plaintext leaking into `localStorage` dumps or a synced profile — it
 *    does not stop a determined attacker with script execution on the origin.
 *    The honest description of tier 2 is "not a secure store", which is why the
 *    login screen labels the option as device-local and why the checkbox
 *    defaults to OFF.
 *
 * Either way nothing is written until the user explicitly opts in, and clearing
 * the option destroys the record.
 */

const NS = "edms:remember";
const KDF_ITERATIONS = 150_000;

export interface SecureBridge {
  setSecret(key: string, value: string): Promise<boolean>;
  getSecret(key: string): Promise<string | null>;
  deleteSecret(key: string): Promise<boolean>;
}

interface ElectronWindow {
  edmsSecure?: SecureBridge;
}

function bridge(): SecureBridge | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as ElectronWindow;
  return w.edmsSecure ?? null;
}

/** True when OS keychain-backed storage is available (packaged desktop app). */
export function hasSecureStore(): boolean {
  return bridge() !== null;
}

// ── Browser fallback: PBKDF2 → AES-GCM ─────────────────────────────────────

interface Envelope {
  v: 1;
  salt: string;
  iv: string;
  ct: string;
}

function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(salt: Uint8Array): Promise<CryptoKey> {
  // The "secret" is a per-origin constant on purpose: it is what stops the
  // record from being readable by a different app that opens the same profile
  // directory, and it is documented here as the limit of tier 2 rather than
  // sold as a secret. Real key custody is tier 1 (OS keychain) above.
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`edms-origin-v1:${location.origin}`),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: KDF_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function aesSet(key: string, value: string): Promise<boolean> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await deriveKey(salt);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    aesKey,
    new TextEncoder().encode(value)
  );
  const env: Envelope = { v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
  try {
    localStorage.setItem(`${NS}:${key}`, JSON.stringify(env));
    return true;
  } catch {
    return false; // private mode / quota — caller treats as "not remembered"
  }
}

async function aesGet(key: string): Promise<string | null> {
  let raw: string | null;
  try {
    raw = localStorage.getItem(`${NS}:${key}`);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const env = JSON.parse(raw) as Envelope;
    if (env.v !== 1) return null;
    const aesKey = await deriveKey(unb64(env.salt));
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unb64(env.iv) as BufferSource },
      aesKey,
      unb64(env.ct) as BufferSource
    );
    return new TextDecoder().decode(plain);
  } catch {
    // Wrong key, tampered blob, or a key rotated by a change of origin: drop it
    // rather than leaving an undecryptable record that blocks the next save.
    try {
      localStorage.removeItem(`${NS}:${key}`);
    } catch {
      /* ignore */
    }
    return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function storeSecret(key: string, value: string): Promise<boolean> {
  const b = bridge();
  return b ? b.setSecret(key, value) : aesSet(key, value);
}

export async function readSecret(key: string): Promise<string | null> {
  const b = bridge();
  return b ? b.getSecret(key) : aesGet(key);
}

export async function clearSecret(key: string): Promise<void> {
  const b = bridge();
  if (b) {
    await b.deleteSecret(key);
    return;
  }
  try {
    localStorage.removeItem(`${NS}:${key}`);
  } catch {
    /* ignore */
  }
}

export const REMEMBER_KEYS = {
  username: "username",
  password: "password",
} as const;

/** Human-readable description of where the value will actually live. */
export function storageTierLabel(arabic: (s: string) => string): string {
  return hasSecureStore()
    ? arabic("مشفّر بمخزن مفاتيح النظام")
    : arabic("مشفّر محلياً على هذا الجهاز");
}
