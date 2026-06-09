#!/usr/bin/env node

import { createWriteStream, mkdirSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

export const DEFAULT_BASE_URL = 'https://crm.controlitfactory.eu';
export const DEFAULT_SSH_HOST = 'controlit-crm-vps';
export const DEFAULT_REMOTE_DIR = '/opt/controlit-crm';
export const DEFAULT_DB_SERVICE = 'db';
export const DEFAULT_DB_USER = 'controlit_user';
export const DEFAULT_DB_NAME = 'default';
export const DEFAULT_BACKUP_DIR = '.codex/backups';

export function parseCommonArgs() {
  const args = process.argv.slice(2);

  return {
    args,
    isDryRun:
      args.includes('--dry-run') ||
      !args.includes('--apply') ||
      process.env.DRY_RUN === '1',
    skipBackup: args.includes('--skip-backup') || process.env.SKIP_BACKUP === '1',
  };
}

export function loadConfig() {
  return {
    baseUrl: trimTrailingSlash(process.env.CRM_BASE_URL ?? DEFAULT_BASE_URL),
    adminEmail: process.env.CRM_ADMIN_EMAIL,
    adminPassword: process.env.CRM_ADMIN_PASSWORD,
    workspaceId: process.env.CRM_WORKSPACE_ID,
    backupDir: resolve(process.env.CRM_BACKUP_DIR ?? DEFAULT_BACKUP_DIR),
    sshHost: process.env.CRM_SSH_HOST ?? DEFAULT_SSH_HOST,
    remoteDir: process.env.CRM_REMOTE_DIR ?? DEFAULT_REMOTE_DIR,
    dbService: process.env.CRM_DB_SERVICE ?? DEFAULT_DB_SERVICE,
    dbUser: process.env.CRM_DB_USER ?? DEFAULT_DB_USER,
    dbName: process.env.CRM_DB_NAME ?? DEFAULT_DB_NAME,
  };
}

export function validateAdminConfig(config) {
  const missing = [];

  if (!config.adminEmail) {
    missing.push('CRM_ADMIN_EMAIL');
  }

  if (!config.adminPassword) {
    missing.push('CRM_ADMIN_PASSWORD');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

export async function createCrmClient(config) {
  validateAdminConfig(config);

  const signInData = await metadataRequest(config, {
    query: `
      mutation SignIn($email: String!, $password: String!) {
        signIn(email: $email, password: $password) {
          availableWorkspaces {
            availableWorkspacesForSignIn {
              id
              displayName
              loginToken
              workspaceUrls {
                customUrl
                subdomainUrl
              }
            }
          }
        }
      }
    `,
    variables: {
      email: config.adminEmail,
      password: config.adminPassword,
    },
  });

  const workspaces =
    signInData.signIn.availableWorkspaces.availableWorkspacesForSignIn;
  const workspace = config.workspaceId
    ? workspaces.find((candidate) => candidate.id === config.workspaceId)
    : workspaces[0];

  if (!workspace) {
    throw new Error(`Workspace not found for CRM_WORKSPACE_ID=${config.workspaceId}`);
  }

  const authData = await metadataRequest(config, {
    query: `
      mutation GetAuthTokensFromLoginToken($loginToken: String!, $origin: String!) {
        getAuthTokensFromLoginToken(loginToken: $loginToken, origin: $origin) {
          tokens {
            accessOrWorkspaceAgnosticToken {
              token
            }
          }
        }
      }
    `,
    variables: {
      loginToken: workspace.loginToken,
      origin:
        workspace.workspaceUrls.customUrl ??
        workspace.workspaceUrls.subdomainUrl ??
        config.baseUrl,
    },
  });

  const token =
    authData.getAuthTokensFromLoginToken.tokens.accessOrWorkspaceAgnosticToken
      .token;

  return {
    token,
    workspace,
    async metadata(query, variables = {}) {
      return metadataRequest(config, { query, variables, token });
    },
    async rest(method, path, body) {
      return restRequest(config, { method, path, body, token });
    },
  };
}

export async function fetchAll(client, objectNamePlural) {
  const records = [];
  let after = '';

  while (true) {
    const params = new URLSearchParams({ limit: '1000' });

    if (after) {
      params.set('starting_after', after);
    }

    const response = await client.rest(
      'GET',
      `/rest/${objectNamePlural}?${params.toString()}`,
    );
    const batch = response.data?.[objectNamePlural] ?? [];

    records.push(...batch);

    const pageInfo = response.pageInfo ?? {};

    if (!pageInfo.hasNextPage) {
      break;
    }

    after = pageInfo.endCursor;

    if (!after) {
      break;
    }
  }

  return records;
}

export function createBackupOnce({ config, isDryRun, skipBackup, prefix }) {
  let backupPromise;

  return async () => {
    if (isDryRun) {
      return;
    }

    if (skipBackup) {
      console.log('Backup skipped by --skip-backup / SKIP_BACKUP=1.');
      return;
    }

    if (!backupPromise) {
      backupPromise = createDatabaseBackup(config, prefix);
    }

    return backupPromise;
  };
}

export async function createDatabaseBackup(config, prefix) {
  mkdirSync(config.backupDir, { recursive: true });

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '')
    .replace('T', '-');
  const backupPath = resolve(config.backupDir, `${prefix}-${timestamp}.sql.gz`);
  const outputStream = createWriteStream(backupPath, { flags: 'wx' });
  const remoteCommand = [
    `cd ${shellQuote(config.remoteDir)}`,
    '&&',
    'docker compose exec -T',
    shellQuote(config.dbService),
    'pg_dump',
    '-U',
    shellQuote(config.dbUser),
    shellQuote(config.dbName),
    '| gzip -c',
  ].join(' ');

  console.log(`Creating database backup: ${backupPath}`);

  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('ssh', [config.sshHost, remoteCommand], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stderr = [];
    let childClosed = false;
    let outputFinished = false;

    const settle = () => {
      if (!childClosed || !outputFinished) {
        return;
      }

      resolvePromise();
    };

    child.stdout.pipe(outputStream);
    child.stderr.on('data', (chunk) => stderr.push(chunk.toString()));
    child.on('error', rejectPromise);
    outputStream.on('finish', () => {
      outputFinished = true;
      settle();
    });
    outputStream.on('error', rejectPromise);
    child.on('close', (code) => {
      if (code === 0) {
        childClosed = true;
        outputStream.end();
        settle();
        return;
      }

      outputStream.destroy();

      try {
        unlinkSync(backupPath);
      } catch {
        // The backup file may not have been created yet.
      }

      rejectPromise(
        new Error(`Database backup failed with exit code ${code}: ${stderr.join('')}`),
      );
    });
  });

  console.log(`Backup complete: ${backupPath}`);
  return backupPath;
}

export async function runRemotePsql(config, sql) {
  const remoteCommand = [
    `cd ${shellQuote(config.remoteDir)}`,
    '&&',
    'docker compose exec -T',
    shellQuote(config.dbService),
    'psql',
    '-v ON_ERROR_STOP=1',
    '-U',
    shellQuote(config.dbUser),
    '-d',
    shellQuote(config.dbName),
  ].join(' ');

  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('ssh', [config.sshHost, remoteCommand], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];

    child.stdout.on('data', (chunk) => stdout.push(chunk.toString()));
    child.stderr.on('data', (chunk) => stderr.push(chunk.toString()));
    child.on('error', rejectPromise);
    child.on('close', (code) => {
      if (code === 0) {
        if (stdout.length > 0) {
          console.log(stdout.join('').trim());
        }
        resolvePromise();
        return;
      }

      rejectPromise(
        new Error(`Remote psql failed with exit code ${code}: ${stderr.join('')}`),
      );
    });
    child.stdin.end(sql);
  });
}

async function metadataRequest(config, { query, variables = {}, token }) {
  const response = await fetch(`${config.baseUrl}/metadata`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await parseJson(response);

  if (!response.ok || payload?.errors) {
    throw new Error(`Metadata request failed: ${formatApiError(response, payload)}`);
  }

  return payload.data;
}

async function restRequest(config, { method, path, body, token }) {
  const response = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${formatApiError(response, payload)}`);
  }

  return payload;
}

async function parseJson(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function formatApiError(response, payload) {
  return JSON.stringify({
    status: response.status,
    statusText: response.statusText,
    errors: payload?.errors,
    message: payload?.message,
    raw: payload?.raw,
  });
}

export function sqlString(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

export function sqlTextArray(values) {
  return `ARRAY[${values.map(sqlString).join(', ')}]::text[]`;
}

export function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function trimTrailingSlash(value) {
  return value.replace(/\/$/, '');
}
