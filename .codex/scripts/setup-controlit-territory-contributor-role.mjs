#!/usr/bin/env node

import {
  createBackupOnce,
  createCrmClient,
  fetchAll,
  loadConfig,
  parseCommonArgs,
} from './controlit-crm-client.mjs';

const ROLE_DEFINITION = {
  label: 'Territory Contributor',
  description:
    'Can view assigned territory data and create/update own Projects and Tasks within assigned territories.',
  icon: 'IconUserCheck',
  canUpdateAllSettings: false,
  canAccessAllTools: false,
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: false,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
  canBeAssignedToUsers: true,
  canBeAssignedToAgents: false,
  canBeAssignedToApiKeys: false,
};

const OBJECT_PERMISSION_OBJECTS = ['opportunity', 'task'];
const PILOT_EMAIL = 'ak@marketinghackers.lv';

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
  const client = await createCrmClient(config);
  const [roles, objects] = await Promise.all([fetchRoles(client), fetchObjects(client)]);
  const existingRole = roles.find((role) => role.label === ROLE_DEFINITION.label);
  const objectMetadataByName = new Map(
    objects.map((object) => [object.nameSingular, object]),
  );
  const missingObjects = OBJECT_PERMISSION_OBJECTS.filter(
    (objectName) => !objectMetadataByName.has(objectName),
  );

  if (missingObjects.length > 0) {
    throw new Error(`Missing object metadata: ${missingObjects.join(', ')}`);
  }

  console.log(`Workspace: ${client.workspace.displayName} (${client.workspace.id})`);

  let role = existingRole;

  if (!role) {
    console.log(`Role "${ROLE_DEFINITION.label}" will be created.`);

    if (!isDryRun) {
      await ensureBackup();
      role = await createRole(client);
      console.log(`Created role "${role.label}" (${role.id}).`);
    }
  } else {
    const update = diffRole(role);

    if (Object.keys(update).length > 0) {
      console.log(
        `Role "${ROLE_DEFINITION.label}" will be updated: ${Object.keys(update).join(', ')}`,
      );

      if (!isDryRun) {
        await ensureBackup();
        role = await updateRole(client, role.id, update);
        console.log(`Updated role "${role.label}" (${role.id}).`);
      }
    } else {
      console.log(`Role "${ROLE_DEFINITION.label}" already matches expected flags.`);
    }
  }

  const roleForPlanning = role ?? {
    id: '<created-on-apply>',
    objectPermissions: [],
  };
  const objectPermissionPlan = planObjectPermissions(
    roleForPlanning,
    objectMetadataByName,
  );

  if (objectPermissionPlan.needsUpdate) {
    console.log(
      `Object permissions will be upserted for: ${OBJECT_PERMISSION_OBJECTS.join(', ')}`,
    );

    if (!isDryRun) {
      await ensureBackup();
      await upsertObjectPermissions(
        client,
        role.id,
        objectPermissionPlan.objectPermissions,
      );
      console.log('Object permissions upserted.');
    }
  } else {
    console.log('Object permissions already match expected values.');
  }

  if (shouldAssignPilot) {
    if (!role?.id && isDryRun) {
      console.log(`Pilot ${PILOT_EMAIL} would be assigned after role creation.`);
    } else {
      await assignPilotRoleIfNeeded(client, role.id);
    }
  }

  console.log(
    isDryRun
      ? 'Dry run complete. No role changes were applied.'
      : 'Territory contributor role setup complete.',
  );
}

async function fetchRoles(client) {
  const data = await client.metadata(`
    query GetRoles {
      getRoles {
        id
        label
        description
        icon
        canUpdateAllSettings
        canAccessAllTools
        canReadAllObjectRecords
        canUpdateAllObjectRecords
        canSoftDeleteAllObjectRecords
        canDestroyAllObjectRecords
        canBeAssignedToUsers
        canBeAssignedToAgents
        canBeAssignedToApiKeys
        objectPermissions {
          objectMetadataId
          canReadObjectRecords
          canUpdateObjectRecords
          canSoftDeleteObjectRecords
          canDestroyObjectRecords
        }
      }
    }
  `);

  return data.getRoles;
}

async function fetchObjects(client) {
  const data = await client.metadata(`
    query ObjectMetadataItems {
      objects(paging: { first: 1000 }) {
        edges {
          node {
            id
            nameSingular
            labelSingular
          }
        }
      }
    }
  `);

  return data.objects.edges.map((edge) => edge.node);
}

function diffRole(role) {
  return Object.fromEntries(
    Object.entries(ROLE_DEFINITION).filter(
      ([key, value]) => role[key] !== value,
    ),
  );
}

