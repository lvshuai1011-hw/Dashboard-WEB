<template>
<div class="result-card">
  <div class="result-head">
    <strong>{{ item.chart?.title || t('AIAGENT.CHART.TITLE') }}</strong>
    <div v-if="item.chart?.chart_type !== 'table' && chartHasData(item.chart)" class="segmented" role="tablist">
      <button type="button" role="tab" :aria-selected="chartMode(message, item) === 'chart'" :class="{ active: chartMode(message, item) === 'chart' }" @click="setChartMode(message, item, 'chart')"><el-icon><ChartLineIcon /></el-icon>{{ uiCopy.chart }}</button>
      <button type="button" role="tab" :aria-selected="chartMode(message, item) === 'data'" :class="{ active: chartMode(message, item) === 'data' }" @click="setChartMode(message, item, 'data')"><el-icon><TableIcon /></el-icon>{{ uiCopy.data }}</button>
    </div>
    <el-tooltip v-if="canDownloadChart(item)" :content="t(chartMode(message, item) === 'data' ? 'AIAGENT.CHART.DOWNLOAD_TABLE' : 'AIAGENT.CHART.DOWNLOAD')">
      <button class="icon-button" type="button" :aria-label="t(chartMode(message, item) === 'data' ? 'AIAGENT.CHART.DOWNLOAD_TABLE' : 'AIAGENT.CHART.DOWNLOAD')" @click.stop="downloadCurrent(message, item)"><el-icon><Download /></el-icon></button>
    </el-tooltip>
  </div>
  <div class="result-body">
    <p v-if="item.chart?.summary" class="result-summary">{{ item.chart.summary }}</p>
    <template v-if="chartHasData(item.chart)">
      <ChartView v-if="item.chart?.chart_type !== 'table'" v-show="chartMode(message, item) === 'chart'" :ref="el => { registerChart(message, item, el); }" :content="item.chart" :reduced-motion="reducedMotion" />
      <div v-if="chartMode(message, item) === 'data' && chartTable(item.chart)" class="data-table-scroll">
        <table class="data-table">
          <thead><tr><th v-for="(head, hi) in chartTable(item.chart)!.headers" :key="hi" :class="{ num: numericColumn(chartTable(item.chart)!, hi) }">{{ head }}</th></tr></thead>
          <tbody><tr v-for="(row, ri) in chartTable(item.chart)!.rows" :key="ri"><td v-for="(cell, ci) in row" :key="ci" :class="{ num: typeof cell === 'number' }">{{ formatCell(cell) }}</td></tr></tbody>
        </table>
      </div>
    </template>
    <p v-else class="result-empty">{{ t('AIAGENT.CHART.NO_DATA') }}</p>
  </div>
  <div v-if="item.chart?.total != null" class="result-foot">{{ t('AIAGENT.CHART.RECORDS', { total: item.chart.total, displayed: item.chart.displayed ?? item.chart.total }) }}</div>
</div>
</template>

<script setup lang="ts">
import { Download } from "@element-plus/icons-vue";
import { ChartLineIcon, TableIcon } from "../lib/icons";
import { chartHasData } from "../lib/chartOptions";
import ChartView from "./ChartView.vue";
import { useI18n } from "vue-i18n";
const { t } = useI18n();
import type { ChatMessage, ChartContent, ProcessItem } from "../types";
import type { useUiCopy } from "../composables/useUiCopy";
defineProps<{
  reducedMotion: boolean;
  message: ChatMessage;
  item: ProcessItem;
  uiCopy: ReturnType<typeof useUiCopy>["value"];
  chartMode: (message: ChatMessage, item: ProcessItem) => string;
  chartTable: (chart?: ChartContent) => { headers: string[]; rows: (string | number)[][] } | undefined;
  numericColumn: (table: { rows: (string | number)[][] }, index: number) => boolean;
  formatCell: (value: unknown) => string;
}>();
const emit = defineEmits<{
  setChartMode: [message: ChatMessage, item: ProcessItem, mode: "chart" | "data"];
  downloadCurrent: [message: ChatMessage, item: ProcessItem];
  registerChart: [message: ChatMessage, item: ProcessItem, chart: unknown];
}>();
const setChartMode = (...args: [message: ChatMessage, item: ProcessItem, mode: "chart" | "data"]) => emit("setChartMode", ...args);
const downloadCurrent = (...args: [message: ChatMessage, item: ProcessItem]) => emit("downloadCurrent", ...args);
const registerChart = (...args: [message: ChatMessage, item: ProcessItem, chart: unknown]) => emit("registerChart", ...args);
const canDownloadChart = (item: ProcessItem) => chartHasData(item.chart);
</script>
