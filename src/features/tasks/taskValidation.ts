import type { TaskRepeat } from '../../types';
import { getNextOccurrenceForInput, type TaskFormInput } from './taskRecurrence';

export type TaskValidationErrors = Partial<
  Record<'parentId' | 'title' | 'time' | 'selectedWeekdays' | 'startDate', string>
>;

export function trimTaskTitle(title: string): string {
  return title.trim();
}

export function validateTaskInput(
  input: TaskFormInput,
  now = new Date(),
): TaskValidationErrors {
  const errors: TaskValidationErrors = {};
  const title = trimTaskTitle(input.title);

  if (!input.parentId) {
    errors.parentId = 'Choose a parent.';
  }

  if (!title) {
    errors.title = 'Enter a task title.';
  }

  if (!input.time) {
    errors.time = 'Choose a time.';
  }

  if (input.repeat === 'set_days' && input.selectedWeekdays.length === 0) {
    errors.selectedWeekdays = 'Choose at least one day.';
  }

  if (input.repeat === 'once' && input.startDate) {
    const nextOccurrence = getNextOccurrenceForInput(
      { ...input, title },
      now,
    );
    const selectedAt = new Date(`${input.startDate}T00:00:00`);
    const [hours, minutes] = input.time.split(':').map(Number);
    selectedAt.setHours(hours || 0, minutes || 0, 0, 0);

    if (selectedAt.getTime() < now.getTime() && nextOccurrence.getTime() === selectedAt.getTime()) {
      errors.startDate = 'Choose a future date and time.';
    }
  }

  return errors;
}

export function repeatLabel(repeat: TaskRepeat): string {
  switch (repeat) {
    case 'once':
      return 'Does not repeat';
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    case 'yearly':
      return 'Yearly';
    case 'set_days':
      return 'Set Days';
    default:
      return repeat;
  }
}
