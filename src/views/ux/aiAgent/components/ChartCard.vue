<template>
  <div class="result-card">
    <div class="result-head">
      <strong>{{ item.chart?.title || t('AIAGENT.CHART.TITLE') }}</strong>
      <div
        v-if="item.chart?.chart_type !== 'table' && chartHasData(item.chart)"
        class="segmented"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          :aria-selected="charts.chartMode(message, item) === 'chart'"
          :class="{ active: charts.chartMode(message, item) === 'chart' }"
          @click="charts.setChartMode(message, item, 'chart')"
        >
          <el-icon><ChartLineIcon /></el-icon>
          {{ uiCopy.chart }}
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="charts.chartMode(message, item) === 'data'"
          :class="{ active: charts.chartMode(message, item) === 'data' }"
          @click="charts.setChartMode(message, item, 'data')"
        >
          <el-icon><TableIcon /></el-icon>
          {{ uiCopy.data }}
        </button>
      </div>
      <AppTooltip
        v-if="canDownloadChart(item)"
        :content="
          t(
            charts.chartMode(message, item) === 'data'
              ? 'AIAGENT.CHART.DOWNLOAD_TABLE'
              : 'AIAGENT.CHART.DOWNLOAD',
          )
        "
      >
        <button
          class="icon-button"
          type="button"
          :aria-label="
            t(
              charts.chartMode(message, item) === 'data'
                ? 'AIAGENT.CHART.DOWNLOAD_TABLE'
                : 'AIAGENT.CHART.DOWNLOAD',
            )
          "
          @click.stop="charts.downloadCurrent(message, item)"
        >
          <el-icon><Download /></el-icon>
        </button>
      </AppTooltip>
    </div>
    <div class="result-body">
      <template v-if="chartHasData(item.chart)">
        <ChartView
          v-if="item.chart?.chart_type !== 'table'"
          v-show="charts.chartMode(message, item) === 'chart'"
          :ref="
            (el) => {
              charts.registerChart(message, item, el);
            }
          "
          :content="item.chart"
          :reduced-motion="reducedMotion"
        />
        <div v-if="charts.chartMode(message, item) === 'data' && table" class="data-table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th
                  v-for="(head, hi) in table.headers"
                  :key="hi"
                  :class="{ num: numericColumns[hi] }"
                >
                  {{ head }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, ri) in table.rows" :key="ri">
                <td v-for="(cell, ci) in row" :key="ci" :class="{ num: typeof cell === 'number' }">
                  {{ charts.formatCell(cell) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <p v-else class="result-empty">
        {{ t('AIAGENT.CHART.NO_DATA') }}
      </p>
      <p v-if="item.chart?.summary" class="result-summary">
        {{ item.chart.summary }}
      </p>
    </div>
    <div v-if="item.chart?.total != null" class="result-foot">
      {{
        t('AIAGENT.CHART.RECORDS', {
          total: item.chart.total,
          displayed: item.chart.displayed ?? item.chart.total,
        })
      }}
    </div>
  </div>
</template>

<script setup lang="ts">
import AppTooltip from './AppTooltip.vue';
import { computed } from 'vue';
import { Download } from '@element-plus/icons-vue';
import { ChartLineIcon, TableIcon } from '../lib/icons';
import { chartHasData } from '../lib/chartOptions';
import ChartView from './ChartView.vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import type { ChatMessage, ProcessItem } from '../types';
import type { useChartCards } from '../composables/useChartCards';
import type { useUiCopy } from '../composables/useUiCopy';
const props = defineProps<{
  reducedMotion: boolean;
  message: ChatMessage;
  item: ProcessItem;
  uiCopy: ReturnType<typeof useUiCopy>['value'];
  charts: ReturnType<typeof useChartCards>;
}>();

const table = computed(() => props.charts.chartTable(props.item.chart));
const numericColumns = computed(
  () =>
    table.value?.headers.map((_, index) => props.charts.numericColumn(table.value!, index)) ?? [],
);
const canDownloadChart = (item: ProcessItem) => chartHasData(item.chart);
</script>
