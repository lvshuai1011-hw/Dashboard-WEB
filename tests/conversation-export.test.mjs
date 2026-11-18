import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadSource } from './load-source.mjs';

const { conversationBlocks } = await loadSource(
  "export { conversationBlocks } from './src/views/ux/aiAgent/lib/export/content';",
);

test('历史会话导出保留问答和表格顺序，排除思考过程与追问', () => {
  const chart = {
    chart_type: 'table',
    title: '收入明细',
    summary: '按类型汇总',
    table_data: {
      headers: ['类型', '金额'],
      rows: [
        ['预付费', 0],
        ['后付费', 12],
      ],
    },
  };
  const chat = {
    title: '日报',
    messages: [
      { role: 'user', content: '列出收入' },
      {
        role: 'assistant',
        status: 'completed',
        followUps: ['继续？'],
        process: [
          { id: 1, kind: 'text', text: '内部分析' },
          { id: 2, kind: 'chart', chart },
        ],
      },
    ],
  };
  assert.deepEqual(
    conversationBlocks(chat, (key) => key, true),
    [
      { kind: 'heading', text: '日报' },
      { kind: 'heading', text: '提问' },
      { kind: 'text', text: '列出收入' },
      { kind: 'heading', text: '回答' },
      { kind: 'heading', text: '收入明细' },
      { kind: 'text', text: '按类型汇总' },
      {
        kind: 'table',
        rows: [
          ['类型', '金额'],
          ['预付费', '0'],
          ['后付费', '12'],
        ],
      },
    ],
  );
});
