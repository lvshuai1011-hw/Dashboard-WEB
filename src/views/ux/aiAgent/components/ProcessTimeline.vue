<template>
  <div
    v-if="message.process.length || active"
    class="process"
    :class="[message.status, { live: active, open: timeline.traceOpen(message) }]"
  >
    <button
      class="trace-toggle"
      type="button"
      :data-message-id="message.id"
      :aria-expanded="timeline.traceOpen(message)"
      :aria-controls="`trace-${message.id}`"
    >
      <!-- 生成中的折叠方块与结果图标共用一个槽位：结束时方块收拢，再弹出结果图标。 -->
      <span class="trace-icon">
        <Transition name="mark" mode="out-in">
          <ActivityMark v-if="active" key="live" />
          <el-icon v-else key="result" class="trace-result">
            <component
              :is="
                message.status === 'error'
                  ? CircleClose
                  : message.status === 'stopped'
                    ? VideoPause
                    : CircleCheck
              "
            />
          </el-icon>
        </Transition>
      </span>
      <template v-if="active">
        <span class="trace-label">
          {{ liveStatus.label }}
          <template v-if="liveStatus.name">· {{ liveStatus.name }}</template>
        </span>
        <span class="trace-elapsed">
          {{
            t('AIAGENT.STATUS.ELAPSED', {
              seconds: Math.floor(Math.max(0, now - message.createdAt) / 1000),
            })
          }}
        </span>
      </template>
      <template v-else>
        <span class="trace-label">{{ timeline.summaryLabel(message) }}</span>
        <span v-if="counts.length" class="trace-counts">
          <AppTooltip :content="entry.label" v-for="entry in counts" :key="entry.group">
            <span>
              <el-icon><component :is="entry.icon" /></el-icon>
              {{ entry.count }}
            </span>
          </AppTooltip>
        </span>
      </template>
      <el-icon v-if="items.length" class="trace-chevron">
        <ChevronIcon />
      </el-icon>
    </button>
    <div
      v-if="timeline.traceOpen(message) && items.length"
      :id="`trace-${message.id}`"
      class="steps"
    >
      <template v-for="item in items" :key="item.id">
        <component
          :is="timeline.stepExpandable(item) ? 'button' : 'div'"
          class="step-row"
          :class="[
            timeline.stepGroup(item),
            item.status,
            {
              expandable: timeline.stepExpandable(item),
              open: timeline.stepExpandable(item) && timeline.stepOpen(message, item),
            },
          ]"
          v-bind="
            timeline.stepExpandable(item)
              ? {
                  type: 'button',
                  'data-message-id': message.id,
                  'data-process-id': item.id,
                  'aria-expanded': timeline.stepOpen(message, item),
                }
              : {}
          "
        >
          <el-icon class="step-icon">
            <component :is="item.status === 'error' ? CircleClose : timeline.stepIcon(item)" />
          </el-icon>
          <span class="step-name">{{ timeline.stepName(item) }}</span>
          <span class="step-preview">
            {{
              timeline.stepExpandable(item) && timeline.stepOpen(message, item)
                ? ''
                : timeline.stepPreview(message, item)
            }}
          </span>
          <span class="step-time">{{ timeline.stepTime(message, item) }}</span>
          <el-icon v-if="timeline.stepExpandable(item)" class="step-chevron">
            <ChevronIcon />
          </el-icon>
        </component>
        <div
          v-if="timeline.stepExpandable(item) && timeline.stepOpen(message, item)"
          class="step-detail"
        >
          <Typewriter
            v-if="item.kind === 'text'"
            :content="item.text"
            :active="active && item.status === 'running'"
            @progress="emit('scheduleScroll')"
            :reduced-motion="reducedMotion"
            @copy-code="(event) => emit('copyCode', event)"
          />
          <template v-else-if="item.kind === 'subagent'">
            <template v-if="item.thinking">
              <h4>{{ t('AIAGENT.PROCESS.THINKING_TURN') }}</h4>
              <p class="plain">{{ item.thinking }}</p>
            </template>
            <template v-if="item.answer">
              <h4>{{ t('AIAGENT.PROCESS.SUBAGENT_ANSWER') }}</h4>
              <Typewriter
                :content="item.answer"
                :active="active && item.status === 'running'"
                @progress="emit('scheduleScroll')"
                :reduced-motion="reducedMotion"
                @copy-code="(event) => emit('copyCode', event)"
              />
            </template>
            <p v-if="!item.thinking && !item.answer" class="plain">
              {{ t('AIAGENT.STATUS.WAITING') }}
            </p>
          </template>
          <pre v-else-if="item.kind === 'json'" class="raw">{{ item.input }}</pre>
          <template v-else>
            <dl v-if="timeline.toolFacts(item).length" class="facts">
              <template v-for="fact in timeline.toolFacts(item)" :key="fact.label">
                <dt>{{ fact.label }}</dt>
                <dd>{{ fact.value }}</dd>
              </template>
            </dl>
            <p v-else class="plain">
              {{ t('AIAGENT.PROCESS.NO_DETAILS') }}
            </p>
            <details v-if="item.input" class="raw-details">
              <summary>{{ t('AIAGENT.PROCESS.RAW') }}</summary>
              <pre class="raw">{{ timeline.prettyJson(item.input) }}</pre>
            </details>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppTooltip from './AppTooltip.vue';
import { CircleCheck, CircleClose, VideoPause } from '@element-plus/icons-vue';
import { ChevronIcon, ActivityMark } from '../lib/icons';
import Typewriter from './Typewriter.vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import type { ChatMessage, ProcessItem } from '../types';
import type { useProcessTimeline } from '../composables/useProcessTimeline';
const props = defineProps<{
  reducedMotion: boolean;
  now: number;
  message: ChatMessage;
  items: ProcessItem[];
  isActive: (message: ChatMessage) => boolean;
  timeline: ReturnType<typeof useProcessTimeline>;
}>();
const active = computed(() => props.isActive(props.message));
const counts = computed(() => props.timeline.stepCounts(props.items));
const liveStatus = computed(() => props.timeline.liveStatus(props.message));
const emit = defineEmits<{
  scheduleScroll: [];
  copyCode: [event: MouseEvent];
}>();
</script>
