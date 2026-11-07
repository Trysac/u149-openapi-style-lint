# Security

## Threat Model

`@trysac/openapi-style-lint` accepts untrusted OpenAPI JSON documents as input.

### Defended Threats

- **Denial of Service (DoS)**: Maliciously deep JSON structures are caught by an iterative traversal limiting nesting to 128 levels (`too_deep`).
- **Memory Exhaustion**: The CLI strictly limits input files to 10 MiB (10,485,760 bytes) before parsing.
- **Unintended Mutation**: The `fix()` function uses `structuredClone()` to ensure all operations are performed on a copy, leaving the original input reference immutable.

### Not Defended

- Malicious content within structurally valid JSON (e.g., semantically invalid payloads). Style rules are not designed as a security firewall.