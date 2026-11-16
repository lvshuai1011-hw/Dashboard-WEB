<template>
<section ref="processRoot" class="agent-page" :aria-label="dashboardName" @keydown="onWorkspaceKeydown">
    <div class="workspace">
      <!-- 侧栏：品牌、新建、搜索、按时间分组的历史会话 -->
<ChatSidebar
  v-if="sidebarOpen"
  :activeId="activeId"
  :searchMode="searchMode"
  :storageWarning="storageWarning"
  :historyQuery="historyQuery"
  :messages="messages"
  :filteredHistory="filteredHistory"
  :current="current"
  :historyGroups="historyGroups"
  :renaming="renaming"
  :chatStateKeys="chatStateKeys"
  :uiCopy="uiCopy"
  :chatState="chatState"
  :historyMatch="historyMatch"
  @toggleSidebar="toggleSidebar"
  @newConversation="newConversation"
  @focusHistorySearch="focusHistorySearch"
  @closeSearch="closeSearch"
  @commitRename="commitRename"
  @cancelRename="cancelRename"
  @openHistoryResult="openHistoryResult"
  @renameConversation="renameConversation"
  @onChatCommand="onChatCommand"
  @registerHistorySearch="registerHistorySearch"
  @updateHistoryQuery="updateHistoryQuery"
  @updateRename="updateRename"
/>

      <main class="chat-pane" :class="{ 'is-welcome': !messages.length, 'sidebar-hidden': !sidebarOpen }" @dragenter="onAttachmentDragEnter" @dragover="onAttachmentDragOver" @dragleave="onAttachmentDragLeave" @drop="onAttachmentDrop">
        <div v-if="attachmentDragDepth" class="attachment-drop" aria-hidden="true"><el-icon><Paperclip /></el-icon><strong>{{ attachmentCopy.add }}</strong><span>{{ attachmentHint }}</span></div>
        <el-tooltip v-if="!sidebarOpen" :content="uiCopy.expand" placement="right">
          <button class="icon-button sidebar-open" type="button" :aria-label="uiCopy.expand" :aria-expanded="false" @click="toggleSidebar"><el-icon><PanelIcon /></el-icon></button>
        </el-tooltip>

        <!-- 顶栏：会话标题即菜单（收藏 / 重命名 / 删除） -->
<ChatHeader
  v-if="messages.length"
  :current="current"
  :renaming="renaming"
  @commitRename="commitRename"
  @cancelRename="cancelRename"
  @onChatCommand="onChatCommand"
  @updateRename="updateRename"
/>
<WelcomePage
  v-if="!messages.length"
/>
<MessageList
  v-else
  :activeQuestionId="activeQuestionId"
  :locatedMessageId="locatedMessageId"
  :copiedMessageId="copiedMessageId"
  :streaming="streaming"
  :attachmentReading="attachmentReading"
  :reducedMotion="reducedMotion"
  :following="following"
  :now="now"
  :messages="messages"
  :questionEntries="questionEntries"
  :feedback="feedback"
  :uiCopy="uiCopy"
  :formatTime="formatTime"
  :layout="layout"
  :isActive="isActive"
  :justFinished="justFinished"
  :keyMarkPart="keyMarkPart"
  :bodyEntries="bodyEntries"
  :answerText="answerText"
  :canRegenerate="canRegenerate"
  :showFollowUps="showFollowUps"
  :traceOpen="traceOpen"
  :liveLabel="liveLabel"
  :liveStepName="liveStepName"
  :summaryLabel="summaryLabel"
  :stepCounts="stepCounts"
  :stepExpandable="stepExpandable"
  :stepGroup="stepGroup"
  :stepOpen="stepOpen"
  :stepIcon="stepIcon"
  :stepName="stepName"
  :stepPreview="stepPreview"
  :stepTime="stepTime"
  :toolFacts="toolFacts"
  :prettyJson="prettyJson"
  :chartMode="chartMode"
  :chartTable="chartTable"
  :numericColumn="numericColumn"
  :formatCell="formatCell"
  @scheduleScroll="scheduleScroll"
  @onMessageScroll="onMessageScroll"
  @jumpToBottom="jumpToBottom"
  @copyQuestion="copyQuestion"
  @copyAnswer="copyAnswer"
  @editQuestion="editQuestion"
  @regenerate="regenerate"
  @setFeedback="setFeedback"
  @askFollowUp="askFollowUp"
  @jumpToMessage="jumpToMessage"
  @copyCode="copyCode"
  @previewAttachment="previewAttachment"
  @setChartMode="setChartMode"
  @downloadCurrent="downloadCurrent"
  @registerChart="registerChart"
  @registerScrollbar="registerScrollbar"
