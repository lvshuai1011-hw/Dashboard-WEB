<template>
<div class="typewriter" :class="{ active: props.active }">
  <div ref="root" class="markdown-body" v-html="html" @click="emit('copyCode', $event)" @toggle.capture="emit('progress')"
    @vue:before-update="captureDetails" @vue:mounted="mounted" @vue:updated="updated" />
</div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { renderMarkdown, typingChunk } from "../lib/markdown";
const { t } = useI18n();
const props = defineProps<{
  content: string;
  active?: boolean;
  highlight?: boolean;
  sweep?: boolean;
  reducedMotion: boolean;
}>();
const emit = defineEmits<{ progress: []; copyCode: [event: MouseEvent] }>();
const displayed = ref(''); let observed = '', pending = '';
let timer: ReturnType<typeof setTimeout> | undefined;
const clear = () => { clearTimeout(timer); timer = undefined; };
const pump = () => {
  timer = undefined;
  const chunk = typingChunk(pending);
  displayed.value += chunk; pending = pending.slice(chunk.length); emit('progress');
  if (pending && chunk) timer = setTimeout(pump, 30);
};
watch(() => [props.content, props.active, props.reducedMotion] as const, ([content, active, reduced]) => {
  if (!active || reduced) { clear(); pending = ''; displayed.value = content; }
  else {
    if (!content.startsWith(observed)) { clear(); displayed.value = ''; pending = content; }
    else pending += content.slice(observed.length);
    // 收到增量先绘制一小段，剩余内容再定时追赶；避免首帧完全依赖延迟计时器。
    if (pending) { clear(); pump(); }
  }
  observed = content; emit('progress');
}, { immediate: true });
onUnmounted(clear);
const html = computed(() => renderMarkdown(displayed.value, t));
const root = ref<HTMLElement>(); let openStates: boolean[] = [];
const captureDetails = () => { openStates = Array.from(root.value?.querySelectorAll('details') || []).map(el => el.open); };
const restoreDetails = () => { root.value?.querySelectorAll('details').forEach((el, i) => { if (i < openStates.length) el.open = openStates[i]; }); };
// 流式输出时仅加粗；正文完成后等待布局稳定，再刷出重点底色，不依赖追问。
// 组件在流式期间已经挂载，因此必须响应 active/sweep 的变化，不能只在挂载时初始化。
const SETTLE_MS = 300, SWEEP_MAX_WAIT = 2600;
let waitAt = 0;
let sweepState: 'idle' | 'waiting' | 'playing' = 'idle';
let sweepAt = 0, settleFrame = 0;
const paintMarks = () => {
  const el = props.highlight ? root.value?.querySelector('strong') : null;
  if (!el) return;
  if (props.active) {
    el.classList.remove('key-mark', 'mark-wait', 'mark-sweep');
    el.style.animationDelay = ''; return;
  }
  el.classList.add('key-mark');
  if (sweepState === 'idle') {
    el.classList.remove('mark-wait', 'mark-sweep'); el.style.animationDelay = '';
  } else if (sweepState === 'waiting') el.classList.add('mark-wait');
  else if (sweepState === 'playing') {
    el.classList.remove('mark-wait');
    // 仅在新节点上恢复进度；已有节点继续自己的时间线，避免更新时重复扣减延迟。
    if (!el.classList.contains('mark-sweep')) {
      el.style.animationDelay = `${Math.round(sweepAt - performance.now())}ms`;
      el.classList.add('mark-sweep');
    }
  }
};
const waitForSettle = () => {
  let lastTop = Number.NaN, stableSince = performance.now();
  const step = () => {
    settleFrame = 0;
    if (sweepState !== 'waiting') return;
    const now = performance.now(), el = root.value?.querySelector('strong.key-mark');
    if (el) { const top = Math.round(el.getBoundingClientRect().top); if (top !== lastTop) { lastTop = top; stableSince = now; } }
    if ((el && now - stableSince >= SETTLE_MS) || now - waitAt >= SWEEP_MAX_WAIT) {
      sweepState = 'playing'; sweepAt = now; paintMarks(); return;
    }
    settleFrame = requestAnimationFrame(step);
  };
  settleFrame = requestAnimationFrame(step);
};
const syncSweep = () => {
  if (props.active || props.reducedMotion) {
    cancelAnimationFrame(settleFrame); settleFrame = 0; sweepState = 'idle';
  } else if (props.highlight && props.sweep && sweepState === 'idle') {
    sweepState = 'waiting'; waitAt = performance.now(); waitForSettle();
  }
  paintMarks();
};
watch(() => [props.active, props.sweep, props.highlight, props.reducedMotion], syncSweep, { flush: 'post' });
onUnmounted(() => cancelAnimationFrame(settleFrame));
// 浮现式输出：不显示输入光标，新出现的文字在约半秒内淡入。
// innerHTML 每次更新都会重建节点，因此记录每段文字出现的时刻，重建后按已播放时长（负的 animation-delay）接续，不会重播。
const FADE_MS = 480, NO_WRAP = /^(?:UL|OL|TABLE|THEAD|TBODY|TR)$/;
let reveals: { from: number; at: number }[] = [], shownLength = 0, fadedHtml = '';
const fadeIn = () => {
  const el = root.value;
  if (!el || fadedHtml === html.value) return;
  fadedHtml = html.value;
  const nodes: Text[] = [], walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let total = 0;
  while (walker.nextNode()) { const node = walker.currentNode as Text; nodes.push(node); total += node.data.length; }
  const now = performance.now();
  if (props.active && !props.reducedMotion && total > shownLength) reveals.push({ from: shownLength, at: now });
  shownLength = total;
  reveals = reveals.filter(item => now - item.at < FADE_MS && item.from < total);
  if (!reveals.length) return;
  let offset = 0;
  for (const node of nodes) {
    const start = offset, end = offset + node.data.length; offset = end;
    if (end <= reveals[0].from || NO_WRAP.test(node.parentElement?.tagName ?? '')) continue;
    let rest = node, restStart = start;
    for (let k = 0; k < reveals.length; k++) {
      const from = Math.max(reveals[k].from, start), to = Math.min(k + 1 < reveals.length ? reveals[k + 1].from : total, end);
      if (from >= to) continue;
      if (from > restStart) { rest = rest.splitText(from - restStart); restStart = from; }
      const after = to < end ? rest.splitText(to - restStart) : null;
      const span = document.createElement('span');
      span.className = 'fade-in-text'; span.style.animationDelay = `${Math.round(reveals[k].at - now)}ms`;
      rest.replaceWith(span); span.appendChild(rest);
      if (!after) break;
      rest = after; restStart = to;
    }
  }
};
const mounted = () => { syncSweep(); fadeIn(); };
const updated = () => { restoreDetails(); paintMarks(); fadeIn(); };
</script>
