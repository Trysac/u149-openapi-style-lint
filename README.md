# @trysac/openapi-style-lint

Style lint and safe autofixer for OpenAPI 3.0 and 3.1 JSON documents. Provides 10 fixed style rules, RFC 6901 JSON pointer tracking, idempotent safe autofixes, and a zero-dependency CLI.

## The Problem

API style guides often demand consistent patterns like camelCase for operationIds, kebab-case for paths, and mandatory response descriptions. Manual enforcement is error-prone, and existing linters are frequently heavy rule engines with complex configuration overhead.

## Installation

```bash
npm install @trysac/openapi-style-lint
```

## Usage Example

```typescript
import { fix, lint } from "@trysac/openapi-style-lint";

const doc = { openapi: "3.0.3", info: { title: "API", version: "1.0" }, paths: { "/users/": {} } };
const findings = lint(doc);
// Findings: [{ rule: 'OAS004', severity: 'error', pointer: '/paths/~1users~1', message: "Path '/users/' has a trailing slash", fixable: true }]

const { doc: fixed, applied } = fix(doc);
// 'fixed' paths key: "/users"
```

## Public API Summary

- `lint(doc: unknown, opts?: LintOptions): Finding[]`: Validates OpenAPI 3.0/3.1 JSON.
- `fix(doc: unknown, opts?: LintOptions): { doc: unknown, applied: AppliedFix[] }`: Applies safe, non-destructive fixes. Uses `structuredClone` to keep input immutable.
- `LintError`: Thrown for structural issues (unsupported_version, invalid_document, too_deep).
- Options: Configure rule severities (`error`, `warn`, `off`).
- CLI: `npx openapi-style-lint <lint|fix> <path>` with 10 MiB input limit and standard exit codes (0 clean, 1 errors, 2 usage/IO).

## Why not Spectral or Redocly?

`@trysac/openapi-style-lint` offers 10 specific, fixed style rules and guaranteed safe, idempotent autofixes without external rule engines or configuration dependency bloat.

## Security

See [docs/SECURITY.md](docs/SECURITY.md) for the threat model.