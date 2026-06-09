#!/usr/bin/env node

import { randomUUID } from 'node:crypto';

import {
  createBackupOnce,
  createCrmClient,
  loadConfig,
  parseCommonArgs,
} from './controlit-crm-client.mjs';

const FIELD_WIDTH = 150;
const { isDryRun, skipBackup } = parseCommonArgs();
const config = loadConfig();
const ensureBackup = createBackupOnce({
  config,
  isDryRun,
  skipBackup,
  prefix: 'controlit-crm-project-card',
});

const fieldDefinitions = [
  selectField('projectCountry', 'Project country', 'IconMapPin', [
    ['Finland', 'FINLAND', 'blue'],
    ['Estonia', 'ESTONIA', 'sky'],
    ['Lithuania', 'LITHUANIA', 'green'],
    ['Latvia', 'LATVIA', 'turquoise'],
    ['United Arab Emirates', 'UNITED_ARAB_EMIRATES', 'purple'],
    ['Asia', 'ASIA', 'yellow'],
    ['Czechia', 'CZECHIA', 'orange'],
    ['Slovakia', 'SLOVAKIA', 'red'],
    ['Slovenia', 'SLOVENIA', 'pink'],
    ['Croatia', 'CROATIA', 'sky'],
    ['Romania', 'ROMANIA', 'green'],
    ['Hungary', 'HUNGARY', 'gray'],
    ['MENA region', 'MENA', 'purple'],
    ['Australia', 'AUSTRALIA', 'blue'],
    ['New Zealand', 'NEW_ZEALAND', 'green'],
  ]),
  selectField('membraneType', 'Membrane type', 'IconLayersIntersect', [
    ['PVC', 'PVC', 'green'],
    ['TPO', 'TPO', 'turquoise'],
    ['Bitumen', 'BITUMEN', 'orange'],
    ['EPDM', 'EPDM', 'purple'],
  ]),
  {
    name: 'projectSizeM2',
    label: 'Project size (m2)',
    type: 'NUMBER',
    icon: 'IconRulerMeasure',
    description: 'Project size in square meters.',
  },
  selectField('installationYear', 'Installation year', 'IconCalendarEvent', [
    ['2005', 'YEAR_2005', 'green'],
    ['2006', 'YEAR_2006', 'turquoise'],
    ['2007', 'YEAR_2007', 'sky'],
    ['2008', 'YEAR_2008', 'blue'],
  ]),
  selectField('installationQuarter', 'Installation quarter', 'IconCalendarStats', [
    ['1', 'Q1', 'green'],
    ['2', 'Q2', 'turquoise'],
    ['3', 'Q3', 'sky'],
    ['4', 'Q4', 'blue'],
  ]),
  selectField('installationMonth', 'Installation month', 'IconCalendarMonth', [
    ['January', 'JANUARY', 'green'],
    ['February', 'FEBRUARY', 'turquoise'],
    ['March', 'MARCH', 'sky'],
    ['April', 'APRIL', 'blue'],
    ['May', 'MAY', 'purple'],
    ['June', 'JUNE', 'pink'],
    ['July', 'JULY', 'red'],
    ['August', 'AUGUST', 'orange'],
    ['September', 'SEPTEMBER', 'yellow'],
    ['October', 'OCTOBER', 'lime'],
    ['November', 'NOVEMBER', 'jade'],
    ['December', 'DECEMBER', 'gray'],
  ]),
  selectField('possibility', 'Possibility', 'IconPercentage', [
    ['<50%', 'LESS_THAN_50', 'red'],
    ['50%', 'PERCENT_50', 'orange'],
    ['70%', 'PERCENT_70', 'yellow'],
    ['90%', 'PERCENT_90', 'green'],
    ['Order', 'ORDER', 'blue'],
  ]),
];