/>
<Composer
  :streaming="streaming"
  :attachmentReading="attachmentReading"
  :draft="draft"
  :editingMessageId="editingMessageId"
  :attachmentError="attachmentError"
  :messages="messages"
  :draftAttachments="draftAttachments"
  :uiCopy="uiCopy"
  :attachmentCopy="attachmentCopy"
  @sendMessage="sendMessage"
  @stopGeneration="stopGeneration"
  @cancelQuestionEdit="cancelQuestionEdit"
  @clearAttachmentError="clearAttachmentError"
  @setDraft="setDraft"
  @removeAttachment="removeAttachment"
  @onAttachmentChoose="onAttachmentChoose"
  @onAttachmentPaste="onAttachmentPaste"
  @onInputKeydown="onInputKeydown"
  @previewAttachment="previewAttachment"
  @registerInput="registerInput"
  @updateDraft="updateDraft"
/>
        <p class="disclaimer">{{ uiCopy.disclaimer }}</p>
      </main>
    </div>
<ConfirmDialogs
  :pendingDelete="pendingDelete"
  :attachmentPreview="attachmentPreview"
  :uiCopy="uiCopy"
  @confirmDelete="confirmDelete"
  @previewAttachment="previewAttachment"
  @setPendingDelete="setPendingDelete"
/>
    <p class="sr-only" role="status" aria-live="polite">{{ t(streaming ? 'AIAGENT.A11Y.GENERATING' : 'AIAGENT.A11Y.READY') }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useI18n } from 'vue-i18n';
import { ElIcon, ElTooltip, ElMessage, type InputInstance, type ScrollbarInstance } from 'element-plus';
import { Paperclip } from '@element-plus/icons-vue';
import { PanelIcon } from "./lib/icons";
import { dashboardName, STORAGE_KEY } from "./types";
import type { ChatMessage, ProcessItem, Conversation } from "./types";
import { layout } from "./lib/messageLayout";
import { useConversations } from "./composables/useConversations";
import { useChatStream } from "./composables/useChatStream";
import { useAttachments } from './composables/useAttachments';
import { useChartCards } from './composables/useChartCards';
import { useProcessTimeline } from './composables/useProcessTimeline';
import { useUiCopy } from "./composables/useUiCopy";
import ChatSidebar from "./components/ChatSidebar.vue";
import ChatHeader from "./components/ChatHeader.vue";
import WelcomePage from "./components/WelcomePage.vue";
import MessageList from "./components/MessageList.vue";
import Composer from "./components/Composer.vue";
import ConfirmDialogs from "./components/ConfirmDialogs.vue";
const { t, locale } = useI18n();
const reducedMotion = ref(false);
const inputRef = ref<InputInstance>();
const processRoot = ref<HTMLElement>();
let processEventRoot: HTMLElement | undefined;
let disposed = false;

