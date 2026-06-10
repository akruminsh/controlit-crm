# Controlit CRM Project Company Task Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Controlit CRM project lost stage, company reference fields, standalone-task categorization, and overdue task due-date highlighting without weakening the existing territory restrictions.

**Architecture:** Workspace metadata changes are applied through a new idempotent Controlit setup script that logs in through the existing metadata API helper, backs up before apply, updates standard/custom fields, and positions fields in existing views. The overdue due-date behavior is a narrow frontend change: a pure utility decides overdue status, and `DateTimeFieldDisplay` applies red text only for the `task.dueAt` field when the task is not done. Existing task/project territory create/read/update guards stay unchanged.

**Tech Stack:** Twenty CRM v2.11.1 monorepo, Node ESM metadata scripts, Twenty metadata GraphQL + REST metadata APIs, React 18, Linaria styled components, Jotai record store, Temporal polyfill, Nx/Jest, Codex in-app Browser.

---

## File Structure

- Create `.codex/scripts/setup-controlit-crm-enhancements.mjs`
  - One idempotent metadata entry point for this enhancement batch.
  - Updates `opportunity.stage` options to append `DECLINED`.
  - Creates Company reference fields and Task category field.
  - Adds the new fields to `All Companies`, `All Tasks`, and `By Status` task views where available.
- Create `.codex/scripts/test-controlit-crm-enhancements.mjs`
  - Node `node:test` coverage for the pure metadata planning helpers in the setup script.
  - Verifies no duplicate stage option, field type conflict detection, and stable option-id preservation.
- Create `packages/twenty-front/src/modules/activities/tasks/utils/isTaskDueAtOverdue.ts`
  - Pure date/status helper used by UI.
- Create `packages/twenty-front/src/modules/activities/tasks/utils/__tests__/isTaskDueAtOverdue.test.ts`
  - Jest coverage for overdue edge cases.
- Modify `packages/twenty-front/src/modules/object-record/record-field/ui/meta-types/display/components/DateTimeFieldDisplay.tsx`
  - Wrap only `task.dueAt` display in red text when helper returns true.
- Modify `packages/twenty-front/src/modules/object-record/record-field/ui/meta-types/display/components/__stories__/perf/DateTimeFieldDisplay.perf.stories.tsx`
  - Add a non-performance story for an overdue task due date so visual behavior is inspectable in Storybook.
- Modify `/Users/alexeykruminsh/Documents/All projects/Kruminsh Second Brain/Projects/controlit-crm/README.md`
  - Save the durable decision and implementation status after completion.

## Metadata Values

Project stage option:

```js
{
  label: 'Declined',
  value: 'DECLINED',
  color: 'red'
}
```

Company fields:

```js
[
  selectField('referenceSourceType', 'Reference source type', 'IconPointer', [
    ['Exhibition', 'EXHIBITION', 'blue'],
    ['Referral', 'REFERRAL', 'green'],
    ['Direct contact', 'DIRECT_CONTACT', 'turquoise'],
    ['Website', 'WEBSITE', 'purple'],
    ['Other', 'OTHER', 'gray'],
  ]),
  textField('referenceName', 'Reference name', 'IconTag'),
  numberField('referenceYear', 'Reference year', 'IconCalendarStats'),
  textField('referenceLocation', 'Reference location', 'IconMapPin'),
  textField('referenceNotes', 'Reference notes', 'IconNotes'),
]
```

Task field:

```js
selectField('taskCategory', 'Task category', 'IconCategory', [
  ['Project', 'PROJECT', 'blue'],
  ['Sales', 'SALES', 'green'],
  ['Operations', 'OPERATIONS', 'orange'],
  ['Admin', 'ADMIN', 'purple'],
  ['Other', 'OTHER', 'gray'],
])
```

## Task 1: Add Metadata Setup Script Tests

**Files:**
- Create: `.codex/scripts/test-controlit-crm-enhancements.mjs`
- Create later in Task 2: `.codex/scripts/setup-controlit-crm-enhancements.mjs`

- [ ] **Step 1: Create the failing Node test file**

Use `node:test` so the script tests do not depend on Nx. The tests import helpers that Task 2 will export.