const metadataFieldNames = fieldDefinitions.map((field) => field.name);

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function main() {
  const client = await createCrmClient(config);
  const initialMetadata = await fetchOpportunityMetadata(client);
  const opportunity = initialMetadata.opportunity;

  console.log(`Workspace: ${initialMetadata.workspaceName} (${initialMetadata.workspaceId})`);
  console.log(`Object: ${opportunity.labelPlural} / ${opportunity.nameSingular} (${opportunity.id})`);

  let currentFields = mapByName(opportunity.fieldsList);
  const fieldActions = planFieldActions(currentFields);

  if (fieldActions.length === 0) {
    console.log('Fields: no changes needed.');
  } else if (isDryRun) {
    console.log('Fields to create:');
    fieldActions.forEach((action) => console.log(`- ${action.definition.name} (${action.definition.type})`));
  } else {
    await ensureBackup();
    for (const action of fieldActions) {
      const createdField = await createField(client, opportunity.id, action.definition);
      currentFields.set(createdField.name, createdField);
      console.log(`Created field: ${createdField.name}`);
    }
  }

  const refreshedMetadata = fieldActions.length > 0 && !isDryRun
    ? await fetchOpportunityMetadata(client)
    : initialMetadata;

  currentFields = mapByName(refreshedMetadata.opportunity.fieldsList);

  if (isDryRun && fieldActions.length > 0) {
    console.log('View changes will be planned after the missing fields exist.');
    console.log('Dry run complete. No metadata was changed.');
    return;
  }

  assertRequiredFields(currentFields);

  const views = await getViews(client, refreshedMetadata.opportunity.id);
  const targetViews = resolveTargetViews(views);
  const viewActions = await planViewFieldActions(client, targetViews, currentFields);

  if (viewActions.length === 0) {
    console.log('Views: no changes needed.');
  } else if (isDryRun) {
    console.log('View field changes:');
    viewActions.forEach((action) => {
      console.log(`- ${action.kind} ${action.fieldName} in ${action.view.name} at position ${action.position}`);
    });
  } else {
    await ensureBackup();
    for (const action of viewActions) {
      if (action.kind === 'create') {
        await createViewField(client, action.view.id, action.fieldMetadataId, action.position);
        console.log(`Added ${action.fieldName} to view: ${action.view.name}`);
      } else {
        await updateViewField(client, action.viewFieldId, action.position);
        console.log(`Updated ${action.fieldName} in view: ${action.view.name}`);
      }
    }
  }

  if (isDryRun) {
    console.log('Dry run complete. No metadata was changed.');
    return;
  }

  const verificationMetadata = await fetchOpportunityMetadata(client);
  const verificationFields = mapByName(verificationMetadata.opportunity.fieldsList);
  assertRequiredFields(verificationFields);
  const verificationViews = await getViews(client, verificationMetadata.opportunity.id);
  const verificationTargets = resolveTargetViews(verificationViews);
  const verificationActions = await planViewFieldActions(client, verificationTargets, verificationFields);

  if (verificationActions.length > 0) {
    throw new Error(`Verification failed: ${verificationActions.length} view changes are still pending.`);
  }

  console.log('Verification: metadata fields and target views are in the expected state.');
}

async function fetchOpportunityMetadata(client) {
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

  const objects = data.objects.edges.map((edge) => edge.node);
  const opportunity = objects.find((object) => object.nameSingular === 'opportunity')
    ?? objects.find((object) => object.labelPlural === 'Projects');

  if (!opportunity) {
    throw new Error('Could not find Projects/opportunity object metadata.');
  }

  return {
    workspaceId: client.workspace.id,
    workspaceName: client.workspace.displayName,
    opportunity,
  };
}

function planFieldActions(currentFields) {
  const actions = [];

  for (const definition of fieldDefinitions) {
    const existingField = currentFields.get(definition.name);

    if (!existingField) {
      actions.push({ kind: 'create', definition });
      continue;
    }

    assertExistingFieldMatchesDefinition(existingField, definition);
  }

  return actions;
}

