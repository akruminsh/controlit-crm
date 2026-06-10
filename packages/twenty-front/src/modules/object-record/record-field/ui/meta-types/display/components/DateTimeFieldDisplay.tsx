import { useContext } from 'react';

import { type Task } from '@/activities/types/Task';
import { isTaskDueAtOverdue } from '@/activities/tasks/utils/isTaskDueAtOverdue';
import { FieldContext } from '@/object-record/record-field/ui/contexts/FieldContext';
import { useDateTimeFieldDisplay } from '@/object-record/record-field/ui/meta-types/hooks/useDateTimeFieldDisplay';
import { type FieldDefinition } from '@/object-record/record-field/ui/types/FieldDefinition';
import { type FieldDateTimeMetadata } from '@/object-record/record-field/ui/types/FieldMetadata';
import { useRecordFieldValue } from '@/object-record/record-store/hooks/useRecordFieldValue';
import { DateTimeDisplay } from '@/ui/field/display/components/DateTimeDisplay';
import { UserContext } from '@/users/contexts/UserContext';
import { themeCssVariables } from 'twenty-ui-deprecated/theme-constants';

const overdueTaskDueAtStyle = {
  color: themeCssVariables.font.color.danger,
};

type TaskDueAtDateTimeFieldDisplayProps = {
  fieldDefinition: FieldDefinition<FieldDateTimeMetadata>;
  fieldValue: string | undefined;
};

const TaskDueAtDateTimeFieldDisplay = ({
  fieldDefinition,
  fieldValue,
}: TaskDueAtDateTimeFieldDisplayProps) => {
  const { recordId } = useContext(FieldContext);
  const { timeZone } = useContext(UserContext);

  const dateFieldSettings = fieldDefinition.metadata?.settings;
  const taskStatus = useRecordFieldValue<Task['status']>(
    recordId,
    'status',
    fieldDefinition,
  );
  const isOverdueTaskDueAt = isTaskDueAtOverdue({
    dueAt: fieldValue,
    status: taskStatus,
    timeZone,
  });

  return (
    <div style={isOverdueTaskDueAt ? overdueTaskDueAtStyle : undefined}>
      <DateTimeDisplay
        value={fieldValue}
        dateFieldSettings={dateFieldSettings}
      />
    </div>
  );
};

export const DateTimeFieldDisplay = () => {
  const { fieldValue, fieldDefinition } = useDateTimeFieldDisplay();

  const dateFieldSettings = fieldDefinition.metadata?.settings;
  const isTaskDueAtField =
    fieldDefinition.metadata.objectMetadataNameSingular === 'task' &&
    fieldDefinition.metadata.fieldName === 'dueAt';

  if (!isTaskDueAtField) {
    return (
      <DateTimeDisplay
        value={fieldValue}
        dateFieldSettings={dateFieldSettings}
      />
    );
  }

  return (
    <TaskDueAtDateTimeFieldDisplay
      fieldDefinition={fieldDefinition}
      fieldValue={fieldValue}
    />
  );
};
