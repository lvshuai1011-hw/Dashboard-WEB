import { reactive, ref, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { STORAGE_KEY } from '../types';
import type { ChatMessage, ComposerTranslation } from '../types';

export function useMessageActions(
  t: ComposerTranslation,
  answerText: (message: ChatMessage) => string,
  isDisposed: () => boolean,
) {
  const copiedMessageId = ref('');
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;
  const codeTimers = new Set<ReturnType<typeof setTimeout>>();
  // 反馈是本地标记，独立键保存，不改变历史结构、不伪装服务端反馈接口。
  type AnswerFeedback = 'up' | 'down';
  function readFeedback(): Map<string, AnswerFeedback> {
    try {
      const values: unknown = JSON.parse(localStorage.getItem(`${STORAGE_KEY}:feedback`) || '[]');
      if (!Array.isArray(values)) return new Map();
      return new Map(
        values
          .filter(
            (item): item is [string, AnswerFeedback] =>
              Array.isArray(item) &&
              item.length === 2 &&
              typeof item[0] === 'string' &&
              ['up', 'down'].includes(item[1]),
          )
          .slice(-1000),
      );
    } catch {
      return new Map();
    }
  }
  const feedback = reactive(readFeedback());
  function setFeedback(message: ChatMessage, value: AnswerFeedback) {
    if (feedback.get(message.id) === value) feedback.delete(message.id);
    else feedback.set(message.id, value);
    try {
      localStorage.setItem(`${STORAGE_KEY}:feedback`, JSON.stringify([...feedback].slice(-1000)));
    } catch {
      ElMessage.warning(t('AIAGENT.HISTORY.SAVE_FAILED'));
    }
  }
  function markCopied(id: string) {
    if (isDisposed()) return;
    copiedMessageId.value = id;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      copiedMessageId.value = '';
    }, 1800);
  }
  async function copyQuestion(message: ChatMessage) {
    if (await copyText(message.content)) markCopied(message.id);
  }
  async function copyAnswer(message: ChatMessage) {
    if (await copyText(answerText(message))) markCopied(message.id);
  }

  async function copyText(content: string) {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
        copied = true;
      }
    } catch {
      /* 尝试兼容内网 HTTP。 */
    }
    if (!copied && !isDisposed()) {
      const previous = document.activeElement,
        textarea = document.createElement('textarea');
      textarea.value = content;
      textarea.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(textarea);
      try {
        textarea.select();
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      } finally {
        textarea.remove();
        if (previous instanceof HTMLElement) previous.focus({ preventScroll: true });
      }
    }
    // 成功时由按钮图标就地变为对勾来反馈，不再弹顶部提示；失败才提示。
    if (!isDisposed() && !copied) ElMessage.warning(t('AIAGENT.COPY.FAILED'));
    return copied;
  }
  function copyCode(event: MouseEvent) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('button[data-copy-code]');
    const code = button?.closest('.code-block')?.querySelector('pre code');
    // 复制成功后按钮图标短暂变为对勾，给出就地反馈。
    if (code)
      void copyText(code.textContent ?? '').then((copied) => {
        if (!copied || !button || isDisposed()) return;
        button.classList.add('copied');
        const timer = setTimeout(() => {
          button.classList.remove('copied');
          codeTimers.delete(timer);
        }, 1800);
        codeTimers.add(timer);
      });
  }

  onUnmounted(() => {
    clearTimeout(copiedTimer);
    codeTimers.forEach(clearTimeout);
  });
  return { copiedMessageId, feedback, setFeedback, copyQuestion, copyAnswer, copyCode };
}
