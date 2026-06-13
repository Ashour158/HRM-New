# Security Policy

## Supported Versions

Security fixes are accepted for the current `main` branch and the latest tagged release. Older tags are treated as reference builds unless a maintainer explicitly opens a maintenance branch.

| Version | Supported |
| ------- | --------- |
| Latest tagged release | Yes |
| `main` | Yes |
| Older releases | Case by case |

## Reporting A Vulnerability

Please report suspected vulnerabilities privately through GitHub Security Advisories for this repository, or contact the repository owner directly if advisory access is unavailable.

Include:

- affected route, workflow, or package;
- reproduction steps;
- tenant/user role assumptions;
- expected impact;
- logs, request IDs, or screenshots with secrets redacted.

Do not include plaintext API keys, passwords, tokens, private keys, payroll files, or personally identifiable HR data in the report.

## Response Expectations

- Initial triage target: 3 business days.
- Critical exploitable issues: fix or mitigation plan within 7 business days.
- High severity issues: fix or mitigation plan within 14 business days.
- Medium/low severity issues: scheduled according to release priority.

Accepted vulnerabilities should receive a tracked remediation issue or private advisory. Declined reports should include the reason when it is safe to share.

## Release Security Gates

Every production release should pass:

- secret scan;
- dependency audit;
- CodeQL analysis;
- Trivy filesystem and image scans;
- migration verification;
- Docker image build;
- runtime smoke and golden workflow smoke;
- deployment envelope verification.

Security exceptions must be documented with owner, expiry date, risk, and compensating control.
