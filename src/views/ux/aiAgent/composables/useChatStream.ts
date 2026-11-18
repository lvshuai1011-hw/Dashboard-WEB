import { computed, reactive, ref } from 'vue';
import type { Ref } from 'vue';
import type { ChatMessage, Conversation, JsonRecord, TextAttachment, StreamEvent } from '../types';
import { ElMessage } from 'element-plus';
import type { ComposerTranslation } from '../types';
import { MAX_RUNNING, FOLLOW_UP_WAIT } from '../types';
import { chatStream, isRecord } from '../lib/sse';
import { makeMessage, closeProcess, applyAgentEvent, readFollowUps } from '../lib/streamEvents';
import { attachmentRequestContent } from '../lib/attachmentMetadata';
import { useRunningRequests } from './useRunningRequests';

export function useChatStream(options: {
  t: ComposerTranslation;
  draft: Ref<string>;
  attachmentReading: Ref<boolean>;
  current: Ref<Conversation>;
  messages: Ref<ChatMessage[]>;
  attachmentErrors: Map<string, string>;
  activeId: Ref<string>;
  following: Ref<boolean>;
  questionEdits: Map<string, { userId: string; draft: string; attachments: TextAttachment[] }>;
  persistHistory: () => void;
  scheduleSave: () => void;
  scheduleScroll: () => void;
  draftAttachments: Ref<TextAttachment[]>;
  editQuestion: (message: ChatMessage) => void;
  isDisposed: () => boolean;
}) {
  const {
    t,
    draft,
    attachmentReading,
    current,
    messages,
    attachmentErrors,
    activeId,
    following,
    questionEdits,
    persistHistory,
    scheduleSave,
    scheduleScroll,
    draftAttachments,
    editQuestion,
  } = options;
  const running = useRunningRequests();
  const now = ref(Date.now());
  let elapsedTimer: ReturnType<typeof setInterval> | undefined;
  const streaming = computed(() => messages.value.some((m) => running.has(m.id)));
  function isActive(message: ChatMessage) {
    return running.has(message.id);
  }
  const tails = new Map<string, { abort: () => void; timer: ReturnType<typeof setTimeout> }>();
  function endTail(messageId: string) {
    const tail = tails.get(messageId);
    if (!tail) return;
    tails.delete(messageId);
    clearTimeout(tail.timer);
    tail.abort();
  }
  function acceptTailEvent(message: ChatMessage, event: StreamEvent) {
    if (
      event.outerEvent !== 'ExecuteAgentNormal' ||
      (event.innerEvent !== 'json' && event.innerEvent !== 'subagent_json')
    )
      return;
    try {
      const parsed: unknown = JSON.parse(
        (event.content ?? '')
          .replace(/^```json\s*/, '')
          .replace(/\s*```$/, '')
          .trim(),
      );
      if (!isRecord(parsed) || !('follow_up' in parsed)) return;
      const list = readFollowUps((parsed as JsonRecord).follow_up);
      if (list) {
        message.followUps = list;
        persistHistory();
        scheduleScroll();
      }
      endTail(message.id);
    } catch {
      /* 非 JSON，忽略 */
    }
  }
  function finishRequest(
    messageId: string,
    message: ChatMessage,
    status: 'completed' | 'stopped' | 'error',
    keepTail = false,
  ) {
    const handle = running.get(messageId);
    if (!handle) {
      endTail(messageId);
      return;
    }
    running.delete(messageId);
    message.status = status;
    message.process.forEach((p) => closeProcess(p, status));
    message.finishedAt = Date.now();
    // 完成后收起过程卡，让答复正文成为视觉主体；图表属于正文，保持展开。
    if (status === 'completed')
      message.process.forEach((p) => {
        if (p.kind !== 'chart') p.expanded = false;
      });
    if (!running.size) {
      clearInterval(elapsedTimer);
      elapsedTimer = undefined;
    }
    if (keepTail && !options.isDisposed()) {
      tails.set(messageId, {
        abort: handle.abort,
        timer: setTimeout(() => endTail(messageId), FOLLOW_UP_WAIT),
      });
    } else handle.abort();
    persistHistory();
    scheduleScroll();
  }
  function sendMessage() {
    const content = draft.value.trim();
    if (!content || options.isDisposed() || attachmentReading.value) return;
    if (running.size >= MAX_RUNNING) {
      ElMessage.warning(t('AIAGENT.LIMIT.RUNNING', { max: MAX_RUNNING }));
      return;
    }
    const chat = current.value;
    // 同一会话不允许并发：两个请求共用同一个 conversationId，上游返回的会话 id
    // 会被两条流交叉回写，上下文也会混在一起。不同会话之间并发才是我们要的。
    if (chat.messages.some((m) => running.has(m.id))) {
      ElMessage.warning(t('AIAGENT.LIMIT.SESSION_BUSY'));
      return;
    }
    const edit = questionEdits.get(chat.id);
    if (edit) {
      const index = chat.messages.findIndex((item) => item.id === edit.userId);
      // 最后一问复用原重新生成语义；历史问题重新提问，保留后续轮次，不擅自截断历史。
      if (
        index >= 0 &&
        index === chat.messages.length - 2 &&
        chat.messages[index + 1]?.role === 'assistant'
      )
        chat.messages.splice(index, 2);
      questionEdits.delete(chat.id);
    }
    if (!chat.title) chat.title = Array.from(content).slice(0, 20).join('');
    if (!chat.conversationId)
      chat.conversationId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const message = reactive(makeMessage('assistant', '', content));
    const files = (chat.attachments || []).map((file) => ({ ...file }));
    const userMessage = makeMessage('user', content);
    userMessage.attachments = files;
    chat.messages.push(userMessage, message);
    // 编辑提交后也恢复原来的下一问草稿，避免只有取消时保留、发送时却丢失。
    chat.draft = edit?.draft ?? '';
    chat.attachments = edit?.attachments ?? [];
    attachmentErrors.delete(chat.id);
    chat.updatedAt = Date.now();
    following.value = true;
    now.value = Date.now();
    if (!elapsedTimer)
      elapsedTimer = setInterval(() => {
        now.value = Date.now();
      }, 500);
    // 先登记请求，再启动传输，以便同步失败时也能清理句柄。
    let transportAbort: (() => void) | undefined;
    let cancellationRequested = false;
    running.set(message.id, {
      message,
      abort: () => {
        cancellationRequested = true;
        transportAbort?.();
      },
    });
    transportAbort = chatStream(
      {
        conversationId: chat.conversationId,
        agent: { agentCode: 'SDA' },
        message: { content: attachmentRequestContent(content, files) },
        stream: true,
      },
      (event) => {
        if (options.isDisposed()) return;
        if (!running.has(message.id)) {
          if (tails.has(message.id)) acceptTailEvent(message, event);
          return;
        }
        if (event.conversationId) chat.conversationId = event.conversationId;
        chat.updatedAt = Date.now();
        const result = applyAgentEvent(message, event);
        if (result) {
          finishRequest(
            message.id,
            message,
            result === 'done' ? 'completed' : 'error',
            result === 'done',
          );
          // 错误已在消息内以卡片完整呈现；只有该会话不在前台时才额外弹出提示。
          if (result === 'error' && chat.id !== activeId.value)
            ElMessage.error(t(message.errorKey!));
        } else {
          scheduleSave();
          scheduleScroll();
        }
      },
      (error) => {
        if (options.isDisposed() || !running.has(message.id)) {
          endTail(message.id);
          return;
        }
        // 传输层将 HTTP 状态码保存在错误对象上。
        const status = (error as { status?: number } | null)?.status;
        message.errorKey =
          status === 401 || status === 403 ? 'AIAGENT.ERROR.AUTH' : 'AIAGENT.ERROR.NETWORK';
        finishRequest(message.id, message, 'error');
        if (chat.id !== activeId.value) ElMessage.error(t(message.errorKey));
      },
      () => {
        endTail(message.id);
        if (!options.isDisposed()) finishRequest(message.id, message, 'completed');
      },
    );
    if (cancellationRequested) transportAbort();
    persistHistory();
    scheduleScroll();
  }
  // 只停止指定消息；不传则停止当前会话里正在跑的那条。
  // 模板通过包装函数调用，避免把点击事件当成消息参数。
  function stopGeneration(message?: ChatMessage) {
    // 当前会话优先；找不到再全局找，避免用户切了会话后停不到原来那条。
    const target =
      (message instanceof Object && 'process' in message ? message : undefined) ??
      messages.value.find((m) => running.has(m.id)) ??
      [...running.values()].map((h) => h.message).find((m) => m.role === 'assistant');
    if (target) {
      finishRequest(target.id, target, 'stopped');
      return;
    }
    // 没有可停的请求时也要有反馈，否则用户无从判断按钮是否生效。
    if (!running.size) ElMessage.info(t('AIAGENT.STATUS.STOPPED'));
  }
  // 每条助手答复均可再次生成；最后一轮原位替换，旧轮次作为新问题提交以保留后续历史。
  function canRegenerate(message: ChatMessage) {
    const index = messages.value.indexOf(message);
    return (
      !running.has(message.id) &&
      !!message.prompt &&
      index > 0 &&
      messages.value[index - 1]?.role === 'user'
    );
  }
  function regenerate(message: ChatMessage) {
    if (
      !canRegenerate(message) ||
      streaming.value ||
      options.isDisposed() ||
      attachmentReading.value
    )
      return;
    if (running.size >= MAX_RUNNING) {
      ElMessage.warning(t('AIAGENT.LIMIT.RUNNING', { max: MAX_RUNNING }));
      return;
    }
    // 重试不能覆盖正在编辑的草稿；需要修改时使用问题旁的编辑入口。
    if (draft.value.trim() || draftAttachments.value.length) {
      ElMessage.warning(t('AIAGENT.INPUT.DRAFT_EXISTS'));
      return;
    }
    editQuestion(message);
    sendMessage();
  }
  function stopAll() {
    [...running.values()].forEach((handle) =>
      finishRequest(handle.message.id, handle.message, 'stopped'),
    );
  }

  function disposeRequests() {
    stopAll();
    [...tails.keys()].forEach(endTail);
    clearInterval(elapsedTimer);
  }

  return {
    running,
    now,
    streaming,
    isActive,
    finishRequest,
    sendMessage,
    stopGeneration,
    canRegenerate,
    regenerate,
    stopAll,
    disposeRequests,
  };
}