```js
#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildOptionsWithStableIds,
  companyReferenceFieldDefinitions,
  normalizeOptions,
  planSelectOptionUpdate,
  taskCategoryFieldDefinition,
} from './setup-controlit-crm-enhancements.mjs';

test('buildOptionsWithStableIds preserves existing option ids and appends new options', () => {
  const existingOptions = [
    { id: 'existing-new', label: 'New', value: 'NEW', color: 'red', position: 0 },
    { id: 'existing-customer', label: 'Customer', value: 'CUSTOMER', color: 'yellow', position: 4 },
  ];
  const desiredOptions = [
    { label: 'New', value: 'NEW', color: 'red', position: 0 },
    { label: 'Declined', value: 'DECLINED', color: 'red', position: 5 },
  ];

  const result = buildOptionsWithStableIds(desiredOptions, existingOptions);

  assert.equal(result[0].id, 'existing-new');
  assert.equal(result[1].value, 'DECLINED');
  assert.match(result[1].id, /^[0-9a-f-]{36}$/);
});

test('planSelectOptionUpdate returns null when options are already correct', () => {
  const existingField = {
    id: 'stage-field',
    name: 'stage',
    type: 'SELECT',
    options: [
      { id: 'new-id', label: 'New', value: 'NEW', color: 'red', position: 0 },
      { id: 'declined-id', label: 'Declined', value: 'DECLINED', color: 'red', position: 5 },
    ],
  };

  const desiredOptions = [
    { label: 'New', value: 'NEW', color: 'red', position: 0 },
    { label: 'Declined', value: 'DECLINED', color: 'red', position: 5 },
  ];

  assert.equal(planSelectOptionUpdate(existingField, desiredOptions), null);
});

test('planSelectOptionUpdate preserves existing options and plans a declined stage append', () => {
  const existingField = {
    id: 'stage-field',
    name: 'stage',
    type: 'SELECT',
    options: [
      { id: 'new-id', label: 'New', value: 'NEW', color: 'red', position: 0 },
      { id: 'customer-id', label: 'Customer', value: 'CUSTOMER', color: 'yellow', position: 4 },
    ],
  };

  const update = planSelectOptionUpdate(existingField, [
    { label: 'New', value: 'NEW', color: 'red', position: 0 },
    { label: 'Customer', value: 'CUSTOMER', color: 'yellow', position: 4 },
    { label: 'Declined', value: 'DECLINED', color: 'red', position: 5 },
  ]);

  assert.equal(update.options.length, 3);
  assert.equal(update.options[0].id, 'new-id');
  assert.equal(update.options[1].id, 'customer-id');
  assert.equal(update.options[2].value, 'DECLINED');
});

test('metadata definitions use stable API names', () => {
  assert.deepEqual(
    companyReferenceFieldDefinitions.map((field) => field.name),
    [
      'referenceSourceType',
      'referenceName',
      'referenceYear',
      'referenceLocation',
      'referenceNotes',
    ],
  );
  assert.equal(taskCategoryFieldDefinition.name, 'taskCategory');
  assert.deepEqual(
    normalizeOptions(taskCategoryFieldDefinition.options).map((option) => option.value),
    ['PROJECT', 'SALES', 'OPERATIONS', 'ADMIN', 'OTHER'],
  );
});
```

- [ ] **Step 2: Run the tests and verify the expected import failure**

Run:

```bash
node .codex/scripts/test-controlit-crm-enhancements.mjs
```

Expected: fail with `Cannot find module` or missing named export from `setup-controlit-crm-enhancements.mjs`.

## Task 2: Implement Idempotent Metadata Setup

**Files:**
- Create: `.codex/scripts/setup-controlit-crm-enhancements.mjs`
- Test: `.codex/scripts/test-controlit-crm-enhancements.mjs`

- [ ] **Step 1: Create the script with exported planning helpers**

Use the existing `.codex/scripts/controlit-crm-client.mjs` helper so auth, REST, dry-run parsing, and DB backup behavior stay consistent with the existing project-card and territory scripts.

