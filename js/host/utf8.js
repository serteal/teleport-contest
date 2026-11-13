// host/utf8.js - UTF-8 conversions between JS strings and the C heap.
//
//   utf8Bytes(text)                    -> Uint8Array (a lone surrogate becomes U+FFFD)
//   utf8ToString(heap, p, max)         -> JS string of the NUL-terminated UTF-8 at p
//   stringToUtf8(text, heap, p, max)   -> bytes written at p (NUL-terminated, at most max in all)
//   utf8Length(text)                   -> bytes stringToUtf8 writes for text, without the NUL
//
// The heap conversions are the C library's conventions for path names (Emscripten's
// UTF8ToString / stringToUTF8 / lengthBytesUTF8).

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** The UTF-8 bytes of text. */
export function utf8Bytes(text) {
  return encoder.encode(String(text));
}

/** JS string of the NUL-terminated UTF-8 string at p (at most max bytes). */
export function utf8ToString(heap, p, max = Infinity) {
  let end = p;
  const maxEnd = p + max;
  while (heap[end] && !(end >= maxEnd)) ++end;
  if (end - p > 16) return decoder.decode(heap.subarray(p, end));
  let str = "";
  let i = p;
  while (i < end) {
    let u0 = heap[i++];
    if (!(u0 & 0x80)) {
      str += String.fromCharCode(u0);
      continue;
    }
    const u1 = heap[i++] & 63;
    if ((u0 & 0xe0) === 0xc0) {
      str += String.fromCharCode(((u0 & 31) << 6) | u1);
      continue;
    }
    const u2 = heap[i++] & 63;
    if ((u0 & 0xf0) === 0xe0) u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
    else u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heap[i++] & 63);
    if (u0 < 0x10000) str += String.fromCharCode(u0);
    else {
      const ch = u0 - 0x10000;
      str += String.fromCharCode(0xd800 | (ch >> 10), 0xdc00 | (ch & 0x3ff));
    }
  }
  return str;
}

/** Write text as UTF-8 at p (at most max bytes incl. the NUL); returns the bytes written w/o NUL. */
export function stringToUtf8(text, heap, p, max) {
  if (!(max > 0)) return 0;
  const start = p;
  const end = p + max - 1;
  for (let i = 0; i < text.length; ++i) {
    const u = text.codePointAt(i);
    if (u > 0xffff) i++;
    if (u <= 0x7f) {
      if (p >= end) break;
      heap[p++] = u;
    } else if (u <= 0x7ff) {
      if (p + 1 >= end) break;
      heap[p++] = 0xc0 | (u >> 6);
      heap[p++] = 0x80 | (u & 63);
    } else if (u <= 0xffff) {
      if (p + 2 >= end) break;
      heap[p++] = 0xe0 | (u >> 12);
      heap[p++] = 0x80 | ((u >> 6) & 63);
      heap[p++] = 0x80 | (u & 63);
    } else {
      if (p + 3 >= end) break;
      heap[p++] = 0xf0 | (u >> 18);
      heap[p++] = 0x80 | ((u >> 12) & 63);
      heap[p++] = 0x80 | ((u >> 6) & 63);
      heap[p++] = 0x80 | (u & 63);
    }
  }
  heap[p] = 0;
  return p - start;
}

/** Number of UTF-8 bytes of text (without the NUL). */
export function utf8Length(text) {
  let len = 0;
  for (let i = 0; i < text.length; ++i) {
    const c = text.charCodeAt(i);
    if (c <= 0x7f) len++;
    else if (c <= 0x7ff) len += 2;
    else if (c >= 0xd800 && c <= 0xdfff) {
      len += 4;
      ++i;
    } else len += 3;
  }
  return len;
}
