# Controlit CRM Upgrade To Twenty v2.11 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Controlit CRM fork from its November 2025 Twenty base to the latest safe Twenty app release before inviting real partner users.

**Architecture:** Use the latest tagged Twenty app release as the new base, reapply the Controlit-specific layer in an isolated worktree, then rehearse database upgrade on a restored production backup before touching production. Production rollout uses the existing GitHub Actions to GHCR to VPS Docker Compose pipeline and includes a database backup, upgrade dry-run, upgrade apply, UI/API verification, and rollback path.

**Tech Stack:** Twenty CRM monorepo, Nx, Yarn 4, React, NestJS, TypeORM/PostgreSQL, Redis, Docker, GitHub Actions, GHCR, Hostinger VPS.

---

## Current Facts

- Current date: 2026-06-09.
- Production Controlit revision: `c9f496f54c62f7a3b57397bc90dfef881709bc9f`.
- Local old Twenty base: `main` at `1b308a7b74d4c364defc5cf2243d1da5f356b805` from 2025-11-12.
- Latest fetched Twenty app tag: `twenty/v2.11.1` at `ba4ac6b70e9558255e13251446d98c9a52d0b620`.
- Upstream `main` is `5f7638cdaf2839bf61bda26772a73a81755e2cf7` and is 17 commits ahead of `twenty/v2.11.1`.
- Use `twenty/v2.11.1` as the production upgrade target unless a newer `twenty/v*` tag is fetched and inspected immediately before execution.
- Do not target upstream `main` for production; it contains development commits beyond the latest app release tag.
- There are about 3797 upstream commits between the old base and `twenty/v2.11.1`.
- The existing deployment path is: push `controlit-main` -> GitHub Actions `Build and Push Controlit CRM` -> GHCR image `ghcr.io/akruminsh/controlit-crm:$IMAGE_TAG` -> VPS `/opt/controlit-crm` -> `docker compose pull server worker && docker compose up -d server worker`.
- Production uses Docker Compose services `server`, `worker`, `db`, and `redis`.
- Newer Twenty images run `yarn command:prod upgrade` from the Docker entrypoint, but the entrypoint only warns on upgrade errors. For this client, run the upgrade command explicitly and fail-fast before starting the app.

## Controlit Layer To Preserve

- Deployment:
  - `.github/workflows/controlit-build.yaml`
  - `deploy/docker-compose.prod.yml`
  - `deploy/update-crm.sh`
  - `deploy/setup-server.sh`
  - `deploy/.env.template`
- Branding and login:
  - `packages/twenty-front/src/modules/auth/components/Logo.tsx`
  - `packages/twenty-front/src/modules/auth/sign-in-up/components/FooterNote.tsx`
  - `packages/twenty-front/src/modules/auth/sign-in-up/components/internal/SignInUpWithCredentials.tsx`
  - `packages/twenty-front/src/pages/auth/SignInUp.tsx`
  - `packages/twenty-front/src/modules/ui/navigation/navigation-drawer/constants/DefaultWorkspaceName.ts`
  - `packages/twenty-ui/src/theme/constants/AccentDark.ts`
  - `packages/twenty-ui/src/theme/constants/AccentLight.ts`
  - Controlit image assets under `packages/twenty-front/public/images/`
- Onboarding email/calendar skip:
  - `packages/twenty-server/src/engine/core-modules/onboarding/onboarding.service.ts`
  - `packages/twenty-server/src/engine/core-modules/onboarding/onboarding.service.spec.ts`
  - `packages/twenty-front/src/modules/onboarding/hooks/useSetNextOnboardingStatus.ts`
  - `packages/twenty-front/src/modules/onboarding/hooks/__tests__/useSetNextOnboardingStatus.test.ts`
- Territory access:
  - `packages/twenty-server/src/modules/controlit/territory-access/**`
  - `packages/twenty-server/src/engine/api/graphql/workspace-query-runner/workspace-query-hook/workspace-query-hook.module.ts`
  - `packages/twenty-server/src/database/typeorm/core/migrations/common/1778750000000-addControlitTerritoryAccess.ts`
  - `.codex/scripts/setup-controlit-territory-metadata.mjs`
  - `.codex/scripts/setup-controlit-territory-assignments.mjs`
  - `.codex/scripts/backfill-controlit-territories.mjs`
  - `.codex/scripts/setup-controlit-territory-contributor-role-db.mjs`
- CRM import and metadata scripts:
  - `.codex/scripts/setup-project-card-metadata.mjs`
  - `.codex/scripts/setup-company-contact-metadata.py`
  - `.codex/scripts/crm_contact_import.py`

## Go / No-Go Rules

- No production deploy until staging upgrade on a restored DB backup succeeds.
- No real user invitations until post-upgrade pilot checks pass with `ak@marketinghackers.lv`.
- No production deploy from a dirty worktree.
- No production deploy from upstream `main`; use a `twenty/v*` release tag.
- No deploy if any of these fail: server typecheck, targeted Controlit tests, production image build, staging upgrade dry-run, staging upgrade apply, staging login, territory visibility, create own Project, create own Task.
- Rollback must be ready before production deploy: previous image SHA, DB backup path, and exact restore command.

---

