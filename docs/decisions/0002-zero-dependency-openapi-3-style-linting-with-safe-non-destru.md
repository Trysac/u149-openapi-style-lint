# Zero-dependency OpenAPI 3 style linting with safe non-destructive fixes

Status: accepted (generated, pending human review)

## Context

Existing OpenAPI linters like Spectral or Redocly rely on complex AST parsers and large dependency trees. Developers need a zero-dependency, ultra-fast style linter for OpenAPI 3.0 and 3.1 JSON documents with fixed safe autofixes.

## Decision

Implement ten fixed linting rules with RFC 6901 pointer tracking and an iterative maximum depth checker capped at 128 levels. Automated fixes clone inputs via structuredClone and apply fixes in a deterministic sequence (OAS004, OAS002, OAS006, OAS008) verifying that no breaking collision occurs.

## Consequences

Maintains zero runtime dependencies while ensuring idempotence, no in-place mutation, and protection against stack overflow or prototype pollution.
