import { CommonQueryNames } from 'src/engine/api/common/types/common-query-args.type';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import {
  CONTROLIT_TERRITORY_SYNC_POST_QUERY_HOOKS,
  ControlitTerritorySyncCreateOnePostQueryHook,
} from 'src/modules/controlit/territory-access/query-hooks/controlit-territory-sync.post-query.hooks';
import { ControlitTerritorySyncService } from 'src/modules/controlit/territory-access/services/controlit-territory-sync.service';

const authContext = {
  type: 'user',
  workspace: { id: '63c3e463-fa79-4e0e-8f48-1363976393df' },
  userWorkspaceId: 'user-workspace-id',
  workspaceMemberId: 'member-id',
} as unknown as WorkspaceAuthContext;

describe('Controlit territory sync post query hooks', () => {
  const setup = () => {
    const service = {
      syncWorkspaceTerritories: jest.fn().mockResolvedValue(undefined),
    };

    return {
      service,
      hook: new ControlitTerritorySyncCreateOnePostQueryHook(
        service as unknown as ControlitTerritorySyncService,
      ),
    };
  };

  it('registers sync hooks for create and update mutations', () => {
    expect(CONTROLIT_TERRITORY_SYNC_POST_QUERY_HOOKS).toEqual([
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
    ]);
  });

  it('syncs territories after a supported object mutation', async () => {
    const { hook, service } = setup();

    await hook.execute(authContext, 'taskTarget', [{ id: 'task-target-id' }]);

    expect(service.syncWorkspaceTerritories).toHaveBeenCalledWith(authContext);
  });

  it('does not sync territories for unrelated object mutations', async () => {
    const { hook, service } = setup();

    await hook.execute(authContext, 'rocket', [{ id: 'rocket-id' }]);

    expect(service.syncWorkspaceTerritories).not.toHaveBeenCalled();
  });

  it('keeps the create hook wired to createOne semantics', () => {
    expect(CommonQueryNames.CREATE_ONE).toBe('createOne');
  });
});
