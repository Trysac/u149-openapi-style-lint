import { LintError } from "./errors.js";
import type { Finding, LintOptions, RuleId, Severity } from "./types.js";
import {
  assertMaxDepth,
  encodePointerToken,
  HTTP_OPERATIONS,
  isCamelCase,
  isKebabCase,
  toCamelCase,
} from "./utils.js";

interface InternalRuleSpec {
  readonly id: RuleId;
  readonly defaultSeverity: Severity;
}

export const RULE_SPECS: Record<RuleId, InternalRuleSpec> = {
  OAS001: { id: "OAS001", defaultSeverity: "error" },
  OAS002: { id: "OAS002", defaultSeverity: "error" },
  OAS003: { id: "OAS003", defaultSeverity: "warn" },
  OAS004: { id: "OAS004", defaultSeverity: "error" },
  OAS005: { id: "OAS005", defaultSeverity: "warn" },
  OAS006: { id: "OAS006", defaultSeverity: "warn" },
  OAS007: { id: "OAS007", defaultSeverity: "error" },
  OAS008: { id: "OAS008", defaultSeverity: "error" },
  OAS009: { id: "OAS009", defaultSeverity: "error" },
  OAS010: { id: "OAS010", defaultSeverity: "warn" },
};

/**
 * Validates the basic shape of an OpenAPI document and ensures
 * the version string is OpenAPI 3.0.x or 3.1.x.
 */
export function validateDocumentHeader(doc: unknown): asserts doc is Record<string, unknown> {
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    throw new LintError("invalid_document", "Document must be a valid JSON object");
  }

  const root = doc as Record<string, unknown>;
  const openapi = root.openapi;
  if (typeof openapi !== "string" || (!openapi.startsWith("3.0.") && !openapi.startsWith("3.1."))) {
    throw new LintError("unsupported_version", `Unsupported OpenAPI version: ${String(openapi)}`);
  }

  if ("paths" in root) {
    const paths = root.paths;
    if (typeof paths !== "object" || paths === null || Array.isArray(paths)) {
      throw new LintError("invalid_document", "'paths' property must be an object if present");
    }
  }
}

function getEffectiveSeverity(ruleId: RuleId, opts?: LintOptions): Severity | "off" {
  const configured = opts?.severities?.[ruleId];
  if (configured !== undefined) {
    return configured;
  }
  return RULE_SPECS[ruleId].defaultSeverity;
}

interface OperationRef {
  readonly pathStr: string;
  readonly method: string;
  readonly opObj: Record<string, unknown>;
  readonly pathObj: Record<string, unknown>;
  readonly pointer: string;
}

/**
 * Collects all existing operation IDs to detect duplicates and fix collisions.
 */
function collectExistingOperationIds(operations: OperationRef[]): Set<string> {
  const ids = new Set<string>();
  for (const op of operations) {
    if (typeof op.opObj.operationId === "string") {
      ids.add(op.opObj.operationId);
    }
  }
  return ids;
}

/**
 * Extracts path template parameter names from a path string, e.g. /users/{id} -> ['id'].
 */
export function extractPathParameters(pathStr: string): string[] {
  const matches: string[] = [];
  const re = /\{([^}]+)\}/g;
  let match = re.exec(pathStr);
  while (match !== null) {
    const name = match[1]?.trim();
    if (name && name.length > 0) {
      matches.push(name);
    }
    match = re.exec(pathStr);
  }
  return matches;
}

/**
 * Extracts parameter names declared with in === 'path' from an array of parameters.
 */
function extractDeclaredPathParams(params: unknown): Set<string> {
  const declared = new Set<string>();
  if (!Array.isArray(params)) {
    return declared;
  }
  for (const item of params) {
    if (item !== null && typeof item === "object" && !Array.isArray(item)) {
      const p = item as Record<string, unknown>;
      if (p.in === "path" && typeof p.name === "string") {
        declared.add(p.name);
      }
    }
  }
  return declared;
}

/**
 * Lints an OpenAPI 3.0 or 3.1 document against ten style rules.
 */