```js
#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import {
  createBackupOnce,
  createCrmClient,
  loadConfig,
  parseCommonArgs,
} from './controlit-crm-client.mjs';

export const FIELD_WIDTH = 150;

export const projectDeclinedStageOption = {
  label: 'Declined',
  value: 'DECLINED',
  color: 'red',
};

export const companyReferenceFieldDefinitions = [
  selectField('referenceSourceType', 'Reference source type', 'IconPointer', [
    ['Exhibition', 'EXHIBITION', 'blue'],
    ['Referral', 'REFERRAL', 'green'],
    ['Direct contact', 'DIRECT_CONTACT', 'turquoise'],
    ['Website', 'WEBSITE', 'purple'],
    ['Other', 'OTHER', 'gray'],
  ]),
  textField('referenceName', 'Reference name', 'IconTag'),
  numberField('referenceYear', 'Reference year', 'IconCalendarStats'),
  textField('referenceLocation', 'Reference location', 'IconMapPin'),
  textField('referenceNotes', 'Reference notes', 'IconNotes'),
];

export const taskCategoryFieldDefinition = selectField(
  'taskCategory',
  'Task category',
  'IconCategory',
  [
    ['Project', 'PROJECT', 'blue'],
    ['Sales', 'SALES', 'green'],
    ['Operations', 'OPERATIONS', 'orange'],
    ['Admin', 'ADMIN', 'purple'],
    ['Other', 'OTHER', 'gray'],
  ],
);

const isRunningAsCli =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isRunningAsCli) {
  const { isDryRun, skipBackup } = parseCommonArgs();
  const config = loadConfig();
  const ensureBackup = createBackupOnce({
    config,
    isDryRun,
    skipBackup,
    prefix: 'controlit-crm-enhancements',
  });

  main({ config, isDryRun, ensureBackup }).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

export async function main({ config, isDryRun, ensureBackup }) {
  const client = await createCrmClient(config);
  const metadata = await fetchMetadata(client);

  const opportunity = findObjectOrThrow(metadata.objects, 'opportunity');
  const company = findObjectOrThrow(metadata.objects, 'company');
  const task = findObjectOrThrow(metadata.objects, 'task');

  console.log(`Workspace: ${client.workspace.displayName} (${client.workspace.id})`);

  const actions = [
    ...planProjectStageActions(opportunity),
    ...planObjectFieldActions(company, companyReferenceFieldDefinitions),
    ...planObjectFieldActions(task, [taskCategoryFieldDefinition]),
  ];

  if (actions.length === 0) {
    console.log('Fields: no changes needed.');
  } else if (isDryRun) {
    actions.forEach((action) => console.log(`${action.kind}: ${action.object.nameSingular}.${action.fieldName}`));
  } else {
    await ensureBackup();
    for (const action of actions) {
      if (action.kind === 'update-field') {
        await updateField(client, action.field.id, action.update);
        console.log(`Updated field: ${action.object.nameSingular}.${action.fieldName}`);
      }
      if (action.kind === 'create-field') {
        await createField(client, action.object.id, action.definition);
        console.log(`Created field: ${action.object.nameSingular}.${action.fieldName}`);
      }
    }
  }

  const refreshedMetadata = actions.length > 0 && !isDryRun
    ? await fetchMetadata(client)
    : metadata;

  const refreshedCompany = findObjectOrThrow(refreshedMetadata.objects, 'company');
  const refreshedTask = findObjectOrThrow(refreshedMetadata.objects, 'task');

  if (isDryRun && actions.some((action) => action.kind === 'create-field')) {
    console.log('View changes will be planned after missing fields exist.');
    console.log('Dry run complete. No metadata was changed.');
    return;
  }

  const viewActions = [
    ...(await planViewActions(client, refreshedCompany, companyReferenceFieldDefinitions, {
      viewName: 'All Companies',
      fallbackType: 'TABLE',
      afterFieldNames: ['targetPersonRole', 'projectTypes', 'companyCategoryRaw', 'companyCountry', 'companyType', 'name'],
    })),
    ...(await planViewActions(client, refreshedTask, [taskCategoryFieldDefinition], {
      viewName: 'All Tasks',
      fallbackType: 'TABLE',
      afterFieldNames: ['taskTerritory', 'status', 'title'],
    })),
    ...(await planViewActions(client, refreshedTask, [taskCategoryFieldDefinition], {
      viewName: 'By Status',
      fallbackType: 'KANBAN',
      afterFieldNames: ['taskTerritory', 'status', 'title'],
      optional: true,
    })),
  ];

  if (viewActions.length === 0) {
    console.log('Views: no changes needed.');
  } else if (isDryRun) {
    viewActions.forEach((action) => console.log(`${action.kind}: ${action.view.name}.${action.fieldName}`));
  } else {
    await ensureBackup();
    for (const action of viewActions) {
      if (action.kind === 'create-view-field') {
        await createViewField(client, action.view.id, action.fieldMetadataId, action.position);
        console.log(`Added ${action.fieldName} to view: ${action.view.name}`);
      }
      if (action.kind === 'update-view-field') {
        await updateViewField(client, action.viewFieldId, action.position);
        console.log(`Updated ${action.fieldName} in view: ${action.view.name}`);
      }
    }
  }

  if (isDryRun) {
    console.log('Dry run complete. No metadata was changed.');
    return;
  }

  const verificationMetadata = await fetchMetadata(client);
  const verificationOpportunity = findObjectOrThrow(verificationMetadata.objects, 'opportunity');
  const verificationCompany = findObjectOrThrow(verificationMetadata.objects, 'company');
  const verificationTask = findObjectOrThrow(verificationMetadata.objects, 'task');

  const verificationActions = [
    ...planProjectStageActions(verificationOpportunity),
    ...planObjectFieldActions(verificationCompany, companyReferenceFieldDefinitions),
    ...planObjectFieldActions(verificationTask, [taskCategoryFieldDefinition]),
  ];
  const verificationViewActions = [
    ...(await planViewActions(client, verificationCompany, companyReferenceFieldDefinitions, {
      viewName: 'All Companies',
      fallbackType: 'TABLE',
      afterFieldNames: ['targetPersonRole', 'projectTypes', 'companyCategoryRaw', 'companyCountry', 'companyType', 'name'],
    })),
    ...(await planViewActions(client, verificationTask, [taskCategoryFieldDefinition], {
      viewName: 'All Tasks',
      fallbackType: 'TABLE',
      afterFieldNames: ['taskTerritory', 'status', 'title'],
    })),
    ...(await planViewActions(client, verificationTask, [taskCategoryFieldDefinition], {
      viewName: 'By Status',
      fallbackType: 'KANBAN',
      afterFieldNames: ['taskTerritory', 'status', 'title'],
      optional: true,
    })),
  ];

  if (verificationActions.length > 0) {
    throw new Error(`Verification failed: ${verificationActions.length} field actions are still pending.`);
  }

  if (verificationViewActions.length > 0) {
    throw new Error(`Verification failed: ${verificationViewActions.length} view actions are still pending.`);
  }

  console.log('Verification: project stage, company reference fields, task category field, and target views are configured.');
}
```

