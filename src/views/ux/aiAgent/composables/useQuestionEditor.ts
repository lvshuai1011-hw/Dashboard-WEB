import { computed, nextTick, reactive, type Ref } from 'vue';
import type { InputInstance } from 'element-plus';
import type { ChatMessage, Conversation, TextAttachment } from '../types';

export function useQuestionEditor(options: {
  activeId: Ref<string>;
  current: Ref<Conversation>;
  messages: Ref<ChatMessage[]>;
  draft: Ref<string>;
  draftAttachments: Ref<TextAttachment[]>;
  attachmentReading: Ref<boolean>;
  isStreaming: () => boolean;
  inputRef: Ref<InputInstance | undefined>;
  scheduleSave: () => void;
}) {
  const {
    activeId,
    current,
    messages,
    draft,
    draftAttachments,
    attachmentReading,
    inputRef,
    scheduleSave,
  } = options;
  // 编辑先进入输入框，提交前不改动任何已发送消息。每个会话独立保存编辑目标与原草稿。
  const questionEdits = reactive(
    new Map<string, { userId: string; draft: string; attachments: TextAttachment[] }>(),
  );
  const editingMessageId = computed(() => questionEdits.get(activeId.value)?.userId || '');
  function editQuestion(message: ChatMessage) {
    if (options.isStreaming() || attachmentReading.value) return;
    const index = messages.value.indexOf(message);
    const question = message.role === 'user' ? message : messages.value[index - 1];
    if (!question || question.role !== 'user') return;
    const prior = questionEdits.get(activeId.value);
    // Preserve a pending draft, including attachments, so Cancel restores it instead of silently discarding it.
    questionEdits.set(activeId.value, {
      userId: question.id,
      draft: prior?.draft ?? draft.value,
      attachments: prior?.attachments ?? draftAttachments.value.map((file) => ({ ...file })),
    });
    current.value.attachments = (question.attachments || []).map((file) => ({ ...file }));
    draft.value = question.content;
    void nextTick(() => inputRef.value?.focus());
  }
  function cancelQuestionEdit() {
    const edit = questionEdits.get(activeId.value);
    if (!edit || attachmentReading.value) return;
    current.value.draft = edit.draft;
    current.value.attachments = edit.attachments;
    questionEdits.delete(activeId.value);
    scheduleSave();
    void nextTick(() => inputRef.value?.focus());
  }
  return { questionEdits, editingMessageId, editQuestion, cancelQuestionEdit };
}
