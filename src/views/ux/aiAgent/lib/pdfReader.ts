import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { MAX_DOCUMENT_PAGES, MAX_ATTACHMENT_BYTES } from '../types';

// 字体/CMap 随 Vite 打包到同源静态资源，不从 CDN 读取；兼容原工程 Vite 4/5。
const pdfAssets = import.meta.glob('/node_modules/pdfjs-dist/{cmaps,standard_fonts}/*', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const PDF_READ_TIMEOUT_MS = 30_000;
class PdfBinaryDataFactory {
  async fetch({ kind, filename }: { kind: string; filename: string }): Promise<Uint8Array> {
    const folder =
      kind === 'cMapUrl' ? 'cmaps' : kind === 'standardFontDataUrl' ? 'standard_fonts' : '';
    const url = folder && pdfAssets[`/node_modules/pdfjs-dist/${folder}/${filename}`];
    if (!url) throw new Error('PDF_RESOURCE_UNAVAILABLE');
    const response = await fetch(url);
    if (!response.ok) throw new Error('PDF_RESOURCE_UNAVAILABLE');
    return new Uint8Array(await response.arrayBuffer());
  }
}
export async function readPdfFile(file: File): Promise<string> {
  // 主解析库只在首次上传 PDF 时加载；仅读取文本层，不渲染页面或启动 OCR。
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    BinaryDataFactory: PdfBinaryDataFactory,
    useWorkerFetch: false,
    useWasm: false,
    disableFontFace: true,
    disableWorkerRendering: true,
    stopAtErrors: true,
  });
  const timeout = setTimeout(() => {
    void task.destroy().catch(() => undefined);
  }, PDF_READ_TIMEOUT_MS);
  try {
    const document = await task.promise;
    if (document.numPages > MAX_DOCUMENT_PAGES) throw new Error('DOCUMENT_PAGES');
    const pages: string[] = [];
    let bytes = 0,
      hasText = false;
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      try {
        const content = await page.getTextContent();
        let text = '',
          previousY: number | undefined;
        for (const item of content.items) {
          if (!('str' in item)) continue;
          const y = item.transform[5];
          // 优先使用 PDF 的行结束标记；无标记时按基线变化保留换行。
          if (
            text &&
            !text.endsWith('\n') &&
            previousY !== undefined &&
            Math.abs(y - previousY) > Math.max(2, item.height * 0.5)
          )
            text += '\n';
          else if (text && !/\s$/.test(text) && item.str && !/^\s/.test(item.str)) text += ' ';
          text += item.str + (item.hasEOL ? '\n' : '');
          previousY = y;
        }
        text = text.trim();
        hasText ||= !!text;
        const block = `## ${number}\n${text}`;
        bytes += new TextEncoder().encode(block).length;
        if (bytes > MAX_ATTACHMENT_BYTES) throw new Error('ATTACHMENT_SIZE');
        pages.push(block);
      } finally {
        page.cleanup();
      }
    }
    // 无文本层不能当作解析成功；由既有空内容提示拒绝加入附件。
    return hasText ? pages.join('\n\n') : '';
  } finally {
    clearTimeout(timeout);
    await task.destroy();
  }
}
