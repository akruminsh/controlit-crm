import { type ObjectRecordFilter } from 'src/engine/api/graphql/workspace-query-builder/interfaces/object-record.interface';

import {
  CONTROLIT_NO_RECORD_ID,
  type ControlitTerritory,
} from 'src/modules/controlit/territory-access/constants/controlit-territory.constants';

type TaskOwnershipRecord = {
  assigneeId?: string | null;
  createdBy?: {
    workspaceMemberId?: string | null;
  } | null;
};

type CreatedByOwnershipRecord = {
  createdBy?: {
    workspaceMemberId?: string | null;
  } | null;
};

export const mergeObjectFilter = (
  existingFilter: ObjectRecordFilter | undefined,
  fieldName: string,
  territories: ControlitTerritory[],
): ObjectRecordFilter => {
  const territoryFilter =
    territories.length === 0
      ? ({ id: { eq: CONTROLIT_NO_RECORD_ID } } as ObjectRecordFilter)
      : ({
          [fieldName]: { in: territories },
        } as ObjectRecordFilter);

  if (!existingFilter || Object.keys(existingFilter).length === 0) {
    return territoryFilter;
  }

  return {
    and: [existingFilter, territoryFilter],
  } as ObjectRecordFilter;
};

export const buildTaskManagerOwnershipFilter = (
  workspaceMemberId: string,
): ObjectRecordFilter =>
  ({
    or: [
      { assigneeId: { eq: workspaceMemberId } },
      { createdBy: { workspaceMemberId: { eq: workspaceMemberId } } },
    ],
  }) as ObjectRecordFilter;

export const isTaskOwnedByWorkspaceMember = (
  task: TaskOwnershipRecord,
  workspaceMemberId: string,
): boolean =>
  task.assigneeId === workspaceMemberId ||
  task.createdBy?.workspaceMemberId === workspaceMemberId;

export const isRecordCreatedByWorkspaceMember = (
  record: CreatedByOwnershipRecord,
  workspaceMemberId: string,
): boolean => record.createdBy?.workspaceMemberId === workspaceMemberId;

export const getRecordTerritory = (
  record: Record<string, unknown>,
  fieldName: string,
): ControlitTerritory | null => {
  const territory = record[fieldName];

  return typeof territory === 'string'
    ? (territory as ControlitTerritory)
    : null;
};