### Task 1: Create The Isolated Upgrade Worktree

**Files:**
- Create worktree directory: `.worktrees/codex-controlit-upgrade-twenty-v2-11`
- Modify later inside that worktree only.

- [ ] **Step 1: Confirm latest Twenty app tag**

```bash
git fetch https://github.com/twentyhq/twenty.git 'refs/tags/twenty/v*:refs/tags/twenty/v*' 'refs/heads/main:refs/remotes/twenty-upstream/main'
git tag -l 'twenty/v*' --sort=-v:refname | sed -n '1,10p'
git show --no-patch --format='%H %ci %s' twenty/v2.11.1
git rev-list --count twenty/v2.11.1..twenty-upstream/main
```

Expected:
- `twenty/v2.11.1` exists.
- Upstream `main` may have extra commits; do not use them as the production base.

- [ ] **Step 2: Create worktree from the release tag**

```bash
git worktree add .worktrees/codex-controlit-upgrade-twenty-v2-11 twenty/v2.11.1 -b codex/controlit-upgrade-twenty-v2-11
cd .worktrees/codex-controlit-upgrade-twenty-v2-11
git status --short
```

Expected:
- Clean worktree.
- Branch is `codex/controlit-upgrade-twenty-v2-11`.

- [ ] **Step 3: Commit an upgrade-base marker**

```bash
git commit --allow-empty -m "chore: start Controlit upgrade from Twenty v2.11.1"
```

Expected:
- Empty marker commit makes the upgrade branch history easy to audit.

---

### Task 2: Reapply Deployment And Branding Layer

**Files:**
- Modify: `.github/workflows/controlit-build.yaml`
- Modify: `deploy/docker-compose.prod.yml`
- Modify: `deploy/update-crm.sh`
- Modify: `deploy/setup-server.sh`
- Modify: `deploy/.env.template`
- Modify: `packages/twenty-docker/twenty/Dockerfile`
- Modify: `packages/twenty-front/src/modules/auth/components/Logo.tsx`
- Modify: `packages/twenty-front/src/modules/auth/sign-in-up/components/FooterNote.tsx`
- Modify: `packages/twenty-front/src/modules/auth/sign-in-up/components/internal/SignInUpWithCredentials.tsx`
- Modify: `packages/twenty-front/src/pages/auth/SignInUp.tsx`
- Modify: `packages/twenty-front/src/modules/ui/navigation/navigation-drawer/constants/DefaultWorkspaceName.ts`
- Modify: `packages/twenty-ui/src/theme/constants/AccentDark.ts`
- Modify: `packages/twenty-ui/src/theme/constants/AccentLight.ts`
- Add/modify: `packages/twenty-front/public/images/controlit-logo.svg`
- Add/modify: `packages/twenty-front/public/images/controlit-icon.png`

- [ ] **Step 1: Apply only deployment and branding patch**

```bash
git diff --binary main...origin/controlit-main -- \
  .github/workflows/controlit-build.yaml \
  deploy \
  packages/twenty-docker/twenty/Dockerfile \
  packages/twenty-front/src/modules/auth/components/Logo.tsx \
  packages/twenty-front/src/modules/auth/sign-in-up/components/FooterNote.tsx \
  packages/twenty-front/src/modules/auth/sign-in-up/components/internal/SignInUpWithCredentials.tsx \
  packages/twenty-front/src/pages/auth/SignInUp.tsx \
  packages/twenty-front/src/modules/ui/navigation/navigation-drawer/constants/DefaultWorkspaceName.ts \
  packages/twenty-ui/src/theme/constants/AccentDark.ts \
  packages/twenty-ui/src/theme/constants/AccentLight.ts \
  packages/twenty-front/public/images \
  | git apply --3way
```

Expected:
- Patch applies or leaves explicit conflict files to resolve.
- Do not accept old Dockerfile wholesale if it removes upstream Node 24.16.0/OpenSSL/security changes.

- [ ] **Step 2: Preserve upstream Dockerfile base and labels**

Inspect:

```bash
rg -n "node:24.16.0|APP_VERSION|org.opencontainers.image.revision|REACT_APP_SERVER_BASE_URL|twenty-ui-deprecated|twenty-front-component-renderer" packages/twenty-docker/twenty/Dockerfile .github/workflows/controlit-build.yaml
```

Expected:
- Dockerfile still uses upstream `node:24.16.0-alpine3.23` base.
- Dockerfile still supports `ARG APP_VERSION`.
- Build workflow passes `APP_VERSION=${{ github.sha }}`.
- Build workflow builds target image for `crm.controlitfactory.eu`.

- [ ] **Step 3: Update production compose env for new Twenty requirements**

Edit `deploy/docker-compose.prod.yml` so both `server` and `worker` include these environment keys, preserving existing SMTP and local storage values:

```yaml
      NODE_ENV: production
      SERVER_URL: ${SERVER_URL}
      REDIS_URL: redis://redis:6379
      APP_SECRET: ${APP_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      FALLBACK_ENCRYPTION_KEY: ${FALLBACK_ENCRYPTION_KEY}
      STORAGE_TYPE: local
      DISABLE_DB_MIGRATIONS: ${DISABLE_DB_MIGRATIONS:-}
      DISABLE_CRON_JOBS_REGISTRATION: ${DISABLE_CRON_JOBS_REGISTRATION:-}
      MESSAGING_PROVIDER_GMAIL_ENABLED: "false"
      CALENDAR_PROVIDER_GOOGLE_ENABLED: "false"
      MESSAGING_PROVIDER_MICROSOFT_ENABLED: "false"
      CALENDAR_PROVIDER_MICROSOFT_ENABLED: "false"
```

For `worker`, keep:

```yaml
      DISABLE_DB_MIGRATIONS: "true"
      DISABLE_CRON_JOBS_REGISTRATION: "true"
```

Expected:
- New encrypted-secret upgrade commands can run.
- Email/calendar sync remains disabled, so the onboarding sync step remains skipped.

- [ ] **Step 4: Validate compose syntax**

```bash
docker compose -f deploy/docker-compose.prod.yml config >/tmp/controlit-compose-v2-11.yml
rg "ENCRYPTION_KEY|FALLBACK_ENCRYPTION_KEY|MESSAGING_PROVIDER_GMAIL_ENABLED|CALENDAR_PROVIDER_GOOGLE_ENABLED" /tmp/controlit-compose-v2-11.yml
```

Expected:
- Compose renders without errors.
- Required env keys are visible.

- [ ] **Step 5: Commit deployment and branding**

```bash
git add .github/workflows/controlit-build.yaml deploy packages/twenty-docker/twenty/Dockerfile packages/twenty-front packages/twenty-ui
git commit -m "chore: reapply Controlit branding and deployment on Twenty v2.11"
```

Expected:
- One focused commit.

---

### Task 3: Reapply Onboarding Email Sync Skip

**Files:**
- Modify: `packages/twenty-server/src/engine/core-modules/onboarding/onboarding.service.ts`
- Modify: `packages/twenty-server/src/engine/core-modules/onboarding/onboarding.service.spec.ts`
- Modify: `packages/twenty-front/src/modules/onboarding/hooks/useSetNextOnboardingStatus.ts`
- Modify: `packages/twenty-front/src/modules/onboarding/hooks/__tests__/useSetNextOnboardingStatus.test.ts`

- [ ] **Step 1: Apply onboarding patch**

```bash
git diff --binary main...origin/controlit-main -- \
  packages/twenty-server/src/engine/core-modules/onboarding/onboarding.service.ts \
  packages/twenty-server/src/engine/core-modules/onboarding/onboarding.service.spec.ts \
  packages/twenty-front/src/modules/onboarding/hooks/useSetNextOnboardingStatus.ts \
  packages/twenty-front/src/modules/onboarding/hooks/__tests__/useSetNextOnboardingStatus.test.ts \
  | git apply --3way
```

Expected:
- Conflicts are likely because upstream changed onboarding hooks. Resolve by keeping upstream structure and reintroducing only provider-disabled skip behavior.

- [ ] **Step 2: Verify backend behavior**

In `onboarding.service.ts`, keep the provider check equivalent to:

```ts
private isEmailOrCalendarSyncProviderEnabled() {
  return (
    this.twentyConfigService.get('MESSAGING_PROVIDER_GMAIL_ENABLED') ||
    this.twentyConfigService.get('CALENDAR_PROVIDER_GOOGLE_ENABLED') ||
    this.twentyConfigService.get('MESSAGING_PROVIDER_MICROSOFT_ENABLED') ||
    this.twentyConfigService.get('CALENDAR_PROVIDER_MICROSOFT_ENABLED')
  );
}
```

And keep this behavior in `getOnboardingStatus`:

```ts
if (isConnectAccountPending) {
  if (!this.isEmailOrCalendarSyncProviderEnabled()) {
    await this.setOnboardingConnectAccountPending({
      userId: user.id,
      workspaceId: workspace.id,
      value: false,
    });
  } else {
    return OnboardingStatus.SYNC_EMAIL;
  }
}
```

Expected:
- When all sync providers are disabled, the backend clears connect-account pending instead of returning `SYNC_EMAIL`.

- [ ] **Step 3: Verify frontend behavior**

In `useSetNextOnboardingStatus.ts`, keep logic equivalent to:

```ts
const hasEmailOrCalendarSyncProvider =
  isGoogleMessagingEnabled ||
  isGoogleCalendarEnabled ||
  isMicrosoftMessagingEnabled ||
  isMicrosoftCalendarEnabled;

if (currentUser?.onboardingStatus === OnboardingStatus.PROFILE_CREATION) {
  return hasEmailOrCalendarSyncProvider
    ? OnboardingStatus.SYNC_EMAIL
    : getNextStatusAfterSyncEmail(currentWorkspace);
}
```

Expected:
- New users do not see the unusable email/calendar sync modal while providers are disabled.

- [ ] **Step 4: Run onboarding tests**

```bash
NODE_OPTIONS="--max-old-space-size=8192" npx nx test twenty-server --testPathPattern=onboarding.service.spec.ts --runInBand
NODE_OPTIONS="--max-old-space-size=8192" npx nx test twenty-front --testPathPattern=useSetNextOnboardingStatus.test.ts --runInBand
```

