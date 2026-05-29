# Payroll Enterprise Maturity Plan

## Goal
Close the remaining payroll gaps with durable workflow state, policy-driven calculation, downstream exports, and employee-facing publish controls.

## Scope
- Add statutory payroll packs that can override tax, insurance, caps, and payroll behavior by country, location, and employee type.
- Add bank payment workflow states: ready, approved, exported, reconciled, and reconciliation exception.
- Add bank file rendering for CSV, Egypt CBE CSV, SEPA XML, and NACHA-style files.
- Add payslip publishing so generated payslips are not automatically visible until payroll approves publication.
- Add GL posting artifacts with balanced debit/credit lines.
- Add off-cycle and retro input support through the payroll input lifecycle.
- Expose workflow controls in the admin payroll UI without turning the page into one giant panel.

## Verification
- Focused unit tests for payroll workflow, statutory policy selection, bank file rendering, and GL posting.
- Migration run for new workflow fields and GL posting table.
- `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm build`.
- HTTP smoke for API health and payroll page availability after restart.
