import type { ChatMessage } from '../types';
import { layout } from './messageLayout';

// 复制/判空都以“用户在正文里看到的全部内容”为准：文本 part + 图表标题与摘要。
// 纯图表回答没有文本 part，若只取 text，复制会被误禁用且会被误判为“未收到答复”。
export function bodyEntries(message: ChatMessage) {
  return layout(message)
    .body.map((p) => {
      if (p.kind === 'text') return p.text.trim();
      if (p.kind === 'chart')
        return [p.chart?.title, p.chart?.summary].filter(Boolean).join('\n').trim();
      return '';
    })
    .filter(Boolean);
}
export function answerText(message: ChatMessage) {
  // 用户评审修正：中断后仍可复制已收到的文字，不把过程文本冒充已完成的最终答复。
  if (message.status === 'stopped' || message.status === 'error') {
    return message.process
      .map((item) =>
        item.kind === 'text'
          ? item.text
          : item.kind === 'subagent'
            ? item.answer
            : item.kind === 'chart'
              ? [item.chart?.title, item.chart?.summary].filter(Boolean).join('\n')
              : '',
      )
      .filter(Boolean)
      .join('\n\n')
      .trim();
  }
  return bodyEntries(message).join('\n\n').trim();
}
