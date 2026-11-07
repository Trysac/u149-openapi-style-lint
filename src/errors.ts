import type { LintErrorCode } from "./types.js";

/**
 * Typed error raised when an OpenAPI document violates structural prerequisites
 * or maximum nesting depth limits.
 */
export class LintError extends Error {
  readonly code: LintErrorCode;

  constructor(code: LintErrorCode, message: string) {
    super(message);
    this.name = "LintError";
    this.code = code;
    Object.setPrototypeOf(this, LintError.prototype);
  }
}
