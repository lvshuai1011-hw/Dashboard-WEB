import { reactive, type Component, type Ref } from 'vue';
import { Document } from '@element-plus/icons-vue';
import { CloudIcon, SkillIcon, BotIcon, WrenchIcon } from '../lib/icons';
import { layout } from '../lib/messageLayout';
import { isRecord } from '../lib/sse';
import { processStatusKeys, statusKeys } from '../types';
import type { ChatMessage, ProcessItem, ComposerTranslation } from '../types';
import type { useUiCopy } from './useUiCopy';

export function useProcessTimeline(
  t: ComposerTranslation,
  uiCopy: ReturnType<typeof useUiCopy>,
  now: Ref<number>,
  isActive: (message: ChatMessage) => boolean,
  chartKey: (message: ChatMessage, item: ProcessItem) => string,
) {
  // ---- 执行过程：每个 SSE 过程项渲染为一行步骤 ----
  type StepGroup = 'thinking' | 'skill' | 'agent' | 'tool' | 'data';
  function stepGroup(item: ProcessItem): StepGroup {
    if (item.kind === 'text') return 'thinking';
    if (item.kind === 'subagent') return 'agent';
    if (item.kind === 'tool') return item.skillLoad ? 'skill' : 'tool';
    return 'data';
  }
  const stepIcons: Record<StepGroup, Component> = {
    thinking: CloudIcon,
    skill: SkillIcon,
    agent: BotIcon,
    tool: WrenchIcon,
    data: Document,
  };
  function stepIcon(item: ProcessItem) {
    return stepIcons[stepGroup(item)];
  }
  function stepName(item: ProcessItem) {
    if (item.kind === 'tool' && item.skillLoad)
      return t('AIAGENT.PROCESS.SKILL_LOADED', { name: skillLabel(item.toolName) });
    return processTitle(item);
  }
  function plainLine(value: string, last = false) {
    const lines = value
      .split('\n')
      .map((line) => line.replace(/^[#>\-*\s]+|[`*_]/g, '').trim())
      .filter(Boolean);
    return (last ? lines[lines.length - 1] : lines[0]) || '';
  }
  function stepPreview(message: ChatMessage, item: ProcessItem) {
    const live = isActive(message) && item.status === 'running';
    if (item.kind === 'text') return plainLine(item.text, live);
    if (item.kind === 'subagent') return plainLine(item.answer || item.thinking, true);
    if (item.kind === 'tool' && !item.skillLoad)
      return toolFacts(item)
        .filter(
          (fact) =>
            fact.label !== t('AIAGENT.PROCESS.SKILL') &&
            fact.label !== t('AIAGENT.PROCESS.STATUS') &&
            fact.label !== t('AIAGENT.PROCESS.DURATION_LABEL'),
        )
        .map((fact) => `${fact.label}: ${fact.value}`)
        .join('  ');
    return '';
  }
  function stepTime(_message: ChatMessage, item: ProcessItem) {
    if (item.kind === 'text' || item.kind === 'chart' || item.kind === 'json') return '';
    const ms = Math.round(Math.max(0, item.duration ?? now.value - item.startTime));
    return ms < 1000
      ? t('AIAGENT.PROCESS.DURATION', { ms })
      : t('AIAGENT.STATUS.ELAPSED', { seconds: (ms / 1000).toFixed(ms < 10_000 ? 2 : 1) });
  }
  function stepExpandable(item: ProcessItem) {
    if (item.kind === 'text') return !!item.text.trim();
    if (item.kind === 'tool') return !item.skillLoad;
    return true;
  }
  const stepOverride = reactive(new Map<string, boolean>());
  function stepOpen(message: ChatMessage, item: ProcessItem) {
    const manual = stepOverride.get(chartKey(message, item));
    if (manual !== undefined) return manual;
    // 默认只展开“正在输出”的思考 / 子智能体，以及出错的步骤。
    return (
      item.status === 'error' ||
      (isActive(message) &&
        item.status === 'running' &&
        (item.kind === 'text' || item.kind === 'subagent'))
    );
  }
  function toggleStep(message: ChatMessage, item: ProcessItem) {
    stepOverride.set(chartKey(message, item), !stepOpen(message, item));
  }
  function stepCounts(message: ChatMessage) {
    const counts: Partial<Record<StepGroup, number>> = {};
    layout(message).timeline.forEach((item) => {
      const group = stepGroup(item);
      counts[group] = (counts[group] || 0) + 1;
    });
    return (['thinking', 'skill', 'agent', 'tool'] as const)
      .filter((group) => counts[group])
      .map((group) => ({
        group,
        count: counts[group]!,
        icon: stepIcons[group],
        label: uiCopy.value.steps[group],
      }));
  }
  function liveStepName(message: ChatMessage) {
    const item = message.process
      .filter((p) => (p.kind === 'tool' || p.kind === 'subagent') && p.status === 'running')
      .pop();
    return item
      ? item.kind === 'tool' && item.skillLoad
        ? skillLabel(item.toolName)
        : processTitle(item)
      : '';
  }
  function summaryLabel(message: ChatMessage) {
    const label =
      message.status === 'completed' ? uiCopy.value.done : t(statusKeys[message.status]);
    return message.finishedAt
      ? `${label} · ${uiCopy.value.usedTime(((message.finishedAt - message.createdAt) / 1000).toFixed(1))}`
      : label;
  }
  // Running traces expand automatically; explicit user choices take precedence.
  const traceOverride = reactive(new Map<string, boolean>());
  function traceOpen(message: ChatMessage) {
    const manual = traceOverride.get(message.id);
    // 生成中自动展开、结束后收起；用户手动展开/收起后以用户选择为准。
    return manual === undefined ? isActive(message) : manual;
  }
  function toggleTrace(message: ChatMessage) {
    traceOverride.set(message.id, !traceOpen(message));
  }
  // ---- 状态栏：运行中把这一条变成「当前步骤 + 正在输出的文字」 ----
  // 阶段只从本地观测推断，不依赖上游任何格式约定。
  function liveLabel(message: ChatMessage) {
    const runningTool = message.process
      .filter((p) => (p.kind === 'tool' || p.kind === 'subagent') && p.status === 'running')
      .pop();
    if (runningTool)
      return t(runningTool.kind === 'subagent' ? 'AIAGENT.STATUS.SUBAGENT' : 'AIAGENT.STATUS.TOOL');
    const text = message.process.filter((p) => p.kind === 'text').pop();
    if (text && text.status === 'running') return t('AIAGENT.STATUS.ANSWER');
    if (message.process.some((p) => p.kind === 'chart')) return t('AIAGENT.STATUS.RENDERING');
    return message.process.length ? t('AIAGENT.STATUS.THINKING') : t('AIAGENT.STATUS.WAITING');
  }
  // 技能名保持英文原文，只有拿不到名字时才回落到本地化占位。
  function skillLabel(name: string) {
    return name || t('AIAGENT.SKILL.GENERIC');
  }
  function processTitle(item: ProcessItem) {
    if (item.kind === 'chart') return item.chart?.title || t('AIAGENT.CHART.TITLE');
    if (item.kind === 'json') return t('AIAGENT.CHART.JSON_TITLE');
    if (item.kind === 'text') return t('AIAGENT.PROCESS.THINKING_TURN');
    if (item.kind === 'tool')
      return item.toolName
        ? skillLabel(item.toolName)
        : t('AIAGENT.PROCESS.TOOL_CALL', { name: t('AIAGENT.SKILL.GENERIC') });
    return item.agentName === 'to_pcr_agent'
      ? t('AIAGENT.AGENT.PCR')
      : item.agentName || t('AIAGENT.PROCESS.SUBAGENT');
  }
  // metadata 里 callId / timeStart / toolName / status / duration 是链路内部字段：
  // 前两个对用户没有意义，其余三个已单独成行，都不在这里重复展示。
  const internalMetaKeys = new Set([
    'toolName',
    'status',
    'duration',
    'callId',
    'timeStart',
    'input',
  ]);
  // 技能卡展开后给用户看的是「这次调用做了什么」，而不是给开发看的原始 JSON。
  // 只解释已知字段，未知字段仍收在下方「原始数据」里，不猜测含义。
  function toolFacts(item: ProcessItem) {
    const facts: { label: string; value: string }[] = [];
    if (item.toolName) facts.push({ label: t('AIAGENT.PROCESS.SKILL'), value: item.toolName });
    facts.push({ label: t('AIAGENT.PROCESS.STATUS'), value: t(processStatusKeys[item.status]) });
    // duration 单位为毫秒（与参考实现 rdd-agent/MessagePop.vue 一致），不要当秒再除 1000。
    if (item.duration != null)
      facts.push({
        label: t('AIAGENT.PROCESS.DURATION_LABEL'),
        value: t('AIAGENT.PROCESS.DURATION', { ms: Math.round(Math.max(0, item.duration)) }),
      });
    let meta: Record<string, unknown> | undefined;
    try {
      const parsed: unknown = JSON.parse(item.input || '{}');
      if (isRecord(parsed)) meta = parsed;
    } catch {
      /* 非 JSON，只展示原始数据 */
    }
    if (meta) {
      for (const [key, value] of Object.entries(meta)) {
        if (internalMetaKeys.has(key)) continue;
        if (value == null || value === '' || typeof value === 'object') continue;
        facts.push({ label: key, value: String(value) });
      }
    }
    return facts;
  }
  function prettyJson(value: string) {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value || '—';
    }
  }

  return {
    traceOverride,
    traceOpen,
    toggleTrace,
    stepGroup,
    stepIcon,
    stepName,
    stepPreview,
    stepTime,
    stepExpandable,
    stepOpen,
    toggleStep,
    stepCounts,
    liveStepName,
    summaryLabel,
    liveLabel,
    toolFacts,
    prettyJson,
  };
}
