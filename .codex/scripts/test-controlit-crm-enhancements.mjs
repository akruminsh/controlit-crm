#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildOptionsWithStableIds,
  companyReferenceFieldDefinitions,
  main,
  normalizeOptions,
  planObjectFieldActions,
  planProjectStageActions,
  planSelectOptionUpdate,
  taskCategoryFieldDefinition,
} from './setup-controlit-crm-enhancements.mjs';

test('buildOptionsWithStableIds preserves existing option ids and appends new options', () => {
  const existingOptions = [
    { id: 'existing-new', label: 'New', value: 'NEW', color: 'red', position: 0 },
    {
      id: 'existing-customer',
      label: 'Customer',
      value: 'CUSTOMER',
      color: 'yellow',
      position: 4,
    },
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
      {
        id: 'declined-id',
        label: 'Declined',
        value: 'DECLINED',
        color: 'red',
        position: 5,
      },
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
      {
        id: 'customer-id',
        label: 'Customer',
        value: 'CUSTOMER',
        color: 'yellow',
        position: 4,
      },
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

test('planSelectOptionUpdate preserves a pre-existing declined option id', () => {
  const existingField = {
    id: 'stage-field',
    name: 'stage',
    type: 'SELECT',
    options: [
      { id: 'new-id', label: 'New', value: 'NEW', color: 'red', position: 0 },
      {
        id: 'declined-id',
        label: 'Declined',
        value: 'DECLINED',
        color: 'gray',
        position: 5,
      },
    ],
  };

  const update = planSelectOptionUpdate(existingField, [
    { label: 'New', value: 'NEW', color: 'red', position: 0 },
    { label: 'Declined', value: 'DECLINED', color: 'red', position: 5 },
  ]);

  assert.equal(update.options.length, 2);
  assert.equal(update.options[1].id, 'declined-id');
  assert.equal(update.options[1].color, 'red');
});

test('planSelectOptionUpdate rejects non-select field type conflicts', () => {
  assert.throws(
    () =>
      planSelectOptionUpdate(
        { id: 'stage-field', name: 'stage', type: 'TEXT', options: [] },
        [{ label: 'Declined', value: 'DECLINED', color: 'red', position: 5 }],
      ),
    /expected SELECT/,
  );
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

test('main requires explicit workspace id for apply mode before CRM login', async () => {
  await assert.rejects(
    () =>
      main({
        config: {},
        isDryRun: false,
        ensureBackup: async () => {},
      }),
    /CRM_WORKSPACE_ID is required for --apply/,
  );
});

test('planProjectStageActions appends declined stage while preserving existing option ids', () => {
  const actions = planProjectStageActions(
    opportunityWithStageOptions([
      { id: 'new-id', label: 'New', value: 'NEW', color: 'red', position: 0 },
      {
        id: 'customer-id',
        label: 'Customer',
        value: 'CUSTOMER',
        color: 'yellow',
        position: 4,
      },
    ]),
  );

  assert.equal(actions.length, 1);
  assert.equal(actions[0].kind, 'update-field');
  assert.equal(actions[0].fieldName, 'stage');
  assert.deepEqual(
    actions[0].update.options.map((option) => option.value),
    ['NEW', 'CUSTOMER', 'DECLINED'],
  );
  assert.equal(actions[0].update.options[0].id, 'new-id');
  assert.equal(actions[0].update.options[1].id, 'customer-id');
  assert.match(actions[0].update.options[2].id, /^[0-9a-f-]{36}$/);
  assert.equal(actions[0].update.options[2].label, 'Declined');
  assert.equal(actions[0].update.options[2].color, 'red');
  assert.equal(actions[0].update.options[2].position, 5);
});

test('planProjectStageActions updates existing declined stage without duplicating or changing id', () => {
  const actions = planProjectStageActions(
    opportunityWithStageOptions([
      { id: 'new-id', label: 'New', value: 'NEW', color: 'red', position: 0 },
      {
        id: 'declined-id',
        label: 'Declined',
        value: 'DECLINED',
        color: 'gray',
        position: 3,
      },
    ]),
  );

  assert.equal(actions.length, 1);

  const declinedOptions = actions[0].update.options.filter(
    (option) => option.value === 'DECLINED',
  );

  assert.equal(declinedOptions.length, 1);
  assert.equal(declinedOptions[0].id, 'declined-id');
  assert.equal(declinedOptions[0].label, 'Declined');
  assert.equal(declinedOptions[0].color, 'red');
  assert.equal(declinedOptions[0].position, 3);
});

test('planProjectStageActions returns no actions when declined stage already matches', () => {
  assert.deepEqual(
    planProjectStageActions(
      opportunityWithStageOptions([
        { id: 'new-id', label: 'New', value: 'NEW', color: 'red', position: 0 },
        {
          id: 'declined-id',
          label: 'Declined',
          value: 'DECLINED',
          color: 'red',
          position: 1,
        },
      ]),
    ),
    [],
  );
});

test('planObjectFieldActions plans missing company reference field creation', () => {
  const company = {
    id: 'company-object',
    nameSingular: 'company',
    fieldsList: [],
  };

  const actions = planObjectFieldActions(company, companyReferenceFieldDefinitions);

  assert.equal(actions.length, 5);
  assert.deepEqual(
    actions.map((action) => action.kind),
    [
      'create-field',
      'create-field',
      'create-field',
      'create-field',
      'create-field',
    ],
  );
  assert.deepEqual(
    actions.map((action) => action.fieldName),
    [
      'referenceSourceType',
      'referenceName',
      'referenceYear',
      'referenceLocation',
      'referenceNotes',
    ],
  );
});

test('planObjectFieldActions plans existing field updates', () => {
  const task = {
    id: 'task-object',
    nameSingular: 'task',
    fieldsList: [
      {
        id: 'task-category-field',
        name: 'taskCategory',
        type: 'SELECT',
        label: 'Old task category',
        icon: 'IconOld',
        isActive: true,
        options: [
          {
            id: 'project-option-id',
            label: 'Project',
            value: 'PROJECT',
            color: 'gray',
            position: 0,
          },
        ],
      },
    ],
  };

  const actions = planObjectFieldActions(task, [taskCategoryFieldDefinition]);

  assert.equal(actions.length, 1);
  assert.equal(actions[0].kind, 'update-field');
  assert.equal(actions[0].fieldName, 'taskCategory');
  assert.equal(actions[0].update.label, 'Task category');
  assert.equal(actions[0].update.icon, 'IconCategory');
  assert.deepEqual(
    actions[0].update.options.map((option) => option.value),
    ['PROJECT', 'SALES', 'OPERATIONS', 'ADMIN', 'OTHER'],
  );
  assert.equal(actions[0].update.options[0].id, 'project-option-id');
  assert.equal(actions[0].update.options[0].color, 'blue');
});

test('planObjectFieldActions reactivates inactive existing fields', () => {
  const company = {
    id: 'company-object',
    nameSingular: 'company',
    fieldsList: [
      {
        id: 'reference-name-field',
        name: 'referenceName',
        type: 'TEXT',
        label: 'Reference name',
        icon: 'IconTag',
        isActive: false,
      },
    ],
  };
  const referenceNameDefinition = companyReferenceFieldDefinitions.find(
    (field) => field.name === 'referenceName',
  );

  const actions = planObjectFieldActions(company, [referenceNameDefinition]);

  assert.equal(actions.length, 1);
  assert.equal(actions[0].kind, 'update-field');
  assert.equal(actions[0].fieldName, 'referenceName');
  assert.deepEqual(actions[0].update, { isActive: true });
});

test('planObjectFieldActions rejects existing fields with conflicting types', () => {
  const company = {
    id: 'company-object',
    nameSingular: 'company',
    fieldsList: [
      {
        id: 'reference-name-field',
        name: 'referenceName',
        type: 'NUMBER',
        label: 'Reference name',
        icon: 'IconTag',
      },
    ],
  };
  const referenceNameDefinition = companyReferenceFieldDefinitions.find(
    (field) => field.name === 'referenceName',
  );

  assert.throws(
    () => planObjectFieldActions(company, [referenceNameDefinition]),
    /Field referenceName exists with type NUMBER; expected TEXT/,
  );
});

function opportunityWithStageOptions(options) {
  return {
    id: 'opportunity-object',
    nameSingular: 'opportunity',
    fieldsList: [
      {
        id: 'stage-field',
        name: 'stage',
        type: 'SELECT',
        label: 'Stage',
        icon: 'IconProgress',
        options,
      },
    ],
  };
}
