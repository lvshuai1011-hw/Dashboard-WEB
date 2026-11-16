<template>
  <article
    :id="`chat-message-${message.id}`"
    class="message"
    :class="[message.role, { located: locatedMessageId === message.id }]"
    tabindex="-1"
  >
    <!-- 用户提问 -->
    <template v-if="message.role === 'user'">
      <div
        class="question"
        :title="formatTime(message.createdAt)"
      >
        <p class="question-text">{{ message.content }}</p>
        <div
          v-if="message.attachments?.length"
          class="sent-attachments"
        >
          <button
            v-for="file in message.attachments"
            :key="file.id"
            type="button"
            class="file-chip"
            :title="file.name"
            @click="previewAttachment(file)"
          >
            <el-icon><Document /></el-icon><span>{{ file.name }}</span>
          </button>
        </div>
      </div>
      <div class="question-actions">
        <el-tooltip
          :content="copiedMessageId === message.id ? t('AIAGENT.COPY.SUCCESS') : uiCopy.copy"
          ><button
            type="button"
            class="icon-button small"
            :aria-label="uiCopy.copy"
            @click="copyQuestion(message)"
          >
            <el-icon
              ><component :is="copiedMessageId === message.id ? Check : CopyDocument"
            /></el-icon></button
        ></el-tooltip>
        <el-tooltip :content="t('AIAGENT.BUTTON.EDIT_QUESTION')"
          ><button
            type="button"
            class="icon-button small"
            :disabled="streaming || attachmentReading"
            :aria-label="t('AIAGENT.BUTTON.EDIT_QUESTION')"
            @click="editQuestion(message)"
          >
            <el-icon><EditPen /></el-icon></button
        ></el-tooltip>
      </div>
    </template>

    <!-- 助手回答 -->
    <template v-else>
      <ProcessTimeline
        :reducedMotion="reducedMotion"
        :now="now"
        :message="message"
        :layout="layout"
        :isActive="isActive"
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
        @scheduleScroll="scheduleScroll"
        @copyCode="copyCode"
      />

      <div
        v-for="item in layout(message).body"
        :key="`body-${item.id}`"
        class="answer-part"
      >
        <Typewriter
          v-if="item.kind === 'text'"
          :content="item.text"
          :active="isActive(message)"
          :highlight="item.id === keyMarkPart(message)"
          :sweep="justFinished(message)"
          @progress="scheduleScroll"
          :reduced-motion="reducedMotion"
          @copy-code="copyCode"
        />
        <ChartCard
          v-else-if="item.kind === 'chart'"
          :reducedMotion="reducedMotion"
          :message="message"
          :item="item"
          :uiCopy="uiCopy"
          :chartMode="chartMode"
          :chartTable="chartTable"
          :numericColumn="numericColumn"
          :formatCell="formatCell"
          @setChartMode="setChartMode"
          @downloadCurrent="downloadCurrent"
          @registerChart="registerChart"
        />
      </div>
      <p
        v-if="message.status === 'completed' && !bodyEntries(message).length"
        class="note"
      >
        {{ t('AIAGENT.STATUS.NO_ANSWER') }}
      </p>
      <p
        v-if="message.status === 'stopped'"
        class="note"
      >
        {{ t('AIAGENT.STATUS.STOPPED_NOTE') }}
      </p>
      <div
        v-if="message.errorKey"
        class="error-card"
        role="alert"
      >
        <el-icon><Warning /></el-icon>
        <div>
          <strong>{{ t(message.errorKey) }}</strong>
          <p v-if="message.errorDetail">{{ message.errorDetail }}</p>
        </div>
      </div>
      <div
        v-if="!isActive(message)"
        class="answer-actions"
      >
        <el-tooltip
          :content="
            t(copiedMessageId === message.id ? 'AIAGENT.COPY.SUCCESS' : 'AIAGENT.BUTTON.COPY')
          "
          ><button
            type="button"
            class="icon-button small"
            :disabled="!answerText(message)"
            :aria-label="t('AIAGENT.BUTTON.COPY')"
            @click="copyAnswer(message)"
          >
            <el-icon
              ><component :is="copiedMessageId === message.id ? Check : CopyDocument"
            /></el-icon></button
        ></el-tooltip>
        <!-- 反馈仅保存在本机，不声称已提交服务端；复用 YES / NOT 键。 -->
        <el-tooltip :content="t('CM.COMMON.YES')"
          ><button
            type="button"
            class="icon-button small"
            :class="{ selected: feedback.get(message.id) === 'up' }"
            :aria-label="t('CM.COMMON.YES')"
            :aria-pressed="feedback.get(message.id) === 'up'"
            @click="setFeedback(message, 'up')"
          >
            <FeedbackIcon /></button
        ></el-tooltip>
        <el-tooltip :content="t('CM.COMMON.NOT')"
          ><button
            type="button"
            class="icon-button small"
            :class="{ selected: feedback.get(message.id) === 'down' }"
            :aria-label="t('CM.COMMON.NOT')"
            :aria-pressed="feedback.get(message.id) === 'down'"
            @click="setFeedback(message, 'down')"
          >
            <FeedbackIcon down /></button
        ></el-tooltip>
        <el-tooltip
          v-if="canRegenerate(message)"
          :content="t('AIAGENT.BUTTON.REGENERATE')"
          ><button
            type="button"
            class="icon-button small"
            :disabled="streaming"
            :aria-label="t('AIAGENT.BUTTON.REGENERATE')"
            @click="regenerate(message)"
          >
            <el-icon><RefreshRight /></el-icon></button
        ></el-tooltip>
      </div>
      <!-- 追问建议：仅在最新一条已完成的答复下展示，点击直接提问。 -->
      <div
        v-if="showFollowUps(message)"
        class="follow-ups"
        role="group"
        :aria-label="uiCopy.related"
      >
        <p
          class="follow-label"
          aria-hidden="true"
        >
          {{ uiCopy.related }}
        </p>
        <button
          v-for="(question, index) in message.followUps"
          :key="question"
          type="button"
          class="follow-up"
          :style="{ '--i': index }"
          @click="askFollowUp(question)"
        >
          <span>{{ question }}</span><ArrowRightIcon
            class="follow-icon"
            aria-hidden="true"
          />
        </button>
      </div>
    </template>
  </article>
