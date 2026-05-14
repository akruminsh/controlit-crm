import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddControlitTerritoryAccess1778750000000
  implements MigrationInterface
{
  name = 'AddControlitTerritoryAccess1778750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "core"."controlitTerritoryAccess" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "workspaceMemberId" uuid NOT NULL,
        "territories" text[] NOT NULL DEFAULT '{}',
        "canManageTerritory" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_controlitTerritoryAccess_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_controlitTerritoryAccess_workspace_member" UNIQUE ("workspaceId", "workspaceMemberId"),
        CONSTRAINT "FK_controlitTerritoryAccess_workspace" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_controlitTerritoryAccess_workspace_member"
      ON "core"."controlitTerritoryAccess" ("workspaceId", "workspaceMemberId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_controlitTerritoryAccess_territories"
      ON "core"."controlitTerritoryAccess" USING GIN ("territories")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "core"."IDX_controlitTerritoryAccess_territories"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "core"."IDX_controlitTerritoryAccess_workspace_member"',
    );
    await queryRunner.query(
      'DROP TABLE IF EXISTS "core"."controlitTerritoryAccess"',
    );
  }
}
