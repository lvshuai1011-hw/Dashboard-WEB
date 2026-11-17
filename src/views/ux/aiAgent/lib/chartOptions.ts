import { merge, cloneDeep } from 'lodash-es';
import type { ChartContent, ChartType } from '../types';
// SDA 数据映射与展示主题分开：前者保留数据语义，后者统一视觉配置。
const seriesColors = [
  '#1677ff',
  '#4b9b8f',
  '#c99b48',
  '#c76d73',
  '#6c9dbb',
  '#7976b5',
  '#b88968',
  '#7e929f',
];
const dataZoomConfig: Record<string, unknown>[] = [
  { type: 'inside', xAxisIndex: [0], start: 0, end: 100 },
  {
    type: 'slider',
    xAxisIndex: [0],
    start: 0,
    end: 100,
    top: '85%',
    height: 20,
    show: true,
    brushSelect: true,
  },
];
const legendConfig: Record<string, unknown> = {
  width: '80%',
  height: 100,
  bottom: 0,
  type: 'scroll',
  left: 'center',
  itemWidth: 18,
  itemHeight: 12,
  textStyle: { fontSize: 10 },
};
const textSlice = (params: string) => {
  const textlen = 14;
  return params.length > textlen ? `${params.slice(0, textlen)}..` : params;
};
// 类目名普遍偏长（如 BillingType (currency)）时，截断会丢掉关键信息；
// 改为整段展示并旋转 40°，同时抬高 grid 底部给旋转后的标签留位，避免压住 legend。
// formatter 必须显式给出恒等函数：base option 里已有 textSlice，lodash merge 不会因缺键而清掉它。
function categoryAxis(values: (string | number)[], base?: Record<string, unknown>) {
  const longest = values.reduce<number>((n, v) => Math.max(n, String(v).length), 0);
  return longest > 10
    ? {
        axisLabel: {
          rotate: 40,
          fontSize: 10,
          interval: 0,
          hideOverlap: false,
          formatter: (v: string) => v,
        },
        bottom: '22%',
      }
    : {
        axisLabel: base ?? { fontSize: 10, formatter: textSlice },
        bottom: undefined as string | undefined,
      };
}
const barOption: Record<string, unknown> = {
  xAxis: { type: 'category', axisLabel: { fontSize: 10, formatter: textSlice } },
  yAxis: { type: 'value' },
  tooltip: { show: true },
  grid: { top: '5%', bottom: '10%', left: '0', right: '2%', containLabel: true },
  color: ['#587DFF', '#468BCA', '#349396', '#349855', '#629433'],
  legend: legendConfig,
};
const lineOption: Record<string, unknown> = {
  xAxis: {
    type: 'category',
    axisLabel: { padding: [0, 0, 15, 0], fontSize: 10, formatter: textSlice },
  },
  legend: legendConfig,
  tooltip: { confine: true, trigger: 'axis' },
  grid: { bottom: '9%', top: '5%', left: '2%', right: '2%', containLabel: true },
  yAxis: { type: 'value' },
};
const pieOption: Record<string, unknown> = {
  title: {
    top: '0%',
    left: 'center',
    show: true,
    width: '80%',
    textStyle: { fontSize: 17, align: 'center', padding: [0, 10] },
  },
  tooltip: {
    confine: true,
    fontSize: 14,
    trigger: 'item',
    formatter: `{a}<br /> {b} : {c} ({d}%) `,
  },
  legend: legendConfig,
  series: [{ type: 'pie', top: 'middle' }],
};
const scatterOption: Record<string, unknown> = {
  grid: { left: '5%', bottom: '8%', containLabel: true },
  xAxis: { axisLabel: { fontSize: 10, formatter: textSlice } },
  legend: legendConfig,
  tooltip: { trigger: 'item' },
};
export function dealChart(content: ChartContent): Record<string, unknown> | null {
  if (!content || !content.chart_type) return null;
  switch (content.chart_type) {
    case 'multi-bar':
    case 'bar':
      return cartesianChart(content, 'bar');
    case 'multi-line':
    case 'line':
      return cartesianChart(content, 'line');
    case 'pie':
      return pieMerge(content, 'pie');
    case 'ring':
      return pieMerge(content, 'ring');
    case 'scatter':
      return scatterMerge(content);
    default:
      return null;
  }
}
// 柱状图和折线图共用类目对齐、稀疏轴编号映射和缩放规则。
function cartesianChart(config: ChartContent, type: 'bar' | 'line'): Record<string, unknown> {
  const series = config.series ?? [];
  const categories = [...new Set(series.flatMap((item) => item.data.map((point) => point.x)))];
  const axisIndices = [...new Set(series.map((item) => item.y_axis_index ?? 0))];
  const isBar = type === 'bar';
  const category = categoryAxis(
    categories,
    isBar
      ? undefined
      : {
          padding: [0, 0, 15, 0],
          fontSize: 10,
          formatter: textSlice,
        },
  );
  const yAxis =
    axisIndices.length > 1
      ? axisIndices.map((index, position) => ({
          type: 'value',
          name: series.find((item) => (item.y_axis_index ?? 0) === index)?.name || '',
          position: position === 0 ? 'left' : 'right',
          nameGap: 25,
          nameTextStyle: { verticalAlign: 'top', align: position === 0 ? 'right' : 'left' },
        }))
      : {
          type: 'value',
          name: config.y_label,
          nameGap: 25,
          nameTextStyle: {
            verticalAlign: 'top',
            align: config.y_label && config.y_label.length > 7 ? 'left' : 'center',
          },
        };
  const option: Record<string, unknown> = {
    title: {
      text: config.title,
      top: '0%',
      left: 'center',
      show: true,
      width: '80%',
      textStyle: { fontSize: 14, align: 'center', padding: [0, 10] },
    },
    legend: { bottom: '-3' },
    tooltip: isBar
      ? { trigger: 'axis', axisPointer: { type: 'shadow' } }
      : { trigger: 'axis', confine: true },
    grid: {
      top: '20%',
      left: '3%',
      right: isBar ? '7%' : '8%',
      bottom: category.bottom ?? (isBar ? '10%' : '15%'),
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: category.axisLabel,
      name: config.x_label,
      nameLocation: 'end',
      nameTextStyle: { verticalAlign: 'top', align: 'right', padding: [20, 0, 0, 0] },
    },
    yAxis,
    series: series.map((item, index) => {
      const values = new Map(item.data.map((point) => [point.x, point.y]));
      return {
        name: item.name,
        type,
        data: categories.map((x) => [x, values.get(x) ?? null]),
        yAxisIndex: axisIndices.indexOf(item.y_axis_index ?? 0),
        ...(isBar
          ? {
              barMaxWidth: Math.max(8, 40 / series.length),
              itemStyle: { color: seriesColors[index % seriesColors.length] },
            }
          : { smooth: true }),
      };
    }),
  };
  if (categories.length > 20) option.dataZoom = cloneDeep(dataZoomConfig);
  return merge(cloneDeep(isBar ? barOption : lineOption), option);
}
function pieMerge(data: ChartContent, type: 'pie' | 'ring'): Record<string, unknown> {
  const { title, series, summary } = data;
  const pieSeries = series ?? [];
  const pieData = (pieSeries[0]?.data ?? []).map((item) => ({ name: item.x, value: item.y }));
  pieData.sort((a, b) => Number(b.value) - Number(a.value));
  const option: Record<string, unknown> = {
    title: { text: title },
    series: [
      {
        name: pieSeries[0]?.name,
        type: 'pie',
        data: pieData,
        top: '0',
        radius: type === 'pie' ? '53%' : ['40%', '53%'],
        label: { fontSize: 13, formatter: (params: { name: string }) => `${params.name}` },
      },
    ],
  };
  if (type === 'ring') {
    option.graphic = [
      {
        type: 'group',
        left: 'center',
        top: 'center',
        children: [
          {
            type: 'text',
            style: {
              text: summary ?? '-',
              textAlign: 'center',
              fill: '#333',
              fontSize: 13,
              fontWeight: 'bold',
            },
            tooltip: {
              show: true,
              trigger: 'item',
              formatter: summary ?? '-',
              backgroundColor: '#f8fafc',
              borderColor: '#dfe5ee',
              textStyle: { color: '#333a47' },
            },
          },
        ],
      },
    ];
  }
  return merge(cloneDeep(pieOption), option);
}
function scatterMerge(chartData: ChartContent): Record<string, unknown> {
  const series = chartData.series ?? [];
  const legendData = series.map((item) => item.name);
  const option: Record<string, unknown> = {
    title: { text: chartData.title, left: 'center' },
    legend: { data: legendData },
    xAxis: { type: 'value', name: chartData.x_label, splitLine: { show: true } },
    yAxis: { type: 'value', name: chartData.y_label, splitLine: { show: true } },
    series: [] as unknown[],
  };
  const firstSeries = series[0];
  if (firstSeries && firstSeries.data.length > 0) {
    const firstDataPoint = firstSeries.data[0];
    if (typeof firstDataPoint.x === 'string') {
      (option.xAxis as Record<string, unknown>).type = 'category';
      const xCategories = new Set<string | number>();
      const uniqueXCategories: (string | number)[] = [];
      series.forEach((s) =>
        s.data.forEach((dp) => {
          if (dp.x !== undefined && !xCategories.has(dp.x)) {
            xCategories.add(dp.x);
            uniqueXCategories.push(dp.x);
          }
        }),
      );
      uniqueXCategories.sort((a, b) => String(a).localeCompare(String(b)));
      (option.xAxis as Record<string, unknown>).data = uniqueXCategories;
    }
    if (typeof firstDataPoint.y === 'string') {
      (option.yAxis as Record<string, unknown>).type = 'category';
      const yCategories = new Set<string | number>();
      const uniqueYCategories: (string | number)[] = [];
      series.forEach((s) =>
        s.data.forEach((dp) => {
          if (dp.y !== undefined && !yCategories.has(dp.y)) {
            yCategories.add(dp.y);
            uniqueYCategories.push(dp.y);
          }
        }),
      );
      (option.yAxis as Record<string, unknown>).data = uniqueYCategories;
    }
  }
  const outSeries = option.series as unknown[];
  series.forEach((s, index) => {
    outSeries.push({
      name: s.name,
      type: 'scatter',
      data: s.data.map((item) => [item.x, item.y]),
      symbolSize: 10,
      itemStyle: { color: seriesColors[index % seriesColors.length] },
    });
  });
  if ((option.xAxis as Record<string, unknown>).type === 'category') {
    (option.xAxis as Record<string, unknown>).axisTick = { alignWithLabel: true, length: 5 };
  }
  return merge(cloneDeep(scatterOption), option);
}
// 展示层图表主题（企业风格）：只在 dealChart 结果上叠加样式，不改变数据、系列与坐标含义。
// 卡片标题已显示图表名，画布内标题仅在下载 PNG 时临时显示。
// 色板以主题蓝起头，其余取冷色为主、暖色点缀，保证相邻系列可区分且整体不跳色。
const chartPalette = [
  '#3370ff',
  '#2fc0b3',
  '#8b7bf7',
  '#f5a73b',
  '#5aa9ff',
  '#ee7a92',
  '#74c26b',
  '#94a0b4',
];
// 纵向渐变：顶部实色、底部略透，柱体与面积更有层次；下载 PNG 时同样生效。
const fadeDown = (color: string, from = 'ff', to = 'cc') => ({
  type: 'linear',
  x: 0,
  y: 0,
  x2: 0,
  y2: 1,
  colorStops: [
    { offset: 0, color: color + from },
    { offset: 1, color: color + to },
  ],
});
const asArray = <T>(value: T | T[] | undefined): T[] =>
  value == null ? [] : Array.isArray(value) ? value : [value];