</template>

<script setup lang="ts">
import {
  Check,
  CopyDocument,
  Document,
  EditPen,
  RefreshRight,
  Warning,
} from '@element-plus/icons-vue';
import { ArrowRightIcon, FeedbackIcon } from '../lib/icons';
import ProcessTimeline from './ProcessTimeline.vue';
import ChartCard from './ChartCard.vue';
import Typewriter from './Typewriter.vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import type { ChatMessage, ProcessItem, TextAttachment } from '../types';
import type { MessageItemProps } from '../componentTypes';
defineProps<MessageItemProps>();
const emit = defineEmits<{
  scheduleScroll: [];
  copyQuestion: [message: ChatMessage];
  copyAnswer: [message: ChatMessage];
  editQuestion: [message: ChatMessage];
  regenerate: [message: ChatMessage];
  setFeedback: [message: ChatMessage, value: 'up' | 'down'];
  askFollowUp: [question: string];
  copyCode: [event: MouseEvent];
  previewAttachment: [file: TextAttachment | null];
  setChartMode: [message: ChatMessage, item: ProcessItem, mode: 'chart' | 'data'];
  downloadCurrent: [message: ChatMessage, item: ProcessItem];
  registerChart: [message: ChatMessage, item: ProcessItem, chart: unknown];
}>();
const scheduleScroll = (...args: []) => emit('scheduleScroll', ...args);
const copyQuestion = (...args: [message: ChatMessage]) => emit('copyQuestion', ...args);
const copyAnswer = (...args: [message: ChatMessage]) => emit('copyAnswer', ...args);
const editQuestion = (...args: [message: ChatMessage]) => emit('editQuestion', ...args);
const regenerate = (...args: [message: ChatMessage]) => emit('regenerate', ...args);
const setFeedback = (...args: [message: ChatMessage, value: 'up' | 'down']) =>
  emit('setFeedback', ...args);
const askFollowUp = (...args: [question: string]) => emit('askFollowUp', ...args);
const copyCode = (...args: [event: MouseEvent]) => emit('copyCode', ...args);
const previewAttachment = (...args: [file: TextAttachment | null]) =>
  emit('previewAttachment', ...args);
const setChartMode = (...args: [message: ChatMessage, item: ProcessItem, mode: 'chart' | 'data']) =>
  emit('setChartMode', ...args);
const downloadCurrent = (...args: [message: ChatMessage, item: ProcessItem]) =>
  emit('downloadCurrent', ...args);
const registerChart = (...args: [message: ChatMessage, item: ProcessItem, chart: unknown]) =>
  emit('registerChart', ...args);
</script>