Expected:
- Onboarding tests pass.
- If full project test command fans out too widely, run Jest directly against the exact spec file and record the command in the final upgrade notes.

- [ ] **Step 5: Commit onboarding skip**

```bash
git add packages/twenty-server/src/engine/core-modules/onboarding packages/twenty-front/src/modules/onboarding/hooks
git commit -m "fix: skip email sync onboarding when providers are disabled"
```

Expected:
- One focused commit.

---

### Task 4: Reapply Territory Access Server Layer

**Files:**
- Add/modify: `packages/twenty-server/src/modules/controlit/territory-access/**`
- Modify: `packages/twenty-server/src/engine/api/graphql/workspace-query-runner/workspace-query-hook/workspace-query-hook.module.ts`
- Move/add: `packages/twenty-server/src/database/typeorm/core/legacy-typeorm-migrations-do-not-add/common/1778750000000-addControlitTerritoryAccess.ts`
- Add/modify: `.codex/scripts/setup-controlit-territory-metadata.mjs`
- Add/modify: `.codex/scripts/setup-controlit-territory-assignments.mjs`
- Add/modify: `.codex/scripts/backfill-controlit-territories.mjs`
- Add/modify: `.codex/scripts/setup-controlit-territory-contributor-role-db.mjs`

- [ ] **Step 1: Apply Controlit territory patch**

```bash
git diff --binary main...origin/controlit-main -- \
  packages/twenty-server/src/modules/controlit \
  packages/twenty-server/src/engine/api/graphql/workspace-query-runner/workspace-query-hook/workspace-query-hook.module.ts \
  packages/twenty-server/src/database/typeorm/core/migrations/common/1778750000000-addControlitTerritoryAccess.ts \
  .codex/scripts/setup-controlit-territory-metadata.mjs \
  .codex/scripts/setup-controlit-territory-assignments.mjs \
  .codex/scripts/backfill-controlit-territories.mjs \
  .codex/scripts/setup-controlit-territory-contributor-role-db.mjs \
  .codex/scripts/setup-controlit-territory-contributor-role.mjs \
  | git apply --3way
```

Expected:
- Territory module files are restored.
- Query hook module conflict is likely because upstream changed hook types.

- [ ] **Step 2: Adapt query hook auth types**

In `packages/twenty-server/src/modules/controlit/territory-access/query-hooks/controlit-record-access.pre-query.hooks.ts`, replace old `AuthContext` usage with latest `WorkspaceAuthContext`:

```ts
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';

execute(
  authContext: WorkspaceAuthContext,
  objectName: string,
  payload: ResolverArgs,
): Promise<ResolverArgs> {
  return this.controlitTerritoryAccessService.applyPreQueryHook(
    authContext,
    objectName,
    this.methodName,
    payload,
  );
}
```

In `controlit-territory-access.service.ts`, update the public hook signature the same way:

```ts
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';

applyPreQueryHook(
  authContext: WorkspaceAuthContext,
  objectName: string,
  methodName: CommonQueryNames,
  payload: ResolverArgs,
): Promise<ResolverArgs> {
  // existing Controlit logic remains unchanged
}
```

Expected:
- The custom hook matches latest Twenty hook interfaces.

- [ ] **Step 3: Register Controlit module in the latest hook module**

In `workspace-query-hook.module.ts`, keep all upstream imports and add:

```ts
import { ControlitTerritoryAccessModule } from 'src/modules/controlit/territory-access/controlit-territory-access.module';
```

Add `ControlitTerritoryAccessModule` to the `imports` array after existing standard hook modules:

```ts
imports: [
  MessagingQueryHookModule,
  CalendarQueryHookModule,
  ConnectedAccountQueryHookModule,
  DashboardQueryHookModule,
  BlocklistQueryHookModule,
  MessageChannelQueryHookModule,
  WorkspaceMemberQueryHookModule,
  ControlitTerritoryAccessModule,
  DiscoveryModule,
],
```

Expected:
- All upstream hook modules remain registered.
- Controlit pre-query hooks run for find/create/update/delete operations.

- [ ] **Step 4: Move custom TypeORM migration to latest legacy path**

New Twenty moved old TypeORM migrations into `legacy-typeorm-migrations-do-not-add`. Keep the Controlit migration available there for fresh disaster-recovery installs:

```bash
mkdir -p packages/twenty-server/src/database/typeorm/core/legacy-typeorm-migrations-do-not-add/common
if [ -f packages/twenty-server/src/database/typeorm/core/migrations/common/1778750000000-addControlitTerritoryAccess.ts ]; then
  git mv packages/twenty-server/src/database/typeorm/core/migrations/common/1778750000000-addControlitTerritoryAccess.ts \
    packages/twenty-server/src/database/typeorm/core/legacy-typeorm-migrations-do-not-add/common/1778750000000-addControlitTerritoryAccess.ts
fi
rg -n "AddControlitTerritoryAccess1778750000000|legacy-typeorm-migrations-do-not-add" packages/twenty-server/src/database/typeorm/core
```

Expected:
- Migration is in the same tree as latest upstream legacy migrations.
- Production already has `core.controlitTerritoryAccess`; this migration is mainly for restore/fresh environment safety.

