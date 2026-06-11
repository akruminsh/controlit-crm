#!/usr/bin/env node

import {
  createBackupOnce,
  createCrmClient,
  fetchAll,
  loadConfig,
  parseCommonArgs,
} from './controlit-crm-client.mjs';

const TERRITORIES = new Set([
  'FINLAND',
  'ESTONIA',
  'LITHUANIA',
  'LATVIA',
  'UNITED_ARAB_EMIRATES',
  'ASIA',
  'CZECHIA',
  'SLOVAKIA',
  'SLOVENIA',
  'CROATIA',
  'ROMANIA',
  'HUNGARY',
  'MENA',
  'AUSTRALIA',
  'NEW_ZEALAND',
  'UNITED_KINGDOM',
  'KUWAIT',
  'SWEDEN',
]);

const { isDryRun, skipBackup } = parseCommonArgs();
const config = loadConfig();
const ensureBackup = createBackupOnce({
  config,
  isDryRun,
  skipBackup,
  prefix: 'controlit-territory-backfill',
});

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function main() {
  const client = await createCrmClient(config);

  console.log(`Workspace: ${client.workspace.displayName} (${client.workspace.id})`);

  const [
    companies,
    people,
    opportunities,
    tasks,
    notes,
    taskTargets,
    noteTargets,
  ] = await Promise.all([
    fetchAll(client, 'companies'),
    fetchAll(client, 'people'),
    fetchAll(client, 'opportunities'),
    fetchAll(client, 'tasks'),
    fetchAll(client, 'notes'),
    fetchAll(client, 'taskTargets'),
    fetchAll(client, 'noteTargets'),
  ]);

  const companyTerritoryById = new Map(
    companies
      .map((company) => [company.id, normalizeTerritory(company.companyCountry)])
      .filter(([, territory]) => territory),
  );
  const personById = new Map(people.map((person) => [person.id, person]));
  const opportunityById = new Map(
    opportunities.map((opportunity) => [opportunity.id, opportunity]),
  );

  const actions = [];

  for (const person of people) {
    if (normalizeTerritory(person.personTerritory)) {
      continue;
    }

    const companyId = relationId(person, 'company');
    const territory = companyId ? companyTerritoryById.get(companyId) : null;

    if (territory) {
      actions.push({
        object: 'people',
        id: person.id,
        label: person.name?.firstName
          ? `${person.name.firstName} ${person.name.lastName ?? ''}`.trim()
          : person.id,
        data: { personTerritory: territory },
      });
    }
  }

  for (const opportunity of opportunities) {
    if (normalizeTerritory(opportunity.projectCountry)) {
      continue;
    }

    const companyId = relationId(opportunity, 'company');
    const territory = companyId ? companyTerritoryById.get(companyId) : null;

    if (territory) {
      actions.push({
        object: 'opportunities',
        id: opportunity.id,
        label: opportunity.name ?? opportunity.id,
        data: { projectCountry: territory },
      });
    }
  }

  const taskTargetsByTaskId = groupBy(taskTargets, (taskTarget) =>
    relationId(taskTarget, 'task'),
  );

  for (const task of tasks) {
    if (normalizeTerritory(task.taskTerritory)) {
      continue;
    }

    const territory = inferTaskTerritory({
      taskTargets: taskTargetsByTaskId.get(task.id) ?? [],
      companyTerritoryById,
      personById,
      opportunityById,
    });

    if (territory) {
      actions.push({
        object: 'tasks',
        id: task.id,
        label: task.title ?? task.id,
        data: { taskTerritory: territory },
      });
    }
  }

  const noteTargetsByNoteId = groupBy(noteTargets, (noteTarget) =>
    relationId(noteTarget, 'note'),
  );

  for (const note of notes) {
    if (normalizeTerritory(note.noteTerritory)) {
      continue;
    }

    const territory = inferNoteTerritory({
      noteTargets: noteTargetsByNoteId.get(note.id) ?? [],
      companyTerritoryById,
      personById,
      opportunityById,
    });

    if (territory) {
      actions.push({
        object: 'notes',
        id: note.id,
        label: note.title ?? note.id,
        data: { noteTerritory: territory },
      });
    }
  }

  const counts = actions.reduce((acc, action) => {
    acc[action.object] = (acc[action.object] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`Backfill actions planned: ${actions.length}`);
  console.log(JSON.stringify(counts, null, 2));

  if (actions.length === 0) {
    console.log('No territory backfill changes needed.');
    return;
  }

  if (isDryRun) {
    actions.slice(0, 20).forEach((action) => {
      console.log(
        `Would update ${action.object}/${action.id} (${action.label}) -> ${JSON.stringify(action.data)}`,
      );
    });
    console.log('Dry run complete. No records were changed.');
    return;
  }

  await ensureBackup();

  for (const action of actions) {
    await client.rest(
      'PATCH',
      `/rest/${action.object}/${encodeURIComponent(action.id)}`,
      action.data,
    );
    console.log(`Updated ${action.object}/${action.id}: ${JSON.stringify(action.data)}`);
  }

  console.log('Territory backfill complete.');
}

function inferTaskTerritory({
  taskTargets,
  companyTerritoryById,
  personById,
  opportunityById,
}) {
  for (const taskTarget of taskTargets) {
    const opportunityId = relationId(taskTarget, 'opportunity');
    const opportunity = opportunityId ? opportunityById.get(opportunityId) : null;
    const opportunityTerritory = normalizeTerritory(opportunity?.projectCountry);

    if (opportunityTerritory) {
      return opportunityTerritory;
    }

    const opportunityCompanyId = opportunity ? relationId(opportunity, 'company') : null;
    const opportunityCompanyTerritory = opportunityCompanyId
      ? companyTerritoryById.get(opportunityCompanyId)
      : null;

    if (opportunityCompanyTerritory) {
      return opportunityCompanyTerritory;
    }
  }

  for (const taskTarget of taskTargets) {
    const companyId = relationId(taskTarget, 'company');
    const companyTerritory = companyId ? companyTerritoryById.get(companyId) : null;

    if (companyTerritory) {
      return companyTerritory;
    }
  }

  for (const taskTarget of taskTargets) {
    const personId = relationId(taskTarget, 'person');
    const person = personId ? personById.get(personId) : null;
    const personTerritory = normalizeTerritory(person?.personTerritory);

    if (personTerritory) {
      return personTerritory;
    }

    const personCompanyId = person ? relationId(person, 'company') : null;
    const personCompanyTerritory = personCompanyId
      ? companyTerritoryById.get(personCompanyId)
      : null;

    if (personCompanyTerritory) {
      return personCompanyTerritory;
    }
  }

  return null;
}

function inferNoteTerritory({
  noteTargets,
  companyTerritoryById,
  personById,
  opportunityById,
}) {
  const territories = new Set();

  for (const noteTarget of noteTargets) {
    addTerritory(
      territories,
      inferOpportunityTerritory(
        relationId(noteTarget, 'opportunity'),
        opportunityById,
        companyTerritoryById,
      ),
    );
    addTerritory(
      territories,
      inferCompanyTerritory(relationId(noteTarget, 'company'), companyTerritoryById),
    );
    addTerritory(
      territories,
      inferPersonTerritory(
        relationId(noteTarget, 'person'),
        personById,
        companyTerritoryById,
      ),
    );
  }

  return territories.size === 1 ? [...territories][0] : null;
}

function inferOpportunityTerritory(
  opportunityId,
  opportunityById,
  companyTerritoryById,
) {
  const opportunity = opportunityId ? opportunityById.get(opportunityId) : null;
  const opportunityTerritory = normalizeTerritory(opportunity?.projectCountry);

  if (opportunityTerritory) {
    return opportunityTerritory;
  }

  const companyId = opportunity ? relationId(opportunity, 'company') : null;

  return inferCompanyTerritory(companyId, companyTerritoryById);
}

function inferCompanyTerritory(companyId, companyTerritoryById) {
  return companyId ? companyTerritoryById.get(companyId) ?? null : null;
}

function inferPersonTerritory(personId, personById, companyTerritoryById) {
  const person = personId ? personById.get(personId) : null;
  const personTerritory = normalizeTerritory(person?.personTerritory);

  if (personTerritory) {
    return personTerritory;
  }

  const companyId = person ? relationId(person, 'company') : null;

  return inferCompanyTerritory(companyId, companyTerritoryById);
}

function addTerritory(territories, territory) {
  if (territory) {
    territories.add(territory);
  }
}

function relationId(record, relationName) {
  return (
    record?.[`${relationName}Id`] ??
    record?.[relationName]?.id ??
    record?.[relationName]?.edges?.[0]?.node?.id ??
    null
  );
}

function normalizeTerritory(value) {
  return typeof value === 'string' && TERRITORIES.has(value) ? value : null;
}

function groupBy(items, keyGetter) {
  const groups = new Map();

  for (const item of items) {
    const key = keyGetter(item);

    if (!key) {
      continue;
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(item);
  }

  return groups;
}
