import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const { outputFiles } = await build({
  stdin: {
    contents: `export { appendTextTurn, markFinalTurn, handleJsonEvent } from './src/views/ux/aiAgent/lib/streamEvents';
      export { layout } from './src/views/ux/aiAgent/lib/messageLayout';`,
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
});
const module = { exports: {} };
new Function('module', outputFiles[0].text)(module);
const context = module.exports;

const message = () => ({ process: [], status: 'answer' });
const json = (m, value) => context.handleJsonEvent(m, { content: JSON.stringify(value) });
const chart = (m) => json(m, { chart_type: 'bar', title: 'Revenue', series: [] });
const kinds = (items) => Array.from(items, (item) => item.kind);

test('summary streams below the chart even when messageId is reused', () => {
  const m = message();
  context.appendTextTurn(m, 'same', 'Planning');
  chart(m);
  context.appendTextTurn(m, 'same', 'Summary');
  context.appendTextTurn(m, 'same', ' continues');
  const { timeline, body } = context.layout(m);
  assert.deepEqual(kinds(timeline), ['text']);
  assert.equal(timeline[0].text, 'Planning');
  assert.deepEqual(kinds(body), ['chart', 'text']);
  assert.equal(body[1].text, 'Summary continues');
  context.markFinalTurn(m, 'same');
  for (const status of ['completed', 'stopped', 'error']) {
    m.status = status;
    assert.deepEqual(kinds(context.layout(m).body), ['chart', 'text']);
  }
});

test('follow-up JSON never becomes a chart boundary or a process item', () => {
  const m = message();
  context.appendTextTurn(m, 'planning', 'Planning');
  json(m, { follow_up: ['Next question?'] });
  assert.equal(context.layout(m).body.length, 0);
  chart(m);
  context.appendTextTurn(m, 'summary', 'Summary');
  json(m, { follow_up: ['Compare last month?'] });
  assert.equal(m.process.length, 3);
  assert.equal(m.followUps[0], 'Compare last month?');
  assert.deepEqual(kinds(context.layout(m).body), ['chart', 'text']);
});

test('chart-free replies keep final-turn selection and fallback', () => {
  for (const finishId of ['final', 'unknown']) {
    const m = message();
    context.appendTextTurn(m, 'planning', 'Planning');
    context.appendTextTurn(m, 'final', 'Answer');
    assert.equal(context.layout(m).body.length, 0);
    context.markFinalTurn(m, finishId);
    m.status = 'completed';
    assert.equal(context.layout(m).body[0].text, 'Answer');
  }
});

test('chart boundary overrides stale final flags and finish IDs in history', () => {
  const m = message();
  context.appendTextTurn(m, 'planning', 'Planning').isFinal = true;
  chart(m);
  context.markFinalTurn(m, 'planning');
  m.status = 'completed';
  assert.deepEqual(kinds(context.layout(m).body), ['chart']);
});

test('multiple charts retain their own following text even with reused IDs', () => {
  const m = message();
  chart(m);
  context.appendTextTurn(m, 'same', 'First summary');
  chart(m);
  context.appendTextTurn(m, 'same', 'Second summary');
  const body = context.layout(m).body;
  assert.deepEqual(kinds(body), ['chart', 'text', 'chart', 'text']);
  assert.equal(body[1].text, 'First summary');
  assert.equal(body[3].text, 'Second summary');
});
