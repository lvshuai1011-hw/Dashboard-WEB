import type { ChatMessage, ProcessItem } from '../types';
import { layout } from './messageLayout';

// 复制/判空都以“用户在正文里看到的全部内容”为准：文本 part + 图表标题与摘要。
// 纯图表回答没有文本 part，若只取 text，复制会被误禁用且会被误判为“未收到答复”。
export function bodyEntries(message: ChatMessage, body: ProcessItem[] = layout(message).body) {
  return body
    .map((p) => {
      if (p.kind === 'text') return p.text.trim();
      if (p.kind === 'chart')
        return [p.chart?.title, p.chart?.summary].filter(Boolean).join('\n').trim();
      return '';
    })
    .filter(Boolean);
}
export function answerText(message: ChatMessage) {
  // 中断后仍可复制已经进入正文的内容。
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

// 搜索列表、命中摘要和点击后的消息定位共用同一份字段定义。
export function messageSearchValues(message: ChatMessage) {
  return [
    message.content,
    ...(message.attachments ?? []).map((file) => file.name),
    ...message.process.flatMap((item) => [
      item.text,
      item.answer,
      item.thinking,
      item.chart?.title,
      item.chart?.summary,
    ]),
  ];
}
export function matchesQuery(value: string | undefined, query: string) {
  return !!value?.normalize('NFKC').toLocaleLowerCase().includes(query);
}
export function messageMatches(message: ChatMessage, query: string) {
  return messageSearchValues(message).some((value) => matchesQuery(value, query));
}
