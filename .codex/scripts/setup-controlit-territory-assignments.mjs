#!/usr/bin/env node

import {
  createBackupOnce,
  createCrmClient,
  fetchAll,
  loadConfig,
  parseCommonArgs,
  runRemotePsql,
  sqlString,
  sqlTextArray,
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
]);

const { isDryRun, skipBackup } = parseCommonArgs();
const config = loadConfig();
const ensureBackup = createBackupOnce({
  config,
  isDryRun,
  skipBackup,
  prefix: 'controlit-territory-assignments',
});

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function main() {
  const assignments = parseAssignments();
  const client = await createCrmClient(config);
  const workspaceMembers = await fetchAll(client, 'workspaceMembers');
  const workspaceMembersByEmail = new Map(
    workspaceMembers
      .filter((member) => member.userEmail)
      .map((member) => [member.userEmail.toLowerCase(), member]),
  );

  console.log(`Workspace: ${client.workspace.displayName} (${client.workspace.id})`);
  console.log(`Assignments requested: ${assignments.length}`);

  const rows = assignments.map((assignment) => {
    const workspaceMember = workspaceMembersByEmail.get(
      assignment.email.toLowerCase(),
    );

    if (!workspaceMember) {
      throw new Error(`Workspace member not found for email: ${assignment.email}`);
    }

    return {
      ...assignment,
      workspaceMemberId: workspaceMember.id,
      workspaceMemberName: workspaceMember.name,
    };
  });

  for (const row of rows) {
    console.log(
      `${row.email}: ${row.territories.join(', ')}; canManageTerritory=${row.canManageTerritory}`,
    );
  }

  if (isDryRun) {
    console.log('Dry run complete. No assignments were changed.');
    return;
  }

  await ensureBackup();
  await runRemotePsql(config, buildUpsertSql(client.workspace.id, rows));

  console.log('Territory assignments setup complete.');
}

function parseAssignments() {
  const raw = process.env.CONTROLIT_TERRITORY_ASSIGNMENTS;

  if (!raw) {
    throw new Error(
      'Missing CONTROLIT_TERRITORY_ASSIGNMENTS JSON. Example: ' +
        `'[{"email":"manager@example.com","territories":["FINLAND"],"canManageTerritory":false}]'`,
    );
  }

  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('CONTROLIT_TERRITORY_ASSIGNMENTS must be a JSON array.');
  }

  return parsed.map((assignment, index) => {
    if (!assignment || typeof assignment !== 'object') {
      throw new Error(`Assignment at index ${index} must be an object.`);
    }

    if (typeof assignment.email !== 'string' || assignment.email.trim() === '') {
      throw new Error(`Assignment at index ${index} is missing email.`);
    }

    if (!Array.isArray(assignment.territories)) {
      throw new Error(`Assignment for ${assignment.email} is missing territories.`);
    }

    const territories = assignment.territories.map((territory) =>
      String(territory).trim().toUpperCase(),
    );
    const invalidTerritories = territories.filter(
      (territory) => !TERRITORIES.has(territory),
    );

    if (invalidTerritories.length > 0) {
      throw new Error(
        `Assignment for ${assignment.email} has invalid territories: ${invalidTerritories.join(', ')}`,
      );
    }

    return {
      email: assignment.email.trim(),
      territories,
      canManageTerritory: assignment.canManageTerritory === true,
    };
  });
}

function buildUpsertSql(workspaceId, rows) {
  const values = rows
    .map(
      (row) => `(
        uuid_generate_v4(),
        ${sqlString(workspaceId)}::uuid,
        ${sqlString(row.workspaceMemberId)}::uuid,
        ${sqlTextArray(row.territories)},
        ${row.canManageTerritory ? 'true' : 'false'},
        now(),
        now()
      )`,
    )
    .join(',\n');

  return `
    INSERT INTO "core"."controlitTerritoryAccess" (
      "id",
      "workspaceId",
      "workspaceMemberId",
      "territories",
      "canManageTerritory",
      "createdAt",
      "updatedAt"
    )
    VALUES
    ${values}
    ON CONFLICT ("workspaceId", "workspaceMemberId")
    DO UPDATE SET
      "territories" = EXCLUDED."territories",
      "canManageTerritory" = EXCLUDED."canManageTerritory",
      "updatedAt" = now();
  `;
}
