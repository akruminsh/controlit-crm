#!/usr/bin/env node

import { spawn } from 'node:child_process';

import {
  createBackupOnce,
  loadConfig,
  parseCommonArgs,
  runRemotePsql,
  shellQuote,
  sqlString,
} from './controlit-crm-client.mjs';

const ROLE_LABEL = 'Territory Contributor';
const ROLE_DESCRIPTION =
  'Can view assigned territory data and create/update own Projects and Tasks within assigned territories.';
const ROLE_ICON = 'IconUserCheck';
const ROLE_UNIVERSAL_IDENTIFIER = 'f82b25b2-9bbb-4de4-9ebc-88404763f5b0';
const PILOT_EMAIL = 'ak@marketinghackers.lv';
const READ_OBJECTS = ['company', 'person', 'opportunity', 'task', 'note'];
const UPDATE_OBJECTS = ['opportunity', 'task'];

const { args, isDryRun, skipBackup } = parseCommonArgs();
const shouldAssignPilot = args.includes('--assign-pilot');
const config = loadConfig();
const ensureBackup = createBackupOnce({
  config,
  isDryRun,
  skipBackup,
  prefix: 'controlit-territory-contributor-role',
});

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function main() {
  if (isDryRun) {
    await runRemotePsql(config, buildDryRunSql());
    console.log('Dry run complete. No role changes were applied.');
    return;
  }

  await ensureBackup();
  await runRemotePsql(config, buildApplySql());
  await flushRemoteCache(config);
  console.log('Territory contributor role DB setup complete.');
}

function workspaceScopeSql() {
  return `
    "workspaceScope" AS (
      SELECT "id", "workspaceCustomApplicationId"
      FROM "core"."workspace"
      WHERE ${sqlString(config.workspaceId)}::uuid IS NULL
        OR "id" = ${sqlString(config.workspaceId)}::uuid
      ORDER BY "createdAt" ASC
      LIMIT 1
    )
  `;
}

function buildDryRunSql() {
  return `
    WITH ${workspaceScopeSql()}
    SELECT
      'workspace' AS "item",
      "id"::text AS "id",
      NULL::text AS "details"
    FROM "workspaceScope";

    WITH ${workspaceScopeSql()}
    SELECT
      'role' AS "item",
      COALESCE(role."id"::text, '<missing>') AS "id",
      CONCAT(
        role."label",
        ', canReadAll=',
        COALESCE(role."canReadAllObjectRecords"::text, '<missing>'),
        ', canUpdateAll=',
        COALESCE(role."canUpdateAllObjectRecords"::text, '<missing>')
      ) AS "details"
    FROM "workspaceScope" workspace
    LEFT JOIN "core"."role" role
      ON role."workspaceId" = workspace."id"
      AND role."label" = ${sqlString(ROLE_LABEL)};

    WITH ${workspaceScopeSql()}
    SELECT
      'object-permission' AS "item",
      object."nameSingular" AS "id",
      CONCAT(
        'canRead=', COALESCE(permission."canReadObjectRecords"::text, '<missing>'),
        ', canUpdate=', COALESCE(permission."canUpdateObjectRecords"::text, '<missing>'),
        ', canSoftDelete=', COALESCE(permission."canSoftDeleteObjectRecords"::text, '<missing>'),
        ', canDestroy=', COALESCE(permission."canDestroyObjectRecords"::text, '<missing>')
      ) AS "details"
    FROM "workspaceScope" workspace
    JOIN "core"."objectMetadata" object
      ON object."workspaceId" = workspace."id"
      AND object."nameSingular" IN (${READ_OBJECTS.map(sqlString).join(', ')})
    LEFT JOIN "core"."role" role
      ON role."workspaceId" = workspace."id"
      AND role."label" = ${sqlString(ROLE_LABEL)}
    LEFT JOIN "core"."objectPermission" permission
      ON permission."roleId" = role."id"
      AND permission."objectMetadataId" = object."id"
    ORDER BY object."nameSingular";

    WITH ${workspaceScopeSql()}
    SELECT
      'pilot-role' AS "item",
      "user"."email" AS "id",
      COALESCE(role."label", '<no role>') AS "details"
    FROM "workspaceScope" workspace
    JOIN "core"."userWorkspace" userWorkspace
      ON userWorkspace."workspaceId" = workspace."id"
    JOIN "core"."user" "user"
      ON "user"."id" = userWorkspace."userId"
      AND LOWER("user"."email") = LOWER(${sqlString(PILOT_EMAIL)})
    LEFT JOIN "core"."roleTarget" roleTarget
      ON roleTarget."workspaceId" = workspace."id"
      AND roleTarget."userWorkspaceId" = userWorkspace."id"
    LEFT JOIN "core"."role" role
      ON role."id" = roleTarget."roleId";
  `;
}

