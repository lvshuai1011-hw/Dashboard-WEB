import { nextTick, reactive, type Ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { ChartContent, ChatMessage, ProcessItem, ComposerTranslation } from '../types';
import type { useUiCopy } from './useUiCopy';

export function useChartCards(t: ComposerTranslation, locale: Ref<string>, uiCopy: ReturnType<typeof useUiCopy>) {
  const chartRefs = new Map<string, { getDataURL: (opts?: Record<string, unknown>) => string }>();

  const chartModes = reactive(new Map<string, 'chart' | 'data'>());
  function chartMode(message: ChatMessage, item: ProcessItem) { return item.chart?.chart_type === 'table' ? 'data' : chartModes.get(chartKey(message, item)) || 'chart'; }
  function chartTable(chart?: ChartContent): { headers: string[]; rows: (string | number)[][] } | undefined {
    if (!chart) return undefined;
    if (chart.chart_type === 'table') return chart.table_data ? { headers: chart.table_data.headers.map(String), rows: chart.table_data.rows as (string | number)[][] } : undefined;
    const series = chart.series ?? [];
    if (!series.length) return undefined;
    const xs: (string | number)[] = [];
    series.forEach(s => s.data.forEach(d => { if (!xs.includes(d.x)) xs.push(d.x); }));
    const maps = series.map(s => new Map(s.data.map(d => [d.x, d.y])));
    return { headers: [chart.x_label || uiCopy.value.dimension, ...series.map(s => s.name || chart.y_label || '')], rows: xs.map(x => [x, ...maps.map(m => m.get(x) ?? '')]) };
  }
  function numericColumn(table: { rows: (string | number)[][] }, index: number) { return table.rows.length > 0 && table.rows.every(row => typeof row[index] === 'number' || row[index] === '' || row[index] == null); }
  function formatCell(value: unknown) { return typeof value === 'number' ? value.toLocaleString(locale.value.startsWith('zh') ? 'zh-CN' : 'en-US', { maximumFractionDigits: 6 }) : value == null ? '' : String(value); }
  async function downloadCurrent(message: ChatMessage, item: ProcessItem) {
    const chart = item.chart;
    if (!chart) return;
    if (chart.chart_type === 'table' || chartMode(message, item) === 'chart') { await downloadChart(message, item); return; }
    const table = chartTable(chart);
    if (!table) return;
    const rows = [table.headers.map(csvCell).join(','), ...table.rows.map(row => row.map(csvCell).join(','))];
    saveBlob(new Blob([`\ufeff${rows.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }), chartFileName(chart, 'csv'));
  }
  function chartFileName(chart?: ChartContent, ext = 'png') {
    const base = (chart?.title || 'chart').replace(/[\\/:*?"<>|\r\n\t]+/g, '_').replace(/\s+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'chart';
    return `${base}.${ext}`;
  }
  function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  function csvCell(value: unknown) {
    const text = value == null ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
  // item.id 只在单条消息内自增，跨消息会重号；用「消息 id : 步骤 id」做复合键避免串图。
  function chartKey(message: ChatMessage, item: ProcessItem) { return `${message.id}:${item.id}`; }
  function setChartRef(key: string, el: unknown) {
    const instance = el as { getDataURL?: (opts?: Record<string, unknown>) => string } | null;
    if (instance?.getDataURL) chartRefs.set(key, instance as { getDataURL: (opts?: Record<string, unknown>) => string });
    else chartRefs.delete(key);
  }
  async function downloadChart(message: ChatMessage, item: ProcessItem) {
    const chart = item.chart;
    if (!chart) return;
    if (chart.chart_type === 'table' && chart.table_data) {
      const rows = [chart.table_data.headers.map(csvCell).join(','), ...chart.table_data.rows.map(row => row.map(csvCell).join(','))];
      // BOM 让 Excel 正确识别 UTF-8 中文。
      saveBlob(new Blob([`﻿${rows.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }), chartFileName(chart, 'csv'));
      return;
    }
    const key = chartKey(message, item);
    // 图表始终渲染，正常情况下直接取实例；取不到时等一帧再取。
    if (!chartRefs.get(key)) await nextTick();
    const url = chartRefs.get(key)?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    if (!url) { ElMessage.warning(t('AIAGENT.CHART.DOWNLOAD_FAILED')); return; }
    const link = document.createElement('a');
    link.href = url; link.download = chartFileName(chart); document.body.appendChild(link); link.click(); link.remove();
  }
  const setChartMode = (message: ChatMessage, item: ProcessItem, mode: 'chart' | 'data') => chartModes.set(chartKey(message, item), mode);
  const registerChart = (message: ChatMessage, item: ProcessItem, chart: unknown) => setChartRef(chartKey(message, item), chart);

  return { chartMode, chartTable, numericColumn, formatCell, chartKey, downloadCurrent, setChartMode, registerChart };
}
