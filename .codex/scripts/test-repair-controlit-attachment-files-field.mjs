#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ATTACHMENT_FILE_FIELD_UNIVERSAL_IDENTIFIER,
  buildApplySql,
  buildDryRunSql,
} from './repair-controlit-attachment-files-field.mjs';

const config = {
  workspaceId: '63c3e463-fa79-4e0e-8f48-1363976393df',
};

test('dry run reports attachment file metadata and workspace column state', () => {
  const sql = buildDryRunSql(config);

  assert.match(sql, /nameSingular" = 'attachment'/);
  assert.match(sql, /field\."name" = 'file'/);
  assert.match(sql, /column_name" = 'file'/);
  assert.match(sql, new RegExp(ATTACHMENT_FILE_FIELD_UNIVERSAL_IDENTIFIER));
});

test('apply creates the standard FILES metadata and jsonb column idempotently', () => {
  const sql = buildApplySql(config);

  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "file" jsonb/);
  assert.match(sql, /INSERT INTO "core"\."fieldMetadata"/);
  assert.match(sql, /'FILES'/);
  assert.match(sql, /'File'/);
  assert.match(sql, /'Attachment file'/);
  assert.match(sql, /'IconFileUpload'/);
  assert.match(sql, /jsonb_build_object\('maxNumberOfValues', 1\)/);
  assert.match(sql, /ON CONFLICT \("workspaceId", "universalIdentifier"\)/);
  assert.match(sql, /"metadataVersion" = "metadataVersion" \+ 1/);
});