async function createField(client, objectMetadataId, definition) {
  const data = await client.metadata(`
    mutation CreateOneFieldMetadataItem($input: CreateOneFieldMetadataInput!) {
      createOneField(input: $input) {
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
  `, {
    input: {
      field: {
        objectMetadataId,
        name: definition.name,
        label: definition.label,
        type: definition.type,
        icon: definition.icon,
        description: definition.description ?? '',
        isCustom: true,
        isActive: true,
        isNullable: true,
        isLabelSyncedWithName: false,
        ...(definition.options ? { options: cloneOptions(definition.options) } : {}),
        ...(definition.settings ? { settings: definition.settings } : {}),
      },
    },
  });

  return data.createOneField;
}

async function getViews(client, objectMetadataId) {
  return client.rest('GET', `/rest/metadata/views?objectMetadataId=${encodeURIComponent(objectMetadataId)}`);
}

async function planViewFieldActions(client, targetViews, currentFields) {
  const actions = [];
  const pointOfContactField = currentFields.get('pointOfContact');

  if (!pointOfContactField) {
    throw new Error('Cannot position custom fields: pointOfContact field is missing.');
  }

  for (const view of targetViews) {
    const currentViewFields = await client.rest('GET', `/rest/metadata/viewFields?viewId=${encodeURIComponent(view.id)}`);
    const viewFieldsByFieldId = new Map(currentViewFields.map((viewField) => [viewField.fieldMetadataId, viewField]));
    const pointOfContactViewField = viewFieldsByFieldId.get(pointOfContactField.id);
    const basePosition = Number(pointOfContactViewField?.position ?? maxPosition(currentViewFields));

    metadataFieldNames.forEach((fieldName, index) => {
      const field = currentFields.get(fieldName);
      const existingViewField = viewFieldsByFieldId.get(field.id);
      const desiredPosition = basePosition + index + 1;

      if (!existingViewField) {
        actions.push({
          kind: 'create',
          view,
          fieldName,
          fieldMetadataId: field.id,
          position: desiredPosition,
        });
        return;
      }

      if (
        existingViewField.isVisible !== true
        || Number(existingViewField.position) !== desiredPosition
        || Number(existingViewField.size) !== FIELD_WIDTH
      ) {
        actions.push({
          kind: 'update',
          view,
          fieldName,
          viewFieldId: existingViewField.id,
          fieldMetadataId: field.id,
          position: desiredPosition,
        });
      }
    });
  }

  return actions;
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

function resolveTargetViews(views) {
  const allProjects = views.find((view) => view.name === 'All Projects' && view.type === 'TABLE')
    ?? views.find((view) => view.type === 'TABLE' && view.position === 0);
  const byStage = views.find((view) => view.name === 'By Stage' && view.type === 'KANBAN');

  const missing = [
    allProjects ? null : 'All Projects table',
    byStage ? null : 'By Stage kanban',
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Missing target views: ${missing.join(', ')}`);
  }

  return [allProjects, byStage];
}

function assertRequiredFields(currentFields) {
  for (const definition of fieldDefinitions) {
    const existingField = currentFields.get(definition.name);

    if (!existingField) {
      throw new Error(`Verification failed: ${definition.name} was not created.`);
    }

    assertExistingFieldMatchesDefinition(existingField, definition);
  }
}

function assertExistingFieldMatchesDefinition(existingField, definition) {
  if (existingField.type !== definition.type) {
    throw new Error(`Field ${definition.name} already exists with type ${existingField.type}; expected ${definition.type}.`);
  }

  if (definition.options) {
    const expectedOptions = normalizeOptions(definition.options);
    const actualOptions = normalizeOptions(existingField.options ?? []);

    if (JSON.stringify(actualOptions) !== JSON.stringify(expectedOptions)) {
      throw new Error(`Field ${definition.name} already exists with different select options.`);
    }
  }
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

function normalizeOptions(options) {
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
  if (items.length === 0) {
    return 0;
  }

  return Math.max(...items.map((item) => Number(item.position)));
}
