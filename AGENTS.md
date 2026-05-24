# AGENTS.md — Enterprise HR/HCM SaaS Platform Architecture Documentation

> **Project type:** Architecture documentation repository (no source code, no runtime artifacts).  
> **Language:** English  
> **Purpose:** Definitive architecture reference for an enterprise Human Resources / Human Capital Management (HR/HCM) SaaS platform.

---

## Project Overview

This repository contains the **complete technical architecture documentation** for a world-class enterprise HR/HCM SaaS platform (Blueprint v1.4). It is a **documentation-only** workspace — there are no source files, build tools, package managers, or executable artifacts here. All content is authored in Markdown with embedded Mermaid diagrams.

The documentation was produced through a structured multi-agent analysis of a single master blueprint. It covers:

- 70+ finite state machines (FSMs)
- 150+ database tables / aggregates
- 25+ policy engines (the "Business Brain")
- 400+ canonical events across 13 event topics
- 27 capability domains (bounded contexts)
- Full RBAC/ABAC/SoD access control model
- Country-policy governance (upload, approval, simulation, publication, rollback)

### Core Architectural Doctrine

The platform follows an **authority-first, event-driven, command-based** architectural doctrine:

1. **One authority per concept** — Every HR business concept has exactly one owning domain. Others may observe, request, recommend, project, report, or integrate, but they may **never** mutate another domain's truth.
2. **Canonical registries** — FSMs, commands, events, aggregates, and rule packs are all canonically registered. Synonyms appear only in migration mappings.
3. **Event nervous system** — Cross-domain communication happens exclusively through canonical events. Events carry identity and correlation but never raw sensitive payloads.
4. **Policy engines as authority** — All policy decisions are explainable, versioned, and recorded. UI may never infer policy outcomes.
5. **Strict tenant isolation** — Every table, query, event, and projection is tenant-scoped.
6. **Field-level HR privacy** — Data classification (`LOW`, `CONFIDENTIAL`, `HIGH_SENSITIVITY`, `SPECIAL_CATEGORY`, `LEGAL_HOLD`) governs every field access.
7. **Audit discipline** — Every meaningful action produces an immutable audit record.
8. **Outbox / Inbox pattern** — All cross-domain events flow through the outbox pattern; consumers use inbox deduplication.
9. **Idempotency by design** — Every command and saga step is deterministically idempotent.
10. **AI advisory only** — HR AI remains governed and advisory; it never owns HR truth.

---

## Repository Structure

```
.
├── plan.md                                                    # Execution plan for the 6-agent documentation run
├── enterprise_hr_hcm_master_blueprint_v1_4_country_policy_approval_ready.md   # Source blueprint (~850 KB, 15K+ lines)
├── 01_feature_depth_chart.md                                  # Feature depth catalog by module
├── 02_event_flow_chart.md                                     # Event topology and cascade mapping
├── 03_feature_integration_chart.md                            # Cross-domain integration matrix (27×27)
├── 04_brain_engines_wiring.md                                 # Policy engines, calculation engines, wiring
├── 05_roles_accessibility_matrix.md                           # RBAC, ABAC, SoD, field-level access
└── 06_full_system_chart.md                                    # Layered architecture, bounded contexts, data flow
```

### File Guide

| File | Scope | Approx. Size |
|------|-------|--------------|
| `enterprise_hr_hcm_master_blueprint_v1_4_country_policy_approval_ready.md` | The **single source of truth** — master blueprint covering all domains, tables, FSMs, events, commands, policy engines, DDL, ADRs, integration contracts, testing strategy, roadmap, and CI gates. | ~850 KB |
| `01_feature_depth_chart.md` | Module hierarchy (14 modules), feature depth per service, FSM/table/policy-engine indices, version distribution matrix, summary statistics. | ~115 KB |
| `02_event_flow_chart.md` | Event naming standards, 13+ topic registry, complete event catalog, trigger cascade map, consumer group responsibilities, inbox DDL contract, event envelope structure. | ~156 KB |
| `03_feature_integration_chart.md` | 27×27 capability domain integration matrix with integration types (CP / EC / PR / SO), external system contracts, data flow direction, Mermaid topology. | ~132 KB |
| `04_brain_engines_wiring.md` | 25+ policy engines (inputs / outputs / decision records / rule packs / tables), calculation engines (Payroll, Tax, Leave, Learning), Country Policy Engine v1.4, engine wiring architecture, rule-pack data models, ADR summary. | ~305 KB |
| `05_roles_accessibility_matrix.md` | RBAC role catalog (HR Admin, HRBP, Recruiter, Payroll Admin, etc.), ABAC dimensions, complete SoD matrix, field-level access policy, self-service command allowlist, data classification levels, break-glass rules. | ~108 KB |
| `06_full_system_chart.md` | Layered architecture view, bounded context map with aggregates/commands/events, data architecture (PostgreSQL, Redis, S3, Search, Warehouse), event-driven architecture, external integration adapters, security & privacy architecture, request lifecycle flow. | ~148 KB |

---

## Technology Stack

This repository contains **documentation only**. The described target platform uses the following conceptual technology stack (as documented in the architecture, not present in this repo):

