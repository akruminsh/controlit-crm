#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import {
  createBackupOnce,
  loadConfig,
  parseCommonArgs,
  runRemotePsql,
  shellQuote,
  sqlString,
} from './controlit-crm-client.mjs';

export const ATTACHMENT_FILE_FIELD_UNIVERSAL_IDENTIFIER =
  '20202020-15db-460e-8166-c7b5d87ad4be';

const ATTACHMENT_OBJECT_UNIVERSAL_IDENTIFIER =
  '20202020-bd3d-4c60-8dca-571c71d4447a';

export function buildDryRunSql(config) {
  return `
    WITH "workspaceScope" AS (
      SELECT "id", "databaseSchema", "metadataVersion"
      FROM "core"."workspace"
      WHERE "id" = ${sqlString(config.workspaceId)}::uuid
    ),
    "attachmentObject" AS (
      SELECT object.*
      FROM "core"."objectMetadata" object
      JOIN "workspaceScope" workspace
        ON workspace."id" = object."workspaceId"
      WHERE object."nameSingular" = 'attachment'
        AND object."universalIdentifier" =
          ${sqlString(ATTACHMENT_OBJECT_UNIVERSAL_IDENTIFIER)}::uuid
    )
    SELECT
      workspace."id" AS "workspaceId",
      workspace."databaseSchema",
      workspace."metadataVersion",
      object."id" AS "attachmentObjectId",
      field."id" AS "fileFieldId",
      field."name" AS "fileFieldName",
      field."type" AS "fileFieldType",
      field."universalIdentifier" AS "fileFieldUniversalIdentifier",
      columns."data_type" AS "fileColumnType"
    FROM "workspaceScope" workspace
    LEFT JOIN "attachmentObject" object ON true
    LEFT JOIN "core"."fieldMetadata" field
      ON field."objectMetadataId" = object."id"
      AND field."workspaceId" = workspace."id"
      AND field."name" = 'file'
      AND field."universalIdentifier" =
        ${sqlString(ATTACHMENT_FILE_FIELD_UNIVERSAL_IDENTIFIER)}::uuid
    LEFT JOIN "information_schema"."columns" columns
      ON columns."table_schema" = workspace."databaseSchema"
      AND columns."table_name" = 'attachment'
      AND columns."column_name" = 'file';
  `;
}