const {
  conversations, current, messages, activeId, storageWarning, sidebarOpen, chatState, chatStateKeys,
  historyQuery, historyMatch, filteredHistory, pinned, unpinned, draft, historySearchRef, searchMode,
  closeSearch, persistHistory, scheduleSave, toggleSidebar, newConversation, switchConversation,
  toggleFavorite, renaming, renameConversation, cancelRename, commitRename, pendingDelete,
  deleteConversation, confirmDelete, disposeHistory, scroll,
} = useConversations({
  t, inputRef, processRoot,
  isDisposed: () => disposed,
  finishRequest: (id, message, status) => finishRequest(id, message, status),
});
const {
  following, scrollRef, locatedMessageId, questionEntries, activeQuestionId, jumpToMessage,
  updateActiveQuestion, scheduleScroll, jumpToBottom, onMessageScroll, disposeScroll,
} = scroll;
const copiedMessageId = ref('');
let copiedTimer: ReturnType<typeof setTimeout> | undefined;
function messageMatches(message: ChatMessage, query: string) {
  const contains = (value?: string) => !!value?.normalize('NFKC').toLocaleLowerCase().includes(query);
  return contains(message.content) || message.attachments?.some(file => contains(file.name)) || message.process.some(item => contains(item.text) || contains(item.answer) || contains(item.thinking) || contains(item.chart?.title) || contains(item.chart?.summary));
}
async function openHistoryResult(chat: Conversation) {
  const query = historyQuery.value.trim().normalize('NFKC').toLocaleLowerCase();
  switchConversation(chat.id);
  const match = query ? chat.messages.find(message => messageMatches(message, query)) : undefined;
  if (match) { if (match.role === 'assistant') traceOverride.set(match.id, true); await jumpToMessage(match.id); }
}
async function focusHistorySearch() {
  sidebarOpen.value = true; searchMode.value = true;
  await nextTick(); historySearchRef.value?.focus();
}
// 点击发送会卸载原按钮并把焦点交回 body；只在此时补快捷键，不重复处理组件内事件。
function onPageShortcut(event: KeyboardEvent) {
  if (!processRoot.value?.getClientRects().length) return;
  if (event.target === document.body || event.target === document.documentElement) onWorkspaceKeydown(event);
}
function onWorkspaceKeydown(event: KeyboardEvent) {
  if (event.isComposing || event.keyCode === 229) return;
  // 不抢占弹窗/文件选择器的 Escape，也不让快捷新建使当前弹窗串到另一会话。
  if (attachmentPreview.value) return;
  if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') { event.preventDefault(); void focusHistorySearch(); }
  else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'o') { event.preventDefault(); newConversation(); }
  else if (event.shiftKey && event.key === 'Escape') { event.preventDefault(); inputRef.value?.focus(); }
}
function markCopied(id: string) { copiedMessageId.value = id; clearTimeout(copiedTimer); copiedTimer = setTimeout(() => { copiedMessageId.value = ''; }, 1800); }
async function copyQuestion(message: ChatMessage) { if (await copyText(message.content)) markCopied(message.id); }
async function copyAnswer(message: ChatMessage) {
  if (await copyText(answerText(message))) markCopied(message.id);
}

// 图表实例按 ProcessItem.id 缓存，供下载按钮取 getDataURL；组件卸载时由 ChartView 自身 dispose。
const uiCopy = useUiCopy(locale);
const {
  attachmentPreview, attachmentDragDepth, attachmentErrors, draftAttachments, attachmentReading, attachmentError,
  attachmentCopy, attachmentHint, removeAttachment, onAttachmentChoose, onAttachmentDragEnter, onAttachmentDragOver,
  onAttachmentDragLeave, onAttachmentDrop, onAttachmentPaste, previewAttachment, clearAttachmentError,
} = useAttachments({ current, activeId, conversations, locale, t, scheduleSave, isDisposed: () => disposed });
const { chartMode, chartTable, numericColumn, formatCell, chartKey, downloadCurrent, setChartMode, registerChart } =
  useChartCards(t, locale, uiCopy);
