import { Module } from '@nestjs/common';

import { CONTROLIT_RECORD_ACCESS_PRE_QUERY_HOOKS } from 'src/modules/controlit/territory-access/query-hooks/controlit-record-access.pre-query.hooks';
import { CONTROLIT_TERRITORY_SYNC_POST_QUERY_HOOKS } from 'src/modules/controlit/territory-access/query-hooks/controlit-territory-sync.post-query.hooks';
import { ControlitTerritoryAccessService } from 'src/modules/controlit/territory-access/services/controlit-territory-access.service';
import { ControlitTerritorySyncService } from 'src/modules/controlit/territory-access/services/controlit-territory-sync.service';

@Module({
  providers: [
    ControlitTerritoryAccessService,
    ControlitTerritorySyncService,
    ...CONTROLIT_RECORD_ACCESS_PRE_QUERY_HOOKS,
    ...CONTROLIT_TERRITORY_SYNC_POST_QUERY_HOOKS,
  ],
})
export class ControlitTerritoryAccessModule {}
