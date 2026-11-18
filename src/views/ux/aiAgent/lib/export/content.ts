import * as echarts from 'echarts';
import type { ChartContent, ComposerTranslation, Conversation } from '../../types';
import { chartHasData, dealChart, polishChartOption } from '../chartOptions';
import { layout } from '../messageLayout';
import { renderMarkdown } from '../markdown';

export type Block =
  | { kind: 'heading' | 'text'; text: string }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'chart'; png: string };
export const CHART_WIDTH = 840;
export const CHART_HEIGHT = 420;

// 历史会话可能没有挂载图表，导出从该轮的原始数据独立绘制。
function chartImage(chart: ChartContent): string {
  const host = document.createElement('canvas');
  const instance = echarts.init(host, undefined, {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    devicePixelRatio: 2,
  });
  try {
    const option = dealChart(chart);
    if (!option) throw new Error('Unsupported chart');
    polishChartOption(option, chart.chart_type);
    delete option.dataZoom;
    instance.setOption({ ...option, animation: false, backgroundColor: '#fff' });
    return instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
  } finally {
    instance.dispose();
  }
}

function markdownBlocks(source: string, t: ComposerTranslation): Block[] {
  const doc = new DOMParser().parseFromString(renderMarkdown(source, t), 'text/html');
  const blocks: Block[] = [];
  function visit(el: Element) {
    if (el.matches('.code-toolbar, .code-fold > summary')) return;
    if (el instanceof HTMLTableElement) {
      blocks.push({
        kind: 'table',
        rows: Array.from(el.rows, (row) => Array.from(row.cells, (cell) => cell.textContent ?? '')),
      });
    } else if (el.matches('ol, ul')) {
      Array.from(el.children).forEach((li, i) =>
        blocks.push({
          kind: 'text',
          text: (el.tagName === 'OL' ? i + 1 + '. ' : '• ') + li.textContent,
        }),
      );
    } else if (el.matches('p, blockquote, pre, summary, h1, h2, h3, h4, h5, h6')) {
      blocks.push({
        kind: el.matches('h1,h2,h3,h4,h5,h6') ? 'heading' : 'text',
        text: el.textContent ?? '',
      });
    } else Array.from(el.children).forEach(visit);
  }
  visit(doc.body);
  return blocks;
}

export function conversationBlocks(
  chat: Conversation,
  t: ComposerTranslation,
  chinese: boolean,
): Block[] {
  const blocks: Block[] = [{ kind: 'heading', text: chat.title || t('AIAGENT.HISTORY.UNTITLED') }];
  for (const message of chat.messages) {
    if (message.role === 'user') {
      blocks.push(
        { kind: 'heading', text: chinese ? '提问' : 'Question' },
        { kind: 'text', text: message.content },
      );
      continue;
    }
    blocks.push({ kind: 'heading', text: chinese ? '回答' : 'Answer' });
    const { body } = layout(message);
    for (const part of body) {
      if (part.kind === 'text') blocks.push(...markdownBlocks(part.text, t));
      const chart = part.chart;
      if (part.kind !== 'chart' || !chart) continue;
      blocks.push({ kind: 'heading', text: chart.title || t('AIAGENT.CHART.TITLE') });
      if (chart.summary) blocks.push({ kind: 'text', text: chart.summary });
      if (!chartHasData(chart)) blocks.push({ kind: 'text', text: t('AIAGENT.CHART.NO_DATA') });
      else if (chart.chart_type === 'table' && chart.table_data) {
        blocks.push({
          kind: 'table',
          rows: [chart.table_data.headers, ...chart.table_data.rows.map((row) => row.map(String))],
        });
      } else blocks.push({ kind: 'chart', png: chartImage(chart) });
      if (chart.total != null)
        blocks.push({
          kind: 'text',
          text: t('AIAGENT.CHART.RECORDS', {
            total: chart.total,
            displayed: chart.displayed ?? chart.total,
          }),
        });
    }
    if (message.status === 'completed' && !body.length)
      blocks.push({ kind: 'text', text: t('AIAGENT.STATUS.NO_ANSWER') });
    if (message.status === 'stopped')
      blocks.push({ kind: 'text', text: t('AIAGENT.STATUS.STOPPED_NOTE') });
    if (message.errorKey)
      blocks.push({
        kind: 'text',
        text: [t(message.errorKey), message.errorDetail].filter(Boolean).join('\n'),
      });
  }
  return blocks;
}
