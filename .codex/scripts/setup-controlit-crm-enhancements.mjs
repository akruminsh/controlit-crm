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
  if (!isDryRun && !config.workspaceId) {
    throw new Error('CRM_WORKSPACE_ID is required for --apply.');
  }

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
    actions.forEach((action) =>
      console.log(`${action.kind}: ${action.object.nameSingular}.${action.fieldName}`),
    );
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

  const refreshedMetadata =
    actions.length > 0 && !isDryRun ? await fetchMetadata(client) : metadata;

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
      afterFieldNames: [
        'targetPersonRole',
        'projectTypes',
        'companyCategoryRaw',
        'companyCountry',
        'companyType',
        'name',
      ],
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
    viewActions.forEach((action) =>
      console.log(`${action.kind}: ${action.view.name}.${action.fieldName}`),
    );
  } else {
    await ensureBackup();
    for (const action of viewActions) {
      if (action.kind === 'create-view-field') {
        await createViewField(
          client,
          action.view.id,
          action.fieldMetadataId,
          action.position,
        );
        console.log(`Added ${action.fieldName} to view: ${action.view.name}`);
      }

      if (action.kind === 'update-view-field') {
        await updateViewField(client, action.viewFieldId, action.update);
        console.log(`Updated ${action.fieldName} in view: ${action.view.name}`);
      }
    }
  }

  if (isDryRun) {
    console.log('Dry run complete. No metadata was changed.');
    return;
  }

  const verificationMetadata = await fetchMetadata(client);
  const verificationOpportunity = findObjectOrThrow(
    verificationMetadata.objects,
    'opportunity',
  );
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
      afterFieldNames: [
        'targetPersonRole',
        'projectTypes',
        'companyCategoryRaw',
        'companyCountry',
        'companyType',
        'name',
      ],
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
    throw new Error(
      `Verification failed: ${verificationActions.length} field actions are still pending.`,
    );
  }

  if (verificationViewActions.length > 0) {
    throw new Error(
      `Verification failed: ${verificationViewActions.length} view actions are still pending.`,
    );
  }

  console.log(
    'Verification: project stage, company reference fields, task category field, and target views are configured.',
  );
}

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
  const existingDeclinedOption = existingOptions.find(
    (option) => option.value === projectDeclinedStageOption.value,
  );
  const declinedPosition =
    existingDeclinedOption?.position ?? maxOptionPosition(existingOptions) + 1;
  const desiredOptions = [
    ...existingOptions.filter(
      (option) => option.value !== projectDeclinedStageOption.value,
    ),
    { ...projectDeclinedStageOption, position: declinedPosition },
  ].sort((left, right) => left.position - right.position);

  const update = planSelectOptionUpdate(stageField, desiredOptions);

  return update
    ? [
        {
          kind: 'update-field',
          object: opportunity,
          fieldName: 'stage',
          field: stageField,
          update,
        },
      ]
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
    throw new Error(
      `Field ${definition.name} exists with type ${existingField.type}; expected ${definition.type}.`,
    );
  }

  const update = {};

  if (existingField.label !== definition.label) {
    update.label = definition.label;
  }

  if (existingField.icon !== definition.icon) {
    update.icon = definition.icon;
  }

  if (existingField.isActive !== true) {
    update.isActive = true;
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
    throw new Error(
      `Field ${existingField.name} exists with type ${existingField.type}; expected SELECT.`,
    );
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
  const existingByValue = new Map(
    existingOptions.map((option) => [option.value, option]),
  );

  return normalizeOptions(desiredOptions).map((option) => ({
    id: existingByValue.get(option.value)?.id ?? randomUUID(),
    label: option.label,
    value: option.value,
    color: option.color,
    position: option.position,
  }));
}

async function createField(client, objectMetadataId, definition) {
  const data = await client.metadata(
    `
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
    `,
    {
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
    },
  );

  return data.createOneField;
}

async function updateField(client, id, update) {
  return client.metadata(
    `
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
    `,
    {
      input: { id, update },
    },
  );
}

