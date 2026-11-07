# Architecture

`@trysac/openapi-style-lint` is a pure TypeScript ESM library for OpenAPI style validation and safe autofixing.

## Design Goals

- **Zero Dependencies**: Pure TypeScript/ESM implementation.
- **Safe Autofixing**: Fixes are non-destructive and idempotent (e.g., trimming trailing slashes only if the target path doesn't already exist).
- **Resource Constraints**: Iterative depth traversal (cap 128) and CLI file size limit (10 MiB) to prevent stack overflows and memory exhaustion.
- **RFC 6901 Compliance**: All findings return exact JSON pointers.

## Module Structure

- `src/linter.ts`: Core validation engine checking OAS001-OAS010.
- `src/fixer.ts`: Four-stage fix pipeline (OAS004 -> OAS002 -> OAS006 -> OAS008) with re-linting for verification.
- `src/cli.ts`: IO handling, size limits, and command execution.
- `src/utils.ts`: String casing utilities, RFC 9110 status table, and iterative tree traversal.