import { CommonQueryNames } from 'src/engine/api/common/types/common-query-args.type';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import {
  type PermissionsException,
  PermissionsExceptionCode,
} from 'src/engine/metadata-modules/permissions/permissions.exception';
import { ControlitTerritoryAccessService } from 'src/modules/controlit/territory-access/services/controlit-territory-access.service';

const authContext = {
  type: 'user',
  workspace: { id: 'workspace-id' },
  userWorkspaceId: 'user-workspace-id',
  workspaceMemberId: 'member-id',
} as unknown as WorkspaceAuthContext;

const apiKeyAuthContext = {
  type: 'apiKey',
  workspace: { id: 'workspace-id' },
  apiKey: { id: 'api-key-id' },
} as unknown as WorkspaceAuthContext;

describe('ControlitTerritoryAccessService', () => {
  const setup = ({
    isAdmin = false,
    assignmentRows = [],
    record = undefined,
    assignmentError = undefined,
  }: {
    isAdmin?: boolean;
    assignmentRows?: Record<string, unknown>[];
    record?: Record<string, unknown>;
    assignmentError?: unknown;
  } = {}) => {
    const coreDataSource = {
      query: jest.fn((query: string) => {
        if (query.includes('"roleTargets"')) {
          return Promise.resolve([{ canUpdateAllSettings: isAdmin }]);
        }

        if (assignmentError) {
          return Promise.reject(assignmentError);
        }

        return Promise.resolve(assignmentRows);
      }),
    };
    const repository = {
      findOneBy: jest.fn().mockResolvedValue(record),
    };
    const twentyORMGlobalManager = {
      executeInWorkspaceContext: jest.fn((callback: () => unknown) =>
        callback(),
      ),
      getRepository: jest.fn().mockResolvedValue(repository),
    };

    const service = new ControlitTerritoryAccessService(
      coreDataSource as unknown as ConstructorParameters<
        typeof ControlitTerritoryAccessService
      >[0],
      twentyORMGlobalManager as unknown as ConstructorParameters<
        typeof ControlitTerritoryAccessService
      >[1],
    );

    return {
      service,
      coreDataSource,
      repository,
      twentyORMGlobalManager,
    };
  };

  it('does not change payloads for api key requests', async () => {
    const { service, coreDataSource } = setup({
      assignmentRows: [
        {
          territories: ['FINLAND'],
          canManageTerritory: false,
        },
      ],
    });
    const payload = { filter: { name: { ilike: '%YIT%' } } };

    await expect(
      service.applyPreQueryHook(
        apiKeyAuthContext,
        'company',
        CommonQueryNames.FIND_MANY,
        payload,
      ),
    ).resolves.toBe(payload);
    expect(coreDataSource.query).not.toHaveBeenCalled();
  });

  it('does not change payloads when a user has no territory assignment yet', async () => {
    const { service } = setup();
    const payload = { filter: { name: { ilike: '%YIT%' } } };

    await expect(
      service.applyPreQueryHook(
        authContext,
        'company',
        CommonQueryNames.FIND_MANY,
        payload,
      ),
    ).resolves.toBe(payload);
  });

  it('does not change payloads for admin roles', async () => {
    const { service } = setup({
      isAdmin: true,
      assignmentRows: [
        {
          territories: ['FINLAND'],
          canManageTerritory: false,
        },
      ],
    });
    const payload = { filter: { name: { ilike: '%YIT%' } } };

    await expect(
      service.applyPreQueryHook(
        authContext,
        'company',
        CommonQueryNames.FIND_MANY,
        payload,
      ),
    ).resolves.toBe(payload);
  });

  it('does not change payloads when the assignment table is not migrated yet', async () => {
    const { service } = setup({
      assignmentError: { code: '42P01' },
    });
    const payload = { filter: { name: { ilike: '%YIT%' } } };

    await expect(
      service.applyPreQueryHook(
        authContext,
        'company',
        CommonQueryNames.FIND_MANY,
        payload,
      ),
    ).resolves.toBe(payload);
  });

  it('adds territory filters to scoped company reads', async () => {
    const { service } = setup({
      assignmentRows: [
        {
          territories: ['FINLAND'],
          canManageTerritory: false,
        },
      ],
    });

    await expect(
      service.applyPreQueryHook(
        authContext,
        'company',
        CommonQueryNames.FIND_MANY,
        { filter: { name: { ilike: '%YIT%' } } },
      ),
    ).resolves.toEqual({
      filter: {
        and: [
          { name: { ilike: '%YIT%' } },
          { companyCountry: { in: ['FINLAND'] } },
        ],
      },
    });
  });

  it('keeps newer partner territories in scoped read filters', async () => {
    const { service } = setup({
      assignmentRows: [
        {
          territories: [
            'CZECHIA',
            'SLOVAKIA',
            'MENA',
            'AUSTRALIA',
            'NEW_ZEALAND',
          ],
          canManageTerritory: false,
        },
      ],
    });

    await expect(
      service.applyPreQueryHook(
        authContext,
        'company',
        CommonQueryNames.FIND_MANY,
        { filter: { name: { ilike: '%partner%' } } },
      ),
    ).resolves.toEqual({
      filter: {
        and: [
          { name: { ilike: '%partner%' } },
          {
            companyCountry: {
              in: ['CZECHIA', 'SLOVAKIA', 'MENA', 'AUSTRALIA', 'NEW_ZEALAND'],
            },
          },
        ],
      },
    });
  });

  it('adds territory filters to scoped note reads', async () => {
    const { service } = setup({
      assignmentRows: [
        {
          territories: ['FINLAND'],
          canManageTerritory: false,
        },
      ],
    });

    await expect(
      service.applyPreQueryHook(
        authContext,
        'note',
        CommonQueryNames.FIND_MANY,
        { filter: { title: { ilike: '%source notes%' } } },
      ),
    ).resolves.toEqual({
      filter: {
        and: [
          { title: { ilike: '%source notes%' } },
          { noteTerritory: { in: ['FINLAND'] } },
        ],
      },
    });
  });

  it('blocks non-branch managers from updating companies', async () => {
    const { service } = setup({
      assignmentRows: [
        {
          territories: ['FINLAND'],
          canManageTerritory: false,
        },
      ],
    });

    await expect(
      service.applyPreQueryHook(
        authContext,
        'company',
        CommonQueryNames.UPDATE_ONE,
        { id: 'company-id', data: { name: 'YIT' } },
      ),
    ).rejects.toMatchObject({
      code: PermissionsExceptionCode.PERMISSION_DENIED,
    } satisfies Partial<PermissionsException>);
  });

  it('allows managers to create opportunities inside their territories', async () => {
    const { service } = setup({
      assignmentRows: [
        {
          territories: ['FINLAND'],
          canManageTerritory: false,
        },
      ],
    });
    const payload = {
      data: {
        name: 'New roof project',
        projectCountry: 'FINLAND',
      },
    };

    await expect(
      service.applyPreQueryHook(
        authContext,
        'opportunity',
        CommonQueryNames.CREATE_ONE,
        payload,
      ),
    ).resolves.toBe(payload);
  });

  it('blocks managers from creating opportunities outside their territories', async () => {
    const { service } = setup({
      assignmentRows: [
        {
          territories: ['FINLAND'],
          canManageTerritory: false,
        },
      ],
    });

    await expect(
      service.applyPreQueryHook(
        authContext,
        'opportunity',
        CommonQueryNames.CREATE_ONE,
        {
          data: {
            name: 'New roof project',
            projectCountry: 'ESTONIA',
          },
        },
      ),
    ).rejects.toMatchObject({
      code: PermissionsExceptionCode.PERMISSION_DENIED,
    } satisfies Partial<PermissionsException>);
  });

  it('allows managers to update opportunities created by them inside their territories', async () => {
    const { service } = setup({
      assignmentRows: [
        {
          territories: ['FINLAND'],
          canManageTerritory: false,
        },
      ],
      record: {
        id: 'opportunity-id',
        projectCountry: 'FINLAND',
        createdBy: { workspaceMemberId: 'member-id' },
      },
    });
    const payload = {
      id: 'opportunity-id',
      data: { name: 'Updated roof project' },
    };

    await expect(
      service.applyPreQueryHook(
        authContext,
        'opportunity',
        CommonQueryNames.UPDATE_ONE,
        payload,
      ),
    ).resolves.toBe(payload);
  });

  it('blocks managers from updating opportunities created by someone else', async () => {
    const { service } = setup({
      assignmentRows: [
        {
          territories: ['FINLAND'],
          canManageTerritory: false,
        },
      ],
      record: {
        id: 'opportunity-id',
        projectCountry: 'FINLAND',
        createdBy: { workspaceMemberId: 'other-member-id' },
      },
    });

    await expect(
      service.applyPreQueryHook(
        authContext,
        'opportunity',
        CommonQueryNames.UPDATE_ONE,
        { id: 'opportunity-id', data: { name: 'Updated roof project' } },
      ),
    ).rejects.toMatchObject({
      code: PermissionsExceptionCode.PERMISSION_DENIED,
    } satisfies Partial<PermissionsException>);
  });

  it('blocks branch managers from updating records outside their territories', async () => {
    const { service } = setup({
      assignmentRows: [
        {
          territories: ['FINLAND'],
          canManageTerritory: true,
        },
      ],
      record: {
        id: 'company-id',
        companyCountry: 'ESTONIA',
      },
    });

    await expect(
      service.applyPreQueryHook(
        authContext,
        'company',
        CommonQueryNames.UPDATE_ONE,
        { id: 'company-id', data: { name: 'YIT' } },
      ),
    ).rejects.toMatchObject({
      code: PermissionsExceptionCode.PERMISSION_DENIED,
    } satisfies Partial<PermissionsException>);
  });

  it('allows managers to update tasks assigned to them inside their territory', async () => {
    const { service } = setup({
      assignmentRows: [
        {
          territories: ['FINLAND'],
          canManageTerritory: false,
        },
      ],
      record: {
        id: 'task-id',
        taskTerritory: 'FINLAND',
        assigneeId: 'member-id',
        createdBy: { workspaceMemberId: null },
      },
    });
    const payload = { id: 'task-id', data: { title: 'Call customer' } };

    await expect(
      service.applyPreQueryHook(
        authContext,
        'task',
        CommonQueryNames.UPDATE_ONE,
        payload,
      ),
    ).resolves.toBe(payload);
  });

  it('allows branch managers to soft-delete tasks inside their territories', async () => {
    const { service } = setup({
      assignmentRows: [
        {
          territories: ['FINLAND'],
          canManageTerritory: true,
        },
      ],
      record: {
        id: 'task-id',
        taskTerritory: 'FINLAND',
        assigneeId: 'other-member-id',
        createdBy: { workspaceMemberId: 'creator-id' },
      },
    });
    const payload = { id: 'task-id' };

    await expect(
      service.applyPreQueryHook(
        authContext,
        'task',
        CommonQueryNames.DELETE_ONE,
        payload,
      ),
    ).resolves.toBe(payload);
  });

  it('blocks managers from updating tasks assigned to someone else', async () => {
    const { service } = setup({
      assignmentRows: [
        {
          territories: ['FINLAND'],
          canManageTerritory: false,
        },
      ],
      record: {
        id: 'task-id',
        taskTerritory: 'FINLAND',
        assigneeId: 'other-member-id',
        createdBy: { workspaceMemberId: 'creator-id' },
      },
    });

    await expect(
      service.applyPreQueryHook(
        authContext,
        'task',
        CommonQueryNames.UPDATE_ONE,
        { id: 'task-id', data: { title: 'Call customer' } },
      ),
    ).rejects.toMatchObject({
      code: PermissionsExceptionCode.PERMISSION_DENIED,
    } satisfies Partial<PermissionsException>);
  });

  it('blocks branch managers from updating notes outside their territories', async () => {
    const { service } = setup({
      assignmentRows: [
        {
          territories: ['FINLAND'],
          canManageTerritory: true,
        },
      ],
      record: {
        id: 'note-id',
        noteTerritory: 'ESTONIA',
      },
    });

    await expect(
      service.applyPreQueryHook(
        authContext,
        'note',
        CommonQueryNames.UPDATE_ONE,
        { id: 'note-id', data: { title: 'Private note' } },
      ),
    ).rejects.toMatchObject({
      code: PermissionsExceptionCode.PERMISSION_DENIED,
    } satisfies Partial<PermissionsException>);
  });
});
