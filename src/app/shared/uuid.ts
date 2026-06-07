/**
 * Safe UUID v4 generator. `crypto.randomUUID()` only exists in a **secure context**
 * (HTTPS or `localhost`) on a recent browser; when the SPA is served over plain HTTP
 * via a LAN IP/hostname, or in an older/embedded browser, it is `undefined` and calling
 * it throws `TypeError: crypto.randomUUID is not a function`, which previously broke the
 * whole plan builder at component construction.
 *
 * Falls back to `crypto.getRandomValues` (still cryptographically strong), then to
 * `Math.random` as a last resort. Callers use these only as local form-row tracking keys
 * (never persisted), so the non-crypto fallback is acceptable.
 */
export function uuid(): string {
  const c = globalThis.crypto as Crypto | undefined;

  if (typeof c?.randomUUID === 'function') {
    return c.randomUUID();
  }

  if (typeof c?.getRandomValues === 'function') {
    const bytes = c.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
    return (
      `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-` +
      `${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`
    );
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
