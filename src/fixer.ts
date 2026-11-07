import { lint } from "./linter.js";
import type { AppliedFix, LintOptions } from "./types.js";
import {
  encodePointerToken,
  getResponseDescription,
  HTTP_OPERATIONS,
  isCamelCase,
  toCamelCase,
} from "./utils.js";

interface FixResult {
  readonly doc: unknown;
  readonly applied: AppliedFix[];
}

/**
 * Applies safe automated fixes to an OpenAPI document.
 *
 * Operates on structuredClone(doc) so the input is never mutated.
 * Fix order: OAS004, OAS002, OAS006, OAS008, followed by a single re-lint pass.
 */
export function fix(doc: unknown, opts?: LintOptions): FixResult {
  // Initial lint to validate document
  lint(doc, opts);

  const clonedDoc = structuredClone(doc) as Record<string, unknown>;
  const applied: AppliedFix[] = [];

  // Fix Order Step 1: OAS004 - Trailing slash on path
  // Path '/users/' yields 'OAS004' and fix renames it to '/users' unless '/users' already exists
  if (
    clonedDoc.paths !== null &&
    typeof clonedDoc.paths === "object" &&
    !Array.isArray(clonedDoc.paths)
  ) {
    const pathsObj = clonedDoc.paths as Record<string, unknown>;
    const pathKeys = Object.keys(pathsObj);
    for (const pathKey of pathKeys) {
      if (pathKey.length > 1 && pathKey.endsWith("/")) {
        const trimmed = pathKey.replace(/\/+$/, "");
        const target = trimmed.length === 0 ? "/" : trimmed;
        if (!Object.hasOwn(pathsObj, target)) {
          const content = pathsObj[pathKey];
          delete pathsObj[pathKey];
          pathsObj[target] = content;
          applied.push({
            rule: "OAS004",
            pointer: `/paths/${encodePointerToken(pathKey)}`,
            before: pathKey,
            after: target,
          });
        }
      }
    }
  }

  // Fix Order Step 2: OAS002 - operationId camelCase
  // Collect all existing operationIds to ensure no collision
  if (
    clonedDoc.paths !== null &&
    typeof clonedDoc.paths === "object" &&
    !Array.isArray(clonedDoc.paths)
  ) {
    const pathsObj = clonedDoc.paths as Record<string, unknown>;
    const existingOpIds = new Set<string>();

    for (const pathKey of Object.keys(pathsObj)) {
      const pItem = pathsObj[pathKey];
      if (pItem !== null && typeof pItem === "object" && !Array.isArray(pItem)) {
        const pRecord = pItem as Record<string, unknown>;
        for (const m of Object.keys(pRecord)) {
          if (HTTP_OPERATIONS.has(m.toLowerCase())) {
            const op = pRecord[m];
            if (op !== null && typeof op === "object" && !Array.isArray(op)) {
              const opId = (op as Record<string, unknown>).operationId;
              if (typeof opId === "string") {
                existingOpIds.add(opId);
              }
            }
          }
        }
      }
    }

    for (const pathKey of Object.keys(pathsObj)) {
      const pItem = pathsObj[pathKey];
      if (pItem !== null && typeof pItem === "object" && !Array.isArray(pItem)) {
        const pRecord = pItem as Record<string, unknown>;
        for (const m of Object.keys(pRecord)) {
          if (HTTP_OPERATIONS.has(m.toLowerCase())) {
            const op = pRecord[m];
            if (op !== null && typeof op === "object" && !Array.isArray(op)) {
              const opRecord = op as Record<string, unknown>;
              const opId = opRecord.operationId;
              if (typeof opId === "string" && !isCamelCase(opId)) {
                const camel = toCamelCase(opId);
                if (camel.length > 0 && !existingOpIds.has(camel)) {
                  existingOpIds.delete(opId);
                  existingOpIds.add(camel);
                  opRecord.operationId = camel;
                  applied.push({
                    rule: "OAS002",
                    pointer: `/paths/${encodePointerToken(pathKey)}/${encodePointerToken(m)}/operationId`,
                    before: opId,
                    after: camel,
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  // Fix Order Step 3: OAS006 - Operation tag missing from top-level tags
  // Appends { name: 'admin' } with the top-level tags sorted by name
  const topTagsArray: Array<Record<string, unknown>> = [];
  if (Array.isArray(clonedDoc.tags)) {
    for (const t of clonedDoc.tags) {
      if (t !== null && typeof t === "object" && !Array.isArray(t)) {
        topTagsArray.push(t as Record<string, unknown>);
      }
    }
  }

  const topTagNames = new Set<string>();
  for (const t of topTagsArray) {
    if (typeof t.name === "string") {
      topTagNames.add(t.name);
    }
  }

  const missingTagsToAdd: string[] = [];
  if (
    clonedDoc.paths !== null &&
    typeof clonedDoc.paths === "object" &&
    !Array.isArray(clonedDoc.paths)
  ) {
    const pathsObj = clonedDoc.paths as Record<string, unknown>;
    for (const pathKey of Object.keys(pathsObj)) {
      const pItem = pathsObj[pathKey];
      if (pItem !== null && typeof pItem === "object" && !Array.isArray(pItem)) {
        const pRecord = pItem as Record<string, unknown>;
        for (const m of Object.keys(pRecord)) {
          if (HTTP_OPERATIONS.has(m.toLowerCase())) {
            const op = pRecord[m];
            if (op !== null && typeof op === "object" && !Array.isArray(op)) {
              const opRecord = op as Record<string, unknown>;
              if (Array.isArray(opRecord.tags)) {
                for (let tIdx = 0; tIdx < opRecord.tags.length; tIdx++) {
                  const tName = opRecord.tags[tIdx];
                  if (typeof tName === "string" && !topTagNames.has(tName)) {
                    if (!missingTagsToAdd.includes(tName)) {
                      missingTagsToAdd.push(tName);
                    }
                    applied.push({
                      rule: "OAS006",
                      pointer: `/paths/${encodePointerToken(pathKey)}/${encodePointerToken(m)}/tags/${tIdx}`,
                      before: undefined,
                      after: tName,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  if (missingTagsToAdd.length > 0) {
    for (const mTag of missingTagsToAdd) {
      topTagsArray.push({ name: mTag });
      topTagNames.add(mTag);
    }
    topTagsArray.sort((a, b) => {
      const nameA = typeof a.name === "string" ? a.name : "";
      const nameB = typeof b.name === "string" ? b.name : "";
      return nameA.localeCompare(nameB);
    });
    clonedDoc.tags = topTagsArray;
  }

  // Fix Order Step 4: OAS008 - Response missing description
  if (
    clonedDoc.paths !== null &&
    typeof clonedDoc.paths === "object" &&
    !Array.isArray(clonedDoc.paths)
  ) {
    const pathsObj = clonedDoc.paths as Record<string, unknown>;
    for (const pathKey of Object.keys(pathsObj)) {
      const pItem = pathsObj[pathKey];
      if (pItem !== null && typeof pItem === "object" && !Array.isArray(pItem)) {
        const pRecord = pItem as Record<string, unknown>;
        for (const m of Object.keys(pRecord)) {
          if (HTTP_OPERATIONS.has(m.toLowerCase())) {
            const op = pRecord[m];
            if (op !== null && typeof op === "object" && !Array.isArray(op)) {
              const opRecord = op as Record<string, unknown>;
              if (
                opRecord.responses !== null &&
                typeof opRecord.responses === "object" &&
                !Array.isArray(opRecord.responses)
              ) {
                const respObj = opRecord.responses as Record<string, unknown>;
                for (const rCode of Object.keys(respObj)) {
                  const respVal = respObj[rCode];
                  if (respVal !== null && typeof respVal === "object" && !Array.isArray(respVal)) {
                    const rRecord = respVal as Record<string, unknown>;
                    const desc = rRecord.description;
                    if (typeof desc !== "string" || desc.trim().length === 0) {
                      const standardDesc = getResponseDescription(rCode);
                      rRecord.description = standardDesc;
                      applied.push({
                        rule: "OAS008",
                        pointer: `/paths/${encodePointerToken(pathKey)}/${encodePointerToken(m)}/responses/${encodePointerToken(rCode)}`,
                        before: desc,
                        after: standardDesc,
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Re-lint once to verify
  lint(clonedDoc, opts);

  return {
    doc: clonedDoc,
    applied,
  };
}