// 历史分组：收藏置顶，其余按最近更新时间分为今天 / 近 7 天 / 更早。
const historyGroups = computed(() => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const today = start.getTime(), week = today - 6 * 86_400_000;
  return [
    { key: 'favorites', label: t('AIAGENT.HISTORY.FAVORITES'), items: pinned.value },
    { key: 'today', label: uiCopy.value.today, items: unpinned.value.filter(c => c.updatedAt >= today) },
    { key: 'week', label: uiCopy.value.week, items: unpinned.value.filter(c => c.updatedAt < today && c.updatedAt >= week) },
    { key: 'earlier', label: uiCopy.value.earlier, items: unpinned.value.filter(c => c.updatedAt < week) },
  ].filter(group => group.items.length);
});
// 点击追问直接发送；若输入框已有草稿、附件或正在编辑问题，则改为填入，避免覆盖用户内容。
function askFollowUp(question: string) {
  if (streaming.value || attachmentReading.value || editingMessageId.value || draft.value.trim() || draftAttachments.value.length) { setDraft(question); return; }
  draft.value = question;
  sendMessage();
}
function showFollowUps(message: ChatMessage) {
  const list = messages.value;
  return message.role === 'assistant' && message.status === 'completed' && !isActive(message) && !!message.followUps?.length && list[list.length - 1]?.id === message.id;
}
function onChatCommand(chat: Conversation, command: string, where: 'side' | 'header' = 'side') {
  if (command === 'favorite') toggleFavorite(chat);
  else if (command === 'rename') renameConversation(chat, where);
  else if (command === 'delete') deleteConversation(chat);
}
// 右侧提问导航：按滚动位置高亮当前所读的提问。
watch(() => [activeId.value, questionEntries.value.length], () => { void nextTick(updateActiveQuestion); });
// 编辑先进入输入框，提交前不改动任何已发送消息。每个会话独立保存编辑目标与原草稿。
const questionEdits = reactive(new Map<string, { userId: string; draft: string; attachments: TextAttachment[] }>());
const editingMessageId = computed(() => questionEdits.get(activeId.value)?.userId || '');
function editQuestion(message: ChatMessage) {
  if (streaming.value || attachmentReading.value) return;
  const index = messages.value.indexOf(message);
  const question = message.role === 'user' ? message : messages.value[index - 1];
  if (!question || question.role !== 'user') return;
  const prior = questionEdits.get(activeId.value);
  // Preserve a pending draft, including attachments, so Cancel restores it instead of silently discarding it.
  questionEdits.set(activeId.value, { userId: question.id, draft: prior?.draft ?? draft.value, attachments: prior?.attachments ?? draftAttachments.value.map(file => ({ ...file })) });
  current.value.attachments = (question.attachments || []).map(file => ({ ...file }));
  draft.value = question.content;
  void nextTick(() => inputRef.value?.focus());
}
function cancelQuestionEdit() {
  const edit = questionEdits.get(activeId.value);
  if (!edit || attachmentReading.value) return;
  current.value.draft = edit.draft; current.value.attachments = edit.attachments;
  questionEdits.delete(activeId.value); scheduleSave(); void nextTick(() => inputRef.value?.focus());
}
// 反馈是本地标记，独立键保存，不改变历史结构、不伪装服务端反馈接口。
type AnswerFeedback = 'up' | 'down';
function readFeedback(): Map<string, AnswerFeedback> {
  try {
    const values: unknown = JSON.parse(localStorage.getItem(`${STORAGE_KEY}:feedback`) || '[]');
    if (!Array.isArray(values)) return new Map();
    return new Map(values.filter((item): item is [string, AnswerFeedback] => Array.isArray(item) && item.length === 2 && typeof item[0] === 'string' && ['up', 'down'].includes(item[1])).slice(-1000));
  } catch { return new Map(); }
}
const feedback = reactive(readFeedback());
function setFeedback(message: ChatMessage, value: AnswerFeedback) {
  if (feedback.get(message.id) === value) feedback.delete(message.id); else feedback.set(message.id, value);
  try { localStorage.setItem(`${STORAGE_KEY}:feedback`, JSON.stringify([...feedback].slice(-1000))); }
  catch { ElMessage.warning(t('AIAGENT.HISTORY.SAVE_FAILED')); }
}

