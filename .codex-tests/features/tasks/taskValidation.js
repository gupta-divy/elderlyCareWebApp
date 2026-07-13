"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trimTaskTitle = trimTaskTitle;
exports.validateTaskInput = validateTaskInput;
exports.repeatLabel = repeatLabel;
const taskRecurrence_1 = require("./taskRecurrence");
function trimTaskTitle(title) {
    return title.trim();
}
function validateTaskInput(input, now = new Date()) {
    const errors = {};
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
        const nextOccurrence = (0, taskRecurrence_1.getNextOccurrenceForInput)({ ...input, title }, now);
        const selectedAt = new Date(`${input.startDate}T00:00:00`);
        const [hours, minutes] = input.time.split(':').map(Number);
        selectedAt.setHours(hours || 0, minutes || 0, 0, 0);
        if (selectedAt.getTime() < now.getTime() && nextOccurrence.getTime() === selectedAt.getTime()) {
            errors.startDate = 'Choose a future date and time.';
        }
    }
    return errors;
}
function repeatLabel(repeat) {
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