export function buildApplySql(config) {
  return `
    BEGIN;

    SELECT pg_advisory_xact_lock(
      hashtext('controlit:repair-attachment-file-field')
    );

    CREATE TEMP TABLE "controlitAttachmentFileRepair" (
      "workspaceId" uuid PRIMARY KEY
    ) ON COMMIT DROP;

    INSERT INTO "controlitAttachmentFileRepair" ("workspaceId")
    SELECT workspace."id"
    FROM "core"."workspace" workspace
    JOIN "core"."objectMetadata" object
      ON object."workspaceId" = workspace."id"
      AND object."nameSingular" = 'attachment'
      AND object."universalIdentifier" =
        ${sqlString(ATTACHMENT_OBJECT_UNIVERSAL_IDENTIFIER)}::uuid
    LEFT JOIN "core"."fieldMetadata" field
      ON field."objectMetadataId" = object."id"
      AND field."workspaceId" = workspace."id"
      AND field."name" = 'file'
    LEFT JOIN "information_schema"."columns" columns
      ON columns."table_schema" = workspace."databaseSchema"
      AND columns."table_name" = 'attachment'
      AND columns."column_name" = 'file'
    WHERE workspace."id" = ${sqlString(config.workspaceId)}::uuid
      AND (
        field."id" IS NULL
        OR field."universalIdentifier" IS DISTINCT FROM
          ${sqlString(ATTACHMENT_FILE_FIELD_UNIVERSAL_IDENTIFIER)}::uuid
        OR field."type" IS DISTINCT FROM 'FILES'
        OR field."settings" IS DISTINCT FROM
          jsonb_build_object('maxNumberOfValues', 1)
        OR columns."column_name" IS NULL
        OR columns."data_type" IS DISTINCT FROM 'jsonb'
      );

    DO $repair$
    DECLARE
      workspace_schema text;
    BEGIN
      SELECT workspace."databaseSchema"
      INTO workspace_schema
      FROM "core"."workspace" workspace
      WHERE workspace."id" = ${sqlString(config.workspaceId)}::uuid;

      IF workspace_schema IS NULL THEN
        RAISE EXCEPTION 'Workspace or database schema not found';
      END IF;

      EXECUTE format(
        'ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS "file" jsonb',
        workspace_schema,
        'attachment'
      );
    END
    $repair$;

    UPDATE "core"."fieldMetadata" field
    SET
      "universalIdentifier" =
        ${sqlString(ATTACHMENT_FILE_FIELD_UNIVERSAL_IDENTIFIER)}::uuid,
      "applicationId" = object."applicationId",
      "type" = 'FILES',
      "label" = 'File',
      "description" = 'Attachment file',
      "icon" = 'IconFileUpload',
      "defaultValue" = NULL,
      "standardOverrides" = NULL,
      "options" = NULL,
      "settings" = jsonb_build_object('maxNumberOfValues', 1),
      "isCustom" = false,
      "isActive" = true,
      "isSystem" = false,
      "isUIReadOnly" = true,
      "isNullable" = true,
      "isLabelSyncedWithName" = false,
      "updatedAt" = now()
    FROM "core"."objectMetadata" object
    WHERE field."objectMetadataId" = object."id"
      AND field."workspaceId" = ${sqlString(config.workspaceId)}::uuid
      AND object."workspaceId" = field."workspaceId"
      AND object."nameSingular" = 'attachment'
      AND field."name" = 'file';

    INSERT INTO "core"."fieldMetadata" (
      "id",
      "objectMetadataId",
      "type",
      "name",
      "label",
      "defaultValue",
      "description",
      "icon",
      "standardOverrides",
      "options",
      "settings",
      "isCustom",
      "isActive",
      "isSystem",
      "isUIReadOnly",
      "isNullable",
      "workspaceId",
      "isLabelSyncedWithName",
      "relationTargetFieldMetadataId",
      "relationTargetObjectMetadataId",
      "morphId",
      "createdAt",
      "updatedAt",
      "universalIdentifier",
      "applicationId"
    )
    SELECT
      uuid_generate_v5(
        uuid_ns_url(),
        CONCAT(
          workspace."id"::text,
          ':',
          ${sqlString(ATTACHMENT_FILE_FIELD_UNIVERSAL_IDENTIFIER)}
        )
      ),
      object."id",
      'FILES',
      'file',
      'File',
      NULL,
      'Attachment file',
      'IconFileUpload',
      NULL,
      NULL,
      jsonb_build_object('maxNumberOfValues', 1),
      false,
      true,
      false,
      true,
      true,
      workspace."id",
      false,
      NULL,
      NULL,
      NULL,
      now(),
      now(),
      ${sqlString(ATTACHMENT_FILE_FIELD_UNIVERSAL_IDENTIFIER)}::uuid,
      object."applicationId"
    FROM "core"."workspace" workspace
    JOIN "core"."objectMetadata" object
      ON object."workspaceId" = workspace."id"
      AND object."nameSingular" = 'attachment'
      AND object."universalIdentifier" =
        ${sqlString(ATTACHMENT_OBJECT_UNIVERSAL_IDENTIFIER)}::uuid
    WHERE workspace."id" = ${sqlString(config.workspaceId)}::uuid
      AND NOT EXISTS (
        SELECT 1
        FROM "core"."fieldMetadata" field
        WHERE field."workspaceId" = workspace."id"
          AND field."objectMetadataId" = object."id"
          AND field."name" = 'file'
      )
    ON CONFLICT ("workspaceId", "universalIdentifier")
    DO UPDATE SET
      "objectMetadataId" = EXCLUDED."objectMetadataId",
      "name" = EXCLUDED."name",
      "type" = EXCLUDED."type",
      "label" = EXCLUDED."label",
      "description" = EXCLUDED."description",
      "icon" = EXCLUDED."icon",
      "settings" = EXCLUDED."settings",
      "isCustom" = EXCLUDED."isCustom",
      "isActive" = EXCLUDED."isActive",
      "isSystem" = EXCLUDED."isSystem",
      "isUIReadOnly" = EXCLUDED."isUIReadOnly",
      "isNullable" = EXCLUDED."isNullable",
      "applicationId" = EXCLUDED."applicationId",
      "updatedAt" = now();

    UPDATE "core"."workspace" workspace
    SET
      "metadataVersion" = "metadataVersion" + 1,
      "updatedAt" = now()
    FROM "controlitAttachmentFileRepair" repair
    WHERE workspace."id" = repair."workspaceId";

    SELECT
      workspace."id" AS "workspaceId",
      workspace."metadataVersion",
      field."id" AS "fileFieldId",
      field."type" AS "fileFieldType",
      field."settings" AS "fileFieldSettings"
    FROM "core"."workspace" workspace
    JOIN "core"."objectMetadata" object
      ON object."workspaceId" = workspace."id"
      AND object."nameSingular" = 'attachment'
    JOIN "core"."fieldMetadata" field
      ON field."objectMetadataId" = object."id"
      AND field."name" = 'file'
    WHERE workspace."id" = ${sqlString(config.workspaceId)}::uuid;

    COMMIT;
  `;
}

async function flushRemoteCache(config) {
  const remoteCommand = [
    `cd ${shellQuote(config.remoteDir)}`,
    '&&',
    'docker compose exec -T server',
    'yarn command:prod cache:flush',
  ].join(' ');

  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('ssh', [config.sshHost, remoteCommand], {
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

async function main() {
  const { isDryRun, skipBackup } = parseCommonArgs();
  const config = loadConfig();

  if (!config.workspaceId) {
    throw new Error('CRM_WORKSPACE_ID is required.');
  }

  if (isDryRun) {
    await runRemotePsql(config, buildDryRunSql(config));
    console.log('Dry run complete. No attachment metadata was changed.');
    return;
  }

  const ensureBackup = createBackupOnce({
    config,
    isDryRun,
    skipBackup,
    prefix: 'controlit-attachment-files-field',
  });

  await ensureBackup();
  await runRemotePsql(config, buildApplySql(config));
  await flushRemoteCache(config);
  console.log('Attachment FILES field repair complete.');
}

const isMainModule =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
