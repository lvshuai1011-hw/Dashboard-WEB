<template>
  <aside class="sidebar">
    <div class="brand">
      <h1>SeekSettlement</h1>
      <AppTooltip :content="uiCopy.collapse" placement="bottom">
        <button
          class="icon-button"
          type="button"
          :aria-label="uiCopy.collapse"
          :aria-expanded="true"
          @click="emit('toggleSidebar')"
        >
          <el-icon><PanelIcon /></el-icon>
        </button>
      </AppTooltip>
    </div>
    <!-- 侧栏导航为无边框列表行；点击“搜索会话”后整块切换为搜索视图，返回或 Esc 退出。 -->
    <nav v-if="!searchMode" class="side-nav">
      <button
        class="side-row new-chat"
        :class="{ current: !messages.length }"
        type="button"
        @click="emit('newConversation')"
      >
        <el-icon><NewChatIcon /></el-icon>
        <span>{{ t('AIAGENT.HISTORY.NEW') }}</span>
      </button>
      <button class="side-row" type="button" @click="emit('focusHistorySearch')">
        <el-icon><Search /></el-icon>
        <span>{{ uiCopy.searchHistory }}</span>
        <kbd>Ctrl K</kbd>
      </button>
    </nav>
    <div v-else class="history-search">
      <AppTooltip :content="uiCopy.back">
        <button
          class="search-back"
          type="button"
          :aria-label="uiCopy.back"
          @click="emit('closeSearch')"
        >
          <el-icon><BackIcon /></el-icon>
        </button>
      </AppTooltip>
      <input
        :ref="bindSearchInput"
        :value="historyQuery"
        @input="emit('updateHistoryQuery', ($event.target as HTMLInputElement).value)"
        type="text"
        :placeholder="uiCopy.searchHistory"
        :aria-label="`${t('AIAGENT.HISTORY.TITLE')} · ${t('CM.COMMON.SEARCH')}`"
        @keydown.esc.stop.prevent="emit('closeSearch')"
      />
      <button
        v-if="historyQuery"
        class="search-clear"
        type="button"
        :aria-label="t('CM.COMMON.CLOSE')"
        @click="
          emit('updateHistoryQuery', '');
          searchInput?.focus();
        "
      >
        <el-icon><Close /></el-icon>
      </button>
    </div>
    <el-scrollbar class="history-scroll">
      <p v-if="!filteredHistory.length" class="history-empty">
        {{ t(historyQuery.trim() ? 'CM.UX.HOME.SEARCH.RESULT.EMPTY' : 'AIAGENT.HISTORY.EMPTY') }}
      </p>
      <section v-for="group in historyGroups" :key="group.key" class="history-group">
        <h2>{{ group.label }}</h2>
        <div
          v-for="chat in group.items"
          :key="chat.id"
          class="history-item"
          :class="{
            selected: chat.id === activeId,
            renaming: renaming.id === chat.id && renaming.where === 'side',
          }"
        >
          <input
            v-if="renaming.id === chat.id && renaming.where === 'side'"
            :value="renaming.value"
            @input="emit('updateRename', ($event.target as HTMLInputElement).value)"
            class="rename-input"
            maxlength="80"
            :aria-label="t('AIAGENT.HISTORY.NAME_LABEL')"
            @keydown.enter.prevent="emit('commitRename')"
            @keydown.esc.stop.prevent="emit('cancelRename')"
            @blur="emit('commitRename')"
          />
          <AppTooltip :content="chat.title || t('AIAGENT.HISTORY.UNTITLED')" v-else>
            <button
              class="history-select"
              type="button"
              :aria-current="chat.id === activeId ? 'page' : undefined"
              @click="emit('openHistoryResult', chat)"
              @dblclick="emit('renameConversation', chat, 'side')"
            >
              <span class="history-title">{{ chat.title || t('AIAGENT.HISTORY.UNTITLED') }}</span>
              <span v-if="historyQuery.trim()" class="history-match">
                {{ historyMatch(chat) }}
              </span>
              <AppTooltip
                :content="t(chatStateKeys[chatState(chat)])"
                v-if="['running', 'failed', 'stopped'].includes(chatState(chat))"
              >
                <i class="history-dot" :class="chatState(chat)" aria-hidden="true" />
              </AppTooltip>
            </button>
          </AppTooltip>
          <el-dropdown
            effect="light"
            v-if="!(renaming.id === chat.id && renaming.where === 'side')"
            trigger="click"
            placement="bottom-end"
            popper-class="agent-menu"
            @command="(command: string) => emit('onChatCommand', chat, command, 'side')"
          >
            <button class="history-more" type="button" :aria-label="uiCopy.more">
              <el-icon><MoreIcon /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="favorite" :icon="chat.favorite ? StarFilled : Star">
                  {{ t(chat.favorite ? 'AIAGENT.HISTORY.UNFAVORITE' : 'AIAGENT.HISTORY.FAVORITE') }}
                </el-dropdown-item>
                <el-dropdown-item command="rename" :icon="EditPen">
                  {{ t('AIAGENT.HISTORY.RENAME') }}
                </el-dropdown-item>
                <el-dropdown-item
                  command="pdf"
                  :icon="Download"
                  :disabled="exportBusy || !chat.messages.length"
                >
                  {{ uiCopy.exportPdf }}
                </el-dropdown-item>
                <el-dropdown-item
                  command="docx"
                  :icon="Download"
                  :disabled="exportBusy || !chat.messages.length"
                >
                  {{ uiCopy.exportWord }}
                </el-dropdown-item>
                <el-dropdown-item command="delete" :icon="Delete" divided class="danger">
                  {{ t('AIAGENT.HISTORY.DELETE') }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </section>
    </el-scrollbar>
    <p v-if="storageWarning" class="history-note" role="alert">
      {{ t(storageWarning) }}
    </p>
  </aside>
</template>

<script setup lang="ts">
import AppTooltip from './AppTooltip.vue';
import {
  Download,
  Close,
  Delete,
  EditPen,
  Search,
  Star,
  StarFilled,
} from '@element-plus/icons-vue';
import { PanelIcon, MoreIcon, BackIcon, NewChatIcon } from '../lib/icons';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import type { ChatMessage, Conversation, ChatState } from '../types';
import type { useUiCopy } from '../composables/useUiCopy';
defineProps<{
  exportBusy: boolean;
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
  uiCopy: ReturnType<typeof useUiCopy>['value'];
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
  renameConversation: [chat: Conversation, where: 'side' | 'header'];
  onChatCommand: [chat: Conversation, command: string, where: 'side' | 'header'];
  registerHistorySearch: [value: unknown];
  updateHistoryQuery: [value: string];
  updateRename: [value: string];
}>();

const registerHistorySearch = (...args: [value: unknown]) => emit('registerHistorySearch', ...args);

let searchInput: HTMLInputElement | undefined;
function bindSearchInput(value: unknown) {
  searchInput = value instanceof HTMLInputElement ? value : undefined;
  registerHistorySearch(value);
}
</script>
