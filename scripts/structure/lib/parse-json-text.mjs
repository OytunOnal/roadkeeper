// @level kernel
// Roadkeeper — a JSON file's text parsed, as the structure module reads structure.json: the one parse its readers share.

const BYTE_ORDER_MARK = String.fromCodePoint(0xfeff); // an editor may open a JSON file with it; JSON.parse refuses it

// The value JSON text holds, a leading byte-order mark taken off first; null when there is no text or it is not JSON.
export function parseJsonText(text) {
  const plain = String(text ?? "");
  try { return JSON.parse(plain.startsWith(BYTE_ORDER_MARK) ? plain.slice(1) : plain); } catch { return null; }
}
