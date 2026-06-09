import { Inject, Injectable } from '@nestjs/common';

import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type ResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';

import { CommonQueryNames } from 'src/engine/api/common/types/common-query-args.type';
import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { ControlitTerritoryAccessService } from 'src/modules/controlit/territory-access/services/controlit-territory-access.service';

abstract class ControlitRecordAccessPreQueryHook implements WorkspacePreQueryHookInstance {
  protected constructor(
    protected readonly controlitTerritoryAccessService: ControlitTerritoryAccessService,
    private readonly methodName: CommonQueryNames,
  ) {}

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
}

@Injectable()
@WorkspaceQueryHook(`*.${CommonQueryNames.FIND_MANY}`)
export class ControlitRecordAccessFindManyPreQueryHook extends ControlitRecordAccessPreQueryHook {
  constructor(
    @Inject(ControlitTerritoryAccessService)
    service: ControlitTerritoryAccessService,
  ) {
    super(service, CommonQueryNames.FIND_MANY);
  }
}

@Injectable()
@WorkspaceQueryHook(`*.${CommonQueryNames.FIND_ONE}`)
export class ControlitRecordAccessFindOnePreQueryHook extends ControlitRecordAccessPreQueryHook {
  constructor(
    @Inject(ControlitTerritoryAccessService)
    service: ControlitTerritoryAccessService,
  ) {
    super(service, CommonQueryNames.FIND_ONE);
  }
}

@Injectable()
@WorkspaceQueryHook(`*.${CommonQueryNames.GROUP_BY}`)
export class ControlitRecordAccessGroupByPreQueryHook extends ControlitRecordAccessPreQueryHook {
  constructor(
    @Inject(ControlitTerritoryAccessService)
    service: ControlitTerritoryAccessService,
  ) {
    super(service, CommonQueryNames.GROUP_BY);
  }
}

@Injectable()
@WorkspaceQueryHook(`*.${CommonQueryNames.FIND_DUPLICATES}`)
export class ControlitRecordAccessFindDuplicatesPreQueryHook extends ControlitRecordAccessPreQueryHook {
  constructor(
    @Inject(ControlitTerritoryAccessService)
    service: ControlitTerritoryAccessService,
  ) {
    super(service, CommonQueryNames.FIND_DUPLICATES);
  }
}

@Injectable()
@WorkspaceQueryHook(`*.${CommonQueryNames.CREATE_ONE}`)
export class ControlitRecordAccessCreateOnePreQueryHook extends ControlitRecordAccessPreQueryHook {
  constructor(
    @Inject(ControlitTerritoryAccessService)
    service: ControlitTerritoryAccessService,
  ) {
    super(service, CommonQueryNames.CREATE_ONE);
  }
}

@Injectable()
@WorkspaceQueryHook(`*.${CommonQueryNames.CREATE_MANY}`)
export class ControlitRecordAccessCreateManyPreQueryHook extends ControlitRecordAccessPreQueryHook {
  constructor(
    @Inject(ControlitTerritoryAccessService)
    service: ControlitTerritoryAccessService,
  ) {
    super(service, CommonQueryNames.CREATE_MANY);
  }
}

@Injectable()
@WorkspaceQueryHook(`*.${CommonQueryNames.UPDATE_ONE}`)
export class ControlitRecordAccessUpdateOnePreQueryHook extends ControlitRecordAccessPreQueryHook {
  constructor(
    @Inject(ControlitTerritoryAccessService)
    service: ControlitTerritoryAccessService,
  ) {
    super(service, CommonQueryNames.UPDATE_ONE);
  }
}

@Injectable()
@WorkspaceQueryHook(`*.${CommonQueryNames.UPDATE_MANY}`)
export class ControlitRecordAccessUpdateManyPreQueryHook extends ControlitRecordAccessPreQueryHook {
  constructor(
    @Inject(ControlitTerritoryAccessService)
    service: ControlitTerritoryAccessService,
  ) {
    super(service, CommonQueryNames.UPDATE_MANY);
  }
}

