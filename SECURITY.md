# Security Policy

## Supported Versions

This project ships a single active release line. Security fixes are applied
to the latest `main`/tagged release only; older releases and tags are not
patched.

## Reporting a Vulnerability

Please report suspected security vulnerabilities privately -- do not open a
public GitHub issue.

**Preferred: GitHub Private Vulnerability Reporting.** Use the "Report a
vulnerability" button under this repository's **Security** tab
(`https://github.com/Ashour158/HRM-New/security/advisories/new`). This opens
a private security advisory visible only to maintainers, lets you attach
proof-of-concept details safely, and keeps a record tied directly to the
affected code.

**What to include:**
- Affected component/endpoint and, if known, file/line
- Steps to reproduce (or a minimal proof of concept)
- Impact assessment (data exposure, privilege escalation, DoS, etc.)
- Whether the issue affects tenant isolation, PII/financial data, or
  authentication/authorization specifically -- these are treated as highest
  priority given this platform handles employee PII, compensation, and bank
  payment data

**What to expect:**
- Acknowledgement of the report
- A good-faith assessment of severity and a fix timeline once triaged
- Credit in the eventual fix's release notes, if desired -- let us know your
  preference when reporting

**Safe harbor:** Good-faith security research conducted through the
reporting channel above, without accessing, modifying, or exfiltrating
other users'/tenants' data beyond what is strictly necessary to demonstrate
the vulnerability, will not result in legal action from this project.

## Scope

In scope: the application code in this repository (`apps/`, `packages/`),
its documented deployment manifests (`deploy/`), and this repository's own
dependency configuration -- i.e. the package manifests, lockfile, and
`pnpm.overrides` entries that select and pin third-party package versions
(including how they're used by our code). Vulnerabilities caused by an
outdated, misconfigured, or unnecessarily permissive dependency selection
*in this repository* are in scope even if the underlying flaw lives in a
third-party package.

Out of scope: upstream defects in third-party package code itself with no
repository-specific misconfiguration -- report those to the upstream
project -- and any environment not provisioned from this repository's own
infrastructure-as-code.
