# Testing Guide

## Test Suites

- `test/index.test.ts`: Unit tests validating all 10 rules (OAS001-OAS010), depth limits, error handling, and camelCase conversion logic.
- `test/fixtures.test.ts`: Idempotence verification; ensures `fix(fix(doc).doc)` results in no further changes and that lint findings are clean after fixing.
- `test/cli.test.ts`: Integration tests for CLI functionality, covering exit codes, stdout/stderr, and file size boundary checks (10 MiB).

## Running Tests

```bash
npm test
```