@Injectable()
@WorkspaceQueryHook(`*.${CommonQueryNames.DELETE_ONE}`)
export class ControlitRecordAccessDeleteOnePreQueryHook extends ControlitRecordAccessPreQueryHook {
  constructor(
    @Inject(ControlitTerritoryAccessService)
    service: ControlitTerritoryAccessService,
  ) {
    super(service, CommonQueryNames.DELETE_ONE);
  }
}

@Injectable()
@WorkspaceQueryHook(`*.${CommonQueryNames.DELETE_MANY}`)
export class ControlitRecordAccessDeleteManyPreQueryHook extends ControlitRecordAccessPreQueryHook {
  constructor(
    @Inject(ControlitTerritoryAccessService)
    service: ControlitTerritoryAccessService,
  ) {
    super(service, CommonQueryNames.DELETE_MANY);
  }
}

@Injectable()
@WorkspaceQueryHook(`*.${CommonQueryNames.RESTORE_ONE}`)
export class ControlitRecordAccessRestoreOnePreQueryHook extends ControlitRecordAccessPreQueryHook {
  constructor(
    @Inject(ControlitTerritoryAccessService)
    service: ControlitTerritoryAccessService,
  ) {
    super(service, CommonQueryNames.RESTORE_ONE);
  }
}

@Injectable()
@WorkspaceQueryHook(`*.${CommonQueryNames.RESTORE_MANY}`)
export class ControlitRecordAccessRestoreManyPreQueryHook extends ControlitRecordAccessPreQueryHook {
  constructor(
    @Inject(ControlitTerritoryAccessService)
    service: ControlitTerritoryAccessService,
  ) {
    super(service, CommonQueryNames.RESTORE_MANY);
  }
}

@Injectable()
@WorkspaceQueryHook(`*.${CommonQueryNames.DESTROY_ONE}`)
export class ControlitRecordAccessDestroyOnePreQueryHook extends ControlitRecordAccessPreQueryHook {
  constructor(
    @Inject(ControlitTerritoryAccessService)
    service: ControlitTerritoryAccessService,
  ) {
    super(service, CommonQueryNames.DESTROY_ONE);
  }
}

@Injectable()
@WorkspaceQueryHook(`*.${CommonQueryNames.DESTROY_MANY}`)
export class ControlitRecordAccessDestroyManyPreQueryHook extends ControlitRecordAccessPreQueryHook {
  constructor(
    @Inject(ControlitTerritoryAccessService)
    service: ControlitTerritoryAccessService,
  ) {
    super(service, CommonQueryNames.DESTROY_MANY);
  }
}

@Injectable()
@WorkspaceQueryHook(`*.${CommonQueryNames.MERGE_MANY}`)
export class ControlitRecordAccessMergeManyPreQueryHook extends ControlitRecordAccessPreQueryHook {
  constructor(
    @Inject(ControlitTerritoryAccessService)
    service: ControlitTerritoryAccessService,
  ) {
    super(service, CommonQueryNames.MERGE_MANY);
  }
}

export const CONTROLIT_RECORD_ACCESS_PRE_QUERY_HOOKS = [
  ControlitRecordAccessFindManyPreQueryHook,
  ControlitRecordAccessFindOnePreQueryHook,
  ControlitRecordAccessGroupByPreQueryHook,
  ControlitRecordAccessFindDuplicatesPreQueryHook,
  ControlitRecordAccessCreateOnePreQueryHook,
  ControlitRecordAccessCreateManyPreQueryHook,
  ControlitRecordAccessUpdateOnePreQueryHook,
  ControlitRecordAccessUpdateManyPreQueryHook,
  ControlitRecordAccessDeleteOnePreQueryHook,
  ControlitRecordAccessDeleteManyPreQueryHook,
  ControlitRecordAccessRestoreOnePreQueryHook,
  ControlitRecordAccessRestoreManyPreQueryHook,
  ControlitRecordAccessDestroyOnePreQueryHook,
  ControlitRecordAccessDestroyManyPreQueryHook,
  ControlitRecordAccessMergeManyPreQueryHook,
];