- **Backend:** Event-driven microservices / modular monolith with domain-driven design (DDD) bounded contexts
- **API / BFF:** REST / GraphQL (documented as interface layers)
- **Event Bus:** Kafka-like streaming with outbox / inbox patterns
- **Primary Database:** PostgreSQL (tenant-scoped)
- **Read Models / Cache:** Redis
- **Object Storage:** S3
- **Search:** Elasticsearch / OpenSearch
- **Data Warehouse:** Export to warehouse for analytics
- **Diagrams:** Mermaid syntax embedded in Markdown

**Repository tooling:**
- Git for version control
- Markdown for all documents
- Mermaid for diagrams

There is **no build system, no package manager, no compiler, and no test runner** in this repository.

---

## How to Navigate the Documentation

### Start Here

1. **For project intent and scope** → Read `plan.md`
2. **For the complete raw blueprint** → Read `enterprise_hr_hcm_master_blueprint_v1_4_country_policy_approval_ready.md`
3. **For a specific architectural view**, use the numbered deliverables:
   - **Features / modules** → `01_feature_depth_chart.md`
   - **Events / messaging** → `02_event_flow_chart.md`
   - **Integrations / contracts** → `03_feature_integration_chart.md`
   - **Policy engines / brain** → `04_brain_engines_wiring.md`
   - **Security / roles / access** → `05_roles_accessibility_matrix.md`
   - **System layers / big picture** → `06_full_system_chart.md`

### Cross-Reference Conventions

- Documents reference the **master blueprint** by filename: `enterprise_hr_hcm_master_blueprint_v1_4_country_policy_approval_ready.md`
- Documents cross-reference each other implicitly by domain name (e.g., "see Event Flow Chart for cascade details").
- Version numbers are aligned across all files: **v1.4** is the current canonical version.
- Dates are consistently ISO-formatted (`2026-05-23`).

### Key Abbreviations Used Throughout

| Abbreviation | Meaning |
|--------------|---------|
| FSM | Finite State Machine |
| RBAC | Role-Based Access Control |
| ABAC | Attribute-Based Access Control |
| SoD | Segregation of Duties |
| HRBP | HR Business Partner |
| ER | Employee Relations |
| WFM | Workforce Management |
| LMS | Learning Management System |
| VMS | Vendor Management System |
| EAP | Employee Assistance Program |
| DEI | Diversity, Equity & Inclusion |
| HR/HCM | Human Resources / Human Capital Management |
| DDL | Data Definition Language |
| ADR | Architecture Decision Record |

---

## Editing Conventions

When modifying any document in this repository, follow these conventions:

1. **Keep English as the sole language** — All content, comments, and diagrams are in English.
2. **Maintain Markdown structure** — Use ATX-style headers (`#`), tables for structured data, and fenced code blocks for diagrams, JSON, and pseudo-code.
3. **Use Mermaid for diagrams** — All architectural diagrams are embedded as ` ```mermaid ` blocks.
4. **Preserve cross-references** — If you rename a section, update all internal anchor links and cross-document references.
5. **Version consistently** — If adding new architectural elements, mark the version introduced (e.g., `V1.4`) and update the summary statistics in `01_feature_depth_chart.md`.
6. **Respect the authority doctrine** — Never introduce documentation that implies a domain can mutate another domain's canonical data. Use the correct integration type (`CP`, `EC`, `PR`, `SO`).
7. **Field-level privacy** — When documenting data models, always annotate fields with their HR data classification level.

---

## Build, Test, and Deployment

**Not applicable.** This repository contains architecture documentation only. There are:
- No build commands
- No test suites
- No CI/CD pipelines (within this repo)
- No deployment artifacts
- No package manifests (`package.json`, `pyproject.toml`, `Cargo.toml`, etc.)

If you are generating code *from* these documents, the generated code should live in a separate implementation repository with its own build system and CI gates (as described in Section 16B of the master blueprint).

---

## Security and Privacy Considerations

The documents in this repository describe a system handling **highly sensitive HR data**. Even though this repo contains no production data, be aware of the following when editing or sharing:

- The master blueprint contains detailed data classification rules (`SPECIAL_CATEGORY` covers ethnicity, health, biometrics, union membership, etc.).
- SoD matrices and break-glass procedures are documented in `05_roles_accessibility_matrix.md`.
- Audit and legal-hold requirements are specified throughout the master blueprint.
- Do **not** add sample data, mock PII, or real employee records to this repository.
- If you add generated code or DDL derived from these documents, ensure it goes into an appropriately secured implementation repository.

---

## Summary for Agents

- **This is a documentation repo.** There is no code to compile, no tests to run, no packages to install.
- **All truth is in the master blueprint** (`enterprise_hr_hcm_master_blueprint_v1_4_country_policy_approval_ready.md`). The 6 numbered files are derived views.
- **When asked to modify architecture**, edit the relevant Markdown file directly and preserve cross-references.
- **When asked about the tech stack**, refer to the conceptual stack above, not files in this repo.
- **When asked to generate code** from these documents, create the code in a new file or recommend creating a separate implementation repository. Do not pollute this repo with generated artifacts unless explicitly asked.
