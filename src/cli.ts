import { readFile } from "node:fs/promises";
import { LintError } from "./errors.js";
import { fix } from "./fixer.js";
import { lint } from "./linter.js";

/**
 * Maximum file size accepted by the CLI: 10 MiB (10,485,760 bytes).
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface CliIO {
  readonly stdout: { write(s: string): unknown };
  readonly stderr: { write(s: string): unknown };
}

/**
 * Executes the OpenAPI style linter CLI.
 *
 * Exit codes:
 * 0: Clean document or successful fix
 * 1: Lint errors found (one or more error-level findings)
 * 2: Usage, I/O, file size, or JSON parse error
 */
export async function run(argv: string[], io: CliIO): Promise<number> {
  if (argv.length < 2) {
    io.stderr.write("Usage: openapi-style-lint <lint|fix> <path-to-json-file>\n");
    return 2;
  }

  const command = argv[0];
  const filePath = argv[1];

  if (command !== "lint" && command !== "fix") {
    io.stderr.write(`Unknown command: ${command}\n`);
    return 2;
  }

  if (!filePath) {
    io.stderr.write("Missing file path\n");
    return 2;
  }

  let rawBuffer: Buffer;
  try {
    rawBuffer = await readFile(filePath);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    io.stderr.write(`I/O error reading file: ${msg}\n`);
    return 2;
  }

  if (rawBuffer.byteLength > MAX_FILE_SIZE) {
    io.stderr.write(
      `input too large: file size ${rawBuffer.byteLength} exceeds maximum allowed of ${MAX_FILE_SIZE} bytes\n`,
    );
    return 2;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBuffer.toString("utf-8"));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    io.stderr.write(`Invalid JSON: ${msg}\n`);
    return 2;
  }

  if (command === "lint") {
    let findings: import("./types.js").Finding[];
    try {
      findings = lint(parsed);
    } catch (err: unknown) {
      if (err instanceof LintError) {
        io.stderr.write(`Lint error (${err.code}): ${err.message}\n`);
        return 2;
      }
      const msg = err instanceof Error ? err.message : String(err);
      io.stderr.write(`Unexpected error: ${msg}\n`);
      return 2;
    }

    for (const f of findings) {
      io.stdout.write(`${f.rule} ${f.severity} ${f.pointer} ${f.message}\n`);
    }

    const hasErrors = findings.some((f) => f.severity === "error");
    return hasErrors ? 1 : 0;
  }

  // command === 'fix'
  try {
    const result = fix(parsed);
    io.stdout.write(`${JSON.stringify(result.doc, null, 2)}\n`);
    return 0;
  } catch (err: unknown) {
    if (err instanceof LintError) {
      io.stderr.write(`Lint error (${err.code}): ${err.message}\n`);
      return 2;
    }
    const msg = err instanceof Error ? err.message : String(err);
    io.stderr.write(`Unexpected error: ${msg}\n`);
    return 2;
  }
}
