# Controlit CRM Project, Company Reference, and Task Enhancements Design

Date: 2026-06-10
Status: Draft for user review
Branch: `codex/controlit-upgrade-twenty-v2-11`

## Purpose

Controlit needs a small set of CRM usability improvements before inviting real users:

- Projects need a final stage for lost projects.
- Companies need one current/main reference source so managers can filter companies by exhibitions or other acquisition context.
- Tasks need clearer support for standalone operational work.
- Overdue task due dates should be visually obvious.

This design keeps v1 intentionally simple. We will use metadata fields wherever possible and only touch frontend code for the overdue due date styling.

## Scope

### Project Stage

Add one option to the existing standard `opportunity.stage` field, which is shown to users as Projects:

| API value | Label | Meaning |
| --- | --- | --- |
| `DECLINED` | `Declined` | Project was lost, rejected, or will not continue. |

The option should appear after the existing active/won stages in project table and kanban views. Existing stage options must remain unchanged.

### Company Main Reference

Add fields directly to `Companies`. We are not creating a separate reference/history object in v1 because the approved requirement is to store only the latest or main reference.

| API name | Label | Type | Notes |
| --- | --- | --- | --- |
| `referenceSourceType` | `Reference source type` | SELECT | Main category for the reference. |
| `referenceName` | `Reference name` | TEXT | Example: `Milan Exhibition`. |
| `referenceYear` | `Reference year` | NUMBER | Example: `2025`; not SELECT, so future years do not require metadata updates. |
| `referenceLocation` | `Reference location` | TEXT | Example: `Milan`. |
| `referenceNotes` | `Reference notes` | TEXT | Short context or explanation. |

`referenceSourceType` options:

| API value | Label |
| --- | --- |
| `EXHIBITION` | `Exhibition` |
| `REFERRAL` | `Referral` |
| `DIRECT_CONTACT` | `Direct contact` |
| `WEBSITE` | `Website` |
| `OTHER` | `Other` |

These fields should be added to the `All Companies` table view so users can filter by source type, name, year, and location.

### Task Category and Standalone Tasks

Standalone tasks are already technically possible in Twenty: a task can exist without a related project, company, or person. For Controlit, we keep that model and add a category field so operational work does not get mixed up with project follow-ups.

Add a custom field on `Tasks`:

| API name | Label | Type | Options |
| --- | --- | --- | --- |
| `taskCategory` | `Task category` | SELECT | `Project`, `Sales`, `Operations`, `Admin`, `Other` |

Option API values:

| API value | Label |
| --- | --- |
| `PROJECT` | `Project` |
| `SALES` | `Sales` |
| `OPERATIONS` | `Operations` |
| `ADMIN` | `Admin` |
| `OTHER` | `Other` |

In v1, `taskCategory` is user-selected and optional. We will not infer category automatically from relations. Operational tasks should be created without a relation and marked as `Operations` or `Admin`.

The existing territory model remains unchanged:

- Restricted users can create tasks in their assigned territory.
- If a restricted user creates a task without choosing `taskTerritory`, the backend defaults it to their first assigned territory.
- Admins continue to see all tasks.

### Overdue Task Due Date Styling

Add a frontend-only visual treatment for overdue task due dates:

- Scope: Task table/list due date field only.
- Condition: `dueAt` is before today and task status is not completed.
- Style: red text and/or existing design-system danger color.
- Do not change stored dates or task status.
- Do not globally style all date fields in other objects.

The exact completed status value should be confirmed from current task status metadata during implementation. If status values differ by workspace metadata, the implementation should treat the known completed value as non-overdue and leave unknown/active statuses eligible for overdue styling.

## Non-Goals

- Do not create a separate exhibition/reference history object in v1.
- Do not import new companies or contacts as part of this change.
- Do not change territory visibility rules.
- Do not add automation that creates tasks automatically.
- Do not redesign the task module or project card layout beyond adding fields/views needed for this scope.

## Implementation Approach

Use an idempotent setup script for metadata changes:

- Add the `DECLINED` stage option if missing.
- Add Company reference fields if missing.
- Add Task category field if missing.
- Add the new fields to relevant table views.
- Re-running the script must not create duplicate fields/options/view fields.

Use code only for overdue due date styling because this is UI behavior, not metadata.

Before production apply:

- Create a database backup.
- Run metadata setup in dry-run mode.
- Apply metadata setup.
- Deploy the frontend/backend image only after code checks pass.

## Testing

Metadata verification:

- `opportunity.stage` contains `DECLINED` exactly once.
- Company fields exist exactly once with the approved API names and types.
- Task field `taskCategory` exists exactly once with approved options.
- Relevant table views show the new fields.
- Re-running setup is a no-op.

Functional verification:

- Admin can set a project to `Declined`.
- Restricted pilot user still sees only assigned-territory Projects and Tasks.
- Restricted pilot user can create a standalone Task without Company/Project relation.
- Standalone Task receives default `taskTerritory` as before.
- Standalone Task can be categorized as `Operations`.
- Existing Project/Task create/update territory restrictions still pass.

UI verification:

- Overdue open task due date is red.
- Completed overdue task is not highlighted.
- Future due date is not highlighted.
- Other date fields in Companies/Projects/People are unchanged.

## Rollback

Rollback is split by change type:

- Metadata: restore from pre-apply DB backup if a metadata migration creates incorrect fields/options.
- Code: redeploy the previous immutable image tag if overdue styling causes frontend issues.

## Open Questions

No open product questions remain for v1. The only implementation-time check is the exact completed task status value used by current Controlit metadata.