function buildApplySql() {
  const pilotSql = shouldAssignPilot
    ? `
      ,
      "pilotUserWorkspace" AS (
        SELECT userWorkspace."id"
        FROM "workspaceScope" workspace
        JOIN "core"."userWorkspace" userWorkspace
          ON userWorkspace."workspaceId" = workspace."id"
        JOIN "core"."user" "user"
          ON "user"."id" = userWorkspace."userId"
          AND LOWER("user"."email") = LOWER(${sqlString(PILOT_EMAIL)})
        LIMIT 1
      ),
      "deletedPilotRoleTargets" AS (
        DELETE FROM "core"."roleTarget" roleTarget
        USING "workspaceScope" workspace, "pilotUserWorkspace" pilot
        WHERE roleTarget."workspaceId" = workspace."id"
          AND roleTarget."userWorkspaceId" = pilot."id"
        RETURNING roleTarget."id"
      ),
      "insertedPilotRoleTarget" AS (
        INSERT INTO "core"."roleTarget" (
          "id",
          "universalIdentifier",
          "applicationId",
          "workspaceId",
          "roleId",
          "userWorkspaceId",
          "createdAt",
          "updatedAt"
        )
        SELECT
          uuid_generate_v4(),
          uuid_generate_v5(
            uuid_ns_url(),
            CONCAT(${sqlString(ROLE_UNIVERSAL_IDENTIFIER)}, ':roleTarget:', pilot."id"::text)
          ),
          application."id",
          workspace."id",
          role."id",
          pilot."id",
          now(),
          now()
        FROM "workspaceScope" workspace
        JOIN "applicationScope" application ON true
        JOIN "upsertedRole" role ON true
        JOIN "pilotUserWorkspace" pilot ON true
        RETURNING "id", "userWorkspaceId"
      )
    `
    : '';

  const pilotSelectSql = shouldAssignPilot
    ? `
      UNION ALL
      SELECT
        'pilot-role-assigned',
        COALESCE((SELECT "id"::text FROM "insertedPilotRoleTarget"), '<pilot missing>')
    `
    : '';

  return `
    WITH
      ${workspaceScopeSql()},
      "applicationScope" AS (
        SELECT workspace."workspaceCustomApplicationId" AS "id"
        FROM "workspaceScope" workspace
        WHERE workspace."workspaceCustomApplicationId" IS NOT NULL
      ),
      "upsertedRole" AS (
        INSERT INTO "core"."role" (
          "id",
          "universalIdentifier",
          "applicationId",
          "label",
          "description",
          "icon",
          "canUpdateAllSettings",
          "canAccessAllTools",
          "canReadAllObjectRecords",
          "canUpdateAllObjectRecords",
          "canSoftDeleteAllObjectRecords",
          "canDestroyAllObjectRecords",
          "canBeAssignedToUsers",
          "canBeAssignedToAgents",
          "canBeAssignedToApiKeys",
          "isEditable",
          "workspaceId",
          "createdAt",
          "updatedAt"
        )
        SELECT
          uuid_generate_v4(),
          ${sqlString(ROLE_UNIVERSAL_IDENTIFIER)}::uuid,
          application."id",
          ${sqlString(ROLE_LABEL)},
          ${sqlString(ROLE_DESCRIPTION)},
          ${sqlString(ROLE_ICON)},
          false,
          false,
          false,
          false,
          false,
          false,
          true,
          false,
          false,
          true,
          workspace."id",
          now(),
          now()
        FROM "workspaceScope" workspace
        JOIN "applicationScope" application ON true
        ON CONFLICT ("label", "workspaceId")
        DO UPDATE SET
          "universalIdentifier" = EXCLUDED."universalIdentifier",
          "applicationId" = EXCLUDED."applicationId",
          "description" = EXCLUDED."description",
          "icon" = EXCLUDED."icon",
          "canUpdateAllSettings" = EXCLUDED."canUpdateAllSettings",
          "canAccessAllTools" = EXCLUDED."canAccessAllTools",
          "canReadAllObjectRecords" = EXCLUDED."canReadAllObjectRecords",
          "canUpdateAllObjectRecords" = EXCLUDED."canUpdateAllObjectRecords",
          "canSoftDeleteAllObjectRecords" = EXCLUDED."canSoftDeleteAllObjectRecords",
          "canDestroyAllObjectRecords" = EXCLUDED."canDestroyAllObjectRecords",
          "canBeAssignedToUsers" = EXCLUDED."canBeAssignedToUsers",
          "canBeAssignedToAgents" = EXCLUDED."canBeAssignedToAgents",
          "canBeAssignedToApiKeys" = EXCLUDED."canBeAssignedToApiKeys",
          "isEditable" = EXCLUDED."isEditable",
          "updatedAt" = now()
        RETURNING "id", "workspaceId"
      ),
      "upsertedObjectPermissions" AS (
        INSERT INTO "core"."objectPermission" (
          "id",
          "universalIdentifier",
          "applicationId",
          "roleId",
          "objectMetadataId",
          "canReadObjectRecords",
          "canUpdateObjectRecords",
          "canSoftDeleteObjectRecords",
          "canDestroyObjectRecords",
          "workspaceId",
          "createdAt",
          "updatedAt"
        )
        SELECT
          uuid_generate_v4(),
          uuid_generate_v5(
            uuid_ns_url(),
            CONCAT(${sqlString(ROLE_UNIVERSAL_IDENTIFIER)}, ':objectPermission:', object."nameSingular")
          ),
          application."id",
          role."id",
          object."id",
          true,
          object."nameSingular" IN (${UPDATE_OBJECTS.map(sqlString).join(', ')}),
          false,
          false,
          role."workspaceId",
          now(),
          now()
        FROM "upsertedRole" role
        JOIN "applicationScope" application ON true
        JOIN "core"."objectMetadata" object
          ON object."workspaceId" = role."workspaceId"
          AND object."nameSingular" IN (${READ_OBJECTS.map(sqlString).join(', ')})
        ON CONFLICT ("objectMetadataId", "roleId")
        DO UPDATE SET
          "universalIdentifier" = EXCLUDED."universalIdentifier",
          "applicationId" = EXCLUDED."applicationId",
          "canReadObjectRecords" = EXCLUDED."canReadObjectRecords",
          "canUpdateObjectRecords" = EXCLUDED."canUpdateObjectRecords",
          "canSoftDeleteObjectRecords" = EXCLUDED."canSoftDeleteObjectRecords",
          "canDestroyObjectRecords" = EXCLUDED."canDestroyObjectRecords",
          "updatedAt" = now()
        RETURNING "id", "objectMetadataId"
      )
      ${pilotSql}
    SELECT 'role-upserted' AS "item", (SELECT "id"::text FROM "upsertedRole") AS "id"
    UNION ALL
    SELECT 'object-permissions-upserted', COUNT(*)::text
    FROM "upsertedObjectPermissions"
    ${pilotSelectSql};
  `;
}

async function flushRemoteCache(remoteConfig) {
  const remoteCommand = [
    `cd ${shellQuote(remoteConfig.remoteDir)}`,
    '&&',
    'docker compose exec -T server',
    'yarn command:prod cache:flush',
  ].join(' ');

  console.log('Flushing CRM cache...');

  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('ssh', [remoteConfig.sshHost, remoteCommand], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];

    child.stdout.on('data', (chunk) => stdout.push(chunk.toString()));
    child.stderr.on('data', (chunk) => stderr.push(chunk.toString()));
    child.on('error', rejectPromise);
    child.on('close', (code) => {
      if (code === 0) {
        const output = [...stdout, ...stderr].join('').trim();

        if (output) {
          console.log(output);
        }

        resolvePromise();
        return;
      }

      rejectPromise(
        new Error(`Cache flush failed with exit code ${code}: ${stderr.join('')}`),
      );
    });
  });
}
