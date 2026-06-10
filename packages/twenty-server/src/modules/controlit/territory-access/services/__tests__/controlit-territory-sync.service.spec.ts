import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { ControlitTerritorySyncService } from 'src/modules/controlit/territory-access/services/controlit-territory-sync.service';

const workspaceId = '63c3e463-fa79-4e0e-8f48-1363976393df';
const schemaName = getWorkspaceSchemaName(workspaceId);

const authContext = {
  type: 'user',
  workspace: { id: workspaceId },
  userWorkspaceId: 'user-workspace-id',
  workspaceMemberId: 'member-id',
} as unknown as WorkspaceAuthContext;

describe('ControlitTerritorySyncService', () => {
  const setup = ({
    queryImplementation = () => Promise.resolve([]),
  }: {
    queryImplementation?: (query: string) => Promise<unknown>;
  } = {}) => {
    const coreDataSource = {
      query: jest.fn(queryImplementation),
    };

    const service = new ControlitTerritorySyncService(
      coreDataSource as unknown as ConstructorParameters<
        typeof ControlitTerritorySyncService
      >[0],
    );

    return { coreDataSource, service };
  };

  const normalizeSql = (sql: string) => sql.replace(/\s+/g, ' ').trim();

  it('fills missing territory fields from related companies and projects', async () => {
    const { coreDataSource, service } = setup();

    await service.syncWorkspaceTerritories(authContext);

    expect(coreDataSource.query).toHaveBeenCalledTimes(4);

    const [peopleSql, projectsSql, tasksSql, notesSql] =
      coreDataSource.query.mock.calls.map(([sql]) => normalizeSql(sql));

    expect(peopleSql).toContain(`UPDATE ${schemaName}."person" AS person`);
    expect(peopleSql).toContain(
      `"personTerritory" = company."companyCountry"::text::${schemaName}."person_personTerritory_enum"`,
    );
    expect(peopleSql).toContain(
      `person."personTerritory" IS DISTINCT FROM company."companyCountry"::text::${schemaName}."person_personTerritory_enum"`,
    );
    expect(peopleSql).toContain('person."companyId" = company.id');

    expect(projectsSql).toContain(
      `UPDATE ${schemaName}."opportunity" AS opportunity`,
    );
    expect(projectsSql).toContain(
      `"projectCountry" = company."companyCountry"::text::${schemaName}."opportunity_projectCountry_enum"`,
    );
    expect(projectsSql).toContain('opportunity."projectCountry" IS NULL');
    expect(projectsSql).toContain('opportunity."companyId" = company.id');

    expect(tasksSql).toContain(`UPDATE ${schemaName}."task" AS task`);
    expect(tasksSql).toContain(
      `"taskTerritory" = inferred.territory::${schemaName}."task_taskTerritory_enum"`,
    );
    expect(tasksSql).toContain('task_target."targetOpportunityId"');
    expect(tasksSql).toContain('opportunity."projectCountry"::text');
    expect(tasksSql).toContain('opportunity_company."companyCountry"::text');
    expect(tasksSql).toContain('person_company."companyCountry"::text');
    expect(tasksSql).toContain('HAVING COUNT(DISTINCT territory) = 1');
    expect(tasksSql).toContain(
      `task."taskTerritory" IS DISTINCT FROM inferred.territory::${schemaName}."task_taskTerritory_enum"`,
    );

    expect(notesSql).toContain(`UPDATE ${schemaName}."note" AS note`);
    expect(notesSql).toContain(
      `"noteTerritory" = inferred.territory::${schemaName}."note_noteTerritory_enum"`,
    );
    expect(notesSql).toContain('note_target."targetOpportunityId"');
    expect(notesSql).toContain('opportunity."projectCountry"::text');
    expect(notesSql).toContain('company."companyCountry"::text');
    expect(notesSql).toContain('HAVING COUNT(DISTINCT territory) = 1');
    expect(notesSql).toContain(
      `note."noteTerritory" IS DISTINCT FROM inferred.territory::${schemaName}."note_noteTerritory_enum"`,
    );
  });

  it('does nothing when the workspace does not have Controlit territory metadata', async () => {
    const { coreDataSource, service } = setup({
      queryImplementation: () => Promise.reject({ code: '42703' }),
    });

    await expect(
      service.syncWorkspaceTerritories(authContext),
    ).resolves.toBeUndefined();
    expect(coreDataSource.query).toHaveBeenCalledTimes(1);
  });
});
