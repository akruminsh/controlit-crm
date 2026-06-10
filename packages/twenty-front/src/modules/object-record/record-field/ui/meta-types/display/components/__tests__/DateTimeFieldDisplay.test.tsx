import { render, screen } from '@testing-library/react';

import { type Task } from '@/activities/types/Task';
import { FieldContext } from '@/object-record/record-field/ui/contexts/FieldContext';
import { DateTimeFieldDisplay } from '@/object-record/record-field/ui/meta-types/display/components/DateTimeFieldDisplay';
import { useDateTimeFieldDisplay } from '@/object-record/record-field/ui/meta-types/hooks/useDateTimeFieldDisplay';
import { type FieldDefinition } from '@/object-record/record-field/ui/types/FieldDefinition';
import {
  type FieldDateTimeMetadata,
  type FieldMetadata,
} from '@/object-record/record-field/ui/types/FieldMetadata';
import { useRecordFieldValue } from '@/object-record/record-store/hooks/useRecordFieldValue';
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
}: {
  fieldDefinition: FieldDefinition<FieldDateTimeMetadata>;
  fieldValue: string;
  taskStatus: Task['status'];
}) => {
  mockedUseDateTimeFieldDisplay.mockReturnValue({
    fieldDefinition,
    fieldValue,
    clearable: false,
  });
  mockedUseRecordFieldValue.mockReturnValue(taskStatus);

  return render(
    <FieldContext.Provider
      value={{
        fieldDefinition: fieldDefinition as FieldDefinition<FieldMetadata>,
        recordId: 'record-id',
        isLabelIdentifier: false,
        isRecordFieldReadOnly: false,
      }}
    >
      <DateTimeFieldDisplay />
    </FieldContext.Provider>,
  );
};

describe('DateTimeFieldDisplay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