- [ ] **Step 2: Add metadata fetch, planning, and mutation helpers**

Append these helpers in the same script.

```js
async function fetchMetadata(client) {
  const data = await client.metadata(`
    query ObjectMetadataItems {
      objects(paging: { first: 1000 }) {
        edges {
          node {
            id
            nameSingular
            namePlural
            labelSingular
            labelPlural
            fieldsList {
              id
              name
              label
              type
              icon
              isCustom
              isActive
              isNullable
              options
              settings
            }
          }
        }
      }
    }
  `);

  return {
    objects: data.objects.edges.map((edge) => edge.node),
  };
}

function findObjectOrThrow(objects, nameSingular) {
  const object = objects.find((candidate) => candidate.nameSingular === nameSingular);

  if (!object) {
    throw new Error(`Object metadata not found: ${nameSingular}`);
  }

  return object;
}

export function planProjectStageActions(opportunity) {
  const fieldsByName = mapByName(opportunity.fieldsList);
  const stageField = fieldsByName.get('stage');

  if (!stageField) {
    throw new Error('Project stage field not found.');
  }

  const existingOptions = normalizeOptions(stageField.options ?? []);
  const declinedPosition =
    existingOptions.some((option) => option.value === 'DECLINED')
      ? existingOptions.find((option) => option.value === 'DECLINED').position
      : maxOptionPosition(existingOptions) + 1;
  const desiredOptions = [
    ...existingOptions.filter((option) => option.value !== 'DECLINED'),
    { ...projectDeclinedStageOption, position: declinedPosition },
  ].sort((left, right) => left.position - right.position);

  const update = planSelectOptionUpdate(stageField, desiredOptions);

  return update
    ? [{
        kind: 'update-field',
        object: opportunity,
        fieldName: 'stage',
        field: stageField,
        update,
      }]
    : [];
}

export function planObjectFieldActions(object, definitions) {
  const fieldsByName = mapByName(object.fieldsList);
  const actions = [];

  for (const definition of definitions) {
    const existingField = fieldsByName.get(definition.name);

    if (!existingField) {
      actions.push({
        kind: 'create-field',
        object,
        fieldName: definition.name,
        definition,
      });
      continue;
    }

    const update = planFieldUpdate(existingField, definition);

    if (update) {
      actions.push({
        kind: 'update-field',
        object,
        fieldName: definition.name,
        field: existingField,
        update,
      });
    }
  }

  return actions;
}

function planFieldUpdate(existingField, definition) {
  if (existingField.type !== definition.type) {
    throw new Error(`Field ${definition.name} exists with type ${existingField.type}; expected ${definition.type}.`);
  }

  const update = {};

  if (existingField.label !== definition.label) {
    update.label = definition.label;
  }

  if (existingField.icon !== definition.icon) {
    update.icon = definition.icon;
  }

  if (definition.options) {
    const optionsUpdate = planSelectOptionUpdate(existingField, definition.options);

    if (optionsUpdate) {
      update.options = optionsUpdate.options;
    }
  }

  return Object.keys(update).length > 0 ? update : null;
}

export function planSelectOptionUpdate(existingField, desiredOptions) {
  if (existingField.type !== 'SELECT') {
    throw new Error(`Field ${existingField.name} exists with type ${existingField.type}; expected SELECT.`);
  }

  const normalizedExisting = normalizeOptions(existingField.options ?? []);
  const normalizedDesired = normalizeOptions(desiredOptions);

  if (JSON.stringify(normalizedExisting) === JSON.stringify(normalizedDesired)) {
    return null;
  }

  return {
    options: buildOptionsWithStableIds(normalizedDesired, existingField.options ?? []),
  };
}

export function buildOptionsWithStableIds(desiredOptions, existingOptions) {
  const existingByValue = new Map(existingOptions.map((option) => [option.value, option]));

  return normalizeOptions(desiredOptions).map((option) => ({
    id: existingByValue.get(option.value)?.id ?? randomUUID(),
    label: option.label,
    value: option.value,
    color: option.color,
    position: option.position,
  }));
}
```

- [ ] **Step 3: Add field creation, field update, view planning, and field factories**

Append the remaining helpers in the same script.

