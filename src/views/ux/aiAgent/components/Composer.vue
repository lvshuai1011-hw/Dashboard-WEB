<template>
<footer class="composer-region">
  <div class="composer" :class="{ 'is-streaming': streaming }" @paste="onAttachmentPaste">
    <!-- DOCX / XLSX / PDF / PPTX 在本地提取文本；仍通过现有 message.content 发送，无新增上传接口。 -->
    <input :ref="bindFileInput" hidden type="file" :accept="ATTACHMENT_ACCEPT" multiple tabindex="-1" :aria-label="attachmentCopy.add" @change="onAttachmentChoose" />
    <div v-if="editingMessageId" class="composer-editing"><span><el-icon><EditPen /></el-icon>{{ t('AIAGENT.BUTTON.EDIT_QUESTION') }}</span><button type="button" class="icon-button small" :aria-label="t('AIAGENT.BUTTON.CANCEL')" :title="t('AIAGENT.BUTTON.CANCEL')" @click="cancelQuestionEdit"><el-icon><Close /></el-icon></button></div>
    <div v-if="draftAttachments.length" class="attachment-list">
      <div v-for="file in draftAttachments" :key="file.id" class="file-chip removable">
        <button type="button" class="file-open" :title="file.name" @click="previewAttachment(file)"><el-icon><Document /></el-icon><span>{{ file.name }}</span></button>
        <button type="button" class="file-remove" :aria-label="`${t('CM.COMMON.DELETE')} ${file.name}`" :title="t('CM.COMMON.DELETE')" @click="removeAttachment(file.id)"><el-icon><Close /></el-icon></button>
      </div>
    </div>
    <p v-if="attachmentError" class="attachment-error" role="alert"><span>{{ attachmentError }}</span><button type="button" class="icon-button small" :aria-label="t('CM.COMMON.CLOSE')" @click="clearAttachmentError()"><el-icon><Close /></el-icon></button></p>
    <el-input :ref="value => registerInput(value)" :model-value="draft" @update:model-value="updateDraft" type="textarea" resize="none" :autosize="{ minRows: messages.length ? 1 : 2, maxRows: 8 }" :placeholder="t('AIAGENT.INPUT.PLACEHOLDER')" :aria-label="t('AIAGENT.INPUT.LABEL')" @keydown="onInputKeydown" />
    <div class="composer-toolbar">
      <el-tooltip placement="top-start" :trigger="['hover', 'focus']">
        <template #content><div class="tooltip-text">{{ attachmentCopy.limits }}<br />{{ attachmentCopy.formatsSummary }}</div></template>
        <button type="button" class="attach-button" :disabled="attachmentReading" :aria-label="attachmentCopy.add" @click="fileInput?.click()"><el-icon><Paperclip /></el-icon><span>{{ attachmentCopy.add }}</span><em v-if="draftAttachments.length">{{ draftAttachments.length }}</em></button>
      </el-tooltip>
      <span v-if="attachmentReading" class="composer-hint" role="status">{{ t('CM.COMMON.UPLOADING_FILE') }}</span>
      <span v-else-if="streaming" class="composer-hint">{{ t('AIAGENT.INPUT.NEXT_DRAFT') }}</span>
      <span class="spacer" />
      <el-tooltip v-if="streaming" :content="t('AIAGENT.BUTTON.STOP')"><button type="button" class="send-button stop" :aria-label="t('AIAGENT.BUTTON.STOP')" @click="stopGeneration()"><el-icon><StopIcon /></el-icon></button></el-tooltip>
      <el-tooltip v-else :content="t(editingMessageId ? 'AIAGENT.BUTTON.REGENERATE' : 'AIAGENT.BUTTON.SEND')"><button type="button" class="send-button" :disabled="!draft.trim() || attachmentReading" :aria-label="t(editingMessageId ? 'AIAGENT.BUTTON.REGENERATE' : 'AIAGENT.BUTTON.SEND')" @click="sendMessage"><el-icon><component :is="editingMessageId ? RefreshRight : Top" /></el-icon></button></el-tooltip>
    </div>
  </div>
  <!-- 示例问题：直接展示完整问题，不依赖专属图标；增删问题只需改 welcomeExamples 与语言包文案。 -->
  <div v-if="!messages.length" class="examples">
    <p class="examples-label">{{ uiCopy.tryAsking }}</p>
    <button v-for="(key, index) in welcomeExamples" :key="key" type="button" class="example" :style="{ '--i': index }" @click="setDraft(t(`AIAGENT.EXAMPLE.${key}.PROMPT`))">
      <span class="example-text">{{ t(`AIAGENT.EXAMPLE.${key}.PROMPT`) }}</span>
      <span class="example-hint" aria-hidden="true">{{ uiCopy.fill }}<el-icon><FillIcon /></el-icon></span>
    </button>
  </div>
</footer>
</template>

<script setup lang="ts">
import { Close, Document, EditPen, Paperclip, Top, RefreshRight } from "@element-plus/icons-vue";
import { FillIcon, StopIcon } from "../lib/icons";
import { ATTACHMENT_ACCEPT } from "../types";
import { useI18n } from "vue-i18n";
const { t } = useI18n();
import type { TextAttachment } from "../types";
import type { useUiCopy } from "../composables/useUiCopy";
defineProps<{
  streaming: boolean;
  attachmentReading: boolean;
  draft: string;
  editingMessageId: string;
  attachmentError: string;
  messages: ChatMessage[];
  draftAttachments: TextAttachment[];
  uiCopy: ReturnType<typeof useUiCopy>["value"];
  attachmentCopy: { add: string; limits: string; formatsSummary: string };
}>();
const emit = defineEmits<{
  sendMessage: [];
  stopGeneration: [];
  cancelQuestionEdit: [];
  clearAttachmentError: [];
  setDraft: [value: string];
  removeAttachment: [id: string];
  onAttachmentChoose: [event: Event];
  onAttachmentPaste: [event: ClipboardEvent];
  onInputKeydown: [event: Event | KeyboardEvent];
  previewAttachment: [file: TextAttachment | null];
  registerInput: [value: unknown];
  updateDraft: [value: string];
}>();
const sendMessage = (...args: []) => emit("sendMessage", ...args);
const stopGeneration = (...args: []) => emit("stopGeneration", ...args);
const cancelQuestionEdit = (...args: []) => emit("cancelQuestionEdit", ...args);
const clearAttachmentError = (...args: []) => emit("clearAttachmentError", ...args);
const setDraft = (...args: [value: string]) => emit("setDraft", ...args);
const removeAttachment = (...args: [id: string]) => emit("removeAttachment", ...args);
const onAttachmentChoose = (...args: [event: Event]) => emit("onAttachmentChoose", ...args);
const onAttachmentPaste = (...args: [event: ClipboardEvent]) => emit("onAttachmentPaste", ...args);
const onInputKeydown = (...args: [event: Event | KeyboardEvent]) => emit("onInputKeydown", ...args);
const previewAttachment = (...args: [file: TextAttachment | null]) => emit("previewAttachment", ...args);
const registerInput = (...args: [value: unknown]) => emit("registerInput", ...args);
const updateDraft = (...args: [value: string]) => emit("updateDraft", ...args);
const welcomeExamples = ['ONE', 'TWO', 'THREE'];
let fileInput: HTMLInputElement | undefined;
function bindFileInput(value: unknown) {
  fileInput = value instanceof HTMLInputElement ? value : undefined;
}
</script>
