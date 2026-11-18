import type { ChatMessage, Conversation, JsonRecord, ProcessItem } from '../types';
import { errorKeys } from '../types';
import { isRecord } from './records';
import { readAttachments } from './attachmentMetadata';
import { readChartContent } from './chartSchema';
import { uid, textValue, timeValue } from './identity';
import { readFollowUps } from './streamEvents';

const PROCESS_KINDS = new Set(['text', 'tool', 'subagent', 'chart', 'json']);
const HISTORY_ERROR_KEYS = new Set([
  ...Object.values(errorKeys),
  'AIAGENT.ERROR.NETWORK',
  'AIAGENT.ERROR.AUTH',
]);

function restoredStatus(value: unknown): 'completed' | 'error' | 'stopped' {
  if (value === 'completed' || value === 'error' || value === 'stopped') return value;
  // 刷新后无法恢复原连接，历史中的运行状态转为中断。
  return 'stopped';
}

function restoreProcess(record: JsonRecord, index: number, updatedAt: number): ProcessItem {
  const chart = readChartContent(record.chart);
  const invalidChart = record.kind === 'chart' && !chart;
  const startTime = timeValue(record.startTime);
  return {
    id: index + 1,
    kind: invalidChart ? 'json' : (record.kind as ProcessItem['kind']),
    status: restoredStatus(record.status),
    toolName: textValue(record.toolName),
    agentName: textValue(record.agentName),
    input: invalidChart ? JSON.stringify(record.chart ?? null, null, 2) : textValue(record.input),
    text: textValue(record.text),
    answer: textValue(record.answer),
    thinking: textValue(record.thinking),
    chart,
    startTime,
    duration: Math.max(
      0,
      typeof record.duration === 'number' && Number.isFinite(record.duration)
        ? record.duration
        : updatedAt - startTime,
    ),
    expanded: !!chart,
    isFinal: record.isFinal === true,
    skillLoad: record.skillLoad === true,
  };
}

function restoreFinalTurn(process: ProcessItem[]) {
  if (process.some((item) => item.isFinal)) return;
  // 旧记录可能缺少 isFinal，需恢复工具步骤后的最后一轮正文。
  let firstAnswerIndex = 0;
  process.forEach((item, index) => {
    if (item.kind === 'tool' || item.kind === 'subagent') firstAnswerIndex = index + 1;
  });
  const textTurns = process
    .slice(firstAnswerIndex)
    .filter((item) => item.kind === 'text' && item.text.trim());
  if (textTurns.length) textTurns[textTurns.length - 1].isFinal = true;
}

function restoreMessage(
  record: JsonRecord,
  updatedAt: number,
  uniqueId: (value: unknown) => string,
): ChatMessage {
  const process = (Array.isArray(record.process) ? record.process : [])
    .filter((item): item is JsonRecord => isRecord(item) && PROCESS_KINDS.has(String(item.kind)))
    .map((item, index) => restoreProcess(item, index, updatedAt));
  restoreFinalTurn(process);
  return {
    id: uniqueId(record.id),
    role: record.role as ChatMessage['role'],
    content: textValue(record.content),
    prompt: textValue(record.prompt),
    status: restoredStatus(record.status),
    createdAt: timeValue(record.createdAt),
    finishedAt:
      typeof record.finishedAt === 'number' && Number.isFinite(record.finishedAt)
        ? timeValue(record.finishedAt)
        : undefined,
    errorKey: HISTORY_ERROR_KEYS.has(String(record.errorKey)) ? String(record.errorKey) : undefined,
    errorDetail: textValue(record.errorDetail),
    attachments: record.role === 'user' ? readAttachments(record.attachments) : [],
    followUps: record.role === 'assistant' ? readFollowUps(record.followUps) : undefined,
    process,
  };
}

/** 仅恢复界面需要的字段，跳过无效记录并处理重复标识。 */
export function decodeHistory(data: unknown, onInvalid: () => void = () => {}): Conversation[] {
  if (!Array.isArray(data)) throw new Error('INVALID_HISTORY');
  const usedIds = new Set<string>();
  const uniqueId = (value: unknown) => {
    let id = textValue(value);
    if (!id || usedIds.has(id)) id = uid();
    usedIds.add(id);
    return id;
  };
  const conversations: Conversation[] = [];
  for (const record of data) {
    if (!isRecord(record) || !Array.isArray(record.messages)) {
      onInvalid();
      continue;
    }
    const updatedAt = timeValue(record.updatedAt);
    const messages = record.messages
      .filter(
        (message): message is JsonRecord =>
          isRecord(message) && (message.role === 'user' || message.role === 'assistant'),
      )
      .map((message) => restoreMessage(message, updatedAt, uniqueId));
    conversations.push({
      id: uniqueId(record.id),
      title: textValue(record.title),
      conversationId: textValue(record.conversationId) || null,
      createdAt: timeValue(record.createdAt),
      updatedAt,
      draft: textValue(record.draft),
      attachments: readAttachments(record.attachments),
      favorite: record.favorite === true,
      messages,
    });
  }
  return conversations.sort((left, right) => right.updatedAt - left.updatedAt);
}
