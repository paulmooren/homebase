/**
 * A new row's id, made on the client so the row can be shown, ticked, edited
 * or deleted before the server has answered. The server accepts it as the
 * row's real id (see `clientIdSchema`).
 *
 * `crypto.randomUUID` only exists on secure pages (https or localhost); a dev
 * server opened by IP address from a phone does not have it, hence the fallback.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}
