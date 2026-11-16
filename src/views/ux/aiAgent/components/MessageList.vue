<template>
<div class="chat-scroll-area">
          <el-scrollbar :ref="value => registerScrollbar(value)" class="message-scroll" @scroll="onMessageScroll">
            <div class="message-list" role="log" aria-live="off" :aria-label="t('AIAGENT.A11Y.MESSAGES')">
<MessageItem
  v-for="message in messages" :key="message.id"
  :locatedMessageId="locatedMessageId"
  :copiedMessageId="copiedMessageId"
  :streaming="streaming"
  :attachmentReading="attachmentReading"
  :reducedMotion="reducedMotion"
  :now="now"
  :message="message"
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
  @copyQuestion="copyQuestion"
  @copyAnswer="copyAnswer"
  @editQuestion="editQuestion"
  @regenerate="regenerate"
  @setFeedback="setFeedback"
  @askFollowUp="askFollowUp"
  @copyCode="copyCode"
  @previewAttachment="previewAttachment"
  @setChartMode="setChartMode"
  @downloadCurrent="downloadCurrent"
  @registerChart="registerChart"
/>
            </div>
          </el-scrollbar>

          <!-- 右侧提问导航：悬停展开列表，点击定位 -->
          <nav v-if="questionEntries.length > 1" class="question-nav" :aria-label="uiCopy.questions">
            <div class="nav-rail" aria-hidden="true"><i v-for="entry in questionEntries" :key="entry.id" :class="{ active: entry.id === activeQuestionId }" /></div>
            <div class="nav-panel">
              <p>{{ uiCopy.questions }}</p>
              <button v-for="entry in questionEntries" :key="entry.id" type="button" :class="{ active: entry.id === activeQuestionId }" @click="jumpToMessage(entry.id)">
                <i aria-hidden="true" /><span>{{ entry.content }}</span><time>{{ formatTime(entry.createdAt) }}</time>
              </button>
            </div>
          </nav>
          <el-tooltip v-if="!following" :content="t('AIAGENT.BUTTON.BOTTOM')"><button class="to-bottom" type="button" :aria-label="t('AIAGENT.BUTTON.BOTTOM')" @click="jumpToBottom"><el-icon><ArrowDown /></el-icon></button></el-tooltip>
        </div>
</template>

<script setup lang="ts">
import { ArrowDown } from "@element-plus/icons-vue";
import MessageItem from "./MessageItem.vue";
import { useI18n } from "vue-i18n";
const { t } = useI18n();
import type { ChatMessage, ChartContent, ProcessItem, TextAttachment, MessageLayout } from "../types";
import type { Component } from "vue";
import type { useUiCopy } from "../composables/useUiCopy";
defineProps<{
  activeQuestionId: string;
  locatedMessageId: string;
  copiedMessageId: string;
  streaming: boolean;
  attachmentReading: boolean;
  reducedMotion: boolean;
  following: boolean;
  now: number;
  messages: ChatMessage[];
  questionEntries: ChatMessage[];
  feedback: ReadonlyMap<string, string>;
  uiCopy: ReturnType<typeof useUiCopy>["value"];
  formatTime: (time: number) => string;
  layout: (message: ChatMessage) => MessageLayout;
  isActive: (message: ChatMessage) => boolean;
  justFinished: (message: ChatMessage) => boolean;
  keyMarkPart: (message: ChatMessage) => number | undefined;
  bodyEntries: (message: ChatMessage) => string[];
  answerText: (message: ChatMessage) => string;
  canRegenerate: (message: ChatMessage) => boolean;
  showFollowUps: (message: ChatMessage) => boolean;
  traceOpen: (message: ChatMessage) => boolean;
  liveLabel: (message: ChatMessage) => string;
  liveStepName: (message: ChatMessage) => string;
  summaryLabel: (message: ChatMessage) => string;
  stepCounts: (message: ChatMessage) => { group: string; label: string; icon: Component; count: number }[];
  stepExpandable: (item: ProcessItem) => boolean;
  stepGroup: (item: ProcessItem) => string;
  stepOpen: (message: ChatMessage, item: ProcessItem) => boolean;
  stepIcon: (item: ProcessItem) => Component;
  stepName: (item: ProcessItem) => string;
  stepPreview: (message: ChatMessage, item: ProcessItem) => string;
  stepTime: (message: ChatMessage, item: ProcessItem) => string;
  toolFacts: (item: ProcessItem) => { label: string; value: string }[];
  prettyJson: (value: string) => string;
  chartMode: (message: ChatMessage, item: ProcessItem) => string;
  chartTable: (chart?: ChartContent) => { headers: string[]; rows: (string | number)[][] } | undefined;
  numericColumn: (table: { rows: (string | number)[][] }, index: number) => boolean;
  formatCell: (value: unknown) => string;
}>();
const emit = defineEmits<{
  scheduleScroll: [];
  onMessageScroll: [];
  jumpToBottom: [];
  copyQuestion: [message: ChatMessage];
  copyAnswer: [message: ChatMessage];
  editQuestion: [message: ChatMessage];
  regenerate: [message: ChatMessage];
  setFeedback: [message: ChatMessage, value: "up" | "down"];
  askFollowUp: [question: string];
  jumpToMessage: [id: string];
  copyCode: [event: MouseEvent];
  previewAttachment: [file: TextAttachment | null];
  setChartMode: [message: ChatMessage, item: ProcessItem, mode: "chart" | "data"];
  downloadCurrent: [message: ChatMessage, item: ProcessItem];
  registerChart: [message: ChatMessage, item: ProcessItem, chart: unknown];
  registerScrollbar: [value: unknown];
}>();
const scheduleScroll = (...args: []) => emit("scheduleScroll", ...args);
const onMessageScroll = (...args: []) => emit("onMessageScroll", ...args);
const jumpToBottom = (...args: []) => emit("jumpToBottom", ...args);
const copyQuestion = (...args: [message: ChatMessage]) => emit("copyQuestion", ...args);
const copyAnswer = (...args: [message: ChatMessage]) => emit("copyAnswer", ...args);
const editQuestion = (...args: [message: ChatMessage]) => emit("editQuestion", ...args);
const regenerate = (...args: [message: ChatMessage]) => emit("regenerate", ...args);
const setFeedback = (...args: [message: ChatMessage, value: "up" | "down"]) => emit("setFeedback", ...args);
const askFollowUp = (...args: [question: string]) => emit("askFollowUp", ...args);
const jumpToMessage = (...args: [id: string]) => emit("jumpToMessage", ...args);
const copyCode = (...args: [event: MouseEvent]) => emit("copyCode", ...args);
const previewAttachment = (...args: [file: TextAttachment | null]) => emit("previewAttachment", ...args);
const setChartMode = (...args: [message: ChatMessage, item: ProcessItem, mode: "chart" | "data"]) => emit("setChartMode", ...args);
const downloadCurrent = (...args: [message: ChatMessage, item: ProcessItem]) => emit("downloadCurrent", ...args);
const registerChart = (...args: [message: ChatMessage, item: ProcessItem, chart: unknown]) => emit("registerChart", ...args);
const registerScrollbar = (...args: [value: unknown]) => emit("registerScrollbar", ...args);
</script>
