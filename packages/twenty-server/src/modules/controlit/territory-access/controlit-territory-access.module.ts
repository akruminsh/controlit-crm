import { Module } from '@nestjs/common';

import { CONTROLIT_RECORD_ACCESS_PRE_QUERY_HOOKS } from 'src/modules/controlit/territory-access/query-hooks/controlit-record-access.pre-query.hooks';
import { ControlitTerritoryAccessService } from 'src/modules/controlit/territory-access/services/controlit-territory-access.service';

@Module({
  providers: [
    ControlitTerritoryAccessService,
    ...CONTROLIT_RECORD_ACCESS_PRE_QUERY_HOOKS,
  ],
})
export class ControlitTerritoryAccessModule {}
