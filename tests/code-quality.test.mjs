import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import less from 'less';
import { loadSource } from './load-source.mjs';

const source = await loadSource(`
  export { renderMarkdown } from './src/views/ux/aiAgent/lib/markdown';
  export { dealChart } from './src/views/ux/aiAgent/lib/chartOptions';
  export { readChartContent } from './src/views/ux/aiAgent/lib/chartSchema';
  export { decodeHistory } from './src/views/ux/aiAgent/lib/history';
  export { excelValue } from './src/views/ux/aiAgent/lib/spreadsheetFormats';
  export { applyAgentEvent, makeMessage } from './src/views/ux/aiAgent/lib/streamEvents';
`);
const translate = (key) => key;
const chart = (type = 'bar') => ({
  chart_type: type,
  title: 'Revenue',
  series: [
    {
      name: 'A',
      y_axis_index: 3,
      data: [
        { x: 1, y: 2 },
        { x: 2, y: 4 },
        { x: 10, y: 6 },
      ],
    },
    { name: 'B', y_axis_index: 7, data: [{ x: 1, y: 8 }] },
  ],
});

test('table parsing preserves following source expressions and fenced code', () => {
  const html = source.renderMarkdown(
    '| A | B |\n| --- | --- |\n| 1 | 2 |\na || b\n```js\nif (a || b) {}\n```',
    translate,
  );
  assert.equal((html.match(/<tbody><tr>/g) ?? []).length, 1);
  assert.match(html, /<p>a \|\| b<\/p>/);
  assert.match(html, /class="code-block"/);
  assert.match(html, /a \|\| b/);
});

test('table delimiters must match the header width', () => {
  assert.doesNotMatch(
    source.renderMarkdown('| A | B |\n| --- | --- | --- |', translate),
    /<table>/,
  );
});

test('markdown keeps code and unsafe markup as text', () => {
  const html = source.renderMarkdown(
    '`a || b`\n<script>alert(1)</script>\n[x](javascript:alert)',
    translate,
  );
  assert.match(html, /<code>a \|\| b<\/code>/);
  assert.doesNotMatch(html, /<script>|href="javascript:/);
});

test('charts preserve query category order and map sparse axis identifiers', () => {
  for (const type of ['bar', 'multi-bar', 'line', 'multi-line']) {
    const option = source.dealChart(chart(type));
    assert.deepEqual(option.xAxis.data, [1, 2, 10]);
    assert.deepEqual(
      option.series.map((item) => item.yAxisIndex),
      [0, 1],
    );
    assert.equal(option.series[0].type, type.includes('bar') ? 'bar' : 'line');
    assert.deepEqual(option.series[1].data, [
      [1, 8],
      [2, null],
      [10, null],
    ]);
  }
});

test('invalid chart payloads are rejected without losing raw JSON', () => {
  for (const value of [
    null,
    { ...chart(), title: {} },
    { ...chart(), series: [null] },
    { ...chart(), series: [{ name: 'x', data: [null] }] },
    { chart_type: 'table', title: 'x', table_data: { headers: ['A'], rows: [[1, 2]] } },
  ]) {
    assert.equal(source.readChartContent(value), undefined);
  }
  const message = source.makeMessage('assistant', '');
  source.applyAgentEvent(message, {
    outerEvent: 'ExecuteAgentNormal',
    innerEvent: 'json',
    content: JSON.stringify({ ...chart(), series: [null] }),
    raw: { inner: {} },
  });
  assert.equal(message.process[0].kind, 'json');
  assert.match(message.process[0].input, /null/);
  assert.ok(source.readChartContent(chart()));
});

test('history restores corrupt chart data as text and repairs duplicate IDs', () => {
  const message = {
    id: 'same',
    role: 'assistant',
    status: 'answer',
    createdAt: 1e99,
    process: [{ kind: 'chart', chart: { chart_type: 'bar', title: {}, series: [null] } }],
  };
  const history = source.decodeHistory([{ id: 'same', messages: [message, message] }]);
  assert.equal(new Set([history[0].id, ...history[0].messages.map((item) => item.id)]).size, 3);
  assert.equal(history[0].messages[0].status, 'stopped');
  assert.equal(history[0].messages[0].process[0].kind, 'json');
  assert.ok(Number.isFinite(new Date(history[0].messages[0].createdAt).getTime()));
});

test('spreadsheet date systems, elapsed hours and percentages remain readable', () => {
  assert.equal(source.excelValue('60', 14, '', false), '1900-02-29');
  assert.equal(source.excelValue('0', 14, '', true), '1904-01-01');
  assert.equal(source.excelValue('1.5', 46, '', false), '36:00:00');
  assert.equal(source.excelValue('0.47', 10, '', false), '47.00%');
  assert.equal(source.excelValue('12', 0, '0000', false), '0012');
});

test('wordmark keyframes contain percentage selectors, never page selectors', async () => {
  const stylesheet = await readFile(
    new URL('../src/views/ux/aiAgent/styles/seeksettlement.less', import.meta.url),
    'utf8',
  );
  const { css } = await less.render(stylesheet);
  assert.match(css, /@keyframes vds-wordmark-write\s*\{\s*0%/);
  assert.doesNotMatch(css, /\.agent-page\s+\d+%/);
});
