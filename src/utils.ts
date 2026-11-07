import { LintError } from "./errors.js";

/**
 * Maximum allowed object/array nesting depth for linting.
 */
export const MAX_DOCUMENT_DEPTH = 128;

/**
 * HTTP operation methods defined in OpenAPI 3.0 and 3.1.
 */
export const HTTP_OPERATIONS = new Set([
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
]);

/**
 * Encodes a JSON pointer token according to RFC 6901.
 *
 * '~' is encoded as '~0'
 * '/' is encoded as '~1'
 */
export function encodePointerToken(token: string): string {
  return token.replace(/~/g, "~0").replace(/\//g, "~1");
}

/**
 * Converts an arbitrary string into camelCase.
 *
 * Splits on non-alphanumeric runs and before an uppercase letter
 * preceded by a lowercase letter or digit; lowercases every word;
 * capitalises all but the first; joins.
 */
export function toCamelCase(s: string): string {
  if (typeof s !== "string" || s.length === 0) {
    return "";
  }

  // Split before uppercase letters preceded by lowercase or digit
  const preSplit = s.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  // Split on non-alphanumeric characters
  const words = preSplit
    .split(/[^a-zA-Z0-9]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.toLowerCase());

  if (words.length === 0) {
    return "";
  }

  const first = words[0] ?? "";
  const rest = words
    .slice(1)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");

  return first + rest;
}

/**
 * Checks if a string conforms to lower camelCase ^[a-z][a-zA-Z0-9]*$.
 */
export function isCamelCase(s: string): boolean {
  return /^[a-z][a-zA-Z0-9]*$/.test(s);
}

/**
 * Checks if a string conforms to kebab-case ^[a-z0-9]+(-[a-z0-9]+)*$.
 */
export function isKebabCase(s: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);
}

/**
 * Validates the nesting depth of an arbitrary JSON-like data structure iteratively.
 * Throws LintError('too_deep') if any node exceeds MAX_DOCUMENT_DEPTH.
 */
export function assertMaxDepth(doc: unknown, maxDepth = MAX_DOCUMENT_DEPTH): void {
  if (doc === null || typeof doc !== "object") {
    return;
  }

  const stack: Array<{ value: object; depth: number }> = [{ value: doc as object, depth: 1 }];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    if (current.depth > maxDepth) {
      throw new LintError(
        "too_deep",
        `Document nesting exceeds maximum allowed depth of ${maxDepth}`,
      );
    }

    const target = current.value;
    if (Array.isArray(target)) {
      for (let i = 0; i < target.length; i++) {
        const item = target[i];
        if (item !== null && typeof item === "object") {
          stack.push({ value: item as object, depth: current.depth + 1 });
        }
      }
    } else {
      const record = target as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        const child = record[key];
        if (child !== null && typeof child === "object") {
          stack.push({ value: child as object, depth: current.depth + 1 });
        }
      }
    }
  }
}

/**
 * RFC 9110 Section 15 default status response reason table.
 */
export const REASON_PHRASES: Record<string, string> = {
  "200": "OK",
  "201": "Created",
  "202": "Accepted",
  "204": "No Content",
  "400": "Bad Request",
  "401": "Unauthorized",
  "403": "Forbidden",
  "404": "Not Found",
  "409": "Conflict",
  "422": "Unprocessable Content",
  "429": "Too Many Requests",
  "500": "Internal Server Error",
  "503": "Service Unavailable",
  default: "Unexpected error",
};

/**
 * Resolves standard response description according to RFC 9110 mapping.
 */
export function getResponseDescription(code: string): string {
  const found = REASON_PHRASES[code];
  if (found !== undefined) {
    return found;
  }
  return "Response";
}
