<template>
<div class="welcome">
  <h2 class="welcome-title" :aria-label="dashboardName">
    <svg viewBox="0 0 540 60" aria-hidden="true" focusable="false">
      <text class="welcome-wordmark" x="270" y="43" text-anchor="middle">{{ dashboardName }}</text>
    </svg>
  </h2>
  <svg class="welcome-chart" viewBox="0 0 330 80" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient :id="welcomeChartGradientId" x2="0%" y2="100%">
        <stop stop-color="currentColor" stop-opacity=".16" />
        <stop offset="1" stop-color="currentColor" stop-opacity=".015" />
      </linearGradient>
    </defs>
    <path class="welcome-chart-grid" d="M12 23H318M12 46H318M12 69H318" />
    <path class="welcome-chart-area" :d="`${welcomeChartLine} V69 H12Z`" :fill="`url(#${welcomeChartGradientId})`" />
    <path class="welcome-chart-line" pathLength="1" :d="welcomeChartLine" />
    <g class="welcome-chart-endpoint">
      <circle cx="318" cy="11" r="7" fill="var(--blue-soft)" />
      <circle cx="318" cy="11" r="3.5" fill="currentColor" />
    </g>
  </svg>
</div>
</template>

<script setup lang="ts">
import { useId } from "vue";
import { dashboardName } from "../types";
const welcomeChartGradientId = `${useId()}-welcome-chart-area`;
const welcomeChartLine = 'M12 63 L49 56 83 59 120 36 154 45 190 29 226 35 262 21 294 25 318 11';
</script>
