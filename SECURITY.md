# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x (beta) | Yes — best-effort fixes |

## Reporting a vulnerability

**Do not open a public GitHub issue** for security-sensitive reports.

Email or DM the repository owner with:

- Description of the issue
- Steps to reproduce
- Impact (e.g. sandbox escape, credential leak, policy bypass)
- ShieldedShell version (`shieldedshell --version`) and OS

We will acknowledge within a few business days and coordinate a fix before public disclosure when appropriate.

## Scope

ShieldedShell aims to **reduce** risk when running coding agents locally. It is not a guarantee against a malicious or compromised agent. Known limits:

- Agent runs use `networkPolicy: "agent"` and inherit environment for LLM CLI tools.
- Policy scanning is pattern-based; novel exfil paths may not be blocked.
- Overlay and workspace binding depend on correct `shield.yaml` and cwd.

Report bypasses of documented sandbox behavior as security issues.