async function createRole(client) {
  const data = await client.metadata(
    `
      mutation CreateRole($input: CreateRoleInput!) {
        createOneRole(createRoleInput: $input) {
          id
          label
          description
          icon
          canUpdateAllSettings
          canAccessAllTools
          canReadAllObjectRecords
          canUpdateAllObjectRecords
          canSoftDeleteAllObjectRecords
          canDestroyAllObjectRecords
          canBeAssignedToUsers
          canBeAssignedToAgents
          canBeAssignedToApiKeys
          objectPermissions {
            objectMetadataId
            canReadObjectRecords
            canUpdateObjectRecords
            canSoftDeleteObjectRecords
            canDestroyObjectRecords
          }
        }
      }
    `,
    { input: ROLE_DEFINITION },
  );

  return data.createOneRole;
}

async function updateRole(client, roleId, update) {
  const data = await client.metadata(
    `
      mutation UpdateRole($input: UpdateRoleInput!) {
        updateOneRole(updateRoleInput: $input) {
          id
          label
          description
          icon
          canUpdateAllSettings
          canAccessAllTools
          canReadAllObjectRecords
          canUpdateAllObjectRecords
          canSoftDeleteAllObjectRecords
          canDestroyAllObjectRecords
          canBeAssignedToUsers
          canBeAssignedToAgents
          canBeAssignedToApiKeys
          objectPermissions {
            objectMetadataId
            canReadObjectRecords
            canUpdateObjectRecords
            canSoftDeleteObjectRecords
            canDestroyObjectRecords
          }
        }
      }
    `,
    { input: { id: roleId, update } },
  );

  return data.updateOneRole;
}

function planObjectPermissions(role, objectMetadataByName) {
  const objectPermissions = OBJECT_PERMISSION_OBJECTS.map((objectName) => ({
    objectMetadataId: objectMetadataByName.get(objectName).id,
    canReadObjectRecords: true,
    canUpdateObjectRecords: true,
    canSoftDeleteObjectRecords: false,
    canDestroyObjectRecords: false,
  }));
  const existingByObjectMetadataId = new Map(
    (role.objectPermissions ?? []).map((permission) => [
      permission.objectMetadataId,
      permission,
    ]),
  );
  const needsUpdate = objectPermissions.some((expected) => {
    const existing = existingByObjectMetadataId.get(expected.objectMetadataId);

    if (!existing) {
      return true;
    }

    return Object.entries(expected).some(
      ([key, value]) => existing[key] !== value,
    );
  });

  return {
    needsUpdate,
    objectPermissions,
  };
}

async function upsertObjectPermissions(client, roleId, objectPermissions) {
  await client.metadata(
    `
      mutation UpsertObjectPermissions($input: UpsertObjectPermissionsInput!) {
        upsertObjectPermissions(upsertObjectPermissionsInput: $input) {
          objectMetadataId
          canReadObjectRecords
          canUpdateObjectRecords
          canSoftDeleteObjectRecords
          canDestroyObjectRecords
        }
      }
    `,
    {
      input: {
        roleId,
        objectPermissions,
      },
    },
  );
}

async function assignPilotRoleIfNeeded(client, roleId) {
  const workspaceMembers = await fetchAll(client, 'workspaceMembers');
  const pilot = workspaceMembers.find(
    (member) => member.userEmail?.toLowerCase() === PILOT_EMAIL,
  );

  if (!pilot) {
    throw new Error(`Pilot workspace member not found: ${PILOT_EMAIL}`);
  }

  const existingRoleLabels = (pilot.roles ?? []).map((role) => role.label);

  if (existingRoleLabels.includes(ROLE_DEFINITION.label)) {
    console.log(`Pilot ${PILOT_EMAIL} already has role "${ROLE_DEFINITION.label}".`);
    return;
  }

  console.log(
    `Pilot ${PILOT_EMAIL} will be assigned role "${ROLE_DEFINITION.label}" (current roles: ${existingRoleLabels.join(', ') || 'none'}).`,
  );

  if (isDryRun) {
    return;
  }

  await ensureBackup();
  await client.metadata(
    `
      mutation UpdateWorkspaceMemberRole($workspaceMemberId: UUID!, $roleId: UUID!) {
        updateWorkspaceMemberRole(
          workspaceMemberId: $workspaceMemberId
          roleId: $roleId
        ) {
          id
          userEmail
          roles {
            id
            label
          }
        }
      }
    `,
    {
      workspaceMemberId: pilot.id,
      roleId,
    },
  );
  console.log(`Pilot ${PILOT_EMAIL} assigned role "${ROLE_DEFINITION.label}".`);
}
