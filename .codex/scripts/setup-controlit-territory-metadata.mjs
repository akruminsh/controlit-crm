#!/usr/bin/env node

import { randomUUID } from 'node:crypto';

import {
  createBackupOnce,
  createCrmClient,
  loadConfig,
  parseCommonArgs,
} from './controlit-crm-client.mjs';

const FIELD_WIDTH = 150;

const TERRITORY_OPTIONS = [
  ['Finland', 'FINLAND', 'blue'],
  ['Estonia', 'ESTONIA', 'sky'],
  ['Lithuania', 'LITHUANIA', 'green'],
  ['Latvia', 'LATVIA', 'turquoise'],
  ['United Arab Emirates', 'UNITED_ARAB_EMIRATES', 'purple'],
  ['Asia', 'ASIA', 'yellow'],
];

const FIELD_DEFINITIONS = [
  territoryField('company', 'companyCountry', 'Company country'),
  territoryField('person', 'personTerritory', 'Person territory'),
  territoryField('opportunity', 'projectCountry', 'Project country'),
  territoryField('task', 'taskTerritory', 'Task territory'),
];

const VIEW_TARGETS = [
  {
    objectName: 'company',
    fieldName: 'companyCountry',
    viewNames: ['All Companies'],
    afterFieldNames: ['name'],
  },
  {
    objectName: 'person',
    fieldName: 'personTerritory',
    viewNames: ['All People'],
    afterFieldNames: ['company', 'jobTitle'],
  },
  {
    objectName: 'opportunity',
    fieldName: 'projectCountry',
    viewNames: ['All Projects', 'By Stage'],
    afterFieldNames: ['pointOfContact', 'company'],
  },
  {
    objectName: 'task',
    fieldName: 'taskTerritory',
    viewNames: ['All Tasks'],
    afterFieldNames: ['assignee', 'status'],
  },
];

const { isDryRun, skipBackup } = parseCommonArgs();
const config = loadConfig();
const ensureBackup = createBackupOnce({
  config,
  isDryRun,
  skipBackup,
  prefix: 'controlit-territory-metadata',
});

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function main() {
  const client = await createCrmClient(config);
  const objects = await fetchObjects(client);
  const objectsByName = new Map(objects.map((object) => [object.nameSingular, object]));

  console.log(`Workspace: ${client.workspace.displayName} (${client.workspace.id})`);

  for (const definition of FIELD_DEFINITIONS) {
    const object = objectsByName.get(definition.objectName);

    if (!object) {
      throw new Error(`Object not found: ${definition.objectName}`);
    }

    const fieldsByName = mapByName(object.fieldsList);
    const existingField = fieldsByName.get(definition.name);

    if (!existingField) {
      if (isDryRun) {
        console.log(`Would create field ${definition.objectName}.${definition.name}`);
        continue;
      }

      await ensureBackup();
      const createdField = await createField(client, object.id, definition);
      console.log(`Created field ${definition.objectName}.${createdField.name}`);
      continue;
    }

    const update = planFieldUpdate(existingField, definition);

    if (!update) {
      console.log(`Field OK: ${definition.objectName}.${definition.name}`);
      continue;
    }

    if (isDryRun) {
      console.log(`Would update field ${definition.objectName}.${definition.name}`);
      continue;
    }

    await ensureBackup();
    await updateField(client, existingField.id, update);
    console.log(`Updated field ${definition.objectName}.${definition.name}`);
  }

  const refreshedObjects = await fetchObjects(client);
  const refreshedObjectsByName = new Map(
    refreshedObjects.map((object) => [object.nameSingular, object]),
  );

  for (const target of VIEW_TARGETS) {
    const object = refreshedObjectsByName.get(target.objectName);

    if (!object) {
      throw new Error(`Object not found: ${target.objectName}`);
    }

    const fieldsByName = mapByName(object.fieldsList);
    const field = fieldsByName.get(target.fieldName);

    if (!field) {
      throw new Error(`Field missing after setup: ${target.objectName}.${target.fieldName}`);
    }

    const views = await getViews(client, object.id);
    const targetViews = resolveTargetViews(views, target.viewNames);

    for (const view of targetViews) {
      const action = await planViewFieldAction(
        client,
        view,
        field,
        fieldsByName,
        target.afterFieldNames,
      );

      if (!action) {
        console.log(`View OK: ${view.name} has ${target.fieldName}`);
        continue;
      }

      if (isDryRun) {
        console.log(
          `Would ${action.kind} ${target.fieldName} in view ${view.name} at position ${action.position}`,
        );
        continue;
      }

      await ensureBackup();

      if (action.kind === 'create') {
        await createViewField(client, view.id, field.id, action.position);
        console.log(`Added ${target.fieldName} to view ${view.name}`);
      } else {
        await updateViewField(client, action.viewFieldId, action.position);
        console.log(`Updated ${target.fieldName} in view ${view.name}`);
      }
    }
  }

  console.log(
    isDryRun
      ? 'Dry run complete. No metadata was changed.'
      : 'Territory metadata setup complete.',
  );
}

