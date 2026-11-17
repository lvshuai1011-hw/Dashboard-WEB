<template>
  <el-dialog
    :model-value="!!pendingDelete"
    width="420px"
    :append-to-body="false"
    :show-close="false"
    align-center
    class="agent-confirm"
    @update:model-value="
      (value) => {
        if (!value) emit('setPendingDelete', null);
      }
    "
  >
    <template #header>
      <h3 class="confirm-title">{{ uiCopy.deleteTitle }}</h3>
    </template>
    <p class="confirm-body">
      {{ uiCopy.deleteBody(pendingDelete?.title || t('AIAGENT.HISTORY.UNTITLED')) }}
    </p>
    <template #footer>
      <button type="button" class="dialog-button" @click="emit('setPendingDelete', null)">
        {{ t('AIAGENT.BUTTON.CANCEL') }}
      </button>
      <button type="button" class="dialog-button danger" @click="emit('confirmDelete')">
        {{ t('AIAGENT.HISTORY.DELETE') }}
      </button>
    </template>
  </el-dialog>
  <el-dialog
    :model-value="!!attachmentPreview"
    :title="attachmentPreview?.name || t('CM.COMMON.PREVIEW')"
    width="min(760px, 92vw)"
    :append-to-body="false"
    class="agent-preview"
    @update:model-value="
      (value) => {
        if (!value) emit('previewAttachment', null);
      }
    "
  >
    <pre class="attachment-content">{{ attachmentPreview?.content }}</pre>
  </el-dialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import type { Conversation, TextAttachment } from '../types';
import type { useUiCopy } from '../composables/useUiCopy';
defineProps<{
  pendingDelete: Conversation | null;
  attachmentPreview: TextAttachment | null;
  uiCopy: ReturnType<typeof useUiCopy>['value'];
}>();
const emit = defineEmits<{
  confirmDelete: [];
  previewAttachment: [file: TextAttachment | null];
  setPendingDelete: [chat: Conversation | null];
}>();
</script>
