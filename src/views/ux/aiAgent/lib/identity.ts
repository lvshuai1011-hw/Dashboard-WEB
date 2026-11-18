export const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
export const textValue = (value: unknown) => (typeof value === 'string' ? value : '');
// JavaScript 日期的有效范围是距纪元前后各一亿天。
const MAX_DATE_TIMESTAMP_MS = 8.64e15;
export const timeValue = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_DATE_TIMESTAMP_MS
    ? value
    : Date.now();