async function fetchObjects(client) {
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
            }
          }
        }
      }
    }
  `);

  return data.objects.edges.map((edge) => edge.node);
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

  if (
    JSON.stringify(normalizeOptions(existingField.options ?? [])) !==
    JSON.stringify(normalizeOptions(definition.options))
  ) {
    update.options = mergeOptionIds(definition.options, existingField.options ?? []);
  }

  return Object.keys(update).length > 0 ? update : null;
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
          options: cloneOptions(definition.options),
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
      input: {
        id,
        update,
      },
    },
  );
}

async function getViews(client, objectMetadataId) {
  return client.rest(
    'GET',
    `/rest/metadata/views?objectMetadataId=${encodeURIComponent(objectMetadataId)}`,
  );
}

async function planViewFieldAction(
  client,
  view,
  field,
  fieldsByName,
  afterFieldNames,
) {
  const currentViewFields = await client.rest(
    'GET',
    `/rest/metadata/viewFields?viewId=${encodeURIComponent(view.id)}`,
  );
  const viewFieldsByFieldId = new Map(
    currentViewFields.map((viewField) => [viewField.fieldMetadataId, viewField]),
  );
  const existingViewField = viewFieldsByFieldId.get(field.id);
  const desiredPosition =
    resolveBasePosition(currentViewFields, viewFieldsByFieldId, fieldsByName, afterFieldNames) +
    1;

  if (!existingViewField) {
    return { kind: 'create', position: desiredPosition };
  }

  if (
    existingViewField.isVisible !== true ||
    Number(existingViewField.position) !== desiredPosition ||
    Number(existingViewField.size) !== FIELD_WIDTH
  ) {
    return {
      kind: 'update',
      viewFieldId: existingViewField.id,
      position: desiredPosition,
    };
  }

  return null;
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

function resolveTargetViews(views, names) {
  const targets = [];

  for (const name of names) {
    const view = views.find((candidate) => candidate.name === name);

    if (view) {
      targets.push(view);
    }
  }

  if (targets.length > 0) {
    return targets;
  }

  const fallback = views.find((view) => view.type === 'TABLE');

  if (!fallback) {
    throw new Error(`No target table view found for ${names.join(', ')}`);
  }

  return [fallback];
}

function resolveBasePosition(
  viewFields,
  viewFieldsByFieldId,
  fieldsByName,
  afterFieldNames,
) {
  for (const afterFieldName of afterFieldNames) {
    const field = fieldsByName.get(afterFieldName);

    if (!field) {
      continue;
    }

    const viewField = viewFieldsByFieldId.get(field.id);

    if (viewField) {
      return Number(viewField.position);
    }
  }

  return maxPosition(viewFields);
}

function territoryField(objectName, name, label) {
  return {
    objectName,
    name,
    label,
    type: 'SELECT',
    icon: 'IconMapPin',
    description: `${label} used by Controlit territory access rules.`,
    options: TERRITORY_OPTIONS.map(([optionLabel, value, color], position) => ({
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

function mergeOptionIds(expectedOptions, existingOptions) {
  const existingIdByValue = new Map(
    existingOptions.map((option) => [option.value, option.id]),
  );

  return expectedOptions.map((option) => ({
    ...option,
    id: existingIdByValue.get(option.value) ?? option.id,
  }));
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
