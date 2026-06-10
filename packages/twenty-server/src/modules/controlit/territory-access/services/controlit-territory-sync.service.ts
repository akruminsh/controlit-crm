import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { type DataSource } from 'typeorm';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';

@Injectable()
export class ControlitTerritorySyncService {
  constructor(
    @InjectDataSource()
    private readonly coreDataSource: DataSource,
  ) {}

  async syncWorkspaceTerritories(
    authContext: WorkspaceAuthContext,
  ): Promise<void> {
    const workspaceId = authContext.workspace?.id;

    if (!workspaceId) {
      return;
    }

    const schemaName = getWorkspaceSchemaName(workspaceId);

    try {
      for (const query of this.buildSyncQueries(schemaName)) {
        await this.coreDataSource.query(query);
      }
    } catch (error) {
      if (this.isMissingControlitMetadataError(error)) {
        return;
      }

      throw error;
    }
  }

  private buildSyncQueries(schemaName: string): string[] {
    return [
      this.buildPeopleSyncQuery(schemaName),
      this.buildProjectsSyncQuery(schemaName),
      this.buildTasksSyncQuery(schemaName),
      this.buildNotesSyncQuery(schemaName),
    ];
  }

  private buildPeopleSyncQuery(schemaName: string): string {
    return `
      UPDATE ${schemaName}."person" AS person
      SET
        "personTerritory" = company."companyCountry"::text::${schemaName}."person_personTerritory_enum",
        "updatedAt" = now()
      FROM ${schemaName}."company" AS company
      WHERE person."companyId" = company.id
        AND person."deletedAt" IS NULL
        AND company."deletedAt" IS NULL
        AND company."companyCountry" IS NOT NULL
        AND person."personTerritory" IS DISTINCT FROM company."companyCountry"::text::${schemaName}."person_personTerritory_enum"
    `;
  }

  private buildProjectsSyncQuery(schemaName: string): string {
    return `
      UPDATE ${schemaName}."opportunity" AS opportunity
      SET
        "projectCountry" = company."companyCountry"::text::${schemaName}."opportunity_projectCountry_enum",
        "updatedAt" = now()
      FROM ${schemaName}."company" AS company
      WHERE opportunity."companyId" = company.id
        AND opportunity."deletedAt" IS NULL
        AND company."deletedAt" IS NULL
        AND opportunity."projectCountry" IS NULL
        AND company."companyCountry" IS NOT NULL
    `;
  }

  private buildTasksSyncQuery(schemaName: string): string {
    return `
      WITH candidate_territories AS (
        SELECT
          task_target."taskId" AS "taskId",
          COALESCE(
            opportunity."projectCountry"::text,
            opportunity_company."companyCountry"::text,
            company."companyCountry"::text,
            person."personTerritory"::text,
            person_company."companyCountry"::text
          ) AS territory
        FROM ${schemaName}."taskTarget" AS task_target
        LEFT JOIN ${schemaName}."opportunity" AS opportunity
          ON opportunity.id = task_target."targetOpportunityId"
          AND opportunity."deletedAt" IS NULL
        LEFT JOIN ${schemaName}."company" AS opportunity_company
          ON opportunity_company.id = opportunity."companyId"
          AND opportunity_company."deletedAt" IS NULL
        LEFT JOIN ${schemaName}."company" AS company
          ON company.id = task_target."targetCompanyId"
          AND company."deletedAt" IS NULL
        LEFT JOIN ${schemaName}."person" AS person
          ON person.id = task_target."targetPersonId"
          AND person."deletedAt" IS NULL
        LEFT JOIN ${schemaName}."company" AS person_company
          ON person_company.id = person."companyId"
          AND person_company."deletedAt" IS NULL
        WHERE task_target."deletedAt" IS NULL
      ),
      inferred AS (
        SELECT
          "taskId",
          MIN(territory) AS territory
        FROM candidate_territories
        WHERE territory IS NOT NULL
        GROUP BY "taskId"
        HAVING COUNT(DISTINCT territory) = 1
      )
      UPDATE ${schemaName}."task" AS task
      SET
        "taskTerritory" = inferred.territory::${schemaName}."task_taskTerritory_enum",
        "updatedAt" = now()
      FROM inferred
      WHERE task.id = inferred."taskId"
        AND task."deletedAt" IS NULL
        AND task."taskTerritory" IS DISTINCT FROM inferred.territory::${schemaName}."task_taskTerritory_enum"
    `;
  }

  private buildNotesSyncQuery(schemaName: string): string {
    return `
      WITH candidate_territories AS (
        SELECT
          note_target."noteId" AS "noteId",
          COALESCE(
            opportunity."projectCountry"::text,
            opportunity_company."companyCountry"::text,
            company."companyCountry"::text,
            person."personTerritory"::text,
            person_company."companyCountry"::text
          ) AS territory
        FROM ${schemaName}."noteTarget" AS note_target
        LEFT JOIN ${schemaName}."opportunity" AS opportunity
          ON opportunity.id = note_target."targetOpportunityId"
          AND opportunity."deletedAt" IS NULL
        LEFT JOIN ${schemaName}."company" AS opportunity_company
          ON opportunity_company.id = opportunity."companyId"
          AND opportunity_company."deletedAt" IS NULL
        LEFT JOIN ${schemaName}."company" AS company
          ON company.id = note_target."targetCompanyId"
          AND company."deletedAt" IS NULL
        LEFT JOIN ${schemaName}."person" AS person
          ON person.id = note_target."targetPersonId"
          AND person."deletedAt" IS NULL
        LEFT JOIN ${schemaName}."company" AS person_company
          ON person_company.id = person."companyId"
          AND person_company."deletedAt" IS NULL
        WHERE note_target."deletedAt" IS NULL
      ),
      inferred AS (
        SELECT
          "noteId",
          MIN(territory) AS territory
        FROM candidate_territories
        WHERE territory IS NOT NULL
        GROUP BY "noteId"
        HAVING COUNT(DISTINCT territory) = 1
      )
      UPDATE ${schemaName}."note" AS note
      SET
        "noteTerritory" = inferred.territory::${schemaName}."note_noteTerritory_enum",
        "updatedAt" = now()
      FROM inferred
      WHERE note.id = inferred."noteId"
        AND note."deletedAt" IS NULL
        AND note."noteTerritory" IS DISTINCT FROM inferred.territory::${schemaName}."note_noteTerritory_enum"
    `;
  }

  private isMissingControlitMetadataError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string' &&
      ['42703', '42704', '42P01'].includes(error.code)
    );
  }
}
