# Payroll V5 Enterprise Hardening Plan

## Goal

Make payroll close-to-pay use approved payroll inputs and locked attendance as the source of truth, then persist the artifacts an enterprise payroll team needs: payment batch, payslip artifacts, and export job audit records.

## Scope

1. Approved input projection
   - Add a pure service that applies approved payroll inputs to payroll preview rows.
   - Support gross salary overrides, tax overrides, insurance overrides, and deduction inputs.
   - Recompute gross/net totals and preserve explainability lines.

2. Attendance close blockers
   - Add strict attendance lock checks during close-to-pay.
   - Block close when an employee has no locked attendance ledger for the period unless an admin uses readiness override with a reason.

3. Persisted payroll artifacts
   - Add database tables for payment batches, payslip artifacts, and export jobs.
   - Add repositories and an artifact service with content hashing and data classification.
   - Save payment batches and payslip HTML after result lines are locked.

4. API wiring
   - Use projected payroll rows for calculation run totals, result lines, bank batch totals, and close response.
   - Add endpoints to fetch a persisted payment batch and export job history.
   - Serve persisted payslip HTML when available.

5. Admin UI wiring
   - Display persisted payment batch and artifact counts after close.
   - Keep the page compact and avoid a new giant section.

6. Verification
   - Red-green tests for projection and artifact persistence helpers.
   - Run migrations, typecheck, test, lint, build.
   - Smoke the payroll admin page in the browser if the preview stack is running.
