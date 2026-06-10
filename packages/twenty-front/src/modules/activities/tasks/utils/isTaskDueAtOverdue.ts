import { Temporal } from 'temporal-polyfill';

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

  try {
    return Temporal.PlainDate.from(dueAt);
  } catch {
    return null;
  }
};

type IsTaskDueAtOverdueParams = {
  dueAt: string | null | undefined;
  status: string | null | undefined;
  now?: Temporal.Instant;
  timeZone?: string;
};

export const isTaskDueAtOverdue = ({
  dueAt,
  status,
  now = Temporal.Now.instant(),
  timeZone = 'UTC',
}: IsTaskDueAtOverdueParams) => {
  if (status === 'DONE') {
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