- [ ] **Step 5: Run targeted territory tests**

```bash
NODE_ENV=test NODE_OPTIONS="--max-old-space-size=8192" ../../node_modules/.bin/jest \
  src/modules/controlit/territory-access/services/__tests__/controlit-territory-access.service.spec.ts \
  src/modules/controlit/territory-access/utils/__tests__/controlit-territory-access.util.spec.ts \
  --runInBand
```

Run from:

```bash
cd packages/twenty-server
```

Expected:
- Territory tests pass.
- If Jest path differs after dependency changes, use the nearest equivalent direct Jest command and record it.

- [ ] **Step 6: Commit territory layer**

```bash
git add packages/twenty-server/src/modules/controlit packages/twenty-server/src/engine/api/graphql/workspace-query-runner/workspace-query-hook/workspace-query-hook.module.ts packages/twenty-server/src/database/typeorm/core .codex/scripts
git commit -m "feat: reapply Controlit territory access on Twenty v2.11"
```

Expected:
- One focused commit.

---

### Task 5: Reapply CRM Metadata And Import Tooling

**Files:**
- Add/modify: `.codex/scripts/controlit-crm-client.mjs`
- Add/modify: `.codex/scripts/setup-project-card-metadata.mjs`
- Add/modify: `.codex/scripts/setup-company-contact-metadata.py`
- Add/modify: `.codex/scripts/crm_contact_import.py`
- Add/modify: `.codex/scripts/test_crm_contact_import.py`
- Add/modify: `.codex/controlit-crm-import-structure.md`
- Add/modify: `.codex/notes/controlit-crm-access-matrix-2026-06-09.md`

- [ ] **Step 1: Apply metadata/import script patch**

```bash
git diff --binary main...origin/controlit-main -- \
  .codex/scripts/controlit-crm-client.mjs \
  .codex/scripts/setup-project-card-metadata.mjs \
  .codex/scripts/setup-company-contact-metadata.py \
  .codex/scripts/crm_contact_import.py \
  .codex/scripts/test_crm_contact_import.py \
  .codex/controlit-crm-import-structure.md \
  .codex/notes/controlit-crm-access-matrix-2026-06-09.md \
  | git apply --3way
```

Expected:
- Import and setup scripts are restored without customer source spreadsheets.
- Raw private exports remain outside git.

- [ ] **Step 2: Syntax-check scripts**

```bash
node --check .codex/scripts/controlit-crm-client.mjs
node --check .codex/scripts/setup-project-card-metadata.mjs
node --check .codex/scripts/setup-controlit-territory-metadata.mjs
node --check .codex/scripts/setup-controlit-territory-assignments.mjs
node --check .codex/scripts/backfill-controlit-territories.mjs
node --check .codex/scripts/setup-controlit-territory-contributor-role-db.mjs
python3 -m py_compile .codex/scripts/crm_contact_import.py .codex/scripts/setup-company-contact-metadata.py .codex/scripts/test_crm_contact_import.py
```

Expected:
- Scripts parse.

- [ ] **Step 3: Commit tooling**

```bash
git add .codex
git commit -m "chore: restore Controlit CRM setup and import tooling"
```

Expected:
- One focused commit.

---

### Task 6: Local Build And Type Validation

**Files:**
- No planned source changes; failures may require fixes in files touched by earlier tasks.

- [ ] **Step 1: Install dependencies for latest upstream**

```bash
yarn install --immutable
```

Expected:
- Yarn 4.13.0 from latest upstream is used.
- If local Yarn version is older, use the repo's checked-in `.yarn/releases` binary.

- [ ] **Step 2: Run server typecheck**

```bash
NODE_OPTIONS="--max-old-space-size=8192" npx nx typecheck twenty-server
```

Expected:
- Server typecheck passes.

- [ ] **Step 3: Run frontend typecheck**

```bash
NODE_OPTIONS="--max-old-space-size=8192" npx nx typecheck twenty-front
```

Expected:
- Frontend typecheck passes.

- [ ] **Step 4: Run targeted lint**

```bash
npx eslint \
  packages/twenty-server/src/modules/controlit/territory-access \
  packages/twenty-server/src/engine/core-modules/onboarding/onboarding.service.ts \
  packages/twenty-front/src/modules/onboarding/hooks/useSetNextOnboardingStatus.ts \
  packages/twenty-front/src/modules/auth/components/Logo.tsx \
  packages/twenty-front/src/modules/auth/sign-in-up/components/FooterNote.tsx \
  packages/twenty-front/src/modules/auth/sign-in-up/components/internal/SignInUpWithCredentials.tsx
```

Expected:
- Lint passes or only shows known unrelated deprecation warnings.

- [ ] **Step 5: Run build targets**

```bash
NODE_OPTIONS="--max-old-space-size=8192" npx nx build twenty-server
NODE_OPTIONS="--max-old-space-size=8192" npx nx build twenty-front
```

Expected:
- Both builds pass.

- [ ] **Step 6: Commit validation fixes**

If validation required code changes:

```bash
git add packages .codex deploy .github
git commit -m "fix: resolve Twenty v2.11 upgrade compatibility issues"
```

Expected:
- No uncommitted source fixes remain.

---

