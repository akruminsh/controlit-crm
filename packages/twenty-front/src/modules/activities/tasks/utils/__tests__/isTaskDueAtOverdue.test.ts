import { Temporal } from 'temporal-polyfill';

import { isTaskDueAtOverdue } from '@/activities/tasks/utils/isTaskDueAtOverdue';

describe('isTaskDueAtOverdue', () => {
  const now = Temporal.Instant.from('2024-04-02T12:00:00Z');

  it('returns false for empty due dates', () => {
    expect(isTaskDueAtOverdue({ dueAt: null, status: 'TODO', now })).toBe(
      false,
    );
    expect(isTaskDueAtOverdue({ dueAt: undefined, status: 'TODO', now })).toBe(
      false,
    );
    expect(isTaskDueAtOverdue({ dueAt: '', status: 'TODO', now })).toBe(false);
    expect(isTaskDueAtOverdue({ dueAt: '   ', status: 'TODO', now })).toBe(
      false,
    );
  });

  it('returns false for done tasks even when the due date is in the past', () => {
    expect(
      isTaskDueAtOverdue({ dueAt: '2024-04-01', status: 'DONE', now }),
    ).toBe(false);
  });

  it('returns true when the due date is before today', () => {
    expect(
      isTaskDueAtOverdue({ dueAt: '2024-04-01', status: 'TODO', now }),
    ).toBe(true);
  });

  it('returns false when the due date is today', () => {
    expect(
      isTaskDueAtOverdue({ dueAt: '2024-04-02', status: 'TODO', now }),
    ).toBe(false);
  });

  it('compares due dates against today in the provided time zone', () => {
    const boundaryNow = Temporal.Instant.from('2024-04-02T00:30:00Z');
    const dueAt = '2024-04-01T23:30:00Z';

    expect(
      isTaskDueAtOverdue({
        dueAt,
        status: 'TODO',
        now: boundaryNow,
        timeZone: 'UTC',
      }),
    ).toBe(true);
    expect(
      isTaskDueAtOverdue({
        dueAt,
        status: 'TODO',
        now: boundaryNow,
        timeZone: 'America/Los_Angeles',
      }),
    ).toBe(false);
  });

  it('returns false for invalid due dates', () => {
    expect(
      isTaskDueAtOverdue({ dueAt: 'not-a-date', status: 'TODO', now }),
    ).toBe(false);
  });
});
