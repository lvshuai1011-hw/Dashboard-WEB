import { messageSearchValues, matchesQuery } from '../lib/messagePresentation';
import { computed, nextTick, reactive, ref } from 'vue';
import type { Ref } from 'vue';
import type { InputInstance } from 'element-plus';
import type { ChatMessage, Conversation, ChatState } from '../types';
import { ElMessage } from 'element-plus';
import type { ComposerTranslation } from '../types';
import { STORAGE_KEY } from '../types';
import { decodeHistory } from '../lib/history';
import { uid } from '../lib/identity';
import { useRunningRequests } from './useRunningRequests';
import { useScrollFollow } from './useScrollFollow';

// 模块级会话状态由问结算单页共享。每次挂载仍从本地历史进入新会话。
const conversations = ref<Conversation[]>([]);
const activeId = ref('');

export function useConversations(options: {
  t: ComposerTranslation;
  inputRef: Ref<InputInstance | undefined>;
  processRoot: Ref<HTMLElement | undefined>;
  isDisposed: () => boolean;
  finishRequest: (id: string, message: ChatMessage, status: 'stopped') => void;
}) {
  const { t, inputRef, processRoot } = options;
  function makeConversation(): Conversation {
    return {
      id: uid(),
      title: '',
      conversationId: null,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      draft: '',
      attachments: [],
      favorite: false,
    };
  }
  const storageWarning = ref('');
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const sidebarOpen = ref(true);
  const running = useRunningRequests();
  function readHistory(): Conversation[] {
    try {
      const data: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(data)) throw new Error('INVALID_HISTORY');
      return decodeHistory(data, () => {
        storageWarning.value = 'AIAGENT.HISTORY.LOAD_FAILED';
      });
    } catch {
      storageWarning.value = 'AIAGENT.HISTORY.LOAD_FAILED';
      return [];
    }
  }
  // 每次打开 iframe 都进入新会话；保留有内容的历史及草稿供用户主动选择。
  conversations.value = readHistory().filter(
    (c) => c.messages.length || c.title || c.draft || c.attachments?.length,
  );
  const initialConversation = makeConversation();
  conversations.value.unshift(initialConversation);
  activeId.value = initialConversation.id;
  const current = computed(() => conversations.value.find((c) => c.id === activeId.value)!);
  const messages = computed(() => current.value.messages);
  // ---- 历史会话状态 ----
  // 会话级状态只取「最后一条助手消息」：它代表这次会话最近的结果。
  // running 是实时的（有请求在跑），其余来自消息本身的状态。
  const scroll = useScrollFollow({
    activeId,
    messages,
    processRoot,
    isDisposed: options.isDisposed,
  });
  const {
    rememberReadingPosition,
    locatedMessageId,
    readingPositions,
    following,
    scheduleScroll,
    scrollRef,
  } = scroll;
  function chatState(chat: Conversation): ChatState {
    if (chat.messages.some((m) => running.has(m.id))) return 'running';
    const last = [...chat.messages].reverse().find((m) => m.role === 'assistant');
    if (!last) return 'empty';
    if (last.status === 'error') return 'failed';
    // 用户主动停止也算未完成，单独区分出来，避免和真正失败混在一起。
    if (last.status === 'stopped') return 'stopped';
    if (last.status === 'completed') return 'completed';
    return 'empty';
  }
  const chatStateKeys: Record<ChatState, string> = {
    running: 'AIAGENT.HISTORY.STATE.RUNNING',
    completed: 'AIAGENT.HISTORY.STATE.COMPLETED',
    failed: 'AIAGENT.HISTORY.STATE.FAILED',
    stopped: 'AIAGENT.HISTORY.STATE.STOPPED',
    empty: '',
  };
  const history = computed(() =>
    conversations.value
      .filter((c) => c.messages.length || c.title || c.draft || c.attachments?.length)
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt),
  );
  // 收藏项单独置顶成一块，且不再在下面的历史列表里重复出现。
  const historyQuery = ref('');
  function historyValues(chat: Conversation) {
    return [
      chat.title,
      ...(chat.attachments ?? []).map((file) => file.name),
      ...chat.messages.flatMap(messageSearchValues),
    ];
  }
  // 搜索时用命中片段替代日期行，保持两行密度；只输出文本，不注入 HTML。
  function historyMatch(chat: Conversation) {
    const query = historyQuery.value.trim().normalize('NFKC').toLocaleLowerCase();
    const values = historyValues(chat);
    const text = (values.find((value) => matchesQuery(value, query)) || '')
      .normalize('NFKC')
      .replace(/\s+/g, ' ');
    const index = text.toLocaleLowerCase().indexOf(query),
      start = Math.max(0, index - 12);
    return `${start ? '…' : ''}${text.slice(start, start + Math.max(64, query.length + 24))}`;
  }
  const filteredHistory = computed(() => {
    const query = historyQuery.value.trim().normalize('NFKC').toLocaleLowerCase();
    return query
      ? history.value.filter((chat) =>
          historyValues(chat).some((value) => matchesQuery(value, query)),
        )
      : history.value;
  });
  const pinned = computed(() => filteredHistory.value.filter((c) => c.favorite));
  const unpinned = computed(() => filteredHistory.value.filter((c) => !c.favorite));
  const draft = computed({
    get: () => current.value.draft,
    set: (value) => {
      current.value.draft = value;
      scheduleSave();
    },
  });
  // 「本会话是否有回答在生成」——并发后按当前会话判定，不再用全局单值。

  // 会话定位和快捷键仅改变本地展示。
  const historySearchRef = ref<HTMLInputElement>();
  const searchMode = ref(false);
  function closeSearch() {
    searchMode.value = false;
    historyQuery.value = '';
  }
  function persistHistory() {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.value));
      localStorage.setItem(`${STORAGE_KEY}:active`, activeId.value);
      storageWarning.value = '';
    } catch {
      storageWarning.value = 'AIAGENT.HISTORY.SAVE_FAILED';
    }
  }
  function scheduleSave() {
    if (!saveTimer && !options.isDisposed()) saveTimer = setTimeout(persistHistory, 600);
  }
  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value;
  }
  function newConversation() {
    rememberReadingPosition();
    historyQuery.value = '';
    searchMode.value = false;
    // 不再打断正在跑的回答：并发下其它会话的请求独立存活，切回来还能继续看。
    conversations.value = conversations.value.filter(
      (c) => c.messages.length || c.title || c.draft || c.attachments?.length,
    );
    const chat = makeConversation();
    conversations.value.unshift(chat);
    activeId.value = chat.id;
    following.value = true;
    persistHistory();
    void nextTick(() => inputRef.value?.focus());
  }
  function switchConversation(id: string) {
    if (id !== activeId.value && conversations.value.some((c) => c.id === id)) {
      rememberReadingPosition();
      locatedMessageId.value = '';
      activeId.value = id;
      const position = readingPositions.get(id);
      following.value = position?.following ?? true;
      persistHistory();
      void nextTick(() => {
        if (activeId.value !== id) return;
        if (following.value) scheduleScroll();
        else scrollRef.value?.setScrollTop(position?.top || 0);
      });
    }
  }
  function toggleFavorite(chat: Conversation) {
    chat.favorite = !chat.favorite;
    persistHistory();
  }
  // 重命名：在侧栏条目或顶栏标题处原地编辑；Enter / 失焦保存，Esc 取消。
  const renaming = reactive({ id: '', where: '' as '' | 'side' | 'header', value: '' });
  function renameConversation(chat: Conversation, where: 'side' | 'header' = 'side') {
    renaming.id = chat.id;
    renaming.where = where;
    renaming.value = chat.title || '';
    void nextTick(() => {
      const input = processRoot.value?.querySelector<HTMLInputElement>('input.rename-input');
      input?.focus();
      input?.select();
    });
  }
  function cancelRename() {
    renaming.id = '';
    renaming.where = '';
  }
  function commitRename() {
    const chat = conversations.value.find((c) => c.id === renaming.id);
    const value = renaming.value.trim();
    if (chat && value && value !== chat.title) {
      if (Array.from(value).length > 80) {
        ElMessage.warning(t('AIAGENT.HISTORY.NAME_REQUIRED'));
        return;
      }
      chat.title = value;
      persistHistory();
    }
    cancelRename();
  }
  // 删除：自定义确认框，确认后执行原有删除流程。
  const pendingDelete = ref<Conversation | null>(null);
  function deleteConversation(chat: Conversation) {
    pendingDelete.value = chat;
  }
  function confirmDelete() {
    const chat = pendingDelete.value;
    pendingDelete.value = null;
    if (!chat || options.isDisposed()) return;
    // 删除会话要把该会话下所有在跑的回答都停掉，否则请求会挂在已删除的消息上。
    chat.messages.forEach((m) => {
      options.finishRequest(m.id, m, 'stopped');
    });
    conversations.value = conversations.value.filter((c) => c.id !== chat.id);
    if (!conversations.value.length) conversations.value.push(makeConversation());
    if (chat.id === activeId.value) {
      activeId.value = conversations.value[0].id;
      following.value = true;
      scheduleScroll();
    }
    persistHistory();
  }
  function disposeHistory() {
    clearTimeout(saveTimer);
  }

  return {
    conversations,
    current,
    messages,
    activeId,
    storageWarning,
    sidebarOpen,
    chatState,
    chatStateKeys,
    historyQuery,
    historyMatch,
    filteredHistory,
    pinned,
    unpinned,
    draft,
    historySearchRef,
    searchMode,
    closeSearch,
    persistHistory,
    scheduleSave,
    toggleSidebar,
    newConversation,
    switchConversation,
    toggleFavorite,
    renaming,
    renameConversation,
    cancelRename,
    commitRename,
    pendingDelete,
    deleteConversation,
    confirmDelete,
    disposeHistory,
    scroll,
  };
}
