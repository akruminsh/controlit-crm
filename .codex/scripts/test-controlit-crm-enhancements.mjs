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
