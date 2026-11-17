<template>
  <header class="chat-header">
    <input
      v-if="renaming.id === current.id && renaming.where === 'header'"
      :value="renaming.value"
      @input="emit('updateRename', ($event.target as HTMLInputElement).value)"
      class="rename-input header"
      maxlength="80"
      :aria-label="t('AIAGENT.HISTORY.NAME_LABEL')"
      @keydown.enter.prevent="emit('commitRename')"
      @keydown.esc.stop.prevent="emit('cancelRename')"
      @blur="emit('commitRename')"
    />
    <el-dropdown
      effect="light"
      v-else
      trigger="click"
      placement="bottom-start"
      popper-class="agent-menu"
      @command="(command: string) => emit('onChatCommand', current, command, 'header')"
    >
      <button class="chat-title" type="button">
        <el-icon v-if="current.favorite" class="title-star">
          <StarFilled />
        </el-icon>
        <span>{{ current.title || t('AIAGENT.HISTORY.UNTITLED') }}</span>
        <el-icon class="title-chevron"><ChevronIcon /></el-icon>
      </button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="favorite" :icon="current.favorite ? StarFilled : Star">
            {{ t(current.favorite ? 'AIAGENT.HISTORY.UNFAVORITE' : 'AIAGENT.HISTORY.FAVORITE') }}
          </el-dropdown-item>
          <el-dropdown-item command="rename" :icon="EditPen">
            {{ t('AIAGENT.HISTORY.RENAME') }}
          </el-dropdown-item>
          <el-dropdown-item command="delete" :icon="Delete" divided class="danger">
            {{ t('AIAGENT.HISTORY.DELETE') }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </header>
</template>

<script setup lang="ts">
import { Delete, EditPen, Star, StarFilled } from '@element-plus/icons-vue';
import { ChevronIcon } from '../lib/icons';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import type { Conversation } from '../types';
defineProps<{
  current: Conversation;
  renaming: { id: string; where: string; value: string };
}>();
const emit = defineEmits<{
  commitRename: [];
  cancelRename: [];
  onChatCommand: [chat: Conversation, command: string, where: 'side' | 'header'];
  updateRename: [value: string];
}>();
</script>