### Task 7: Build And Push A Candidate Image Without Updating Production

**Files:**
- Modify only if CI requires compatibility updates: `.github/workflows/controlit-build.yaml`

- [ ] **Step 1: Push upgrade branch**

```bash
git push origin HEAD:codex/controlit-upgrade-twenty-v2-11
```

Expected:
- Remote branch exists.

- [ ] **Step 2: Run GitHub Actions manually on upgrade branch**

Use GitHub Actions `Build and Push Controlit CRM` with branch `codex/controlit-upgrade-twenty-v2-11`, or temporarily adjust workflow trigger to include this branch and commit that workflow change on the upgrade branch.

Expected:
- GHCR image is built.
- Record the immutable SHA tag from workflow output.
- Do not deploy `latest` blindly.

- [ ] **Step 3: Inspect image revision label**

On a machine with Docker access:

```bash
export CANDIDATE_SHA="$(git rev-parse HEAD)"
docker pull ghcr.io/akruminsh/controlit-crm:$CANDIDATE_SHA
docker inspect ghcr.io/akruminsh/controlit-crm:$CANDIDATE_SHA --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}'
```

Expected:
- Label equals the upgrade branch commit SHA.

---

### Task 8: Prepare Staging Restore On VPS

**Files:**
- Create if useful: `deploy/docker-compose.staging.yml`
- No production compose changes during this task.

- [ ] **Step 1: Create production backup**

On VPS:

```bash
ssh controlit-crm-vps 'mkdir -p /opt/controlit-crm/backups && cd /opt/controlit-crm && docker compose exec -T db pg_dump -U "$PG_DATABASE_USER" -d default --format=custom --no-owner --no-acl > backups/pre-upgrade-$(date +%Y%m%d-%H%M%S).dump'
```

Expected:
- Backup file exists under `/opt/controlit-crm/backups/`.
- Record exact backup path.

- [ ] **Step 2: Create isolated staging compose project**

On VPS:

```bash
ssh controlit-crm-vps 'mkdir -p /opt/controlit-crm-staging'
scp deploy/docker-compose.prod.yml controlit-crm-vps:/opt/controlit-crm-staging/docker-compose.yml
```

Then edit staging compose on VPS:

```bash
ssh controlit-crm-vps 'cd /opt/controlit-crm-staging && perl -0pi -e "s/name: controlit-crm/name: controlit-crm-staging/" docker-compose.yml && perl -0pi -e "s/3000:3000/3100:3000/" docker-compose.yml'
```

Expected:
- Staging project name is different from production.
- Staging server port is `3100`.

- [ ] **Step 3: Restore backup into staging DB**

On VPS:

```bash
export CANDIDATE_SHA="$(git rev-parse HEAD)"
ssh controlit-crm-vps "cd /opt/controlit-crm-staging && cp /opt/controlit-crm/.env .env && TAG=$CANDIDATE_SHA docker compose up -d db redis && sleep 10 && docker compose exec -T db pg_restore -U \"\$PG_DATABASE_USER\" -d default --clean --if-exists --no-owner --no-acl /backup/pre-upgrade.dump"
```

If the direct `/backup/pre-upgrade.dump` path is not mounted, copy the dump into the staging DB container:

```bash
export BACKUP_FILE="$(ssh controlit-crm-vps 'cd /opt/controlit-crm && ls -t backups/pre-upgrade-*.dump | head -n1')"
ssh controlit-crm-vps "cd /opt/controlit-crm-staging && docker compose cp /opt/controlit-crm/$BACKUP_FILE db:/tmp/pre-upgrade.dump && docker compose exec -T db pg_restore -U \"\$PG_DATABASE_USER\" -d default --clean --if-exists --no-owner --no-acl /tmp/pre-upgrade.dump"
```

Expected:
- Staging DB contains a restored production copy.
- Production containers are untouched.

---

### Task 9: Run Staging Upgrade Dry-Run And Apply

**Files:**
- No source changes unless upgrade finds a code defect.

- [ ] **Step 1: Run fail-fast upgrade dry-run**

On VPS:

```bash
export CANDIDATE_SHA="$(git rev-parse HEAD)"
ssh controlit-crm-vps "cd /opt/controlit-crm-staging && TAG=$CANDIDATE_SHA docker compose run --rm --entrypoint \"\" server yarn command:prod upgrade --dry-run --verbose"
```

Expected:
- Exit code `0`.
- Upgrade summary reports `0` workspace failures.

- [ ] **Step 2: Run fail-fast upgrade apply**

On VPS:

```bash
export CANDIDATE_SHA="$(git rev-parse HEAD)"
ssh controlit-crm-vps "cd /opt/controlit-crm-staging && TAG=$CANDIDATE_SHA docker compose run --rm --entrypoint \"\" server yarn command:prod upgrade --verbose"
```

Expected:
- Exit code `0`.
- Upgrade summary reports `0` workspace failures.

- [ ] **Step 3: Flush cache and start staging app**

On VPS:

```bash
export CANDIDATE_SHA="$(git rev-parse HEAD)"
ssh controlit-crm-vps "cd /opt/controlit-crm-staging && TAG=$CANDIDATE_SHA docker compose run --rm --entrypoint \"\" server yarn command:prod cache:flush && TAG=$CANDIDATE_SHA docker compose up -d server worker"
```