function formatTime(value: number) { return new Intl.DateTimeFormat(locale.value.startsWith('zh') ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(value); }
// 复制/判空都以“用户在正文里看到的全部内容”为准：文本 part + 图表标题与摘要。
// 纯图表回答没有文本 part，若只取 text，复制会被误禁用且会被误判为“未收到答复”。
function bodyEntries(message: ChatMessage) {
  return layout(message).body.map(p => {
    if (p.kind === 'text') return p.text.trim();
    if (p.kind === 'chart') return [p.chart?.title, p.chart?.summary].filter(Boolean).join('\n').trim();
    return '';
  }).filter(Boolean);
}
function answerText(message: ChatMessage) {
  // 用户评审修正：中断后仍可复制已收到的文字，不把过程文本冒充已完成的最终答复。
  if (message.status === 'stopped' || message.status === 'error') {
    return message.process.map(item => item.kind === 'text' ? item.text : item.kind === 'subagent' ? item.answer : item.kind === 'chart' ? [item.chart?.title, item.chart?.summary].filter(Boolean).join('\n') : '').filter(Boolean).join('\n\n').trim();
  }
  return bodyEntries(message).join('\n\n').trim();
}
function toggleProcess(item: ProcessItem) {
  item.expanded = !item.expanded;
  item.manual = true;
  // 手动查看过程时保留阅读位置，避免展开后立即滚离当前卡片。
}
// 在稳定根节点原生委托，不依赖每个 v-for 按钮自己的 Vue click 绑定。
// 按 id 在**全部会话**里找消息：并发后同时可能有多个会话的消息渲染在屏幕上，
// 只在当前会话里找会让其它会话的卡片点了没反应。
function findMessage(id: string | undefined) {
  if (!id) return undefined;
  for (const conversation of conversations.value) {
    const hit = conversation.messages.find(m => m.id === id);
    if (hit) return hit;
  }
  return undefined;
}
function onProcessClick(event: MouseEvent) {
  if (!(event.target instanceof Element) || !processEventRoot) return;
  const trace = event.target.closest<HTMLButtonElement>('button.trace-toggle[data-message-id]');
  if (trace) {
    const message = findMessage(trace.dataset.messageId);
    if (message) { event.stopPropagation(); toggleTrace(message); }
    return;
  }
  const step = event.target.closest<HTMLButtonElement>('button.step-row[data-message-id][data-process-id]');
  if (step) {
    const message = findMessage(step.dataset.messageId);
    const item = message?.process.find(value => String(value.id) === step.dataset.processId);
    if (message && item) { event.stopPropagation(); toggleStep(message, item); }
    return;
  }
  const button = event.target.closest<HTMLButtonElement>('button.process-summary[data-message-id][data-process-id]');
  if (!button || button.disabled || !processEventRoot.contains(button)) return;
  const message = findMessage(button.dataset.messageId);
  const item = message?.process.find(value => String(value.id) === button.dataset.processId);
  if (!item) return;
  event.stopPropagation();
  toggleProcess(item);
}
function setDraft(content: string) {
  if (draft.value.trim()) { ElMessage.warning(t('AIAGENT.INPUT.DRAFT_EXISTS')); return; }
  draft.value = content; void nextTick(() => inputRef.value?.focus());
}
function onInputKeydown(raw: Event | KeyboardEvent) {
  const event = raw as KeyboardEvent;
  // Enter 直接发送，Shift+Enter 换行；中文输入法组字期间（isComposing / keyCode 229）不拦截。
  if (event.isComposing || event.keyCode === 229 || event.key !== 'Enter') return;
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  sendMessage();
}
// 刚完成（1.5 秒内）的答复在落入正文时播放高亮动画；刷新、切换会话加载的历史不播放。
function justFinished(message: ChatMessage) {
  return message.status === 'completed' && !!message.finishedAt && Date.now() - message.finishedAt < 1500;
}
// 正文中第一个含 **加粗** 的文本块；整条回答只高亮这一处。
function keyMarkPart(message: ChatMessage) {
  return layout(message).body.find(item => item.kind === 'text' && /\*\*[^*\n]+\*\*/.test(item.text))?.id;
}
async function copyText(content: string) {
  let copied = false;
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(content); copied = true; } } catch { /* 尝试兼容内网 HTTP。 */ }
  if (!copied && !disposed) {
    const previous = document.activeElement, textarea = document.createElement('textarea');
    textarea.value = content; textarea.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(textarea);
    try { textarea.select(); copied = document.execCommand('copy'); } catch { copied = false; }
    finally { textarea.remove(); if (previous instanceof HTMLElement) previous.focus({ preventScroll: true }); }
  }
  // 成功时由按钮图标就地变为对勾来反馈，不再弹顶部提示；失败才提示。
  if (!disposed && !copied) ElMessage.warning(t('AIAGENT.COPY.FAILED'));
  return copied;
}
function copyCode(event: MouseEvent) {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('button[data-copy-code]');
  const code = button?.closest('.code-block')?.querySelector('pre code');
  // 复制成功后按钮图标短暂变为对勾，给出就地反馈。
  if (code) void copyText(code.textContent ?? '').then(copied => { if (!copied || !button) return; button.classList.add('copied'); setTimeout(() => button.classList.remove('copied'), 1800); });
}
let motionQuery: MediaQueryList | undefined;
function syncMedia() { reducedMotion.value = !!motionQuery?.matches; }
// 离开页面/卸载时要停掉**全部**在跑的请求：并发下可能同时有 2~3 条，
// 只停当前会话那一条会让其余 fetch 悬挂到空闲超时。
function onPageHide() { stopAll(); persistHistory(); }
onMounted(() => document.addEventListener('keydown', onPageShortcut));
onUnmounted(() => document.removeEventListener('keydown', onPageShortcut));
onMounted(() => {
  processEventRoot = processRoot.value;
  processEventRoot?.addEventListener('click', onProcessClick, true);
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  syncMedia(); motionQuery.addEventListener('change', syncMedia);
  window.addEventListener('pagehide', onPageHide); scheduleScroll();
});
onUnmounted(() => { disposeScroll(); clearTimeout(copiedTimer); });
onUnmounted(() => {
  processEventRoot?.removeEventListener('click', onProcessClick, true);
  processEventRoot = undefined;
  disposeRequests(); persistHistory(); disposed = true; disposeHistory();
  motionQuery?.removeEventListener('change', syncMedia);
  window.removeEventListener('pagehide', onPageHide);
});

