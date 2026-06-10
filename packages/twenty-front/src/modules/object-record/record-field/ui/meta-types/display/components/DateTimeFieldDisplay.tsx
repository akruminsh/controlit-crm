import { useContext } from 'react';

import { type Task } from '@/activities/types/Task';
import { isTaskDueAtOverdue } from '@/activities/tasks/utils/isTaskDueAtOverdue';
import { FieldContext } from '@/object-record/record-field/ui/contexts/FieldContext';
import { useDateTimeFieldDisplay } from '@/object-record/record-field/ui/meta-types/hooks/useDateTimeFieldDisplay';
import { useRecordFieldValue } from '@/object-record/record-store/hooks/useRecordFieldValue';
import { DateTimeDisplay } from '@/ui/field/display/components/DateTimeDisplay';
import { themeCssVariables } from 'twenty-ui-deprecated/theme-constants';

const overdueTaskDueAtStyle = {
  color: themeCssVariables.font.color.danger,
};

export const DateTimeFieldDisplay = () => {
  const { fieldValue, fieldDefinition } = useDateTimeFieldDisplay();
  const { recordId } = useContext(FieldContext);

  const dateFieldSettings = fieldDefinition.metadata?.settings;
  const taskStatus = useRecordFieldValue<Task['status']>(
    recordId,
    'status',
    fieldDefinition,
  );
  const isTaskDueAtField =
    fieldDefinition.metadata.objectMetadataNameSingular === 'task' &&
    fieldDefinition.metadata.fieldName === 'dueAt';
  const isOverdueTaskDueAt =
    isTaskDueAtField &&
    isTaskDueAtOverdue({
      dueAt: fieldValue,
      status: taskStatus,
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
