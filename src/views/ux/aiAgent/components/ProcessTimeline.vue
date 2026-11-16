<template>
  <div
    v-if="message.process.length || isActive(message)"
    class="process"
    :class="[message.status, { live: isActive(message), open: traceOpen(message) }]"
  >
    <button
      class="trace-toggle"
      type="button"
      :data-message-id="message.id"
      :aria-expanded="traceOpen(message)"
      :aria-controls="`trace-${message.id}`"
    >
      <!-- 生成中的折叠方块与结果图标共用一个槽位：结束时方块收拢，再弹出结果图标。 -->
      <span class="trace-icon">
        <Transition
          name="mark"
          mode="out-in"
        >
          <ActivityMark
            v-if="isActive(message)"
            key="live"
          />
          <el-icon
            v-else
            key="result"
            class="trace-result"
            ><component
              :is="
                message.status === 'error'
                  ? CircleClose
                  : message.status === 'stopped'
                    ? VideoPause
                    : CircleCheck
              "
          /></el-icon>
        </Transition>
      </span>
      <template v-if="isActive(message)">
        <span class="trace-label"
          >{{ liveLabel(message)
          }}<template v-if="liveStepName(message)"> · {{ liveStepName(message) }}</template></span
        >
        <span class="trace-elapsed">{{
          t('AIAGENT.STATUS.ELAPSED', {
            seconds: Math.floor(Math.max(0, now - message.createdAt) / 1000),
          })
        }}</span>
      </template>
      <template v-else>
        <span class="trace-label">{{ summaryLabel(message) }}</span>
        <span
          v-if="stepCounts(message).length"
          class="trace-counts"
        >
          <span
            v-for="entry in stepCounts(message)"
            :key="entry.group"
            :title="entry.label"
            ><el-icon><component :is="entry.icon" /></el-icon>{{ entry.count }}</span
          >
        </span>
      </template>
      <el-icon
        v-if="layout(message).timeline.length"
        class="trace-chevron"
        ><ChevronIcon
      /></el-icon>
    </button>
    <div
      v-if="traceOpen(message) && layout(message).timeline.length"
      :id="`trace-${message.id}`"
      class="steps"
    >
      <template
        v-for="item in layout(message).timeline"
        :key="item.id"
      >
        <component
          :is="stepExpandable(item) ? 'button' : 'div'"
          class="step-row"
          :class="[
            stepGroup(item),
            item.status,
            {
              expandable: stepExpandable(item),
              open: stepExpandable(item) && stepOpen(message, item),
            },
          ]"
          v-bind="
            stepExpandable(item)
              ? {
                  type: 'button',
                  'data-message-id': message.id,
                  'data-process-id': item.id,
                  'aria-expanded': stepOpen(message, item),
                }
              : {}
          "
        >
          <el-icon class="step-icon"
            ><component :is="item.status === 'error' ? CircleClose : stepIcon(item)"
          /></el-icon>
          <span class="step-name">{{ stepName(item) }}</span>
          <span class="step-preview">{{
            stepExpandable(item) && stepOpen(message, item) ? '' : stepPreview(message, item)
          }}</span>
          <span class="step-time">{{ stepTime(message, item) }}</span>
          <el-icon
            v-if="stepExpandable(item)"
            class="step-chevron"
            ><ChevronIcon
          /></el-icon>
        </component>
        <div
          v-if="stepExpandable(item) && stepOpen(message, item)"
          class="step-detail"
        >
          <Typewriter
            v-if="item.kind === 'text'"
            :content="item.text"
            :active="isActive(message) && item.status === 'running'"
            @progress="scheduleScroll"
            :reduced-motion="reducedMotion"
            @copy-code="copyCode"
          />
          <template v-else-if="item.kind === 'subagent'">
            <template v-if="item.thinking"
              ><h4>{{ t('AIAGENT.PROCESS.THINKING_TURN') }}</h4>
              <p class="plain">{{ item.thinking }}</p></template
            >
            <template v-if="item.answer"
              ><h4>{{ t('AIAGENT.PROCESS.SUBAGENT_ANSWER') }}</h4>
              <Typewriter
                :content="item.answer"
                :active="isActive(message) && item.status === 'running'"
                @progress="scheduleScroll"
                :reduced-motion="reducedMotion"
                @copy-code="copyCode"
            /></template>
            <p
              v-if="!item.thinking && !item.answer"
              class="plain"
            >
              {{ t('AIAGENT.STATUS.WAITING') }}
            </p>
          </template>
          <pre
            v-else-if="item.kind === 'json'"
            class="raw"
            >{{ item.input }}</pre>
          <template v-else>
            <dl
              v-if="toolFacts(item).length"
              class="facts"
            >
              <template
                v-for="fact in toolFacts(item)"
                :key="fact.label"
                ><dt>{{ fact.label }}</dt>
                <dd>{{ fact.value }}</dd></template
              >
            </dl>
            <p
              v-else
              class="plain"
            >
              {{ t('AIAGENT.PROCESS.NO_DETAILS') }}
            </p>
            <details
              v-if="item.input"
              class="raw-details"
            >
              <summary>{{ t('AIAGENT.PROCESS.RAW') }}</summary>
              <pre class="raw">{{ prettyJson(item.input) }}</pre>
            </details>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CircleCheck, CircleClose, VideoPause } from '@element-plus/icons-vue';
import { ChevronIcon, ActivityMark } from '../lib/icons';
import Typewriter from './Typewriter.vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import type { ChatMessage, ProcessItem, MessageLayout } from '../types';
import type { Component } from 'vue';
defineProps<{
  reducedMotion: boolean;
  now: number;
  message: ChatMessage;
  layout: (message: ChatMessage) => MessageLayout;
  isActive: (message: ChatMessage) => boolean;
  traceOpen: (message: ChatMessage) => boolean;
  liveLabel: (message: ChatMessage) => string;
  liveStepName: (message: ChatMessage) => string;
  summaryLabel: (message: ChatMessage) => string;
  stepCounts: (
    message: ChatMessage,
  ) => { group: string; label: string; icon: Component; count: number }[];
  stepExpandable: (item: ProcessItem) => boolean;
  stepGroup: (item: ProcessItem) => string;
  stepOpen: (message: ChatMessage, item: ProcessItem) => boolean;
  stepIcon: (item: ProcessItem) => Component;
  stepName: (item: ProcessItem) => string;
  stepPreview: (message: ChatMessage, item: ProcessItem) => string;
  stepTime: (message: ChatMessage, item: ProcessItem) => string;
  toolFacts: (item: ProcessItem) => { label: string; value: string }[];
  prettyJson: (value: string) => string;
}>();
const emit = defineEmits<{
  scheduleScroll: [];
  copyCode: [event: MouseEvent];
}>();
const scheduleScroll = (...args: []) => emit('scheduleScroll', ...args);
const copyCode = (...args: [event: MouseEvent]) => emit('copyCode', ...args);
</script>
