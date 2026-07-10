"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatTime = formatTime;
exports.formatDate = formatDate;
exports.formatLocalTime = formatLocalTime;
exports.toDateKey = toDateKey;
exports.generateId = generateId;
exports.startOfDay = startOfDay;
exports.fileToDataUrl = fileToDataUrl;
exports.averageSteps = averageSteps;
function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}
function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}
function formatLocalTime(time) {
    const [hours, minutes] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
    });
}
function toDateKey(value = new Date()) {
    const date = typeof value === 'string' ? new Date(value) : value;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function generateId(prefix) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}
function startOfDay(date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
}
function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
function averageSteps(steps) {
    if (steps.length === 0)
        return 0;
    return Math.round(steps.reduce((s, d) => s + d.count, 0) / steps.length);
}
