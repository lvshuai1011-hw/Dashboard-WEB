<template>
  <div v-if="isEmpty" class="chart-container is-empty">
    <p class="chart-empty">{{ t('AIAGENT.CHART.NO_DATA') }}</p>
  </div>
  <div v-else ref="root" class="chart-container" />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ChartContent } from '../types';
import { chartHasData, dealChart, polishChartOption } from '../lib/chartOptions';
import * as echarts from 'echarts';
const props = defineProps<{ content?: ChartContent; reducedMotion: boolean }>();
const { t } = useI18n();
const root = ref<HTMLElement>();
let inst: ReturnType<typeof echarts.init> | undefined;
let observer: ResizeObserver | undefined;
// 有 series 但每个点都没有数值 = 服务端确实查回了空结果集，改用空状态替代空坐标轴。
const isEmpty = computed(() => !!props.content?.chart_type && !chartHasData(props.content));
const render = () => {
  // 空数据和图表互相切换时，画布宿主会被重新创建。
  if (inst && inst.getDom() !== root.value) {
    observer?.disconnect();
    inst.dispose();
    inst = undefined;
  }
  if (!root.value || !props.content || isEmpty.value) return;
  if (!inst) {
    inst = echarts.init(root.value);
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => inst?.resize());
      observer.observe(root.value);
    }
  }
  const option = dealChart(props.content);
  if (option) {
    // 展示层统一图表字体/颜色；减少动态时关闭 ECharts 自带插值动画。
    option.animation = !props.reducedMotion;
    option.animationDuration = 700;
    option.animationEasing = 'cubicOut';
    polishChartOption(option, props.content.chart_type);
    inst.setOption(option, true);
  }
};
onMounted(render);
onUnmounted(() => {
  observer?.disconnect();
  inst?.dispose();
  inst = undefined;
});
watch(() => [root.value, props.content, props.reducedMotion], render, {
  flush: 'post',
  deep: true,
});
// 供下载按钮取 getDataURL；实例销毁后回落为空，避免抛错。
// 下载时临时显示画布标题并留出顶部空间，导出后恢复屏幕样式。
function getDataURL(options?: Record<string, unknown>): string {
  if (!inst) return '';
  const chart = inst;
  const current = chart.getOption() as { grid?: { top?: unknown }[] };
  const gridTop = current.grid?.[0]?.top;
  try {
    chart.setOption({
      animation: false,
      title: { show: true },
      ...(current.grid?.length ? { grid: { top: 64 } } : {}),
    });
    return chart.getDataURL(options as Parameters<typeof chart.getDataURL>[0]);
  } catch {
    return '';
  } finally {
    // 导出失败时也要恢复交互图表的标题和边距。
    if (!chart.isDisposed())
      chart.setOption({
        animation: !props.reducedMotion,
        title: { show: false },
        ...(current.grid?.length ? { grid: { top: gridTop } } : {}),
      });
  }
}
defineExpose({ getDataURL });
</script>
