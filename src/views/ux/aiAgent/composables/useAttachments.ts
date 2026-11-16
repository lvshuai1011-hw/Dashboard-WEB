import { computed, reactive, ref, type Ref } from 'vue';
import { readPdfFile, readOfficeFile, validAttachmentName } from '../lib/attachmentReaders';
import { uid } from '../lib/identity';
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_TOTAL, MAX_DOCUMENT_PAGES } from '../types';
import type { ComposerTranslation, Conversation, TextAttachment } from '../types';

export function useAttachments({ current, activeId, conversations, locale, t, scheduleSave, isDisposed }: {
  current: Ref<Conversation>;
  activeId: Ref<string>;
  conversations: Ref<Conversation[]>;
  locale: Ref<string>;
  t: ComposerTranslation;
  scheduleSave: () => void;
  isDisposed: () => boolean;
}) {
  const attachmentPreview = ref<TextAttachment | null>(null);
  const attachmentDragDepth = ref(0);
  const attachmentReadingIds = reactive(new Set<string>());
  const attachmentErrors = reactive(new Map<string, string>());
  const draftAttachments = computed(() => current.value.attachments || []);
  const attachmentReading = computed(() => attachmentReadingIds.has(activeId.value));
  const attachmentError = computed(() => attachmentErrors.get(activeId.value) || '');
  // 用户指定“添加附件”与简短格式说明；本地中英副本避免依赖不可修改的外部语言包。
  // Word/Excel/PowerPoint 对应 DOCX/XLSX/PPTX，仍不接收旧 DOC/XLS。
  const attachmentCopy = computed(() => locale.value.toLowerCase().startsWith('zh') ? {
    add: '添加附件',
    formatsTitle: '支持的文件格式',
    formatsSummary: '支持 .pdf / .docx / .xlsx / .pptx / .csv / .txt / .md / .json',
    formats: '支持 PDF/Word/Excel/PowerPoint/CSV/TXT/Markdown/JSON',
    limits: `每条问题最多添加 ${MAX_ATTACHMENTS} 个文件，每个文件不超过 ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB。`,
    countError: `每条问题最多添加 ${MAX_ATTACHMENTS} 个文件。`,
  } : {
    add: 'Add attachments',
    formatsTitle: 'Supported file formats',
    formatsSummary: 'Supports .pdf / .docx / .xlsx / .pptx / .csv / .txt / .md / .json',
    formats: 'Supports PDF, Word, Excel, PowerPoint, CSV, TXT, Markdown and JSON.',
    limits: `Up to ${MAX_ATTACHMENTS} files per question, ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB per file.`,
    countError: `Add up to ${MAX_ATTACHMENTS} files per question.`,
  });
  const attachmentHint = computed(() => attachmentCopy.value.formats);
  function removeAttachment(id: string) { current.value.attachments = draftAttachments.value.filter(file => file.id !== id); scheduleSave(); }
  async function addAttachments(files: File[]) {
    const chat = current.value;
    if (isDisposed() || attachmentReadingIds.has(chat.id) || !files.length) return;
    attachmentReadingIds.add(chat.id); attachmentErrors.delete(chat.id);
    const errors: string[] = [];
    try {
      for (const file of files) {
        if (isDisposed() || !conversations.value.includes(chat)) break;
        const reject = (message: string) => { errors.push(`${file.name}: ${message}`); };
        if (!validAttachmentName(file.name)) { reject(t('CM.COMMON.UPLOAD_FILE_FORMAT', { format: ATTACHMENT_ACCEPT })); continue; }
        if (!file.size) { reject(t('SYS.VALIDATOR.FILE_EMPTY')); continue; }
        const isOffice = /\.(docx|xlsx|pptx)$/i.test(file.name), isPdf = /\.pdf$/i.test(file.name);
        if (file.size > MAX_ATTACHMENT_BYTES) { reject(t('CM.COMMON.UPLOAD_FILE_SIZE', { size: `${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB` })); continue; }
        try {
          const content = isPdf ? await readPdfFile(file) : isOffice ? await readOfficeFile(file) : new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
          if (isDisposed() || !conversations.value.includes(chat)) break;
          if (!content.trim()) { reject(t(isOffice || isPdf ? 'AIAGENT.CHART.NO_DATA' : 'SYS.VALIDATOR.FILE_EMPTY')); continue; }
          if (content.includes('\0')) { reject(t('CM.COMMON.UPLOAD_FILE_FORMAT', { format: 'UTF-8' })); continue; }
          const existing = chat.attachments || [];
          if (existing.some(item => item.name === file.name && item.content === content)) continue;
          if (existing.length >= MAX_ATTACHMENTS) { reject(attachmentCopy.value.countError); continue; }
          const size = new TextEncoder().encode(content).length;
          if (size > MAX_ATTACHMENT_BYTES || existing.reduce((sum, item) => sum + item.size, 0) + size > MAX_ATTACHMENT_TOTAL) { reject(t('CM.COMMON.UPLOAD_FILE_SIZE', { size: `${size > MAX_ATTACHMENT_BYTES ? MAX_ATTACHMENT_BYTES / 1024 / 1024 : MAX_ATTACHMENT_TOTAL / 1024 / 1024} MB` })); continue; }
          chat.attachments = [...existing, { id: uid(), name: file.name.slice(0, 240), size, content }]; scheduleSave();
        } catch (error) {
          reject(error instanceof Error && error.message === 'ATTACHMENT_SIZE'
            ? t('CM.COMMON.UPLOAD_FILE_SIZE', { size: `${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB` })
            : error instanceof Error && error.message === 'DOCUMENT_PAGES'
              ? t('CM.COMMON.LENGTH', { min: 1, max: MAX_DOCUMENT_PAGES })
              // 读取失败不误报为“必须为 PDF 格式”：密码保护/损坏/资源加载失败均可能发生。
              // 复用语言包已有文案；本轮不新增密码输入或扫描识别入口。
              : isPdf ? `${t('CM.COMMON.UPLOAD')} · ${t('AIAGENT.HISTORY.STATE.FAILED')}`
                : t('CM.COMMON.UPLOAD_FILE_FORMAT', { format: isOffice ? 'DOCX / XLSX / PPTX (Office Open XML)' : 'UTF-8' }));
        }
      }
    } finally {
      attachmentReadingIds.delete(chat.id);
      if (errors.length && conversations.value.includes(chat)) attachmentErrors.set(chat.id, errors.join('\n'));
    }
  }
  function onAttachmentChoose(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []); input.value = ''; void addAttachments(files);
  }
  function isFileDrag(event: DragEvent) { return Array.from(event.dataTransfer?.types || []).includes('Files'); }
  function onAttachmentDragEnter(event: DragEvent) { if (isFileDrag(event)) { event.preventDefault(); attachmentDragDepth.value++; } }
  function onAttachmentDragOver(event: DragEvent) { if (isFileDrag(event)) { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'; } }
  function onAttachmentDragLeave(event: DragEvent) { if (isFileDrag(event)) { event.preventDefault(); attachmentDragDepth.value = Math.max(0, attachmentDragDepth.value - 1); } }
  function onAttachmentDrop(event: DragEvent) { if (!isFileDrag(event)) return; event.preventDefault(); attachmentDragDepth.value = 0; void addAttachments(Array.from(event.dataTransfer?.files || [])); }
  function onAttachmentPaste(event: ClipboardEvent) { const files = Array.from(event.clipboardData?.files || []); if (files.length) { event.preventDefault(); void addAttachments(files); } }
  const previewAttachment = (file: TextAttachment | null) => { attachmentPreview.value = file; };
  const clearAttachmentError = () => attachmentErrors.delete(activeId.value);

  return { attachmentPreview, attachmentDragDepth, attachmentErrors, draftAttachments, attachmentReading, attachmentError, attachmentCopy, attachmentHint, removeAttachment, onAttachmentChoose, onAttachmentDragEnter, onAttachmentDragOver, onAttachmentDragLeave, onAttachmentDrop, onAttachmentPaste, previewAttachment, clearAttachmentError };
}
