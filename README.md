# openapi-style-lint

[![npm version](https://img.shields.io/npm/v/@trysac/openapi-style-lint.svg)](https://www.npmjs.com/package/@trysac/openapi-style-lint)
[![license: MIT](https://img.shields.io/npm/l/@trysac/openapi-style-lint.svg)](LICENSE)
[![CI](https://github.com/Trysac/u149-openapi-style-lint/actions/workflows/ci.yml/badge.svg)](https://github.com/Trysac/u149-openapi-style-lint/actions/workflows/ci.yml)

Style lint for OpenAPI 3.0 and 3.1 JSON documents with ten rules, RFC 6901 pointers, safe idempotent autofixes and a CLI

## Problem

Describe in two or three sentences the concrete problem this utility solves, who hits it, and why existing
packages do not solve it well. Keep it factual; link to an issue or decision record when there is one.

## Install

```sh
npm install @trysac/openapi-style-lint
```

Requires Node.js 20 or newer. The package ships ES modules with TypeScript declarations.

## Usage

```ts
import { greet } from "@trysac/openapi-style-lint";

// Build a greeting; surrounding whitespace is ignored.
const message = greet("  Ada ");
console.log(message); // "Hello, Ada!"

try {
  greet("   ");
} catch (error) {
  console.error((error as Error).message); // "name must not be empty"
}
```

## API

| Export | Signature | Description |
|---|---|---|
| `greet` | `(name: string) => string` | Placeholder API; replace it with the real one. |

## Development

```sh
npm install
npm run check   # lint, format, types, tests with coverage, docs, secrets
```

See [AGENTS.md](AGENTS.md) for the full command list and [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## License

[MIT](LICENSE) © 2026 Miguel Gomez
