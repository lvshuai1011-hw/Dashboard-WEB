export const PREFIX = '/vds';
export const IDLE_TIMEOUT = 120_000;
export const STORAGE_KEY = 'vds_ai_conversations';
export type JsonRecord = Record<string, unknown>;
export type Status =
  'waiting' | 'thinking' | 'tool' | 'subagent' | 'answer' | 'completed' | 'stopped' | 'error';
export type ProcessStatus = 'running' | 'completed' | 'error' | 'stopped';
export type ProcessKind = 'text' | 'tool' | 'subagent' | 'chart' | 'json';
export type ChartType =
  'table' | 'bar' | 'multi-bar' | 'line' | 'multi-line' | 'pie' | 'ring' | 'scatter';
export interface ChartPoint {
  x: string | number;
  y: number | string;
}
export interface ChartSeries {
  name: string;
  data: ChartPoint[];
  y_axis_index?: number;
}
export interface ChartTableData {
  headers: string[];
  rows: (string | number)[][];
  sortable?: boolean[];
  filterable?: boolean[];
}
export interface ChartContent {
  chart_type: ChartType;
  title: string;
  summary?: string;
  x_label?: string;
  y_label?: string;
  series?: ChartSeries[];
  table_data?: ChartTableData;
  total?: number;
  displayed?: number;
  [key: string]: unknown;
}
export interface ProcessItem {
  id: number;
  kind: ProcessKind;
  status: ProcessStatus;
  toolName: string;
  agentName: string;
  input: string;
  text: string;
  answer: string;
  thinking: string;
  chart?: ChartContent;
  startTime: number;
  duration?: number;
  expanded: boolean;
  manual?: boolean;
  // 这条 tool 事件只是「加载技能说明书」（title: "Loaded skill: xxx"），
  // 不是真正的工具执行——渲染时降级成一行淡色提示，不画成可展开的执行卡片。
  skillLoad?: boolean;
  // 无图表时，结束帧指定的文本轮作为最终答复。
  isFinal?: boolean;
}
export interface TextAttachment {
  id: string;
  name: string;
  size: number;
  content: string;
}
export interface ChatMessage {
  attachments?: TextAttachment[];
  id: string;
  role: 'user' | 'assistant';
  content: string;
  prompt: string;
  status: Status;
  createdAt: number;
  finishedAt?: number;
  process: ProcessItem[];
  lastEvent?: string;
  activeSubagent?: number;
  errorKey?: string;
  errorDetail?: string;
  // 最近一次收到事件或心跳的时间。
  lastSignalAt?: number;
  // 记录本轮接收的流量。
  streamBytes?: number;
  // 模型在答复结束前通过 json 事件下发的追问建议（最多 3 条）。
  followUps?: string[];
}
/** 气泡渲染布局：process 按时间顺序拆成「可折叠时间线」与「正文主体」两部分。 */
export interface MessageLayout {
  timeline: ProcessItem[];
  body: ProcessItem[];
}
export interface Conversation {
  attachments?: TextAttachment[];
  id: string;
  title: string;
  conversationId: string | null;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  draft: string;
  favorite?: boolean;
}
export interface StreamEvent {
  outerEvent: string;
  innerEvent?: string;
  content?: string;
  toolName?: string;
  raw: JsonRecord & { inner: JsonRecord };
  conversationId?: string;
}
export interface ChatRequest {
  conversationId: string;
  agent: { agentCode: 'SDA' };
  message: { content: string };
  stream: true;
}
export const statusKeys: Record<Status, string> = {
  waiting: 'AIAGENT.STATUS.WAITING',
  thinking: 'AIAGENT.STATUS.THINKING',
  tool: 'AIAGENT.STATUS.TOOL',
  subagent: 'AIAGENT.STATUS.SUBAGENT',
  answer: 'AIAGENT.STATUS.ANSWER',
  completed: 'AIAGENT.STATUS.COMPLETED',
  stopped: 'AIAGENT.STATUS.STOPPED',
  error: 'AIAGENT.STATUS.ERROR',
};
export const processStatusKeys: Record<ProcessStatus, string> = {
  running: 'AIAGENT.PROCESS.RUNNING',
  completed: 'AIAGENT.STATUS.COMPLETED',
  error: 'AIAGENT.PROCESS.ERROR',
  stopped: 'AIAGENT.PROCESS.STOPPED',
};
export const errorKeys: Record<string, string> = {
  ExecuteAgentContentError: 'AIAGENT.ERROR.CONTENT',
  ExecuteAgentSafetyCheckError: 'AIAGENT.ERROR.SAFETY',
  ExecuteAgentInternalSystemError: 'AIAGENT.ERROR.INTERNAL',
  ExecuteAgentLicenseCheckError: 'AIAGENT.ERROR.LICENSE',
};
// 数量和原文件大小在上传提示中说明；文本提取量限制保护既有请求和本地历史。
export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENT_TOTAL = MAX_ATTACHMENTS * MAX_ATTACHMENT_BYTES;
export const ATTACHMENT_ACCEPT =
  '.pdf,.pptx,.docx,.xlsx,.txt,.md,.markdown,.csv,.json,.log,.yaml,.yml,.xml,.sql,.js,.ts,.py,.java,.c,.cpp,.h,.html,.css';
// 本地 OOXML 文本提取，不引入依赖：浏览器 ZIP/DEFLATE + XML DOM。
// DOCX：正文段落、表格；XLSX：全部工作表、共享字符串、日期、百分比、公式缓存值。
// PPTX 复用同一解析器；不执行宏/公式/外部关系，不支持旧版 DOC/XLS 与扫描图片。
export const MAX_OFFICE_EXPANDED_BYTES = 24 * 1024 * 1024;
export const MAX_DOCUMENT_PAGES = 200;
export type ChatState = 'running' | 'completed' | 'failed' | 'stopped' | 'empty';
export const MAX_RUNNING = 3;
export const FOLLOW_UP_WAIT = 20_000;
export const dashboardName = 'VDS RealTime Dashboard';

export type ComposerTranslation = ReturnType<typeof import('vue-i18n').useI18n>['t'];
