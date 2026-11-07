/**
 * Public entry point of @trysac/openapi-style-lint.
 *
 * Provides style linting and safe autofixing for OpenAPI 3.0 and 3.1 documents.
 * Pure library functions only - no Node.js builtins are imported here.
 */

export { LintError } from "./errors.js";
export { fix } from "./fixer.js";
export { lint } from "./linter.js";
export type {
  AppliedFix,
  Finding,
  LintErrorCode,
  LintOptions,
  RuleId,
  RuleSeverityConfig,
  Severity,
} from "./types.js";
export { toCamelCase } from "./utils.js";
