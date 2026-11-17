<template>
  <div class="chat-scroll-area">
    <el-scrollbar
      :ref="(value) => emit('registerScrollbar', value)"
      class="message-scroll"
      @scroll="emit('onMessageScroll')"
    >
      <div class="message-list" role="log" aria-live="off" :aria-label="t('AIAGENT.A11Y.MESSAGES')">
        <MessageItem
          v-for="message in messages"
          :key="message.id"
          v-bind="messageProps"
          :message="message"
          @scheduleScroll="emit('scheduleScroll')"
          @copyQuestion="(message) => emit('copyQuestion', message)"
          @copyAnswer="(message) => emit('copyAnswer', message)"
          @editQuestion="(message) => emit('editQuestion', message)"
          @regenerate="(message) => emit('regenerate', message)"
          @setFeedback="(message, value) => emit('setFeedback', message, value)"
          @askFollowUp="(question) => emit('askFollowUp', question)"
          @copyCode="(event) => emit('copyCode', event)"
          @previewAttachment="(file) => emit('previewAttachment', file)"
        />
      </div>
    </el-scrollbar>

    <!-- 右侧提问导航：悬停展开列表，点击定位 -->
    <nav
      v-if="questionEntries.length > 1"
      class="question-nav"
      tabindex="0"
      :aria-label="uiCopy.questions"
    >
      <div class="nav-rail" aria-hidden="true">
        <i
          v-for="entry in questionEntries"
          :key="entry.id"
          :class="{ active: entry.id === activeQuestionId }"
        />
      </div>
      <div class="nav-panel">
        <p>{{ uiCopy.questions }}</p>
        <button
          v-for="entry in questionEntries"
          :key="entry.id"
          type="button"
          :class="{ active: entry.id === activeQuestionId }"
          @click="emit('jumpToMessage', entry.id)"
        >
          <i aria-hidden="true" />
          <span>{{ entry.content }}</span>
          <time>{{ formatTime(entry.createdAt) }}</time>
        </button>
      </div>
    </nav>
    <AppTooltip v-if="!following" :content="t('AIAGENT.BUTTON.BOTTOM')">
      <button
        class="to-bottom"
        type="button"
        :aria-label="t('AIAGENT.BUTTON.BOTTOM')"
        @click="emit('jumpToBottom')"
      >
        <el-icon><ArrowDown /></el-icon>
      </button>
    </AppTooltip>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppTooltip from './AppTooltip.vue';
import { ArrowDown } from '@element-plus/icons-vue';
import MessageItem from './MessageItem.vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import type { ChatMessage, TextAttachment } from '../types';
import type { MessageItemProps } from '../componentTypes';
interface MessageListProps extends Omit<MessageItemProps, 'message'> {
  activeQuestionId: string;
  following: boolean;
  messages: ChatMessage[];
  questionEntries: ChatMessage[];
}
const props = defineProps<MessageListProps>();
// Keep list-only fields out of the message DOM; forward the shared typed contract together.
const messageProps = computed(() => {
  const { activeQuestionId, following, messages, questionEntries, ...shared } = props;
  return shared;
});
const emit = defineEmits<{
  scheduleScroll: [];
  onMessageScroll: [];
  jumpToBottom: [];
  copyQuestion: [message: ChatMessage];
  copyAnswer: [message: ChatMessage];
  editQuestion: [message: ChatMessage];
  regenerate: [message: ChatMessage];
  setFeedback: [message: ChatMessage, value: 'up' | 'down'];
  askFollowUp: [question: string];
  jumpToMessage: [id: string];
  copyCode: [event: MouseEvent];
  previewAttachment: [file: TextAttachment | null];
  registerScrollbar: [value: unknown];
}>();
</script>