export function lint(doc: unknown, opts?: LintOptions): Finding[] {
  validateDocumentHeader(doc);
  assertMaxDepth(doc);

  const findings: Finding[] = [];

  function emit(finding: {
    rule: RuleId;
    pointer: string;
    message: string;
    fixable: boolean;
  }): void {
    const severity = getEffectiveSeverity(finding.rule, opts);
    if (severity === "off") {
      return;
    }
    findings.push({
      rule: finding.rule,
      severity,
      pointer: finding.pointer,
      message: finding.message,
      fixable: finding.fixable,
    });
  }

  const root = doc as Record<string, unknown>;
  const pathsObj = (root.paths ?? {}) as Record<string, unknown>;
  const pathKeys = Object.keys(pathsObj);

  // Collect operations
  const operations: OperationRef[] = [];
  for (const pathKey of pathKeys) {
    const pathItem = pathsObj[pathKey];
    if (pathItem === null || typeof pathItem !== "object" || Array.isArray(pathItem)) {
      continue;
    }
    const pRecord = pathItem as Record<string, unknown>;
    for (const key of Object.keys(pRecord)) {
      const lowerKey = key.toLowerCase();
      if (HTTP_OPERATIONS.has(lowerKey)) {
        const opVal = pRecord[key];
        if (opVal !== null && typeof opVal === "object" && !Array.isArray(opVal)) {
          operations.push({
            pathStr: pathKey,
            method: lowerKey,
            opObj: opVal as Record<string, unknown>,
            pathObj: pRecord,
            pointer: `/paths/${encodePointerToken(pathKey)}/${encodePointerToken(key)}`,
          });
        }
      }
    }
  }

  // OAS004 & OAS003: Check paths
  for (const pathKey of pathKeys) {
    const encodedPath = encodePointerToken(pathKey);
    const pathPointer = `/paths/${encodedPath}`;

    // OAS004: Trailing slash on a path other than '/'
    if (pathKey.length > 1 && pathKey.endsWith("/")) {
      const trimmed = pathKey.replace(/\/+$/, "");
      const target = trimmed.length === 0 ? "/" : trimmed;
      const targetExists = Object.hasOwn(pathsObj, target);
      emit({
        rule: "OAS004",
        pointer: pathPointer,
        message: `Path '${pathKey}' has a trailing slash`,
        fixable: !targetExists,
      });
    }

    // OAS003: Literal path segments not kebab-case
    // Split on '/' and ignore empty strings and path parameter templates '{...}'
    const segments = pathKey.split("/");
    for (const segment of segments) {
      if (segment.length === 0) {
        continue;
      }
      if (segment.startsWith("{") && segment.endsWith("}")) {
        continue;
      }
      if (!isKebabCase(segment)) {
        emit({
          rule: "OAS003",
          pointer: pathPointer,
          message: `Literal path segment '${segment}' is not kebab-case`,
          fixable: false,
        });
      }
    }
  }

  // Top-level tags for OAS006
  const topLevelTags = new Set<string>();
  if (Array.isArray(root.tags)) {
    for (const t of root.tags) {
      if (t !== null && typeof t === "object" && !Array.isArray(t)) {
        const tagRecord = t as Record<string, unknown>;
        if (typeof tagRecord.name === "string") {
          topLevelTags.add(tagRecord.name);
        }
      }
    }
  }

  // Operation-level rules: OAS001, OAS002, OAS005, OAS006, OAS007, OAS008, OAS009
  const seenOpIds = new Map<string, string>(); // id -> first pointer
  const existingOpIds = collectExistingOperationIds(operations);

  for (const op of operations) {
    const opId = op.opObj.operationId;
    const opPointer = op.pointer;

    // OAS001: Missing operationId
    if (typeof opId !== "string" || opId.length === 0) {
      emit({
        rule: "OAS001",
        pointer: opPointer,
        message: "missing operationId",
        fixable: false,
      });
    } else {
      // OAS009: Duplicate operationId (one finding per later occurrence)
      if (seenOpIds.has(opId)) {
        emit({
          rule: "OAS009",
          pointer: `${opPointer}/operationId`,
          message: `Duplicate operationId '${opId}'`,
          fixable: false,
        });
      } else {
        seenOpIds.set(opId, opPointer);
      }

      // OAS002: operationId not matching ^[a-z][a-zA-Z0-9]*$
      if (!isCamelCase(opId)) {
        const camel = toCamelCase(opId);
        const canFix = camel.length > 0 && camel !== opId && !existingOpIds.has(camel);
        emit({
          rule: "OAS002",
          pointer: `${opPointer}/operationId`,
          message: `operationId '${opId}' is not camelCase`,
          fixable: canFix,
        });
      }
    }

    // OAS005: Missing summary
    if (typeof op.opObj.summary !== "string" || op.opObj.summary.trim().length === 0) {
      emit({
        rule: "OAS005",
        pointer: opPointer,
        message: "Operation missing summary",
        fixable: false,
      });
    }

    // OAS006: Operation tag missing from top-level tags
    if (Array.isArray(op.opObj.tags)) {
      for (let tIdx = 0; tIdx < op.opObj.tags.length; tIdx++) {
        const tagName = op.opObj.tags[tIdx];
        if (typeof tagName === "string" && !topLevelTags.has(tagName)) {
          emit({
            rule: "OAS006",
            pointer: `${opPointer}/tags/${tIdx}`,
            message: `Tag '${tagName}' missing from top-level tags`,
            fixable: true,
          });
        }
      }
    }

    // OAS007: Path template parameter without a matching 'in: path' parameter
    const templateParams = extractPathParameters(op.pathStr);
    if (templateParams.length > 0) {
      const pathParams = extractDeclaredPathParams(op.pathObj.parameters);
      const opParams = extractDeclaredPathParams(op.opObj.parameters);
      for (const pName of templateParams) {
        if (!pathParams.has(pName) && !opParams.has(pName)) {
          emit({
            rule: "OAS007",
            pointer: opPointer,
            message: `Path template parameter '${pName}' missing matching 'in: path' parameter`,
            fixable: false,
          });
        }
      }
    }

    // OAS008: Response missing description
    if (
      op.opObj.responses !== null &&
      typeof op.opObj.responses === "object" &&
      !Array.isArray(op.opObj.responses)
    ) {
      const respObj = op.opObj.responses as Record<string, unknown>;
      for (const respCode of Object.keys(respObj)) {
        const response = respObj[respCode];
        if (response !== null && typeof response === "object" && !Array.isArray(response)) {
          const rRecord = response as Record<string, unknown>;
          const desc = rRecord.description;
          if (typeof desc !== "string" || desc.trim().length === 0) {
            emit({
              rule: "OAS008",
              pointer: `${opPointer}/responses/${encodePointerToken(respCode)}`,
              message: `Response '${respCode}' missing description`,
              fixable: true,
            });
          }
        }
      }
    }
  }

  // OAS010: Property name in components.schemas not camelCase
  if (
    root.components !== null &&
    typeof root.components === "object" &&
    !Array.isArray(root.components)
  ) {
    const comp = root.components as Record<string, unknown>;
    if (comp.schemas !== null && typeof comp.schemas === "object" && !Array.isArray(comp.schemas)) {
      const schemas = comp.schemas as Record<string, unknown>;
      for (const schemaName of Object.keys(schemas)) {
        const schema = schemas[schemaName];
        if (schema !== null && typeof schema === "object" && !Array.isArray(schema)) {
          checkSchemaProperties(
            schema as Record<string, unknown>,
            `/components/schemas/${encodePointerToken(schemaName)}`,
            emit,
          );
        }
      }
    }
  }

  // Sort findings by pointer then rule
  findings.sort((a, b) => {
    if (a.pointer < b.pointer) return -1;
    if (a.pointer > b.pointer) return 1;
    if (a.rule < b.rule) return -1;
    if (a.rule > b.rule) return 1;
    return 0;
  });

  return findings;
}

