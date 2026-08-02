import "server-only";

const forbiddenReturnToPattern = /[\\\u0000-\u001f\u007f]/u;
const encodedBoundaryPattern = /%(?:25)*(?:2f|5c|00|0[0-9a-f]|1[0-9a-f]|7f)/iu;

export function parseReturnTo(value: unknown, fallback = "/"): string {
  if (value === undefined) return fallback;
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 2_048 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    forbiddenReturnToPattern.test(value) ||
    encodedBoundaryPattern.test(value)
  ) {
    throw new TypeError("Invalid returnTo path");
  }

  let parsed: URL;
  try {
    parsed = new URL(value, "https://return-to.invalid");
  } catch {
    throw new TypeError("Invalid returnTo path");
  }

  if (parsed.origin !== "https://return-to.invalid") {
    throw new TypeError("Invalid returnTo path");
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
