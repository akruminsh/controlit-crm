import { type Task } from '@/activities/types/Task';
import { Temporal } from 'temporal-polyfill';

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const parseDueAtPlainDate = (
  dueAt: string,
  timeZone: string,
): Temporal.PlainDate | null => {
  try {
    return Temporal.Instant.from(dueAt)
      .toZonedDateTimeISO(timeZone)
      .toPlainDate();
  } catch {
    //
  }

  if (!DATE_ONLY_REGEX.test(dueAt)) {
    return null;
  }

  try {
    return Temporal.PlainDate.from(dueAt);
  } catch {
    return null;
  }
};

type IsTaskDueAtOverdueParams = {
  dueAt: string | null | undefined;
  status: Task['status'] | undefined;
  now?: Temporal.Instant;
  timeZone?: string;
};

export const isTaskDueAtOverdue = ({
  dueAt,
  status,
  now = Temporal.Now.instant(),
  timeZone = 'UTC',
}: IsTaskDueAtOverdueParams) => {
  if (status !== 'TODO' && status !== 'IN_PROGRESS') {
    return false;
  }

  const trimmedDueAt = dueAt?.trim();

  if (!trimmedDueAt) {
    return false;
  }

  const dueAtPlainDate = parseDueAtPlainDate(trimmedDueAt, timeZone);

  if (!dueAtPlainDate) {
    return false;
  }

  try {
    const todayPlainDate = now.toZonedDateTimeISO(timeZone).toPlainDate();

    return Temporal.PlainDate.compare(dueAtPlainDate, todayPlainDate) === -1;
  } catch {
    return false;
  }
};
