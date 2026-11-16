export const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
export const textValue = (value: unknown) => (typeof value === 'string' ? value : '');
// ECMAScript Date accepts timestamps within 100 million days of the epoch.
const MAX_DATE_TIMESTAMP_MS = 8.64e15;
export const timeValue = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_DATE_TIMESTAMP_MS
    ? value
    : Date.now();
