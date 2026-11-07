import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fix, lint } from "../src/index.js";

describe("Fixtures idempotence and fix verification", () => {
  const fixturesDir = "test/fixtures";
  const fixtureFiles = readdirSync(fixturesDir).filter((file) => file.endsWith(".json"));

  it("fix(fix(doc).doc).applied deep-equals [] for every fixture under 'test/fixtures' (idempotence), and lint(fix(doc).doc) contains no finding with fixable: true", () => {
    for (const file of fixtureFiles) {
      const raw = readFileSync(join(fixturesDir, file), "utf-8");
      const doc = JSON.parse(raw);

      const firstFix = fix(doc);
      const secondFix = fix(firstFix.doc);

      // Idempotence: fix applied to already fixed doc yields empty applied list
      expect(secondFix.applied).toEqual([]);

      // Re-linting the fixed document contains no finding with fixable: true
      const findingsAfterFix = lint(firstFix.doc);
      const fixableFindings = findingsAfterFix.filter((f) => f.fixable === true);
      expect(fixableFindings).toEqual([]);
    }
  });
});
