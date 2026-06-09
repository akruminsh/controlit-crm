import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { type DataSource } from 'typeorm';

import { type ObjectRecordFilter } from 'src/engine/api/graphql/workspace-query-builder/interfaces/object-record.interface';
import { type ResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';

import { CommonQueryNames } from 'src/engine/api/common/types/common-query-args.type';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import {
  PermissionsException,
  PermissionsExceptionCode,
  PermissionsExceptionMessage,
} from 'src/engine/metadata-modules/permissions/permissions.exception';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import {
  CONTROLIT_TERRITORIES,
  CONTROLIT_TERRITORY_FIELD_BY_OBJECT,
  type ControlitRestrictedObjectName,
  type ControlitTerritory,
} from 'src/modules/controlit/territory-access/constants/controlit-territory.constants';
import {
  getRecordTerritory,
  isRecordCreatedByWorkspaceMember,
  isTaskOwnedByWorkspaceMember,
  mergeObjectFilter,
} from 'src/modules/controlit/territory-access/utils/controlit-territory-access.util';

type ControlitTerritoryAccessRow = {
  territories: string[] | null;
  canManageTerritory: boolean;
};

type ControlitRoleBypassRow = {
  canUpdateAllSettings: boolean;
};

type ControlitTerritoryAccessScope = {
  workspaceMemberId: string;
  territories: ControlitTerritory[];
  canManageTerritory: boolean;
};

type PayloadWithFilter = ResolverArgs & {
  filter?: ObjectRecordFilter;
};

type PayloadWithData = ResolverArgs & {
  data?: Record<string, unknown> | Record<string, unknown>[];
};

type PayloadWithId = ResolverArgs & {
  id: string;
};

const CONTROLIT_TERRITORY_SET = new Set<string>(CONTROLIT_TERRITORIES);

const READ_METHODS = new Set<string>([
  CommonQueryNames.FIND_MANY,
  CommonQueryNames.FIND_ONE,
  CommonQueryNames.GROUP_BY,
]);

const BULK_FILTER_MUTATION_METHODS = new Set<string>([
  CommonQueryNames.UPDATE_MANY,
  CommonQueryNames.DELETE_MANY,
  CommonQueryNames.RESTORE_MANY,
]);

const SINGLE_RECORD_MUTATION_METHODS = new Set<string>([
  CommonQueryNames.UPDATE_ONE,
  CommonQueryNames.DELETE_ONE,
  CommonQueryNames.RESTORE_ONE,
]);

const USER_OWNED_MUTATION_OBJECTS = new Set<string>(['opportunity', 'task']);

@Injectable()
export class ControlitTerritoryAccessService {
  constructor(
    @InjectDataSource()
    private readonly coreDataSource: DataSource,
    @Inject(GlobalWorkspaceOrmManager)
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async applyPreQueryHook(
    authContext: WorkspaceAuthContext,
    objectName: string,
    methodName: CommonQueryNames | string,
    payload: ResolverArgs,
  ): Promise<ResolverArgs> {
    const territoryFieldName = this.getTerritoryFieldName(objectName);

    if (!territoryFieldName) {
      return payload;
    }

    const scope = await this.getAccessScope(authContext);

    if (!scope) {
      return payload;
    }

    if (READ_METHODS.has(methodName)) {
      return this.withTerritoryFilter(payload, territoryFieldName, scope);
    }

    if (
      methodName === CommonQueryNames.FIND_DUPLICATES ||
      methodName === CommonQueryNames.MERGE_MANY
    ) {
      this.throwPermissionDenied();
    }

    if (methodName === CommonQueryNames.CREATE_ONE) {
      this.validateCreateDataOrThrow(
        objectName,
        territoryFieldName,
        scope,
        (payload as PayloadWithData).data,
      );

      return payload;
    }

    if (methodName === CommonQueryNames.CREATE_MANY) {
      const data = (payload as PayloadWithData).data;

      if (!Array.isArray(data)) {
        this.throwPermissionDenied();
      }

      for (const record of data) {
        this.validateCreateDataOrThrow(
          objectName,
          territoryFieldName,
          scope,
          record,
        );
      }

      return payload;
    }

    if (SINGLE_RECORD_MUTATION_METHODS.has(methodName)) {
      await this.validateSingleRecordMutationOrThrow(
        authContext,
        objectName,
        territoryFieldName,
        scope,
        methodName,
        payload as PayloadWithId & PayloadWithData,
      );

      return payload;
    }

    if (BULK_FILTER_MUTATION_METHODS.has(methodName)) {
      this.validateBulkMutationOrThrow(
        objectName,
        territoryFieldName,
        scope,
        methodName,
        payload as PayloadWithFilter & PayloadWithData,
      );

      return this.withTerritoryFilter(payload, territoryFieldName, scope);
    }

    if (
      methodName === CommonQueryNames.DESTROY_ONE ||
      methodName === CommonQueryNames.DESTROY_MANY
    ) {
      this.throwPermissionDenied();
    }

    return payload;
  }

  private getTerritoryFieldName(objectName: string): string | null {
    return objectName in CONTROLIT_TERRITORY_FIELD_BY_OBJECT
      ? CONTROLIT_TERRITORY_FIELD_BY_OBJECT[
          objectName as ControlitRestrictedObjectName
        ]
      : null;
  }

  private async getAccessScope(
    authContext: WorkspaceAuthContext,
  ): Promise<ControlitTerritoryAccessScope | null> {
    if (authContext.type === 'apiKey') {
      return null;
    }

    if (authContext.type !== 'user') {
      return null;
    }

    const workspaceId = authContext.workspace.id;
    const userWorkspaceId = authContext.userWorkspaceId;
    const workspaceMemberId = authContext.workspaceMemberId;

    if (!userWorkspaceId || !workspaceMemberId) {
      return null;
    }

    if (await this.hasAdminBypass(workspaceId, userWorkspaceId)) {
      return null;
    }

    let rows: ControlitTerritoryAccessRow[];

    try {
      rows = await this.coreDataSource.query<ControlitTerritoryAccessRow[]>(
        `
          SELECT "territories", "canManageTerritory"
          FROM "core"."controlitTerritoryAccess"
          WHERE "workspaceId" = $1
            AND "workspaceMemberId" = $2
          LIMIT 1
        `,
        [workspaceId, workspaceMemberId],
      );
    } catch (error) {
      if (this.isMissingTerritoryAccessTableError(error)) {
        return this.buildFailClosedScope(workspaceMemberId);
      }

      throw error;
    }

    const row = rows[0];

    if (!row) {
      return this.buildFailClosedScope(workspaceMemberId);
    }

    return {
      workspaceMemberId,
      territories: this.normalizeTerritories(row.territories),
      canManageTerritory: row.canManageTerritory,
    };
  }

  private buildFailClosedScope(
    workspaceMemberId: string,
  ): ControlitTerritoryAccessScope {
    return {
      workspaceMemberId,
      territories: [],
      canManageTerritory: false,
    };
  }

  private normalizeTerritories(
    territories: string[] | null,
  ): ControlitTerritory[] {
    if (!territories) {
      return [];
    }

    return territories.filter((territory): territory is ControlitTerritory =>
      CONTROLIT_TERRITORY_SET.has(territory),
    );
  }

  private async hasAdminBypass(
    workspaceId: string,
    userWorkspaceId: string,
  ): Promise<boolean> {
    const rows = await this.coreDataSource.query<ControlitRoleBypassRow[]>(
      `
        SELECT role."canUpdateAllSettings"
        FROM "core"."roleTargets" roleTargets
        INNER JOIN "core"."role" role
          ON role.id = roleTargets."roleId"
        WHERE roleTargets."workspaceId" = $1
          AND roleTargets."userWorkspaceId" = $2
      `,
      [workspaceId, userWorkspaceId],
    );

    return rows.some((row) => row.canUpdateAllSettings === true);
  }

  private isMissingTerritoryAccessTableError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '42P01'
    );
  }

  private withTerritoryFilter(
    payload: ResolverArgs,
    territoryFieldName: string,
    scope: ControlitTerritoryAccessScope,
  ): ResolverArgs {
    const payloadWithFilter = payload as PayloadWithFilter;

    return {
      ...payload,
      filter: mergeObjectFilter(
        payloadWithFilter.filter,
        territoryFieldName,
        scope.territories,
      ),
    } as ResolverArgs;
  }

  private validateCreateDataOrThrow(
    objectName: string,
    territoryFieldName: string,
    scope: ControlitTerritoryAccessScope,
    data: Record<string, unknown> | Record<string, unknown>[] | undefined,
  ) {
    if (!data || Array.isArray(data)) {
      this.throwPermissionDenied();
    }

    if (!USER_OWNED_MUTATION_OBJECTS.has(objectName)) {
      this.throwPermissionDenied();
    }

    this.validateTerritoryValueOrThrow(data, territoryFieldName, scope);
  }

  private validateBulkMutationOrThrow(
    _objectName: string,
    _territoryFieldName: string,
    _scope: ControlitTerritoryAccessScope,
    _methodName: string,
    _payload: PayloadWithFilter & PayloadWithData,
  ) {
    this.throwPermissionDenied();
  }

  private async validateSingleRecordMutationOrThrow(
    authContext: WorkspaceAuthContext,
    objectName: string,
    territoryFieldName: string,
    scope: ControlitTerritoryAccessScope,
    methodName: string,
    payload: PayloadWithId & PayloadWithData,
  ) {
    if (!payload.id) {
      this.throwPermissionDenied();
    }

    if (methodName !== CommonQueryNames.UPDATE_ONE) {
      this.throwPermissionDenied();
    }

    if (methodName === CommonQueryNames.UPDATE_ONE) {
      this.validateTerritoryUpdateDataOrThrow(
        payload.data,
        territoryFieldName,
        scope,
      );
    }

    if (!USER_OWNED_MUTATION_OBJECTS.has(objectName)) {
      this.throwPermissionDenied();
    }

    const record = await this.findRecordOrThrow(
      authContext,
      objectName,
      payload.id,
    );

    this.validateRecordTerritoryOrThrow(record, territoryFieldName, scope);

    if (
      objectName === 'task' &&
      !isTaskOwnedByWorkspaceMember(record, scope.workspaceMemberId)
    ) {
      this.throwPermissionDenied();
    }

    if (
      objectName === 'opportunity' &&
      !isRecordCreatedByWorkspaceMember(record, scope.workspaceMemberId)
    ) {
      this.throwPermissionDenied();
    }
  }

  private validateTerritoryUpdateDataOrThrow(
    data: Record<string, unknown> | Record<string, unknown>[] | undefined,
    territoryFieldName: string,
    scope: ControlitTerritoryAccessScope,
  ) {
    if (!data || Array.isArray(data) || !(territoryFieldName in data)) {
      return;
    }

    this.validateTerritoryValueOrThrow(data, territoryFieldName, scope);
  }

  private validateTerritoryValueOrThrow(
    data: Record<string, unknown>,
    territoryFieldName: string,
    scope: ControlitTerritoryAccessScope,
  ) {
    const territory = getRecordTerritory(data, territoryFieldName);

    if (!territory || !scope.territories.includes(territory)) {
      this.throwPermissionDenied();
    }
  }

  private validateRecordTerritoryOrThrow(
    record: Record<string, unknown>,
    territoryFieldName: string,
    scope: ControlitTerritoryAccessScope,
  ) {
    const territory = getRecordTerritory(record, territoryFieldName);

    if (!territory || !scope.territories.includes(territory)) {
      this.throwPermissionDenied();
    }
  }

  private async findRecordOrThrow(
    authContext: WorkspaceAuthContext,
    objectName: string,
    id: string,
  ): Promise<Record<string, unknown>> {
    const workspaceId = authContext.workspace?.id;

    if (!workspaceId) {
      this.throwPermissionDenied();
    }

    const record =
      await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const repository = await this.globalWorkspaceOrmManager.getRepository<
            Record<string, unknown>
          >(workspaceId, objectName, { shouldBypassPermissionChecks: true });

          return repository.findOneBy({ id });
        },
        authContext,
      );

    if (!record) {
      this.throwPermissionDenied();
    }

    return record;
  }

  private throwPermissionDenied(): never {
    throw new PermissionsException(
      PermissionsExceptionMessage.PERMISSION_DENIED,
      PermissionsExceptionCode.PERMISSION_DENIED,
    );
  }
}
