import { describe, expect, it } from "vitest";
import { fix, LintError, lint, toCamelCase } from "../src/index.js";

describe("toCamelCase", () => {
  it("handles empty and non-string inputs", () => {
    expect(toCamelCase("")).toBe("");
    expect(toCamelCase("   ")).toBe("");
    expect(toCamelCase(null as unknown as string)).toBe("");
  });

  it("converts snake_case, kebab-case, and mixed strings", () => {
    expect(toCamelCase("get_user-by_id")).toBe("getUserById");
    expect(toCamelCase("user_id")).toBe("userId");
    expect(toCamelCase("FindUserByID")).toBe("findUserById");
    expect(toCamelCase("alreadyCamel")).toBe("alreadyCamel");
    expect(toCamelCase("create--user__account")).toBe("createUserAccount");
  });
});

describe("lint and fix acceptance criteria", () => {
  it("An operation without operationId yields Finding { rule: 'OAS001', severity: 'error', pointer: '/paths/~1users~1{id}/get', fixable: false } and operationId 'get_user-by_id' yields 'OAS002' with fixable: true", () => {
    const doc = {
      openapi: "3.0.3",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/users/{id}": {
          get: {
            responses: {
              "200": { description: "OK" },
            },
            parameters: [{ name: "id", in: "path", required: true }],
          },
        },
      },
    };

    const findings = lint(doc);
    const oas001 = findings.find((f) => f.rule === "OAS001");
    expect(oas001).toEqual({
      rule: "OAS001",
      severity: "error",
      pointer: "/paths/~1users~1{id}/get",
      message: "missing operationId",
      fixable: false,
    });

    const docWithBadId = {
      openapi: "3.0.3",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/users": {
          get: {
            operationId: "get_user-by_id",
            summary: "Get user by id",
            responses: {
              "200": { description: "OK" },
            },
          },
        },
      },
    };
    const findingsBadId = lint(docWithBadId);
    const oas002 = findingsBadId.find((f) => f.rule === "OAS002");
    expect(oas002).toBeDefined();
    expect(oas002?.rule).toBe("OAS002");
    expect(oas002?.fixable).toBe(true);
  });

  it("fix(doc) renames 'get_user-by_id' to 'getUserById', returns applied [{ rule: 'OAS002', pointer: '/paths/~1users/get/operationId', before: 'get_user-by_id', after: 'getUserById' }] and leaves the input object deep-equal to its original", () => {
    const doc = {
      openapi: "3.0.3",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/users": {
          get: {
            operationId: "get_user-by_id",
            summary: "Get users",
            responses: {
              "200": { description: "OK" },
            },
          },
        },
      },
    };

    const clone = structuredClone(doc);
    const result = fix(doc);

    expect(doc).toEqual(clone);
    expect(result.applied).toContainEqual({
      rule: "OAS002",
      pointer: "/paths/~1users/get/operationId",
      before: "get_user-by_id",
      after: "getUserById",
    });

    const fixedPaths = (result.doc as { paths: Record<string, { get: { operationId: string } }> })
      .paths;
    expect(fixedPaths["/users"]?.get.operationId).toBe("getUserById");
  });

  it("Path '/users/' yields 'OAS004' and fix renames it to '/users' unless '/users' already exists, in which case the finding stays and no fix is applied", () => {
    const doc = {
      openapi: "3.0.3",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/users/": {
          get: {
            operationId: "getUsers",
            summary: "List users",
            responses: {
              "200": { description: "OK" },
            },
          },
        },
      },
    };

    const findings = lint(doc);
    const oas004 = findings.find((f) => f.rule === "OAS004");
    expect(oas004).toBeDefined();
    expect(oas004?.pointer).toBe("/paths/~1users~1");
    expect(oas004?.fixable).toBe(true);

    const fixed = fix(doc);
    expect(fixed.applied).toContainEqual({
      rule: "OAS004",
      pointer: "/paths/~1users~1",
      before: "/users/",
      after: "/users",
    });
    const pathsRecord = (fixed.doc as { paths: Record<string, unknown> }).paths;
    expect(pathsRecord["/users"]).toBeDefined();
    expect(pathsRecord["/users/"]).toBeUndefined();

    // Collision case: /users already exists
    const docCollision = {
      openapi: "3.0.3",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/users": {
          get: {
            operationId: "getUsers",
            summary: "List users",
            responses: { "200": { description: "OK" } },
          },
        },
        "/users/": {
          get: {
            operationId: "getUsersSlash",
            summary: "List users slash",
            responses: { "200": { description: "OK" } },
          },
        },
      },
    };
    const findingsColl = lint(docCollision);
    const oas004Coll = findingsColl.find((f) => f.rule === "OAS004");
    expect(oas004Coll?.fixable).toBe(false);

    const fixedColl = fix(docCollision);
    const oas004Applied = fixedColl.applied.find((a) => a.rule === "OAS004");
    expect(oas004Applied).toBeUndefined();
  });

  it("A response '404' without description yields 'OAS008' and fix sets description 'Not Found'; response 'default' gets 'Unexpected error' and an unlisted code '418' gets 'Response'", () => {
    const doc = {
      openapi: "3.0.3",
      info: { title: "Test", version: "1.0" },
      paths: {
        "/items": {
          get: {
            operationId: "getItems",
            summary: "items",
            responses: {
              "404": {},
              default: {},
              "418": {},
            },
          },
        },
      },
    };

    const findings = lint(doc);
    const oas008Findings = findings.filter((f) => f.rule === "OAS008");
    expect(oas008Findings.length).toBe(3);

    const fixed = fix(doc);
    const fixedResponses = (
      fixed.doc as {
        paths: {
          "/items": {
            get: {
              responses: Record<string, { description?: string }>;
            };
          };
        };
      }
    ).paths["/items"].get.responses;
    expect(fixedResponses["404"]?.description).toBe("Not Found");
    expect(fixedResponses.default?.description).toBe("Unexpected error");
    expect(fixedResponses["418"]?.description).toBe("Response");
  });

  it("A tag 'admin' used by an operation but missing from the top-level tags yields 'OAS006' and fix appends { name: 'admin' } with the top-level tags sorted by name; a path '/users/{id}' without an 'id' path parameter yields 'OAS007'", () => {
    const doc = {
      openapi: "3.0.3",
      info: { title: "Test API", version: "1.0.0" },
      tags: [{ name: "public" }, { name: "zebra" }],
      paths: {
        "/users/{id}": {
          get: {
            operationId: "getUser",
            summary: "Get user",
            tags: ["admin"],
            responses: { "200": { description: "OK" } },
          },
        },
      },
    };

    const findings = lint(doc);
    const oas006 = findings.find((f) => f.rule === "OAS006");
    expect(oas006).toBeDefined();
    expect(oas006?.rule).toBe("OAS006");
    expect(oas006?.fixable).toBe(true);

    const oas007 = findings.find((f) => f.rule === "OAS007");
    expect(oas007).toBeDefined();
    expect(oas007?.rule).toBe("OAS007");
    expect(oas007?.pointer).toBe("/paths/~1users~1{id}/get");

    const fixed = fix(doc);
    const fixedTags = (fixed.doc as { tags?: Array<{ name: string }> }).tags;
    expect(fixedTags).toEqual([{ name: "admin" }, { name: "public" }, { name: "zebra" }]);
  });

  it("lint({ openapi: '2.0' }) throws LintError with code 'unsupported_version'; a document nested 129 levels deep throws code 'too_deep'", () => {
    expect(() => lint({ openapi: "2.0" })).toThrow(LintError);
    try {
      lint({ openapi: "2.0" });
    } catch (e) {
      expect((e as LintError).code).toBe("unsupported_version");
    }

    // Create a 129-level deep object
    const deep: Record<string, unknown> = {
      openapi: "3.0.0",
      info: { title: "Deep", version: "1" },
    };
    let curr = deep;
    for (let i = 0; i < 130; i++) {
      const next: Record<string, unknown> = {};
      curr.child = next;
      curr = next;
    }
    expect(() => lint(deep)).toThrow(LintError);
    try {
      lint(deep);
    } catch (e) {
      expect((e as LintError).code).toBe("too_deep");
    }
  });

  it("validates invalid document structure and unsupported versions", () => {
    expect(() => lint(null)).toThrow(LintError);
    expect(() => lint([])).toThrow(LintError);
    expect(() => lint("string")).toThrow(LintError);
    expect(() => lint({ openapi: "4.0.0" })).toThrow(LintError);
    expect(() => lint({ openapi: "3.0.0", paths: "not-an-object" })).toThrow(LintError);
  });

  it("validates OAS003 (path segment kebab-case), OAS005 (missing summary), OAS009 (duplicate operationId), OAS010 (schema properties camelCase)", () => {
    const doc = {
      openapi: "3.1.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/v1/user_accounts/{id}/extra_details": {
          parameters: [{ name: "id", in: "path", required: true }],
          get: {
            operationId: "getAccount",
            responses: { "200": { description: "OK" } },
          },
          post: {
            operationId: "getAccount", // duplicate OAS009
            summary: "   ", // missing summary OAS005
            responses: { "200": { description: "OK" } },
          },
        },
      },
      components: {
        schemas: {
          UserAccount: {
            type: "object",
            properties: {
              user_name: { type: "string" },
              nestedItem: {
                type: "object",
                properties: {
                  sub_field: { type: "number" },
                },
              },
            },
            items: {
              properties: {
                array_field_bad: { type: "string" },
              },
            },
            allOf: [
              {
                properties: {
                  all_of_field: { type: "string" },
                },
              },
            ],
          },
        },
      },
    };

    const findings = lint(doc);
    const oas003 = findings.filter((f) => f.rule === "OAS003");
    expect(oas003.length).toBeGreaterThanOrEqual(2);

    const oas005 = findings.filter((f) => f.rule === "OAS005");
    expect(oas005.length).toBe(2); // both get and post lack valid summary

    const oas009 = findings.find((f) => f.rule === "OAS009");
    expect(oas009).toBeDefined();
    expect(oas009?.pointer).toBe(
      "/paths/~1v1~1user_accounts~1{id}~1extra_details/post/operationId",
    );

    const oas010 = findings.filter((f) => f.rule === "OAS010");
    expect(oas010.length).toBe(4);
  });

  it("allows severities override and disabling via 'off'", () => {
    const doc = {
      openapi: "3.0.0",
      paths: {
        "/users": {
          get: {
            responses: { "200": { description: "OK" } },
          },
        },
      },
    };

    const findingsWarn = lint(doc, { severities: { OAS001: "warn" } });
    expect(findingsWarn.find((f) => f.rule === "OAS001")?.severity).toBe("warn");

    const findingsOff = lint(doc, { severities: { OAS001: "off" } });
    expect(findingsOff.find((f) => f.rule === "OAS001")).toBeUndefined();
  });
});
