# Plan: HR/HCM SaaS Platform — 6 Technical Architecture Deliverables

## Source Material
- **File**: `/mnt/agents/upload/enterprise_hr_hcm_master_blueprint_v1_4_country_policy_approval_ready.md`
- **Scope**: 500K+ character enterprise HR/HCM blueprint v1.4 covering 70+ FSMs, 150+ tables, 25+ policy engines, full event nervous system, integration contracts, role/SoD matrix

## Stage 1 — Parallel Analysis & Document Production (6 Agents)
All 6 deliverables are independent views of the same source blueprint. They can be produced in parallel.

### Agent 1: Feature_Depth_Architect
**Output**: `01_feature_depth_chart.md`
**Mission**: Produce a complete feature depth chart cataloging every feature/service with:
- Module/category hierarchy (Core HR, Recruiting, Payroll, Benefits, etc.)
- Every sub-capability and micro-feature per service
- Version introduced (V1.0/V1.1/V1.2/V1.4)
- Authority owner per feature
- Table/aggregate dependencies per feature
- FSM count per feature
- Policy engine associations
- Mermaid diagram: feature hierarchy tree

### Agent 2: Event_Flow_Architect
**Output**: `02_event_flow_chart.md`
**Mission**: Produce a complete event-triggered update chart showing:
- Every canonical event in the nervous system (400+ events across 13 topics)
- For each event: what aggregates update, what projections refresh, what sagas trigger
- Event topic routing matrix
- Consumer group responsibilities
- Cross-domain cascade chains (e.g., WorkerTerminated → OffboardingPlan → IAM deprovisioning → Benefits termination → Payroll finalization)
- Mermaid diagrams: event flow topology, topic routing diagram

### Agent 3: Integration_Matrix_Architect
**Output**: `03_feature_integration_chart.md`
**Mission**: Produce a complete feature integration matrix showing:
- All 25+ capability domains as rows and columns
- Integration type per crossing (command port, event consumption, projection read, saga orchestration)
- Cross-blueprint integration contracts (HR↔IAM, HR↔Finance, HR↔Service Desk, etc.)
- External system integrations (payroll providers, tax engines, benefits carriers, VMS, LMS, etc.)
- Data flow direction per integration
- Mermaid diagram: integration topology graph

### Agent 4: Brain_Engine_Architect
**Output**: `04_brain_engines_wiring.md`
**Mission**: Document the complete brain, engines, integration and wiring:
- All 25+ policy engines with inputs/outputs/decision records
- Calculation engines (Payroll Calculation, Tax Jurisdiction, Leave Entitlement, Learning Runtime)
- The Country Policy Upload/Approval/Activation Engine (V1.4)
- Runtime engines and their rule-pack consumption
- Event bus wiring (topics, producers, consumers)
- Saga orchestration patterns
- Command → Engine → Event → Projection wiring
- Mermaid diagrams: engine topology, data flow wiring, policy decision flow

### Agent 5: Role_Access_Architect
**Output**: `05_roles_accessibility_matrix.md`
**Mission**: Produce complete rules/roles definition and accessibility:
- RBAC role catalog (HR Admin, HRBP, Recruiter, Payroll Admin, Benefits Admin, Manager, Employee, ER Specialist, Compliance Officer, Executive Viewer, etc.)
- ABAC dimensions (subject worker relationship, manager chain, legal entity, country, department, case ownership)
- Field-level policy matrix (FIELD_VISIBLE, FIELD_MASKED, FIELD_HIDDEN, ACCESS_DENIED)
- Complete SoD matrix (all incompatible combinations)
- Self-service command allowlist by actor type
- Manager-service capabilities and boundaries
- HR data classification levels and access rules
- Break-glass and emergency access rules
- Mermaid diagram: role hierarchy and access control flow

### Agent 6: System_Architect_Drawing
**Output**: `06_full_system_chart.md`
**Mission**: Produce the complete system architecture reference drawing:
- Layered architecture (Presentation/API/Command/Domain/Infra/External)
- All bounded contexts with their aggregates, commands, events
- The 12 HR event topics with producer/consumer mapping
- External integration adapters
- Data stores (PostgreSQL, Redis, S3, Search, Warehouse)
- Projection/read model layer
- Saga and process manager layer
- Policy engine / brain layer
- Security, privacy, and audit cross-cutting concerns
- Mermaid diagram: full system architecture
- Mermaid diagram: bounded context map
- Mermaid diagram: request lifecycle flow

## Stage 2 — Validation & Integration
- Review all 6 outputs for consistency
- Ensure cross-references between documents are aligned
- Final delivery as 6 .md files

## Execution Notes
- Each agent reads the source blueprint independently (it's too large to pass inline)
- Each agent focuses on their specific sections and produces structured markdown with Mermaid diagrams
- All diagrams use Mermaid syntax for easy rendering
- Documents are self-contained but cross-reference each other
