<template>
<aside class="sidebar">
  <div class="brand">
    <h1>SeekSettlement</h1>
    <el-tooltip :content="uiCopy.collapse" placement="bottom"><button class="icon-button" type="button" :aria-label="uiCopy.collapse" :aria-expanded="true" @click="toggleSidebar"><el-icon><PanelIcon /></el-icon></button></el-tooltip>
  </div>
  <!-- 侧栏导航为无边框列表行；点击“搜索会话”后整块切换为搜索视图，返回或 Esc 退出。 -->
  <nav v-if="!searchMode" class="side-nav">
    <button class="side-row new-chat" :class="{ current: !messages.length }" type="button" @click="newConversation"><el-icon><NewChatIcon /></el-icon><span>{{ t('AIAGENT.HISTORY.NEW') }}</span></button>
    <button class="side-row" type="button" @click="focusHistorySearch"><el-icon><Search /></el-icon><span>{{ uiCopy.searchHistory }}</span><kbd>Ctrl K</kbd></button>
  </nav>
  <div v-else class="history-search">
    <button class="search-back" type="button" :aria-label="uiCopy.back" :title="uiCopy.back" @click="closeSearch"><el-icon><BackIcon /></el-icon></button>
    <input :ref="bindSearchInput" :value="historyQuery" @input="updateHistoryQuery(($event.target as HTMLInputElement).value)" type="text" :placeholder="uiCopy.searchHistory" :aria-label="`${t('AIAGENT.HISTORY.TITLE')} · ${t('CM.COMMON.SEARCH')}`" @keydown.esc.stop.prevent="closeSearch" />
    <button v-if="historyQuery" class="search-clear" type="button" :aria-label="t('CM.COMMON.CLOSE')" @click="updateHistoryQuery(''); searchInput?.focus()"><el-icon><Close /></el-icon></button>
  </div>
  <el-scrollbar class="history-scroll">
    <p v-if="!filteredHistory.length" class="history-empty">{{ t(historyQuery.trim() ? 'CM.UX.HOME.SEARCH.RESULT.EMPTY' : 'AIAGENT.HISTORY.EMPTY') }}</p>
    <section v-for="group in historyGroups" :key="group.key" class="history-group">
      <h2>{{ group.label }}</h2>
      <div v-for="chat in group.items" :key="chat.id" class="history-item" :class="{ selected: chat.id === activeId, renaming: renaming.id === chat.id && renaming.where === 'side' }">
        <input v-if="renaming.id === chat.id && renaming.where === 'side'" :value="renaming.value" @input="updateRename(($event.target as HTMLInputElement).value)" class="rename-input" maxlength="80" :aria-label="t('AIAGENT.HISTORY.NAME_LABEL')" @keydown.enter.prevent="commitRename" @keydown.esc.stop.prevent="cancelRename" @blur="commitRename" />
        <button v-else class="history-select" type="button" :aria-current="chat.id === activeId ? 'page' : undefined" :title="chat.title || t('AIAGENT.HISTORY.UNTITLED')" @click="openHistoryResult(chat)" @dblclick="renameConversation(chat, 'side')">
          <span class="history-title">{{ chat.title || t('AIAGENT.HISTORY.UNTITLED') }}</span>
          <span v-if="historyQuery.trim()" class="history-match">{{ historyMatch(chat) }}</span>
          <i v-if="['running', 'failed', 'stopped'].includes(chatState(chat))" class="history-dot" :class="chatState(chat)" :title="t(chatStateKeys[chatState(chat)])" aria-hidden="true" />
        </button>
        <el-dropdown v-if="!(renaming.id === chat.id && renaming.where === 'side')" trigger="click" placement="bottom-end" popper-class="agent-menu" @command="(command: string) => onChatCommand(chat, command, 'side')">
          <button class="history-more" type="button" :aria-label="uiCopy.more"><el-icon><MoreIcon /></el-icon></button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="favorite" :icon="chat.favorite ? StarFilled : Star">{{ t(chat.favorite ? 'AIAGENT.HISTORY.UNFAVORITE' : 'AIAGENT.HISTORY.FAVORITE') }}</el-dropdown-item>
              <el-dropdown-item command="rename" :icon="EditPen">{{ t('AIAGENT.HISTORY.RENAME') }}</el-dropdown-item>
              <el-dropdown-item command="delete" :icon="Delete" divided class="danger">{{ t('AIAGENT.HISTORY.DELETE') }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </section>
  </el-scrollbar>
  <p v-if="storageWarning" class="history-note" role="alert">{{ t(storageWarning) }}</p>
</aside>
</template>

<script setup lang="ts">
import { Close, Delete, EditPen, Search, Star, StarFilled } from "@element-plus/icons-vue";
import { PanelIcon, MoreIcon, BackIcon, NewChatIcon } from "../lib/icons";
import { useI18n } from "vue-i18n";
const { t } = useI18n();
import type { ChatMessage, Conversation, ChatState } from "../types";
import type { useUiCopy } from "../composables/useUiCopy";
defineProps<{
  activeId: string;
  searchMode: boolean;
  storageWarning: string;
  historyQuery: string;
  messages: ChatMessage[];
  filteredHistory: Conversation[];
  current: Conversation;
  historyGroups: { key: string; label: string; items: Conversation[] }[];
  renaming: { id: string; where: string; value: string };
  chatStateKeys: Record<ChatState, string>;
  uiCopy: ReturnType<typeof useUiCopy>["value"];
  chatState: (chat: Conversation) => ChatState;
  historyMatch: (chat: Conversation) => string;
}>();
const emit = defineEmits<{
  toggleSidebar: [];
  newConversation: [];
  focusHistorySearch: [];
  closeSearch: [];
  commitRename: [];
  cancelRename: [];
  openHistoryResult: [chat: Conversation];
  renameConversation: [chat: Conversation, where: "side" | "header"];
  onChatCommand: [chat: Conversation, command: string, where: "side" | "header"];
  registerHistorySearch: [value: unknown];
  updateHistoryQuery: [value: string];
  updateRename: [value: string];
}>();
const toggleSidebar = (...args: []) => emit("toggleSidebar", ...args);
const newConversation = (...args: []) => emit("newConversation", ...args);
const focusHistorySearch = (...args: []) => emit("focusHistorySearch", ...args);
const closeSearch = (...args: []) => emit("closeSearch", ...args);
const commitRename = (...args: []) => emit("commitRename", ...args);
const cancelRename = (...args: []) => emit("cancelRename", ...args);
const openHistoryResult = (...args: [chat: Conversation]) => emit("openHistoryResult", ...args);
const renameConversation = (...args: [chat: Conversation, where: "side" | "header"]) => emit("renameConversation", ...args);
const onChatCommand = (...args: [chat: Conversation, command: string, where: "side" | "header"]) => emit("onChatCommand", ...args);
const registerHistorySearch = (...args: [value: unknown]) => emit("registerHistorySearch", ...args);
const updateHistoryQuery = (...args: [value: string]) => emit("updateHistoryQuery", ...args);
const updateRename = (...args: [value: string]) => emit("updateRename", ...args);
let searchInput: HTMLInputElement | undefined;
function bindSearchInput(value: unknown) {
  searchInput = value instanceof HTMLInputElement ? value : undefined;
  registerHistorySearch(value);
}
</script>
