/**
 * A fresh UUID v4 to send as `Idempotency-Key`.
 *
 * `crypto.randomUUID()` is not always there: browsers only expose it in secure contexts (HTTPS or
 * localhost, so not a plain-HTTP staging host), and some test environments (jsdom) lack it. The
 * key only has to be unique per shipment intent, so a v4 built from `getRandomValues` (or, last
 * resort, `Math.random`) is enough.
 */
export function createOlvaIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto;

  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  const bytes = new Uint8Array(16);

  if (typeof cryptoApi?.getRandomValues === "function") {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  // RFC 4122 v4: version in the high nibble of byte 6, variant in the high bits of byte 8
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));

  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}
