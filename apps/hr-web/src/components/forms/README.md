# Form pattern: react-hook-form + zod

Standard pattern for admin-page forms in `hr-web`. Established while migrating
`pages/admin/compensation.tsx`, `pages/admin/policies.tsx`, and
`pages/admin/sso.tsx` off hand-rolled `useState` forms, three pages where
required fields could reach the API unvalidated. Use those three files as
worked examples when migrating another page.

## Why

Before this pattern, admin forms tracked field values in `useState` and
validated (if at all) with ad hoc checks scattered through submit handlers —
inconsistent, easy to skip, and in a few pages nonexistent (an empty required
field would go straight into the mutation payload). `zod` was already a
dependency, but only auth pages (`login.tsx`, `register.tsx`,
`forgot-password.tsx`) used it.

`react-hook-form` + `@hookform/resolvers/zod` gives every migrated form the
same shape: one schema is the single source of truth for "what's valid",
`zodResolver` wires it into the form, and invalid submits are blocked before
the mutation ever fires — with a field-level error message shown inline.

## The pattern

1. **Define the schema.** Mirror the page's existing form-state shape field
   for field — this is a validation-layer migration, not a feature change.
   Don't add or remove fields. Reach for the shared builders in
   `./schema-helpers.ts` (`requiredText`, `requiredNumericText`,
   `optionalNumericText`, `jsonObjectText`) instead of writing `z.string()...`
   inline everywhere.

   ```ts
   import { z } from 'zod';
   import { requiredText, requiredNumericText } from '@/components/forms/schema-helpers';

   const planSchema = z.object({
     name: requiredText('Plan name is required'),
     planType: requiredText('Plan type is required'),
     effectiveFrom: requiredText('Effective date is required'),
   });

   type PlanFormValues = z.infer<typeof planSchema>;
   ```

2. **Wire `useForm`.**

   ```tsx
   import { useForm } from 'react-hook-form';
   import { zodResolver } from '@hookform/resolvers/zod';

   const form = useForm<PlanFormValues>({
     resolver: zodResolver(planSchema),
     defaultValues: createEmptyPlanForm(),
   });
   ```

3. **Bind inputs with `register`, keep the existing UI components.** Do not
   replace `Input`/`Button`/`Dialog`/etc. from `@/components/ui` — only change
   how their value/onChange plumbing is managed.

   ```tsx
   <Input {...form.register('name')} />
   ```

4. **Radix `Select` isn't a native input** — it can't take `register()`
   directly. Use `Controller` (or the `ControlledSelect` helper in
   `./controlled-select.tsx` for the simple case where changing the select
   has no side effects beyond setting its own value):

   ```tsx
   <ControlledSelect control={form.control} name="planType" options={planTypeOptions} />
   ```

   For selects whose `onValueChange` needs to do more than set one field
   (e.g. `sso.tsx`'s protocol switch resets the whole form), use `Controller`
   directly in the page rather than the wrapper.

5. **Show errors with the existing `FormField` wrapper**
   (`@/components/common/form-field.tsx`) — it already renders the label,
   help text, and an `aria-describedby`-linked error message; just pass it
   `form.formState.errors.<field>?.message`:

   ```tsx
   <FormField id="plan-name" label="Plan name" required error={form.formState.errors.name?.message}>
     <Input {...form.register('name')} />
   </FormField>
   ```

6. **Submit through `handleSubmit`.** The callback only runs with data that
   passed the schema, so the mutation call — url, payload shape, everything —
   stays exactly what it was before the migration; only the path to "we have
   valid data" changed.

   ```tsx
   const onSubmit = form.handleSubmit((values) => {
     mutation.mutate({ url: '/hr/compensation/plans', payload: { ...values, planId: generateUUID(), currency } });
   });
   ```

## What this migration is not

- Not a UI refresh — the same `@/components/ui` primitives render exactly as
  before.
- Not a mechanical rewrite of every admin form. Only pages that are actually
  migrated should import `react-hook-form`/`zodResolver`; the rest keep their
  existing `useState` forms until they're migrated individually.
- Not a place to invent new required fields or cross-field business rules
  that the original page didn't already imply. Keep schemas scoped to what
  the page's existing fields and payload already need (required-ness,
  numeric-ness, well-formed JSON) — see the migrated pages for the level of
  scope that's appropriate.
