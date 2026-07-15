const CODE_HASH_SEPARATOR = ":";

export async function hashGameCode(code: string, salt: string): Promise<string> {
  const encodedCode = new TextEncoder().encode(`${salt}${CODE_HASH_SEPARATOR}${code.trim()}`);
  const digest = await crypto.subtle.digest("SHA-256", encodedCode);

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function createPlayerSessionToken(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);

  return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashPlayerSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token.trim()),
  );

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