/**
 * Recursively checks properties inside schemas for camelCase property names.
 */
function checkSchemaProperties(
  schema: Record<string, unknown>,
  pointer: string,
  emit: (finding: { rule: RuleId; pointer: string; message: string; fixable: boolean }) => void,
): void {
  if (
    schema.properties !== null &&
    typeof schema.properties === "object" &&
    !Array.isArray(schema.properties)
  ) {
    const props = schema.properties as Record<string, unknown>;
    for (const propName of Object.keys(props)) {
      const propPointer = `${pointer}/properties/${encodePointerToken(propName)}`;
      if (!isCamelCase(propName)) {
        emit({
          rule: "OAS010",
          pointer: propPointer,
          message: `Property '${propName}' in schema is not camelCase`,
          fixable: false,
        });
      }
      const propVal = props[propName];
      if (propVal !== null && typeof propVal === "object" && !Array.isArray(propVal)) {
        checkSchemaProperties(propVal as Record<string, unknown>, propPointer, emit);
      }
    }
  }

  // Check items schema for arrays
  if (schema.items !== null && typeof schema.items === "object" && !Array.isArray(schema.items)) {
    checkSchemaProperties(schema.items as Record<string, unknown>, `${pointer}/items`, emit);
  }

  // Check allOf / anyOf / oneOf
  for (const comb of ["allOf", "anyOf", "oneOf"] as const) {
    const arr = schema[comb];
    if (Array.isArray(arr)) {
      for (let i = 0; i < arr.length; i++) {
        const sub = arr[i];
        if (sub !== null && typeof sub === "object" && !Array.isArray(sub)) {
          checkSchemaProperties(sub as Record<string, unknown>, `${pointer}/${comb}/${i}`, emit);
        }
      }
    }
  }
}