const { now, streaming, isActive, finishRequest, sendMessage, stopGeneration, canRegenerate, regenerate, stopAll, disposeRequests } = useChatStream({
  t, draft, attachmentReading, current, messages, attachmentErrors, activeId, following,
  questionEdits, persistHistory, scheduleSave, scheduleScroll, draftAttachments, editQuestion,
  isDisposed: () => disposed,
});

const {
  traceOverride, traceOpen, toggleTrace, stepGroup, stepIcon, stepName, stepPreview, stepTime, stepExpandable,
  stepOpen, toggleStep, stepCounts, liveStepName, summaryLabel, liveLabel, toolFacts, prettyJson,
} = useProcessTimeline(t, uiCopy, now, isActive, chartKey);

const registerScrollbar = (value: unknown) => { scrollRef.value = value as ScrollbarInstance | undefined ?? undefined; };
const registerHistorySearch = (value: unknown) => { historySearchRef.value = value as HTMLInputElement | undefined ?? undefined; };
const registerInput = (value: unknown) => { inputRef.value = value as InputInstance | undefined ?? undefined; };
const updateDraft = (value: string) => { draft.value = value; };
const updateHistoryQuery = (value: string) => { historyQuery.value = value; };
const updateRename = (value: string) => { renaming.value = value; };
const setPendingDelete = (chat: Conversation | null) => { pendingDelete.value = chat; };
</script>

<style lang="less" src="./styles/seeksettlement.less"></style>
<style lang="less" src="./styles/global.less"></style>
