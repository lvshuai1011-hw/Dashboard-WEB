<template>
<div v-if="isEmpty" class="chart-container is-empty"><p class="chart-empty">{{ t('AIAGENT.CHART.NO_DATA') }}</p></div>
<div v-else ref="root" class="chart-container" />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { ChartContent } from "../types";
import { chartHasData, dealChart, polishChartOption } from "../lib/chartOptions";
import * as echarts from 'echarts';
const props = defineProps<{ content?: ChartContent; reducedMotion: boolean }>();
const { t } = useI18n();
const root = ref<HTMLElement>();
let inst: ReturnType<typeof echarts.init> | undefined;
let observer: ResizeObserver | undefined;
// 有 series 但每个点都没有数值 = 服务端确实查回了空结果集，改用空状态替代空坐标轴。
const isEmpty = computed(() => !!props.content?.chart_type && !chartHasData(props.content));
const render = () => {
  if (!root.value || !props.content || !props.content.chart_type) return;
  // 空结果集不初始化 echarts，否则 canvas 会把空状态文案顶掉。
  if (isEmpty.value) { inst?.dispose(); inst = undefined; return; }
  if (!inst) inst = echarts.init(root.value);
  const option = dealChart(props.content);
  if (option) {
    // 展示层统一图表字体/颜色；减少动态时关闭 ECharts 自带插值动画。
    option.animation = !props.reducedMotion;
    option.animationDuration = 700; option.animationEasing = 'cubicOut';
    polishChartOption(option, props.content.chart_type);
    inst.setOption(option, true);
  }
};
onMounted(() => {
  render();
  if (typeof ResizeObserver !== 'undefined' && root.value) {
    observer = new ResizeObserver(() => { try { inst?.resize(); } catch { /* 实例已销毁 */ } });
    observer.observe(root.value);
  }
});
onUnmounted(() => { observer?.disconnect(); inst?.dispose(); inst = undefined; });
watch(() => [props.content, props.reducedMotion], render, { flush: 'post' });
// 供下载按钮取 getDataURL；实例销毁后回落为空，避免抛错。
// 下载时临时显示画布标题并留出顶部空间，导出后恢复屏幕样式。
defineExpose({ getDataURL: (opts?: Record<string, unknown>) => {
  try {
    if (!inst) return '';
    const current = inst.getOption() as { grid?: { top?: unknown }[] };
    const gridTop = current.grid?.[0]?.top;
    inst.setOption({ animation: false, title: { show: true }, ...(current.grid?.length ? { grid: { top: 64 } } : {}) });
    const url = inst.getDataURL(opts as never);
    inst.setOption({ animation: !props.reducedMotion, title: { show: false }, ...(current.grid?.length ? { grid: { top: gridTop } } : {}) });
    return url;
  } catch { return ''; }
} });
</script>
