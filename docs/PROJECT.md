# Project Record

## Objective

Provide lightweight, fast, and deterministic style linting and safe autofixing for OpenAPI 3.0/3.1 documents with zero dependencies.

## Scope

- Validation of OpenAPI 3.0.x and 3.1.x JSON specifications.
- Implementation of 10 fixed style rules (OAS001-OAS010).
- CLI tool for linting and safe autofixing.

## Out of Scope

- YAML parsing (users are expected to convert to JSON).
- Custom rule engines or plugin systems.
- Automated breaking change detection.

## Factory run u149 (measured from API usage)

| Phase | Model | Batch | Input | Output | Cache write | Cache read | Cost (USD) |
|---|---|---|---|---|---|---|---|
| generation | gemini-3.8-flash | yes | 4584 | 20672 | 0 | 0 | 0.0405 |
| fix-1 | gemini-3.8-flash | no | 48199 | 2134 | 0 | 203608 | 0.0594 |
| fix-2 | gemini-3.8-flash | no | 27664 | 614 | 0 | 67627 | 0.0281 |
| fix-3 | gemini-3.8-flash | no | 74172 | 1743 | 0 | 524216 | 0.1015 |
| fix-4 | gemini-3.8-flash | no | 20156 | 581 | 0 | 15469 | 0.0185 |
| audit | gemini-3.1-flash-lite | no | 91079 | 542 | 0 | 270593 | 0.0303 |
| docs | gemini-3.1-flash-lite | no | 20781 | 1700 | 0 | 0 | 0.0077 |

Total: $0.2861. Prices: Anthropic list prices.