export async function planViewActions(client, object, definitions, config) {
  const views = await getViews(client, object.id);
  const view =
    views.find((candidate) => candidate.name === config.viewName) ??
    views.find(
      (candidate) =>
        candidate.type === config.fallbackType && Number(candidate.position) === 0,
    );

  if (!view) {
    if (config.optional) {
      return [];
    }

    throw new Error(`View not found: ${object.nameSingular}.${config.viewName}`);
  }

  const fieldsByName = mapByName(object.fieldsList);
  const viewFields = await getViewFields(client, view.id);
  const viewFieldsByFieldId = new Map(
    viewFields.map((viewField) => [viewField.fieldMetadataId, viewField]),
  );
  const fieldsById = new Map(
    object.fieldsList.map((field) => [field.id, field]),
  );
  const targetItems = definitions.map((definition) => {
    const field = fieldsByName.get(definition.name);

    if (!field) {
      throw new Error(`Cannot add ${definition.name} to ${view.name}: field is missing.`);
    }

    return {
      isTarget: true,
      definition,
      field,
      viewField: viewFieldsByFieldId.get(field.id),
    };
  });
  const targetFieldIds = new Set(
    targetItems.map((targetItem) => targetItem.field.id),
  );
  const orderedExistingViewFields = viewFields
    .map((viewField, originalIndex) => ({ viewField, originalIndex }))
    .sort(
      (left, right) =>
        Number(left.viewField.position) - Number(right.viewField.position) ||
        left.originalIndex - right.originalIndex,
    )
    .map(({ viewField }) => ({
      isTarget: false,
      fieldName: fieldsById.get(viewField.fieldMetadataId)?.name ?? viewField.fieldMetadataId,
      viewField,
    }));
  const existingViewFieldsWithoutTargets = orderedExistingViewFields.filter(
    (item) => !targetFieldIds.has(item.viewField.fieldMetadataId),
  );
  const baseViewField = resolveBaseViewField(
    viewFieldsByFieldId,
    fieldsByName,
    config.afterFieldNames,
  );
  const baseIndex = baseViewField
    ? existingViewFieldsWithoutTargets.findIndex(
        (item) => item.viewField.id === baseViewField.id,
      )
    : -1;
  const insertionIndex = baseIndex === -1
    ? existingViewFieldsWithoutTargets.length
    : baseIndex + 1;
  const desiredViewFieldItems = [
    ...existingViewFieldsWithoutTargets.slice(0, insertionIndex),
    ...targetItems,
    ...existingViewFieldsWithoutTargets.slice(insertionIndex),
  ];
  const nonTargetActions = [];
  const targetActions = [];

  desiredViewFieldItems.forEach((item, position) => {
    if (!item.isTarget) {
      if (Number(item.viewField.position) !== position) {
        nonTargetActions.push({
          kind: 'update-view-field',
          view,
          fieldName: item.fieldName,
          viewFieldId: item.viewField.id,
          update: { position },
        });
      }

      return;
    }

    if (!item.viewField) {
      targetActions.push({
        kind: 'create-view-field',
        view,
        fieldName: item.definition.name,
        fieldMetadataId: item.field.id,
        position,
      });
      return;
    }

    if (
      item.viewField.isVisible !== true ||
      Number(item.viewField.position) !== position ||
      Number(item.viewField.size) !== FIELD_WIDTH
    ) {
      targetActions.push({
        kind: 'update-view-field',
        view,
        fieldName: item.definition.name,
        viewFieldId: item.viewField.id,
        update: {
          isVisible: true,
          size: FIELD_WIDTH,
          position,
        },
      });
    }
  });

  return [
    ...nonTargetActions.sort(
      (left, right) => Number(right.update.position) - Number(left.update.position),
    ),
    ...targetActions,
  ];
}

async function getViews(client, objectMetadataId) {
  const data = await client.metadata(
    `
      query GetViews($objectMetadataId: String) {
        getViews(objectMetadataId: $objectMetadataId) {
          id
          name
          type
          position
        }
      }
    `,
    { objectMetadataId },
  );

  return data.getViews;
}

async function getViewFields(client, viewId) {
  const data = await client.metadata(
    `
      query GetViewFields($viewId: String!) {
        getViewFields(viewId: $viewId) {
          id
          fieldMetadataId
          isVisible
          size
          position
        }
      }
    `,
    { viewId },
  );

  return data.getViewFields;
}

function resolveBaseViewField(
  viewFieldsByFieldId,
  fieldsByName,
  afterFieldNames,
) {
  for (const fieldName of afterFieldNames) {
    const field = fieldsByName.get(fieldName);
    const viewField = field ? viewFieldsByFieldId.get(field.id) : undefined;

    if (viewField) {
      return viewField;
    }
  }

  return undefined;
}

export async function createViewField(client, viewId, fieldMetadataId, position) {
  const data = await client.metadata(
    `
      mutation CreateViewField($input: CreateViewFieldInput!) {
        createViewField(input: $input) {
          id
          fieldMetadataId
          isVisible
          size
          position
        }
      }
    `,
    {
      input: {
        fieldMetadataId,
        viewId,
        isVisible: true,
        size: FIELD_WIDTH,
        position,
      },
    },
  );

  return data.createViewField;
}

export async function updateViewField(client, viewFieldId, update) {
  const data = await client.metadata(
    `
      mutation UpdateViewField($input: UpdateViewFieldInput!) {
        updateViewField(input: $input) {
          id
          fieldMetadataId
          isVisible
          size
          position
        }
      }
    `,
    {
      input: {
        id: viewFieldId,
        update,
      },
    },
  );

  return data.updateViewField;
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

function maxOptionPosition(options) {
  return options.length === 0
    ? -1
    : Math.max(...options.map((option) => Number(option.position)));
}
