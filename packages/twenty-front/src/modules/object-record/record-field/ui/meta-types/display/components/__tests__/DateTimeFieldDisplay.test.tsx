import { render, screen } from '@testing-library/react';
import { Temporal } from 'temporal-polyfill';

import { type Task } from '@/activities/types/Task';
import { DateFormat } from '@/localization/constants/DateFormat';
import { TimeFormat } from '@/localization/constants/TimeFormat';
import { FieldContext } from '@/object-record/record-field/ui/contexts/FieldContext';
import { DateTimeFieldDisplay } from '@/object-record/record-field/ui/meta-types/display/components/DateTimeFieldDisplay';
import { useDateTimeFieldDisplay } from '@/object-record/record-field/ui/meta-types/hooks/useDateTimeFieldDisplay';
import { type FieldDefinition } from '@/object-record/record-field/ui/types/FieldDefinition';
import {
  type FieldDateTimeMetadata,
  type FieldMetadata,
} from '@/object-record/record-field/ui/types/FieldMetadata';
import { useRecordFieldValue } from '@/object-record/record-store/hooks/useRecordFieldValue';
import { UserContext } from '@/users/contexts/UserContext';
import { FieldMetadataType } from '~/generated-metadata/graphql';

jest.mock(
  '@/object-record/record-field/ui/meta-types/hooks/useDateTimeFieldDisplay',
);
jest.mock('@/object-record/record-store/hooks/useRecordFieldValue');
jest.mock(
  'twenty-ui-deprecated/theme-constants',
  () => ({
    themeCssVariables: {
      font: {
        color: {
          danger: 'var(--t-font-color-danger)',
        },
      },
    },
  }),
  { virtual: true },
);
jest.mock('@/ui/field/display/components/DateTimeDisplay', () => ({
  DateTimeDisplay: ({ value }: { value: string | null | undefined }) => (
    <span data-testid="date-time-display">{value}</span>
  ),
}));

const mockedUseDateTimeFieldDisplay = jest.mocked(useDateTimeFieldDisplay);
const mockedUseRecordFieldValue = jest.mocked(useRecordFieldValue);

const dangerColor = 'var(--t-font-color-danger)';

const taskDueAtFieldDefinition = {
  fieldMetadataId: 'task-due-at-field-id',
  label: 'Due At',
  iconName: 'IconCalendar',
  type: FieldMetadataType.DATE_TIME,
  metadata: {
    fieldName: 'dueAt',
    objectMetadataNameSingular: 'task',
    placeHolder: 'Due At',
  },
} satisfies FieldDefinition<FieldDateTimeMetadata>;

const personCreatedAtFieldDefinition = {
  fieldMetadataId: 'person-created-at-field-id',
  label: 'Created At',
  iconName: 'IconCalendar',
  type: FieldMetadataType.DATE_TIME,
  metadata: {
    fieldName: 'createdAt',
    objectMetadataNameSingular: 'person',
    placeHolder: 'Created At',
  },
} satisfies FieldDefinition<FieldDateTimeMetadata>;

const renderDateTimeFieldDisplay = ({
  fieldDefinition,
  fieldValue,
  taskStatus,
  timeZone = 'UTC',
}: {
  fieldDefinition: FieldDefinition<FieldDateTimeMetadata>;
  fieldValue: string;
  taskStatus: Task['status'];
  timeZone?: string;
}) => {
  mockedUseDateTimeFieldDisplay.mockReturnValue({
    fieldDefinition,
    fieldValue,
    clearable: false,
  });
  mockedUseRecordFieldValue.mockReturnValue(taskStatus);

  return render(
    <UserContext.Provider
      value={{
        dateFormat: DateFormat.SYSTEM,
        timeFormat: TimeFormat.SYSTEM,
        timeZone,
      }}
    >
      <FieldContext.Provider
        value={{
          fieldDefinition: fieldDefinition as FieldDefinition<FieldMetadata>,
          recordId: 'record-id',
          isLabelIdentifier: false,
          isRecordFieldReadOnly: false,
        }}
      >
        <DateTimeFieldDisplay />
      </FieldContext.Provider>
    </UserContext.Provider>,
  );
};

describe('DateTimeFieldDisplay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('displays overdue task due date values with danger color', () => {
    renderDateTimeFieldDisplay({
      fieldDefinition: taskDueAtFieldDefinition,
      fieldValue: '2020-01-01T10:00:00.000Z',
      taskStatus: 'TODO',
    });

    expect(screen.getByTestId('date-time-display').parentElement).toHaveStyle({
      color: dangerColor,
    });
  });

  it('does not display other date time fields with danger color', () => {
    renderDateTimeFieldDisplay({
      fieldDefinition: personCreatedAtFieldDefinition,
      fieldValue: '2020-01-01T10:00:00.000Z',
      taskStatus: 'TODO',
    });

    expect(
      screen.getByTestId('date-time-display').parentElement,
    ).not.toHaveStyle({
      color: dangerColor,
    });
  });

  it('uses user timezone when checking whether task due date is overdue', () => {
    jest
      .spyOn(Temporal.Now, 'instant')
      .mockReturnValue(Temporal.Instant.from('2024-04-02T03:30:00.000Z'));

    renderDateTimeFieldDisplay({
      fieldDefinition: taskDueAtFieldDefinition,
      fieldValue: '2024-04-01T23:30:00.000Z',
      taskStatus: 'TODO',
      timeZone: 'America/Los_Angeles',
    });

    expect(
      screen.getByTestId('date-time-display').parentElement,
    ).not.toHaveStyle({
      color: dangerColor,
    });
  });
});