```js
async function createField(client, objectMetadataId, definition) {
  const data = await client.metadata(`
    mutation CreateOneFieldMetadataItem($input: CreateOneFieldMetadataInput!) {
      createOneField(input: $input) {
        id
        name
        label
        type
        icon
        options
      }
    }
  `, {
    input: {
      field: {
        objectMetadataId,
        name: definition.name,
        label: definition.label,
        type: definition.type,
        icon: definition.icon,
        description: definition.description,
        isCustom: true,
        isActive: true,
        isNullable: true,
        isLabelSyncedWithName: false,
        ...(definition.options ? { options: cloneOptions(definition.options) } : {}),
      },
    },
  });

  return data.createOneField;
}

async function updateField(client, id, update) {
  return client.metadata(`
    mutation UpdateOneFieldMetadataItem($input: UpdateOneFieldMetadataInput!) {
      updateOneField(input: $input) {
        id
        name
        label
        type
        icon
        options
      }
    }
  `, {
    input: { id, update },
  });
}

async function planViewActions(client, object, definitions, config) {
  const views = await client.rest(
    'GET',
    `/rest/metadata/views?objectMetadataId=${encodeURIComponent(object.id)}`,
  );
  const view =
    views.find((candidate) => candidate.name === config.viewName) ??
    views.find((candidate) => candidate.type === config.fallbackType && candidate.position === 0);

  if (!view) {
    if (config.optional) {
      return [];
    }
    throw new Error(`View not found: ${object.nameSingular}.${config.viewName}`);
  }

  const fieldsByName = mapByName(object.fieldsList);
  const viewFields = await client.rest(
    'GET',
    `/rest/metadata/viewFields?viewId=${encodeURIComponent(view.id)}`,
  );
  const viewFieldsByFieldId = new Map(viewFields.map((viewField) => [viewField.fieldMetadataId, viewField]));
  const basePosition = resolveBasePosition(viewFields, viewFieldsByFieldId, fieldsByName, config.afterFieldNames);
  const actions = [];

  definitions.forEach((definition, index) => {
    const field = fieldsByName.get(definition.name);

    if (!field) {
      throw new Error(`Cannot add ${definition.name} to ${view.name}: field is missing.`);
    }

    const existingViewField = viewFieldsByFieldId.get(field.id);
    const position = basePosition + index + 1;

    if (!existingViewField) {
      actions.push({
        kind: 'create-view-field',
        view,
        fieldName: definition.name,
        fieldMetadataId: field.id,
        position,
      });
      return;
    }

    if (
      existingViewField.isVisible !== true ||
      Number(existingViewField.position) !== position ||
      Number(existingViewField.size) !== FIELD_WIDTH
    ) {
      actions.push({
        kind: 'update-view-field',
        view,
        fieldName: definition.name,
        viewFieldId: existingViewField.id,
        position,
      });
    }
  });

  return actions;
}

function resolveBasePosition(viewFields, viewFieldsByFieldId, fieldsByName, afterFieldNames) {
  for (const fieldName of afterFieldNames) {
    const field = fieldsByName.get(fieldName);
    const viewField = field ? viewFieldsByFieldId.get(field.id) : undefined;

    if (viewField) {
      return Number(viewField.position);
    }
  }

  return maxPosition(viewFields);
}

async function createViewField(client, viewId, fieldMetadataId, position) {
  return client.rest('POST', '/rest/metadata/viewFields', {
    fieldMetadataId,
    viewId,
    isVisible: true,
    size: FIELD_WIDTH,
    position,
  });
}

async function updateViewField(client, viewFieldId, position) {
  return client.rest('PATCH', `/rest/metadata/viewFields/${encodeURIComponent(viewFieldId)}`, {
    isVisible: true,
    size: FIELD_WIDTH,
    position,
  });
}

function selectField(name, label, icon, optionTuples) {
  return {
    name,
    label,
    type: 'SELECT',
    icon,
    description: '',
    options: optionTuples.map(([optionLabel, value, color], position) => ({
      id: randomUUID(),
      label: optionLabel,
      value,
      color,
      position,
    })),
  };
}

function textField(name, label, icon) {
  return {
    name,
    label,
    type: 'TEXT',
    icon,
    description: '',
  };
}

function numberField(name, label, icon) {
  return {
    name,
    label,
    type: 'NUMBER',
    icon,
    description: '',
  };
}

export function normalizeOptions(options) {
  return options
    .map((option) => ({
      label: option.label,
      value: option.value,
      color: option.color,
      position: Number(option.position),
    }))
    .sort((left, right) => left.position - right.position);
}

function cloneOptions(options) {
  return options.map((option) => ({ ...option }));
}

function mapByName(items) {
  return new Map(items.map((item) => [item.name, item]));
}

function maxPosition(items) {
  return items.length === 0 ? 0 : Math.max(...items.map((item) => Number(item.position)));
}

function maxOptionPosition(options) {
  return options.length === 0 ? -1 : Math.max(...options.map((option) => Number(option.position)));
}
```

- [ ] **Step 4: Run script tests and syntax check**

Run:

```bash
node .codex/scripts/test-controlit-crm-enhancements.mjs
node --check .codex/scripts/setup-controlit-crm-enhancements.mjs
```

Expected: all Node tests pass and syntax check exits with code 0.

- [ ] **Step 5: Run production metadata dry-run**

Run with real admin env variables loaded in the same way previous scripts were run:

```bash
CRM_ADMIN_EMAIL="$CRM_ADMIN_EMAIL" \
CRM_ADMIN_PASSWORD="$CRM_ADMIN_PASSWORD" \
node .codex/scripts/setup-controlit-crm-enhancements.mjs --dry-run
```

Expected first run when fields are missing: prints planned field changes for `opportunity.stage`, Company reference fields, and Task category field, then prints `View changes will be planned after missing fields exist.` and `Dry run complete. No metadata was changed.` If all fields already exist, it also prints any pending target view changes.

- [ ] **Step 6: Commit script and tests**

```bash
git add .codex/scripts/setup-controlit-crm-enhancements.mjs .codex/scripts/test-controlit-crm-enhancements.mjs
git commit -m "feat: add Controlit CRM enhancement metadata setup"
```

## Task 3: Add Overdue Due-Date Helper

**Files:**
- Create: `packages/twenty-front/src/modules/activities/tasks/utils/isTaskDueAtOverdue.ts`
- Create: `packages/twenty-front/src/modules/activities/tasks/utils/__tests__/isTaskDueAtOverdue.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { Temporal } from 'temporal-polyfill';

import { isTaskDueAtOverdue } from '@/activities/tasks/utils/isTaskDueAtOverdue';

const now = Temporal.Instant.from('2026-06-10T10:00:00.000Z');

describe('isTaskDueAtOverdue', () => {
  it('returns false when dueAt is empty', () => {
    expect(isTaskDueAtOverdue({ dueAt: null, status: 'IN_PROGRESS', now })).toBe(false);
    expect(isTaskDueAtOverdue({ dueAt: undefined, status: 'IN_PROGRESS', now })).toBe(false);
    expect(isTaskDueAtOverdue({ dueAt: '', status: 'IN_PROGRESS', now })).toBe(false);
  });

  it('returns false for done tasks even when dueAt is in the past', () => {
    expect(
      isTaskDueAtOverdue({
        dueAt: '2026-06-09T09:00:00.000Z',
        status: 'DONE',
        now,
      }),
    ).toBe(false);
  });

  it('returns true when due date is before today in the user timezone', () => {
    expect(
      isTaskDueAtOverdue({
        dueAt: '2026-06-09T09:00:00.000Z',
        status: 'IN_PROGRESS',
        now,
        timeZone: 'Europe/Riga',
      }),
    ).toBe(true);
  });

  it('returns false when due date is today in the user timezone', () => {
    expect(
      isTaskDueAtOverdue({
        dueAt: '2026-06-10T06:00:00.000Z',
        status: 'IN_PROGRESS',
        now,
        timeZone: 'Europe/Riga',
      }),
    ).toBe(false);
  });

  it('uses timezone-aware dates instead of raw UTC dates', () => {
    expect(
      isTaskDueAtOverdue({
        dueAt: '2026-06-09T22:30:00.000Z',
        status: 'IN_PROGRESS',
        now: Temporal.Instant.from('2026-06-10T00:30:00.000Z'),
        timeZone: 'Europe/Riga',
      }),
    ).toBe(false);
  });

  it('returns false for invalid date values', () => {
    expect(
      isTaskDueAtOverdue({
        dueAt: 'not-a-date',
        status: 'IN_PROGRESS',
        now,
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
npx nx test twenty-front --testFile=src/modules/activities/tasks/utils/__tests__/isTaskDueAtOverdue.test.ts --runInBand
```

Expected: fail because `isTaskDueAtOverdue` does not exist.

- [ ] **Step 3: Implement the helper**

```ts
import { Temporal } from 'temporal-polyfill';

type IsTaskDueAtOverdueParams = {
  dueAt: string | null | undefined;
  status: string | null | undefined;
  now?: Temporal.Instant;
  timeZone?: string;
};

const TASK_DONE_STATUS = 'DONE';

export const isTaskDueAtOverdue = ({
  dueAt,
  status,
  now = Temporal.Now.instant(),
  timeZone = 'UTC',
}: IsTaskDueAtOverdueParams) => {
  if (typeof dueAt !== 'string' || dueAt.trim() === '') {
    return false;
  }

  if (status === TASK_DONE_STATUS) {
    return false;
  }

  try {
    const dueDate = Temporal.Instant.from(dueAt)
      .toZonedDateTimeISO(timeZone)
      .toPlainDate();
    const today = now.toZonedDateTimeISO(timeZone).toPlainDate();

    return Temporal.PlainDate.compare(dueDate, today) < 0;
  } catch {
    return false;
  }
};
```

- [ ] **Step 4: Run the helper test**

```bash
npx nx test twenty-front --testFile=src/modules/activities/tasks/utils/__tests__/isTaskDueAtOverdue.test.ts --runInBand
```

Expected: pass.

- [ ] **Step 5: Commit the helper**

```bash
git add packages/twenty-front/src/modules/activities/tasks/utils/isTaskDueAtOverdue.ts packages/twenty-front/src/modules/activities/tasks/utils/__tests__/isTaskDueAtOverdue.test.ts
git commit -m "feat: detect overdue task due dates"
```

## Task 4: Wire Red Due-Date Display

