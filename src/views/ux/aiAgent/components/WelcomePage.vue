<template>
  <div class="welcome">
    <h2 class="welcome-title" :aria-label="dashboardName">
      <svg viewBox="0 0 540 60" aria-hidden="true" focusable="false">
        <text class="welcome-wordmark" x="270" y="43" text-anchor="middle">
          {{ dashboardName }}
        </text>
      </svg>
    </h2>
    <img class="welcome-chart" src="../assets/welcome-trend.svg" alt="" />
  </div>
</template>

<script setup lang="ts">
import { dashboardName } from '../types';
</script>