Expected:
- Staging server becomes healthy.

- [ ] **Step 4: Check staging health**

On local machine:

```bash
ssh controlit-crm-vps 'cd /opt/controlit-crm-staging && docker compose ps server worker && docker compose logs --no-color --tail=120 server'
```

Expected:
- Server is healthy.
- Worker is running.
- Logs do not show upgrade failures, migration failures, or territory hook errors.

---

### Task 10: Staging Functional Verification

**Files:**
- No source changes unless verification fails.

- [ ] **Step 1: Verify DB invariants**

On VPS:

```bash
ssh controlit-crm-vps 'cd /opt/controlit-crm-staging && docker compose exec -T db psql -U "$PG_DATABASE_USER" -d default -c "select count(*) as territory_access_rows from core.\"controlitTerritoryAccess\";"'
ssh controlit-crm-vps 'cd /opt/controlit-crm-staging && docker compose exec -T db psql -U "$PG_DATABASE_USER" -d default -c "select email, \"displayName\" from core.\"user\" order by email;"'
```

Expected:
- `controlitTerritoryAccess` table exists.
- Pilot/admin users still exist.

- [ ] **Step 2: Re-run idempotent Controlit setup scripts against staging**

Run from local upgrade worktree with staging URL configured:

```bash
CRM_BASE_URL=http://localhost:3100 node .codex/scripts/setup-controlit-territory-metadata.mjs --dry-run
CRM_BASE_URL=http://localhost:3100 node .codex/scripts/setup-controlit-territory-assignments.mjs --dry-run
CRM_BASE_URL=http://localhost:3100 node .codex/scripts/setup-controlit-territory-contributor-role-db.mjs --dry-run --assign-pilot
```

Expected:
- Scripts report no unexpected creates.
- Role `Territory Contributor` exists once.
- Pilot territory assignment remains `FINLAND`.

- [ ] **Step 3: Verify admin UI**

Open staging URL through browser tunnel or direct port if available:

```bash
ssh -L 3100:localhost:3100 controlit-crm-vps
```

Then open:

```text
http://localhost:3100
```

Expected:
- Admin can log in.
- Companies, People, Projects, Tasks, Notes load.
- Admin sees all territories.
- Settings can open without navigation loop.

- [ ] **Step 4: Verify pilot limited UI**

Using pilot user `ak@marketinghackers.lv`:

Expected checks:
- Companies list shows only assigned territory records.
- People list shows only assigned territory records.
- Notes list shows only assigned territory notes.
- Existing unassigned Projects and Tasks remain hidden from limited pilot.
- Projects page shows create button.
- Tasks page shows create button.
- Companies, People, and Notes pages do not show create button.

- [ ] **Step 5: Create and remove staging-only records**

In staging only:
- Create Project named `STAGING UPGRADE TEST PROJECT`.
- Set `Project country = Finland`.
- Create Task named `STAGING UPGRADE TEST TASK`.
- Set `Task territory = Finland`.
- Reload and confirm both persist.
- Delete the two staging records after verification.

Expected:
- Limited pilot can create own Project/Task in assigned territory.
- Limited pilot cannot create outside assigned territory.

---

### Task 11: Production Rollout

**Files:**
- No source changes.

- [ ] **Step 1: Push final branch to production branch**

After staging passes:

```bash
git push origin HEAD:controlit-main
```

Expected:
- GitHub Actions starts for `controlit-main`.
- Record final production commit SHA.

- [ ] **Step 2: Wait for production image build**

```bash
gh run list --workflow "Build and Push Controlit CRM" --limit 5
export RUN_ID="$(gh run list --workflow 'Build and Push Controlit CRM' --branch controlit-main --limit 1 --json databaseId --jq '.[0].databaseId')"
gh run watch $RUN_ID --exit-status
```

Expected:
- Build succeeds.
- GHCR image with final commit SHA exists.

- [ ] **Step 3: Create production backup immediately before deploy**

On VPS:

```bash
ssh controlit-crm-vps 'docker inspect controlit-crm-server-1 --format "{{ index .Config.Labels \"org.opencontainers.image.revision\" }}"' > /tmp/controlit-previous-good-sha
ssh controlit-crm-vps 'mkdir -p /opt/controlit-crm/backups && cd /opt/controlit-crm && docker compose exec -T db pg_dump -U "$PG_DATABASE_USER" -d default --format=custom --no-owner --no-acl > backups/prod-before-v2-11-$(date +%Y%m%d-%H%M%S).dump'
```

Expected:
- Backup created.
- Record exact path.

- [ ] **Step 4: Stop worker before DB upgrade**

On VPS:

```bash
ssh controlit-crm-vps 'cd /opt/controlit-crm && docker compose stop worker'
```

Expected:
- Worker stopped; background jobs cannot mutate during upgrade.

- [ ] **Step 5: Pull final image and run fail-fast production upgrade**

On VPS:

