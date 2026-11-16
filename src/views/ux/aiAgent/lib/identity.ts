export const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
export const textValue = (value: unknown) => typeof value === 'string' ? value : '';
export const timeValue = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : Date.now();
