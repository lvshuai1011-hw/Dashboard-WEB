import { reactive } from 'vue';
import { errorKeys } from '../types';
import type {
  ChatMessage,
  ProcessItem,
  ProcessStatus,
  ProcessKind,
  StreamEvent,
  JsonRecord,
} from '../types';
import { readChartContent } from './chartSchema';
import { isRecord } from './records';
import { uid, textValue } from './identity';
export function readFollowUps(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = [
    ...new Set(
      value
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.trim())
        .filter((v) => v && Array.from(v).length <= 200),
    ),
  ].slice(0, 3);
  return list.length ? list : undefined;
}
export function makeMessage(role: ChatMessage['role'], content: string, prompt = ''): ChatMessage {
  return {
    id: uid(),
    role,
    content,
    prompt,
    status: role === 'user' ? 'completed' : 'waiting',
    createdAt: Date.now(),
    process: [],
  };
}
export function closeProcess(item: ProcessItem, status: ProcessStatus = 'completed') {
  if (item.status !== 'running') return;
  item.status = status;
  // 服务端在 tool 事件的 metadata.duration 里给了真实耗时，要保留；
  // 只有没拿到时才回落到本地计时（此前无条件覆盖，导致显示成 0.0s）。
  if (item.duration == null) item.duration = Math.max(0, Date.now() - item.startTime);
  item.expanded = status === 'error';
}
export function addProcess(message: ChatMessage, kind: ProcessKind): ProcessItem {
  // 只收尾已完成的上一步，不折叠任何卡片：早先在这里统一 expanded=false，
  // 导致每来一个新 skill 就把用户正在看的思考收回去。
  message.process.forEach((p) => {
    if (p.kind !== 'subagent') closeProcess(p);
  });
  const item = reactive<ProcessItem>({
    id: message.process.length + 1,
    kind,
    status: 'running',
    toolName: '',
    agentName: '',
    input: '',
    text: '',
    answer: '',
    thinking: '',
    startTime: Date.now(),
    expanded: true,
  });
  message.process.push(item);
  return message.process[message.process.length - 1];
}
// 文本轮：同一 messageId 的事件持续追加到同一轮，messageId 变化即新开一轮。
export function appendTextTurn(message: ChatMessage, textId: string, chunk: string): ProcessItem {
  // 图表是正文分界，即便上游复用 messageId，也不能继续追加到图表前的思考轮。
  const chartIndex = message.process.map((p) => p.kind).lastIndexOf('chart');
  let item = message.process
    .slice(chartIndex + 1)
    .find((p) => p.kind === 'text' && p.toolName === textId);
  if (!item) {
    // 上一轮文本到此结束，收尾为已完成，避免旧轮一直显示加载态。
    message.process.forEach((p) => {
      if (p.kind === 'text' && p.status === 'running') closeProcess(p);
    });
    item = addProcess(message, 'text');
    item.toolName = textId;
  }
  item.text += chunk;
  return item;
}
// 有图表时按事件顺序划分正文；无图表时保留 finish_stop 指定轮次 / 最后一轮的回落逻辑。
export function markFinalTurn(message: ChatMessage, messageId: string) {
  if (message.process.some((p) => p.kind === 'chart')) return;
  const texts = message.process.filter((p) => p.kind === 'text');
  if (!texts.length) return;
  const matched = messageId ? texts.find((p) => p.toolName === messageId) : undefined;
  (matched || texts[texts.length - 1]).isFinal = true;
}
export function currentSubagent(message: ChatMessage): ProcessItem | undefined {
  return message.process.find((p) => p.id === message.activeSubagent && p.status === 'running');
}
export function ensureSubagent(message: ChatMessage): ProcessItem {
  let item = currentSubagent(message);
  if (!item) {
    item = addProcess(message, 'subagent');
    message.activeSubagent = item.id;
  }
  return item;
}
// 每个 token 只修改既有正文；步骤只由阶段边界创建。没有出参协议，不猜测 output 字段。
export function applyAgentEvent(
  message: ChatMessage,
  event: StreamEvent,
): 'done' | 'error' | undefined {
  // 任何事件（含心跳）都算「上游还活着」，状态栏据此判断是否处于静默期。
  message.lastSignalAt = Date.now();
  if (event.outerEvent !== 'ExecuteAgentNormal' || event.innerEvent === 'error') {
    message.errorKey = errorKeys[event.outerEvent] || 'AIAGENT.ERROR.INTERNAL';
    message.errorDetail =
      event.outerEvent === 'ExecuteAgentNormal' ? event.content : textValue(event.raw.data);
    return 'error';
  }
  const content = event.content ?? '';
  switch (event.innerEvent) {
    case 'answer':
    case 'delta': {
      // 服务端按内层 messageId 区分文本轮次：同一 id 持续追加，id 变化即新的一轮。
      const textId =
        textValue(event.raw.inner.messageId) || textValue(event.raw.conversationId) || 'turn';
      const item = appendTextTurn(message, textId, content);
      item.status = 'running';
      message.content += content; // 兼容字段：保留全文，便于历史持久化与复制兜底。
      message.status = 'answer';
      break;
    }
    case 'tool': {
      const name = content.trim() || event.toolName || '';
      if (event.toolName === 'task') {
        let item = currentSubagent(message);
        // 兼容先发占位 task、再给出目标名称；已有子智能体输出时新建下一次派发。
        if (!item || item.agentName || item.answer || item.thinking) {
          if (item) closeProcess(item);
          message.activeSubagent = undefined;
          item = ensureSubagent(message);
        }
        item.toolName = 'task';
        item.input += content;
        if (/^[\w.-]+$/.test(name) && name !== 'task') item.agentName = name;
        message.status = 'subagent';
      } else if (event.toolName === 'skill') {
        // SDA：metadata.toolName 恒为 "skill"，真正的技能名在 content；每个技能发 running/completed 两次。
        // status/duration 都在内层 metadata 里（不在内层顶层）。
        // 实测这两次事件只相隔 16ms、title 是 "Loaded skill: xxx" ——它是「加载技能说明书」，
        // 不是真正执行查询（真正的 executeCypherQuery 从不下发事件）。标成 kind 之外的一个弱提示，
        // 避免把 16ms 的读文件说成「执行工具」误导用户。
        const meta = isRecord(event.raw.inner.metadata) ? event.raw.inner.metadata : {};
        const status = textValue(meta.status);
        let item = message.process.find(
          (p) => p.kind === 'tool' && p.toolName === name && p.status === 'running',
        );
        if (status === 'completed') {
          if (item) {
            const duration = meta.duration;
            if (typeof duration === 'number' && Number.isFinite(duration)) item.duration = duration;
            closeProcess(item);
          }
          break;
        }
        if (!item) {
          item = addProcess(message, 'tool');
          item.toolName = name;
          item.input = JSON.stringify(meta, null, 2);
          item.skillLoad = true;
        }
        message.status = 'tool';
      } else {
        const item = addProcess(message, 'tool');
        item.toolName = name;
        item.input = content;
        message.status = 'tool';
      }
      break;
    }
    case 'subagent_crunching':
    case 'subagent_answer': {
      const item = ensureSubagent(message);
      if (message.lastEvent !== 'subagent_answer' && message.lastEvent !== 'subagent_crunching') {
        message.process.forEach((p) => {
          if (p.kind !== 'subagent') closeProcess(p);
        });
        if (!item.manual) item.expanded = true;
      }
      if (event.innerEvent === 'subagent_answer') item.answer += content;
      else item.thinking += content;
      message.status = 'subagent';
      break;
    }
    case 'subagent_done': {
      const item = currentSubagent(message);
      if (item) closeProcess(item);
      message.activeSubagent = undefined;
      break;
    }
    case 'done':
    case 'finish_stop':
      // 参考 Dashboard：finish_stop 帧自带内层 messageId，点名的那一轮文本才是答复正文。
      markFinalTurn(
        message,
        textValue(event.raw.inner.messageId) || textValue(event.raw.messageID),
      );
      return 'done';
    // 心跳不产生内容，但它是「上游仍在这条连接上」的唯一证据：
    // 刷新 lastSignalAt 让状态栏继续跳、计时继续走，避免长静默被当成卡死。
    case 'heartbeat':
      message.lastSignalAt = Date.now();
      break;
    case 'json':
    case 'subagent_json':
      handleJsonEvent(message, event);
      break;
  }
  message.lastEvent = event.innerEvent;
}
// SDA 的 json/subagent_json 事件:content 可能带 ```json 代码块包裹,剥掉后 JSON.parse;
// 含 chart_type → 加 chart 卡片(ChartView 用 echarts 渲染);否则加 json 卡片显示 message/status/原文。
export function handleJsonEvent(message: ChatMessage, event: StreamEvent) {
  const content = event.content ?? '';
  if (!content) return;
  try {
    const jsonStr = content
      .replace(/^```json\s*/, '')
      .replace(/\s*```$/, '')
      .trim();
    const parsed: unknown = JSON.parse(jsonStr);
    // 追问建议：{ "follow_up": ["...", "...", "..."] }，不进入执行过程，答复结束后展示在正文下方。
    if (isRecord(parsed) && 'follow_up' in parsed) {
      const list = readFollowUps((parsed as JsonRecord).follow_up);
      if (list) message.followUps = list;
      return;
    }
    const chart = readChartContent(parsed);
    if (chart) {
      const item = addProcess(message, 'chart');
      item.chart = chart;
      closeProcess(item, 'completed');
      item.expanded = true; // 流式期间展开让用户先看到图表；完成后 finishRequest 统一收起。
    } else if (isRecord(parsed)) {
      const record = parsed as JsonRecord;
      const text =
        typeof record.message === 'string'
          ? record.message
          : typeof record.status === 'string'
            ? record.status
            : jsonStr;
      const item = addProcess(message, 'json');
      item.input = text;
      closeProcess(item, 'completed');
    }
  } catch {
    /* 非 JSON 或解析失败,忽略 */
  }
}
