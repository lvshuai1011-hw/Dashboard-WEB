import { computed, nextTick, ref } from "vue";
import type { Ref } from "vue";
import type { ScrollbarInstance } from "element-plus";
import type { ChatMessage } from "../types";

export function useScrollFollow(options: { activeId: Ref<string>; messages: Ref<ChatMessage[]>; processRoot: Ref<HTMLElement | undefined>; isDisposed: () => boolean }) {
  const { activeId, messages, processRoot } = options;
  const following = ref(true);
  const scrollRef = ref<ScrollbarInstance>();
  let scrollScheduled = false;
  const locatedMessageId = ref('');
  let locatedTimer: ReturnType<typeof setTimeout> | undefined;
  const questionEntries = computed(() => messages.value.filter(message => message.role === 'user'));
  const readingPositions = new Map<string, { top: number; following: boolean }>();
  function rememberReadingPosition() {
    const wrap = scrollRef.value?.wrapRef;
    if (wrap) readingPositions.set(activeId.value, { top: wrap.scrollTop, following: following.value });
  }
  async function jumpToMessage(id: string) {
    following.value = false;
    await nextTick();
    const el = document.getElementById(`chat-message-${id}`), wrap = scrollRef.value?.wrapRef;
    if (!el || !wrap || !processRoot.value?.contains(el)) return;
    scrollRef.value?.setScrollTop(wrap.scrollTop + el.getBoundingClientRect().top - wrap.getBoundingClientRect().top - 18);
    el.focus({ preventScroll: true }); locatedMessageId.value = id;
    clearTimeout(locatedTimer); locatedTimer = setTimeout(() => { locatedMessageId.value = ''; }, 2200);
  }
  const activeQuestionId = ref('');
  function updateActiveQuestion() {
    const wrap = scrollRef.value?.wrapRef;
    const entries = questionEntries.value;
    if (!wrap || !entries.length) { activeQuestionId.value = ''; return; }
    if (wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 8) { activeQuestionId.value = entries[entries.length - 1].id; return; }
    const top = wrap.getBoundingClientRect().top + 96;
    let id = entries[0].id;
    for (const entry of entries) {
      const el = document.getElementById(`chat-message-${entry.id}`);
      if (el && el.getBoundingClientRect().top <= top) id = entry.id;
    }
    activeQuestionId.value = id;
  }
  function onScroll() {
    const el = scrollRef.value?.wrapRef;
    if (el) following.value = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
  }
  function scheduleScroll() {
    if (!following.value || scrollScheduled || options.isDisposed()) return;
    scrollScheduled = true;
    void nextTick(() => {
      scrollScheduled = false;
      const el = scrollRef.value?.wrapRef;
      if (!options.isDisposed() && following.value && el) scrollRef.value?.setScrollTop(el.scrollHeight);
    });
  }
  function jumpToBottom() { following.value = true; scheduleScroll(); }
  function disposeScroll() { clearTimeout(locatedTimer); }
  function onMessageScroll() { onScroll(); updateActiveQuestion(); }

  return { following, scrollRef, locatedMessageId, questionEntries, activeQuestionId, readingPositions, rememberReadingPosition, jumpToMessage, updateActiveQuestion, scheduleScroll, jumpToBottom, onMessageScroll, disposeScroll };
}
