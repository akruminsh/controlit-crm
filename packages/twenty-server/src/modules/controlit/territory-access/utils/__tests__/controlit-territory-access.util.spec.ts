import {
  buildTaskManagerOwnershipFilter,
  getRecordTerritory,
  isTaskOwnedByWorkspaceMember,
  mergeObjectFilter,
} from 'src/modules/controlit/territory-access/utils/controlit-territory-access.util';

describe('controlit territory access utils', () => {
  describe('mergeObjectFilter', () => {
    it('adds a territory filter to an empty find filter', () => {
      expect(
        mergeObjectFilter(undefined, 'companyCountry', ['FINLAND']),
      ).toEqual({
        companyCountry: { in: ['FINLAND'] },
      });
    });

    it('combines existing filters with territory filters using and', () => {
      expect(
        mergeObjectFilter({ name: { ilike: '%YIT%' } }, 'companyCountry', [
          'FINLAND',
        ]),
      ).toEqual({
        and: [
          { name: { ilike: '%YIT%' } },
          { companyCountry: { in: ['FINLAND'] } },
        ],
      });
    });

    it('uses an impossible id filter when scoped user has no territories', () => {
      expect(mergeObjectFilter(undefined, 'companyCountry', [])).toEqual({
        id: { eq: '00000000-0000-0000-0000-000000000000' },
      });
    });
  });

  describe('task ownership', () => {
    it('matches a task assigned to the workspace member', () => {
      expect(
        isTaskOwnedByWorkspaceMember(
          { assigneeId: 'member-id', createdBy: { workspaceMemberId: null } },
          'member-id',
        ),
      ).toBe(true);
    });

    it('matches a task created by the workspace member', () => {
      expect(
        isTaskOwnedByWorkspaceMember(
          {
            assigneeId: 'other-member-id',
            createdBy: { workspaceMemberId: 'member-id' },
          },
          'member-id',
        ),
      ).toBe(true);
    });

    it('does not match unrelated tasks', () => {
      expect(
        isTaskOwnedByWorkspaceMember(
          {
            assigneeId: 'other-member-id',
            createdBy: { workspaceMemberId: 'creator-id' },
          },
          'member-id',
        ),
      ).toBe(false);
    });

    it('builds the manager ownership filter for task reads or bulk changes', () => {
      expect(buildTaskManagerOwnershipFilter('member-id')).toEqual({
        or: [
          { assigneeId: { eq: 'member-id' } },
          { createdBy: { workspaceMemberId: { eq: 'member-id' } } },
        ],
      });
    });
  });

  describe('getRecordTerritory', () => {
    it('returns territory values only when the field contains a string', () => {
      expect(
        getRecordTerritory({ companyCountry: 'FINLAND' }, 'companyCountry'),
      ).toBe('FINLAND');
      expect(
        getRecordTerritory({ companyCountry: null }, 'companyCountry'),
      ).toBe(null);
      expect(
        getRecordTerritory({ companyCountry: ['FINLAND'] }, 'companyCountry'),
      ).toBe(null);
    });
  });
});