export function polishChartOption(option: Record<string, unknown>, type: ChartType) {
  const muted = '#8a93a3';
  const series = asArray(option.series as Record<string, unknown>[]);
  const isPie = type === 'pie' || type === 'ring';
  option.color = chartPalette;
  option.textStyle = {
    fontFamily: 'PingFang SC, Microsoft YaHei, -apple-system, Segoe UI, Arial, sans-serif',
    color: '#5f6878',
  };
  option.title = merge(cloneDeep(option.title ?? {}), {
    show: false,
    top: 6,
    left: 'center',
    textStyle: { fontSize: 15, fontWeight: 600, color: '#1f2329' },
  });
  option.tooltip = merge(cloneDeep(option.tooltip ?? {}), {
    backgroundColor: '#f8fafc',
    borderColor: '#e6e9ef',
    borderWidth: 1,
    padding: [9, 13],
    textStyle: { color: '#1d2330', fontSize: 12.5 },
    extraCssText: 'border-radius:10px;box-shadow:0 8px 24px rgba(23,32,56,.12);',
    axisPointer:
      type === 'bar' || type === 'multi-bar'
        ? { type: 'shadow', shadowStyle: { color: 'rgba(51,112,255,0.06)' } }
        : { type: 'line', lineStyle: { color: '#b9c3d6', type: 'dashed' } },
  });
  const showLegend = isPie || series.length > 1;
  option.legend = merge(cloneDeep(option.legend ?? {}), {
    show: showLegend,
    icon: 'circle',
    itemWidth: 8,
    itemHeight: 8,
    itemGap: 22,
    bottom: 0,
    textStyle: { color: '#5f6878', fontSize: 12 },
  });
  if (option.xAxis) {
    const base = {
      axisTick: { show: false },
      axisLabel: { color: muted, fontSize: 12, margin: 12 },
      nameTextStyle: { color: muted, fontSize: 11 },
    };
    option.xAxis = asArray<Record<string, unknown>>(option.xAxis as Record<string, unknown>[]).map(
      (axis) =>
        merge(cloneDeep(axis), base, {
          axisLine: { show: true, lineStyle: { color: '#dfe3ea' } },
          splitLine: {
            show: axis.type === 'value',
            lineStyle: { color: '#eef1f5', type: 'dashed' },
          },
        }),
    );
    option.yAxis = asArray<Record<string, unknown>>(option.yAxis as Record<string, unknown>[]).map(
      (axis) =>
        merge(cloneDeep(axis), base, {
          axisLine: { show: false },
          splitLine: { lineStyle: { color: '#eef1f5', type: 'dashed' } },
        }),
    );
    const zoom = !!option.dataZoom;
    if (zoom)
      option.dataZoom = (option.dataZoom as Record<string, unknown>[]).map((item) =>
        item.type === 'slider'
          ? {
              ...item,
              top: undefined,
              bottom: showLegend ? 28 : 6,
              height: 16,
              borderColor: '#e6e9ef',
              fillerColor: 'rgba(51,112,255,0.1)',
              handleStyle: { color: '#fff', borderColor: '#b9c3d6' },
              moveHandleSize: 0,
              textStyle: { color: muted },
            }
          : item,
      );
    option.grid = {
      top: 28,
      left: 4,
      right: 20,
      bottom: (showLegend ? 28 : 4) + (zoom ? 30 : 0),
      containLabel: true,
    };
  }
  series.forEach((item, index) => {
    const color = chartPalette[index % chartPalette.length];
    if (item.type === 'line') {
      merge(item, {
        smooth: false,
        symbol: 'circle',
        symbolSize: 8,
        showSymbol: asArray(item.data as unknown[]).length <= 24,
        lineStyle: { width: 2.5, cap: 'round', join: 'round' },
        itemStyle: { color, borderColor: '#fff', borderWidth: 2 },
        emphasis: { focus: 'series', scale: 1.4 },
      });
      // 单系列时在折线下铺一层由深到浅的面积，强化趋势；多系列不铺，避免相互遮挡。
      if (series.length === 1) item.areaStyle = { color: fadeDown(color, '2e', '00') };
    } else if (item.type === 'bar' || item.type === 'multi-bar') {
      merge(item, {
        type: 'bar',
        barMaxWidth: series.length > 1 ? 24 : 48,
        barCategoryGap: '46%',
        barGap: '18%',
        itemStyle: { borderRadius: [5, 5, 0, 0] },
        emphasis: { focus: 'series' },
      });
      (item.itemStyle as Record<string, unknown>).color = fadeDown(color);
    } else if (item.type === 'pie') {
      merge(item, {
        radius: ['44%', '68%'],
        center: ['50%', '46%'],
        padAngle: 1.5,
        itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 6 },
        percentPrecision: 1,
        label: { color: '#5f6878', fontSize: 12.5, formatter: '{b}  {d}%' },
        labelLine: { length: 12, length2: 14, lineStyle: { color: '#c5cbd6' } },
        emphasis: { scaleSize: 6 },
      });
    } else if (item.type === 'scatter') {
      merge(item, { symbolSize: 8, itemStyle: { color, opacity: 0.8 } });
    }
  });
  return option;
}
// 单个图表用独立组件管理 echarts 实例:onMounted init、onUnmounted dispose、ResizeObserver 自适应。
// 不在 v-for 里用内联函数 ref(每次渲染都会重建闭包,会被 Vue 当作 ref 变化反复 dispose/re-init,图表画不出来)。
export function chartHasData(chart?: ChartContent) {
  if (!chart) return false;
  if (chart.chart_type === 'table') return !!chart.table_data?.rows?.length;
  const series = chart.series;
  if (!series?.length) return false;
  return series.some((s) => s.data?.some((d) => d.y !== '' && d.y != null));
}
// 空结果的图表没有可导出的内容，隐藏下载按钮避免点了报错。
