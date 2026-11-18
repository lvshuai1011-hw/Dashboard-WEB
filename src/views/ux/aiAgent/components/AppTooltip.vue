<template>
  <ElTooltip
    v-bind="$attrs"
    effect="light"
    :trigger="['hover', 'focus']"
    popper-class="agent-tooltip"
    :show-after="250"
    :hide-after="80"
  >
    <slot />
    <template v-if="$slots.content" #content>
      <slot name="content" />
    </template>
  </ElTooltip>
</template>

<script setup lang="ts">
import { ElTooltip } from 'element-plus';

// 提示层挂在页面根节点之外，外观由 global.less 控制。
defineOptions({ inheritAttrs: false });
</script>
