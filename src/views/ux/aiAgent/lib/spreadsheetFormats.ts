// Built-in number-format identifiers in Office Open XML; custom patterns are checked separately.
const BUILTIN_DATE_RANGES = [
  [14, 22],
  [27, 36],
  [45, 47],
  [50, 58],
] as const;
const BUILTIN_TIME_RANGES = [
  [18, 22],
  [45, 47],
] as const;
const BUILTIN_TIME_ONLY = new Set([18, 19, 20, 21, 45, 46, 47]);
const PERCENT_FORMAT = 9;
const DECIMAL_PERCENT_FORMAT = 10;
const ELAPSED_HOURS_FORMAT = 46;
const inFormatRanges = (id: number, ranges: readonly (readonly [number, number])[]) =>
  ranges.some(([first, last]) => id >= first && id <= last);
const SECONDS_PER_DAY = 86_400;
const MILLISECONDS_PER_DAY = SECONDS_PER_DAY * 1000;
const EXCEL_1900_LEAP_DAY_SERIAL = 60; // Excel 的 1900 日期系统保留了一个虚构的 2 月 29 日。

export function excelValue(
  raw: string,
  formatId: number,
  format: string,
  date1904: boolean,
): string {
  if (!raw || !Number.isFinite(Number(raw))) return raw;
  const value = Number(raw);
  // 引号/转义内容不是日期模式；内置日期格式和自定义日期格式均识别。
  const pattern = format.replace(/"[^"]*"|\\.|\[(?!h+\]|m+\]|s+\])[^\]]*\]/gi, '').toLowerCase();
  const isDate = inFormatRanges(formatId, BUILTIN_DATE_RANGES) || /[ydhs]|m{2,}/.test(pattern);
  if (isDate) {
    const days = Math.floor(value),
      fraction = value - days;
    const hasTime =
      /[hs]/.test(pattern) || inFormatRanges(formatId, BUILTIN_TIME_RANGES) || fraction !== 0;
    const timeOnly =
      (/[hs]/.test(pattern) && !/[yd]/.test(pattern)) || BUILTIN_TIME_ONLY.has(formatId);
    const seconds = Math.round(fraction * SECONDS_PER_DAY);
    const time = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
      .map((n) => String(n).padStart(2, '0'))
      .join(':');
    if (timeOnly)
      return /\[h+\]/.test(pattern) || formatId === ELAPSED_HOURS_FORMAT
        ? `${Math.floor(value * 24)}:${time.slice(3)}`
        : time;
    const date = new Date(
      Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 31) +
        (days - (!date1904 && days >= EXCEL_1900_LEAP_DAY_SERIAL ? 1 : 0)) * MILLISECONDS_PER_DAY,
    );
    if (!Number.isFinite(date.getTime())) return raw;
    const text =
      !date1904 && days === EXCEL_1900_LEAP_DAY_SERIAL
        ? '1900-02-29'
        : date.toISOString().slice(0, 10);
    return hasTime ? `${text} ${time}` : text;
  }
  if ([PERCENT_FORMAT, DECIMAL_PERCENT_FORMAT].includes(formatId) || pattern.includes('%')) {
    const decimals =
      /\.([0#]+)%/.exec(pattern)?.[1].length ?? (formatId === DECIMAL_PERCENT_FORMAT ? 2 : 0);
    return `${(value * 100).toFixed(Math.min(decimals, 10))}%`;
  }
  if (/^0{2,}$/.test(pattern) && Number.isInteger(value) && value >= 0)
    return raw.padStart(pattern.length, '0');
  return raw;
}