**Files:**
- Modify: `packages/twenty-front/src/modules/object-record/record-field/ui/meta-types/display/components/DateTimeFieldDisplay.tsx`
- Modify: `packages/twenty-front/src/modules/object-record/record-field/ui/meta-types/display/components/__stories__/perf/DateTimeFieldDisplay.perf.stories.tsx`

- [ ] **Step 1: Update `DateTimeFieldDisplay.tsx`**

Replace the current file with the following implementation. It reads the current record `status` from the record store and uses the field metadata to scope the visual treatment to `task.dueAt`.

```tsx
import { isTaskDueAtOverdue } from '@/activities/tasks/utils/isTaskDueAtOverdue';
import { FieldContext } from '@/object-record/record-field/ui/contexts/FieldContext';
import { useDateTimeFieldDisplay } from '@/object-record/record-field/ui/meta-types/hooks/useDateTimeFieldDisplay';
import { useRecordFieldValue } from '@/object-record/record-store/hooks/useRecordFieldValue';
import { DateTimeDisplay } from '@/ui/field/display/components/DateTimeDisplay';
import { UserContext } from '@/users/contexts/UserContext';
import { styled } from '@linaria/react';
import { useContext } from 'react';
import { themeCssVariables } from 'twenty-ui-deprecated/theme-constants';

const StyledOverdueDateTimeDisplay = styled.div`
  color: ${themeCssVariables.font.color.danger};
  min-width: 0;
`;

export const DateTimeFieldDisplay = () => {
  const { fieldValue, fieldDefinition } = useDateTimeFieldDisplay();
  const { recordId } = useContext(FieldContext);
  const { timeZone } = useContext(UserContext);

  const status = useRecordFieldValue<string | undefined>(
    recordId,
    'status',
    fieldDefinition,
  );

  const dateFieldSettings = fieldDefinition.metadata?.settings;
  const dateTimeDisplay = (
    <DateTimeDisplay
      value={fieldValue}
      dateFieldSettings={dateFieldSettings}
    />
  );
  const isOverdueTaskDueDate =
    fieldDefinition.metadata.objectMetadataNameSingular === 'task' &&
    fieldDefinition.metadata.fieldName === 'dueAt' &&
    isTaskDueAtOverdue({
      dueAt: fieldValue,
      status,
      timeZone,
    });

  return isOverdueTaskDueDate ? (
    <StyledOverdueDateTimeDisplay>
      {dateTimeDisplay}
    </StyledOverdueDateTimeDisplay>
  ) : (
    dateTimeDisplay
  );
};
```

- [ ] **Step 2: Add a Storybook visual story**

Add this story below `Elipsis` in `DateTimeFieldDisplay.perf.stories.tsx`.

```tsx
export const OverdueTaskDueDate: Story = {
  decorators: [
    getFieldDecorator('task', 'dueAt', '2020-01-01T10:00:00.000Z'),
  ],
};
```

- [ ] **Step 3: Run focused frontend tests**

```bash
npx nx test twenty-front --testFile=src/modules/activities/tasks/utils/__tests__/isTaskDueAtOverdue.test.ts --runInBand
npx nx lint:diff-with-main twenty-front
```

Expected: helper test passes. Lint passes or reports only the known workspace build-chain blocker if dependency barrel generation stalls; record the exact blocker if it appears.

- [ ] **Step 4: Commit frontend UI changes**

```bash
git add packages/twenty-front/src/modules/object-record/record-field/ui/meta-types/display/components/DateTimeFieldDisplay.tsx packages/twenty-front/src/modules/object-record/record-field/ui/meta-types/display/components/__stories__/perf/DateTimeFieldDisplay.perf.stories.tsx
git commit -m "feat: highlight overdue task due dates"
```

## Task 5: Apply Metadata to Production Workspace

**Files:**
- Use: `.codex/scripts/setup-controlit-crm-enhancements.mjs`
- Uses backup path from script output under `.codex/backups/`

- [ ] **Step 1: Run final dry-run**

```bash
CRM_ADMIN_EMAIL="$CRM_ADMIN_EMAIL" \
CRM_ADMIN_PASSWORD="$CRM_ADMIN_PASSWORD" \
node .codex/scripts/setup-controlit-crm-enhancements.mjs --dry-run
```

Expected when fields are missing: planned field changes match this enhancement only, followed by `View changes will be planned after missing fields exist.` No territory role changes should appear because this script never mutates roles, permissions, or `controlitTerritoryAccess`. If all fields already exist, it also prints any pending target view changes.

- [ ] **Step 2: Apply metadata with backup**

```bash
CRM_ADMIN_EMAIL="$CRM_ADMIN_EMAIL" \
CRM_ADMIN_PASSWORD="$CRM_ADMIN_PASSWORD" \
node .codex/scripts/setup-controlit-crm-enhancements.mjs --apply
```

Expected: script prints a backup path with prefix `controlit-crm-enhancements`, creates or updates the metadata fields, and prints verification success.

- [ ] **Step 3: Re-run dry-run to verify idempotency**

