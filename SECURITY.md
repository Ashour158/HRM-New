# Security Policy

## Supported Versions

This project ships a single active release line. Security fixes are applied
to the latest `main`/tagged release only.

| Version | Supported          |
| ------- | ------------------ |
| 1.4.x   | :white_check_mark: |
| < 1.4   | :x:                |

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

In scope: the application code in this repository (`apps/`, `packages/`)
and its documented deployment manifests (`deploy/`). Out of scope:
third-party dependencies (report upstream) and any environment not
provisioned from this repository's own infrastructure-as-code.
