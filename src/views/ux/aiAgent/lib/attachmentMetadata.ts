import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_TOTAL,
} from '../types';
import type { TextAttachment } from '../types';
import { isRecord } from './records';
import { uid } from './identity';

export function validAttachmentName(name: string) {
  return ATTACHMENT_ACCEPT.split(',').some((ext) => name.toLowerCase().endsWith(ext));
}
export function readAttachments(value: unknown): TextAttachment[] {
  if (!Array.isArray(value)) return [];
  const result: TextAttachment[] = [];
  let total = 0;
  for (const file of value) {
    if (result.length >= MAX_ATTACHMENTS) break;
    // 停止接收新 TSV，但已保存的历史附件仍可阅读，避免升级后丢失原内容。
    if (
      !isRecord(file) ||
      typeof file.name !== 'string' ||
      typeof file.content !== 'string' ||
      !(validAttachmentName(file.name) || /\.tsv$/i.test(file.name))
    )
      continue;
    if (
      !file.content.trim() ||
      file.content.includes('\0') ||
      file.content.length > MAX_ATTACHMENT_BYTES
    )
      continue;
    const size = new TextEncoder().encode(file.content).length;
    if (size > MAX_ATTACHMENT_BYTES || total + size > MAX_ATTACHMENT_TOTAL) continue;
    result.push({
      id: typeof file.id === 'string' ? file.id : uid(),
      name: file.name.slice(0, 240),
      content: file.content,
      size,
    });
    total += size;
  }
  return result;
}
export function attachmentRequestContent(question: string, files: TextAttachment[]) {
  if (!files.length) return question;
  // 请求格式保持为原接口的纯文本 content；文件用 JSON 表达边界，显示与本地历史仍保留独立文件卡片。
  return `${question}\n\n<attached_files format="json">\n${JSON.stringify(
    files.map(({ name, content }) => ({ name, content })),
    null,
    2,
  )}\n</attached_files>`;
}