```bash
CRM_ADMIN_EMAIL="$CRM_ADMIN_EMAIL" \
CRM_ADMIN_PASSWORD="$CRM_ADMIN_PASSWORD" \
node .codex/scripts/setup-controlit-crm-enhancements.mjs --dry-run
```

Expected: no field changes needed and no view changes needed.

- [ ] **Step 4: Commit metadata apply notes**

If applying production metadata reveals a necessary script fix, commit that fix before continuing. If the script is unchanged after apply, no commit is needed for this step.

## Task 6: Verify App Behavior Before Inviting Users

**Files:**
- Read-only verification through browser and API.
- No source edits expected in this task.

- [ ] **Step 1: Verify metadata through API**

Run a small metadata query through the existing helper or by using the setup script dry-run output. Confirm:

```text
opportunity.stage contains DECLINED once
company.referenceSourceType exists as SELECT
company.referenceName exists as TEXT
company.referenceYear exists as NUMBER
company.referenceLocation exists as TEXT
company.referenceNotes exists as TEXT
task.taskCategory exists as SELECT
```

- [ ] **Step 2: Verify admin UI**

In the in-app Browser on `https://crm.controlitfactory.eu`:

```text
Projects -> By Stage shows Declined as an available stage or allows moving a project to Declined through the Stage select.
Companies -> All Companies includes the reference fields in the visible/available columns.
Tasks -> All Tasks includes Task category and still allows creating standalone tasks with no relation.
```

- [ ] **Step 3: Verify restricted pilot behavior**

Using the existing pilot account:

```text
Pilot sees only assigned territory data.
Pilot can create a standalone task without Company/Project relation.
Pilot-created standalone task receives the pilot territory default.
Pilot can set Task category to Operations or Admin.
Pilot can create a project and set stage Declined only within assigned territory.
Pilot cannot see admin-only legacy tasks/projects without assigned territory.
```

- [ ] **Step 4: Verify overdue visual behavior**

Create or update a pilot-visible task:

```text
status = IN_PROGRESS
dueAt = yesterday
```

Expected: `Due Date` text is red in the task table. Change `status = DONE`; expected: due date returns to normal color.

- [ ] **Step 5: Commit verification notes if source changed during verification**

```bash
git status --short
```

Expected: clean worktree unless a bug fix was needed. Commit any fix with a focused message before reporting completion.

## Task 7: Update Project Memory

**Files:**
- Modify: `/Users/alexeykruminsh/Documents/All projects/Kruminsh Second Brain/Projects/controlit-crm/README.md`

- [ ] **Step 1: Add a Current Status entry**

Append a dated bullet under `## Current Status`:

```markdown
- 2026-06-10: Planned and implemented Controlit CRM enhancements for project outcomes, company reference filtering, standalone task categorization, and overdue due-date highlighting. Metadata is managed by `.codex/scripts/setup-controlit-crm-enhancements.mjs`; production metadata apply creates a `controlit-crm-enhancements` backup before mutation.
```

- [ ] **Step 2: Add a Latest Decision entry**

Append a dated bullet under `## Latest Decisions`:

```markdown
- 2026-06-10: Company exhibition/reference context is stored as current/latest reference fields on `Company`, not as a separate historical child object. `Reference year` is sufficient for v1; no reference date field is added.
```

- [ ] **Step 3: Add a Next Action entry**

Append a dated bullet under `## Next Actions` if real users are still not invited:

```markdown
- Verify the new `Declined` stage, Company reference fields, standalone task category, and overdue due-date UI with the pilot user before inviting real partner users.
```

- [ ] **Step 4: Commit memory update**

```bash
git add "/Users/alexeykruminsh/Documents/All projects/Kruminsh Second Brain/Projects/controlit-crm/README.md"
git commit -m "docs: update Controlit CRM enhancement memory"
```

## Release Gate

Before claiming completion:

```bash
node .codex/scripts/test-controlit-crm-enhancements.mjs
node --check .codex/scripts/setup-controlit-crm-enhancements.mjs
npx nx test twenty-front --testFile=src/modules/activities/tasks/utils/__tests__/isTaskDueAtOverdue.test.ts --runInBand
npx nx lint:diff-with-main twenty-front
git status --short
```

Expected:

```text
Metadata script tests pass.
Metadata setup script syntax check passes.
Focused frontend overdue tests pass.
Frontend changed-file lint passes or reports the known dependency build-chain blocker with exact output.
Worktree is clean except for files intentionally left unstaged by the user.
```

## Rollback Notes

- Metadata rollback: restore the DB backup created by `.codex/scripts/setup-controlit-crm-enhancements.mjs --apply` if a metadata mutation breaks production.
- Frontend rollback: redeploy the previous immutable image tag, currently recorded in project memory as `f6af59833979967728ab5b068acdb7f9ba3181d1`, if the overdue date UI build causes a production regression.
- Territory restrictions rollback is not part of this work because this plan does not edit `packages/twenty-server/src/modules/controlit/territory-access/*`.
