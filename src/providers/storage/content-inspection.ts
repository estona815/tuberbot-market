const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const MP4_MAJOR_BRANDS = new Set([
  "M4V ",
  "avc1",
  "dash",
  "iso2",
  "iso3",
  "iso4",
  "iso5",
  "iso6",
  "isom",
  "mp41",
  "mp42",
  "msdh",
  "msix",
]);

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

/** Small deterministic detector for the private upload allowlist. */
export function detectPrivateUploadMime(bytes: Uint8Array): string {
  if (startsWith(bytes, PNG_SIGNATURE)) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (ascii(bytes, 0, 5) === "%PDF-") return "application/pdf";

  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const majorBrand = ascii(bytes, 8, 4);
    if (majorBrand === "qt  ") return "video/quicktime";
    if (MP4_MAJOR_BRANDS.has(majorBrand)) return "video/mp4";
  }

  return "application/octet-stream";
}