```bash
export FINAL_SHA="$(git rev-parse HEAD)"
ssh controlit-crm-vps "cd /opt/controlit-crm && TAG=$FINAL_SHA docker compose pull server worker"
ssh controlit-crm-vps "cd /opt/controlit-crm && TAG=$FINAL_SHA docker compose run --rm --entrypoint \"\" server yarn command:prod upgrade --dry-run --verbose"
ssh controlit-crm-vps "cd /opt/controlit-crm && TAG=$FINAL_SHA docker compose run --rm --entrypoint \"\" server yarn command:prod upgrade --verbose"
ssh controlit-crm-vps "cd /opt/controlit-crm && TAG=$FINAL_SHA docker compose run --rm --entrypoint \"\" server yarn command:prod cache:flush"
```

Expected:
- Dry-run succeeds.
- Apply succeeds.
- Cache flush succeeds.

- [ ] **Step 6: Start production server and worker on final image**

On VPS:

```bash
export FINAL_SHA="$(git rev-parse HEAD)"
ssh controlit-crm-vps "cd /opt/controlit-crm && TAG=$FINAL_SHA docker compose up -d server worker"
```

Expected:
- Server healthy.
- Worker running.

- [ ] **Step 7: Verify production image revision**

On VPS:

```bash
ssh controlit-crm-vps 'cd /opt/controlit-crm && docker compose ps server worker && docker inspect controlit-crm-server-1 --format "{{ index .Config.Labels \"org.opencontainers.image.revision\" }}"'
curl -fsS -o /dev/null -w '%{http_code}\n' https://crm.controlitfactory.eu/healthz
```

Expected:
- Revision equals final commit SHA.
- Health check returns `200`.

---

### Task 12: Production Verification And Rollback Decision

**Files:**
- Update after completion: `/Users/alexeykruminsh/Documents/All projects/Kruminsh Second Brain/Projects/controlit-crm/README.md`

- [ ] **Step 1: Verify production admin**

Expected checks:
- Admin login works.
- Companies, People, Projects, Tasks, Notes load.
- Admin can see all territories.
- Existing data counts are not lower than pre-upgrade counts unless explained by filters.

- [ ] **Step 2: Verify production pilot**

Expected checks with `ak@marketinghackers.lv`:
- Finland-only territory visibility remains.
- Existing unassigned Projects/Tasks stay admin-only.
- Create own Project is available.
- Create own Task is available.
- Companies/People/Notes remain read-only.
- Email/calendar onboarding step remains skipped.

- [ ] **Step 3: Check logs**

On VPS:

```bash
ssh controlit-crm-vps 'cd /opt/controlit-crm && docker compose logs --no-color --tail=200 server worker | rg -i "error|exception|migration|upgrade|controlit|permission|territory"'
```

Expected:
- No new upgrade, permission, or territory errors.

- [ ] **Step 4: Rollback if any blocking issue appears**

Rollback image only, if DB is healthy and issue is frontend/runtime:

```bash
export PREVIOUS_GOOD_SHA="$(cat /tmp/controlit-previous-good-sha)"
ssh controlit-crm-vps "cd /opt/controlit-crm && TAG=$PREVIOUS_GOOD_SHA docker compose up -d server worker"
```

Rollback DB and image, if upgrade corrupted data or migrations failed:

```bash
export PROD_BACKUP_FILE="$(ssh controlit-crm-vps 'cd /opt/controlit-crm && ls -t backups/prod-before-v2-11-*.dump | head -n1')"
export PREVIOUS_GOOD_SHA="$(cat /tmp/controlit-previous-good-sha)"
ssh controlit-crm-vps "cd /opt/controlit-crm && docker compose stop server worker && docker compose exec -T db pg_restore -U \"\$PG_DATABASE_USER\" -d default --clean --if-exists --no-owner --no-acl $PROD_BACKUP_FILE && TAG=$PREVIOUS_GOOD_SHA docker compose up -d server worker"
```

Expected:
- CRM returns to previous known-good revision.
- Pilot/admin login is verified after rollback.

- [ ] **Step 5: Record durable project status**

Update:

```text
/Users/alexeykruminsh/Documents/All projects/Kruminsh Second Brain/Projects/controlit-crm/README.md
```

Add:
- Final Twenty target tag.
- Final Controlit commit SHA.
- Production backup path.
- Upgrade command result.
- UI verification result.
- Decision whether real manager invitations can start.

Expected:
- Project memory accurately states whether invitation phase is unblocked.

---

## Final Acceptance Criteria

- Production runs Controlit CRM on latest selected Twenty release tag.
- Production server is healthy and worker is running.
- Admins can see and manage all data.
- Pilot limited user sees only assigned territories.
- Pilot limited user can create own Projects and Tasks.
- Pilot limited user cannot create Companies, People, or Notes.
- Email/calendar onboarding screen remains skipped while sync providers are disabled.
- Imported Companies/People/Notes and custom Project metadata remain present.
- No duplicate `Territory Contributor` role or duplicate territory metadata fields.
- Production rollback artifacts are recorded.
- Project memory is updated.

## Execution Recommendation

Use subagent-driven execution for Tasks 2-6 because conflicts will be independent by layer: deployment/branding, onboarding, territory hooks, and scripts. Use inline execution for Tasks 8-12 because VPS deployment and verification require a single operator to preserve state and avoid concurrent production actions.
