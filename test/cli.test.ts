import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run } from "../src/cli.js";

describe("CLI run", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "openapi-lint-cli-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function createIO() {
    let stdout = "";
    let stderr = "";
    return {
      io: {
        stdout: {
          write: (s: string) => {
            stdout += s;
          },
        },
        stderr: {
          write: (s: string) => {
            stderr += s;
          },
        },
      },
      getStdout: () => stdout,
      getStderr: () => stderr,
    };
  }

  it("await run(['lint', 'api.json'], io) prints 'OAS001 error /paths/~1users~1{id}/get missing operationId' lines and returns 1 when any error exists, 0 otherwise; run(['fix', 'api.json'], io) prints JSON.stringify(fixed, null, 2) + '\n' and returns 0", async () => {
    const apiJsonPath = join(tempDir, "api.json");
    const content = {
      openapi: "3.0.3",
      info: { title: "API", version: "1.0.0" },
      paths: {
        "/users/{id}": {
          parameters: [{ name: "id", in: "path", required: true }],
          get: {
            summary: "Get user",
            responses: { "200": { description: "OK" } },
          },
        },
      },
    };
    writeFileSync(apiJsonPath, JSON.stringify(content, null, 2));

    const { io: ioLint, getStdout: getStdoutLint } = createIO();
    const exitCodeLint = await run(["lint", apiJsonPath], ioLint);

    expect(exitCodeLint).toBe(1);
    expect(getStdoutLint()).toContain(
      "OAS001 error /paths/~1users~1{id}/get missing operationId\n",
    );

    const { io: ioFix, getStdout: getStdoutFix } = createIO();
    const exitCodeFix = await run(["fix", apiJsonPath], ioFix);
    expect(exitCodeFix).toBe(0);
    expect(getStdoutFix().endsWith("\n")).toBe(true);
    const parsedOutput = JSON.parse(getStdoutFix());
    expect(parsedOutput.openapi).toBe("3.0.3");
  });

  it("returns 0 for clean document in lint command", async () => {
    const apiJsonPath = join(tempDir, "clean.json");
    const cleanContent = {
      openapi: "3.0.0",
      info: { title: "Clean", version: "1.0" },
      paths: {
        "/items": {
          get: {
            operationId: "getItems",
            summary: "Retrieve items",
            responses: { "200": { description: "OK" } },
          },
        },
      },
    };
    writeFileSync(apiJsonPath, JSON.stringify(cleanContent));

    const { io, getStdout } = createIO();
    const exitCode = await run(["lint", apiJsonPath], io);
    expect(exitCode).toBe(0);
    expect(getStdout()).toBe("");
  });

  it("the CLI rejects a file of 10_485_761 bytes with exit 2 and stderr starting 'input too large'", async () => {
    const largePath = join(tempDir, "large.json");
    // Create file of exactly 10_485_761 bytes
    const buffer = Buffer.alloc(10_485_761, 32); // spaces
    writeFileSync(largePath, buffer);

    const { io, getStderr } = createIO();
    const exitCode = await run(["lint", largePath], io);
    expect(exitCode).toBe(2);
    expect(getStderr().startsWith("input too large")).toBe(true);
  });

  it("handles usage errors, invalid JSON and missing files with exit 2", async () => {
    const { io: ioUsage, getStderr: getStderrUsage } = createIO();
    const exitUsage = await run([], ioUsage);
    expect(exitUsage).toBe(2);
    expect(getStderrUsage()).toContain("Usage:");

    const { io: ioUnknownCmd, getStderr: getStderrUnknown } = createIO();
    const exitUnknown = await run(["unknown", "file.json"], ioUnknownCmd);
    expect(exitUnknown).toBe(2);
    expect(getStderrUnknown()).toContain("Unknown command");

    const { io: ioNoFile, getStderr: getStderrNoFile } = createIO();
    const exitNoFile = await run(["lint", join(tempDir, "nonexistent.json")], ioNoFile);
    expect(exitNoFile).toBe(2);
    expect(getStderrNoFile()).toContain("I/O error");

    const invalidJsonPath = join(tempDir, "invalid.json");
    writeFileSync(invalidJsonPath, "{ broken json");
    const { io: ioJson, getStderr: getStderrJson } = createIO();
    const exitJson = await run(["lint", invalidJsonPath], ioJson);
    expect(exitJson).toBe(2);
    expect(getStderrJson()).toContain("Invalid JSON");

    const invalidDocPath = join(tempDir, "unsupported.json");
    writeFileSync(invalidDocPath, JSON.stringify({ openapi: "2.0" }));
    const { io: ioDoc, getStderr: getStderrDoc } = createIO();
    const exitDoc = await run(["lint", invalidDocPath], ioDoc);
    expect(exitDoc).toBe(2);
    expect(getStderrDoc()).toContain("Lint error (unsupported_version)");

    const { io: ioFixErr, getStderr: getStderrFixErr } = createIO();
    const exitFixErr = await run(["fix", invalidDocPath], ioFixErr);
    expect(exitFixErr).toBe(2);
    expect(getStderrFixErr()).toContain("Lint error (unsupported_version)");
  });
});
