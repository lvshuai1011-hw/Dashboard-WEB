import type { ChartContent, ChartPoint, ChartSeries, ChartTableData } from '../types';
import { isRecord } from './records';

const CHART_TYPES = new Set([
  'table',
  'bar',
  'multi-bar',
  'line',
  'multi-line',
  'pie',
  'ring',
  'scatter',
]);
const isCell = (value: unknown): value is string | number =>
  typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));
const isCount = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;

function isPoint(value: unknown): value is ChartPoint {
  return isRecord(value) && isCell(value.x) && isCell(value.y);
}

function isSeries(value: unknown): value is ChartSeries {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    Array.isArray(value.data) &&
    value.data.every(isPoint) &&
    (value.y_axis_index === undefined || isCount(value.y_axis_index))
  );
}

function isTable(value: unknown): value is ChartTableData {
  if (!isRecord(value) || !Array.isArray(value.headers) || !Array.isArray(value.rows)) return false;
  const width = value.headers.length;
  return (
    value.headers.every((header) => typeof header === 'string') &&
    value.rows.every((row) => Array.isArray(row) && row.length === width && row.every(isCell)) &&
    ['sortable', 'filterable'].every(
      (key) =>
        value[key] === undefined ||
        (Array.isArray(value[key]) &&
          value[key].length === width &&
          value[key].every((flag) => typeof flag === 'boolean')),
    )
  );
}

/** Validate both SSE payloads and saved history before components dereference them.
 * Invalid payloads remain ordinary JSON process entries; never coerce business values.
 */
export function readChartContent(value: unknown): ChartContent | undefined {
  if (!isRecord(value) || !CHART_TYPES.has(String(value.chart_type))) return undefined;
  if (typeof value.title !== 'string') return undefined;
  for (const key of ['summary', 'x_label', 'y_label']) {
    if (value[key] !== undefined && typeof value[key] !== 'string') return undefined;
  }
  for (const key of ['total', 'displayed']) {
    if (value[key] !== undefined && !isCount(value[key])) return undefined;
  }
  if (value.chart_type === 'table') {
    if (!isTable(value.table_data)) return undefined;
  } else if (!Array.isArray(value.series) || !value.series.every(isSeries)) {
    return undefined;
  }
  return value as unknown as ChartContent;
}
