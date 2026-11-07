/**
 * Supported rule identifiers for OpenAPI style linting.
 */
export type RuleId =
  | "OAS001"
  | "OAS002"
  | "OAS003"
  | "OAS004"
  | "OAS005"
  | "OAS006"
  | "OAS007"
  | "OAS008"
  | "OAS009"
  | "OAS010";

/**
 * Severity levels supported for findings and rule configurations.
 */
export type Severity = "error" | "warn";

/**
 * Configurable rule severity options, including disabling via 'off'.
 */
export type RuleSeverityConfig = "error" | "warn" | "off";

/**
 * Options accepted by lint and fix functions.
 */
export interface LintOptions {
  readonly severities?: Partial<Record<RuleId, RuleSeverityConfig>>;
}

/**
 * A single rule finding in an OpenAPI document.
 */
export interface Finding {
  readonly rule: RuleId;
  readonly severity: Severity;
  readonly pointer: string;
  readonly message: string;
  readonly fixable: boolean;
}

/**
 * Record of an applied automated fix.
 */
export interface AppliedFix {
  readonly rule: RuleId;
  readonly pointer: string;
  readonly before: unknown;
  readonly after: unknown;
}

/**
 * Error codes produced by LintError.
 */
export type LintErrorCode = "unsupported_version" | "invalid_document" | "too_deep";
