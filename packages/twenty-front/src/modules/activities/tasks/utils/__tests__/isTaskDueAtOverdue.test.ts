import { Temporal } from 'temporal-polyfill';

import { isTaskDueAtOverdue } from '@/activities/tasks/utils/isTaskDueAtOverdue';

describe('isTaskDueAtOverdue', () => {
  const now = Temporal.Instant.from('2024-04-02T12:00:00Z');

  it('returns false for empty due dates', () => {
    expect(isTaskDueAtOverdue(null, 'TODO', now)).toBe(false);
    expect(isTaskDueAtOverdue(undefined, 'TODO', now)).toBe(false);
    expect(isTaskDueAtOverdue('', 'TODO', now)).toBe(false);
    expect(isTaskDueAtOverdue('   ', 'TODO', now)).toBe(false);
  });

  it('returns false for done tasks even when the due date is in the past', () => {
    expect(isTaskDueAtOverdue('2024-04-01', 'DONE', now)).toBe(false);
  });

  it('returns true when the due date is before today', () => {
    expect(isTaskDueAtOverdue('2024-04-01', 'TODO', now)).toBe(true);
  });

  it('returns false when the due date is today', () => {
    expect(isTaskDueAtOverdue('2024-04-02', 'TODO', now)).toBe(false);
  });

  it('compares due dates against today in the provided time zone', () => {
    const boundaryNow = Temporal.Instant.from('2024-04-02T00:30:00Z');
    const dueAt = '2024-04-01T23:30:00Z';

    expect(isTaskDueAtOverdue(dueAt, 'TODO', boundaryNow, 'UTC')).toBe(true);
    expect(
      isTaskDueAtOverdue(dueAt, 'TODO', boundaryNow, 'America/Los_Angeles'),
    ).toBe(false);
  });

  it('returns false for invalid due dates', () => {
    expect(isTaskDueAtOverdue('not-a-date', 'TODO', now)).toBe(false);
  });
});
