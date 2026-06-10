import { Inject, Injectable } from '@nestjs/common';

import { type QueryResultFieldValue } from 'src/engine/api/graphql/workspace-query-runner/factories/query-result-getters/interfaces/query-result-field-value';
import { type WorkspacePostQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';

import { CommonQueryNames } from 'src/engine/api/common/types/common-query-args.type';
import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { WorkspaceQueryHookType } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/types/workspace-query-hook.type';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { ControlitTerritorySyncService } from 'src/modules/controlit/territory-access/services/controlit-territory-sync.service';

const CONTROLIT_TERRITORY_SYNC_SOURCE_OBJECTS = new Set([
  'company',
  'person',
  'opportunity',
  'task',
  'note',
  'taskTarget',
  'noteTarget',
]);

abstract class ControlitTerritorySyncPostQueryHook implements WorkspacePostQueryHookInstance {
  protected constructor(
    protected readonly controlitTerritorySyncService: ControlitTerritorySyncService,
  ) {}

  async execute(
    authContext: WorkspaceAuthContext,
    objectName: string,
    _payload: QueryResultFieldValue,
  ): Promise<void> {
    if (!CONTROLIT_TERRITORY_SYNC_SOURCE_OBJECTS.has(objectName)) {
      return;
    }

    await this.controlitTerritorySyncService.syncWorkspaceTerritories(
      authContext,
    );
  }
}

@Injectable()
@WorkspaceQueryHook({
  key: `*.${CommonQueryNames.CREATE_ONE}`,
  type: WorkspaceQueryHookType.POST_HOOK,
})
export class ControlitTerritorySyncCreateOnePostQueryHook extends ControlitTerritorySyncPostQueryHook {
  constructor(
    @Inject(ControlitTerritorySyncService)
    service: ControlitTerritorySyncService,
  ) {
    super(service);
  }
}

@Injectable()
@WorkspaceQueryHook({
  key: `*.${CommonQueryNames.CREATE_MANY}`,
  type: WorkspaceQueryHookType.POST_HOOK,
})
export class ControlitTerritorySyncCreateManyPostQueryHook extends ControlitTerritorySyncPostQueryHook {
  constructor(
    @Inject(ControlitTerritorySyncService)
    service: ControlitTerritorySyncService,
  ) {
    super(service);
  }
}

@Injectable()
@WorkspaceQueryHook({
  key: `*.${CommonQueryNames.UPDATE_ONE}`,
  type: WorkspaceQueryHookType.POST_HOOK,
})
export class ControlitTerritorySyncUpdateOnePostQueryHook extends ControlitTerritorySyncPostQueryHook {
  constructor(
    @Inject(ControlitTerritorySyncService)
    service: ControlitTerritorySyncService,
  ) {
    super(service);
  }
}

@Injectable()
@WorkspaceQueryHook({
  key: `*.${CommonQueryNames.UPDATE_MANY}`,
  type: WorkspaceQueryHookType.POST_HOOK,
})
export class ControlitTerritorySyncUpdateManyPostQueryHook extends ControlitTerritorySyncPostQueryHook {
  constructor(
    @Inject(ControlitTerritorySyncService)
    service: ControlitTerritorySyncService,
  ) {
    super(service);
  }
}

export const CONTROLIT_TERRITORY_SYNC_POST_QUERY_HOOKS = [
  ControlitTerritorySyncCreateOnePostQueryHook,
  ControlitTerritorySyncCreateManyPostQueryHook,
  ControlitTerritorySyncUpdateOnePostQueryHook,
  ControlitTerritorySyncUpdateManyPostQueryHook,
];
