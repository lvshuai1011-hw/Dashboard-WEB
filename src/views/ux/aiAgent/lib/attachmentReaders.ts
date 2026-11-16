import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_TOTAL, MAX_DOCUMENT_PAGES, MAX_OFFICE_EXPANDED_BYTES } from "../types";
import type { TextAttachment } from "../types";
import { isRecord } from "./records";
import { uid } from "./identity";
// ZIP 文件布局。偏移量以各自记录的起点为基准，整数按小端序读取。
const END_OF_CENTRAL_DIRECTORY = {
  SIGNATURE: 0x06054b50, FIXED_SIZE: 22, DISK_NUMBER: 4, DIRECTORY_DISK: 6,
  ENTRIES_ON_DISK: 8, ENTRY_COUNT: 10, DIRECTORY_SIZE: 12, DIRECTORY_OFFSET: 16, COMMENT_LENGTH: 20,
} as const;
const CENTRAL_DIRECTORY_ENTRY = {
  SIGNATURE: 0x02014b50, FIXED_SIZE: 46, FLAGS: 8, METHOD: 10, CRC: 16,
  PACKED_SIZE: 20, SIZE: 24, NAME_LENGTH: 28, EXTRA_LENGTH: 30, COMMENT_LENGTH: 32, LOCAL_HEADER_OFFSET: 42,
} as const;
const LOCAL_FILE_HEADER = {
  SIGNATURE: 0x04034b50, FIXED_SIZE: 30, FLAGS: 6, METHOD: 8, NAME_LENGTH: 26, EXTRA_LENGTH: 28,
} as const;
const MAX_ZIP_COMMENT_BYTES = 0xffff; // 注释长度占无符号 16 位。
const MAX_OFFICE_ZIP_ENTRIES = 4096; // 应用限制，用于约束解析工作量。
const ZIP64_SIZE_MARKER = 0xffffffff;
const ZIP_ENCRYPTED_FLAG = 1;
const ZIP_METHOD = { STORED: 0, DEFLATE: 8 } as const;
const CRC32_INITIAL = 0xffffffff;
const CRC32_REVERSED_POLYNOMIAL = 0xedb88320;
// 字体/CMap 随 Vite 打包到同源静态资源，不从 CDN 读取；兼容原工程 Vite 4/5。
const pdfAssets = import.meta.glob('/node_modules/pdfjs-dist/{cmaps,standard_fonts}/*', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
class PdfBinaryDataFactory {
  async fetch({ kind, filename }: { kind: string; filename: string }): Promise<Uint8Array> {
    const folder = kind === 'cMapUrl' ? 'cmaps' : kind === 'standardFontDataUrl' ? 'standard_fonts' : '';
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
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), BinaryDataFactory: PdfBinaryDataFactory,
    useWorkerFetch: false, useWasm: false, isEvalSupported: false, disableFontFace: true, disableWorkerRendering: true, stopAtErrors: true });
  const timeout = setTimeout(() => { void task.destroy().catch(() => undefined); }, 30000);
  try {
    const document = await task.promise;
    if (document.numPages > MAX_DOCUMENT_PAGES) throw new Error('DOCUMENT_PAGES');
    const pages: string[] = []; let bytes = 0, hasText = false;
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      try {
        const content = await page.getTextContent();
        let text = '', previousY: number | undefined;
        for (const item of content.items) {
          if (!('str' in item)) continue;
          const y = item.transform[5];
          // 优先使用 PDF 的行结束标记；无标记时按基线变化保留换行。
          if (text && !text.endsWith('\n') && previousY !== undefined && Math.abs(y - previousY) > Math.max(2, item.height * .5)) text += '\n';
          else if (text && !/\s$/.test(text) && item.str && !/^\s/.test(item.str)) text += ' ';
          text += item.str + (item.hasEOL ? '\n' : ''); previousY = y;
        }
        text = text.trim(); hasText ||= !!text;
        const block = `## ${number}\n${text}`;
        bytes += new TextEncoder().encode(block).length;
        if (bytes > MAX_ATTACHMENT_BYTES) throw new Error('ATTACHMENT_SIZE');
        pages.push(block);
      } finally { page.cleanup(); }
    }
    // 无文本层不能当作解析成功；由既有空内容提示拒绝加入附件。
    return hasText ? pages.join('\n\n') : '';
  } finally { clearTimeout(timeout); await task.destroy(); }
}
function officeFailure() { return new Error('INVALID_OFFICE_DOCUMENT'); }
function officePath(base: string, target: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.includes('\\')) throw officeFailure();
  const segments: string[] = [];
  for (const part of (target.startsWith('/') ? target.slice(1) : base + target).split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { if (!segments.length) throw officeFailure(); segments.pop(); }
    else segments.push(part);
  }
  return segments.join('/');
}
function xmlElements(root: Document | Element, name: string): Element[] { return Array.from(root.getElementsByTagNameNS('*', name)); }
function parseOfficeXml(text: string): Document {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw officeFailure();
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (xmlElements(doc, 'parsererror').length || !doc.documentElement) throw officeFailure();
  return doc;
}
function officeCrc(data: Uint8Array): number {
  let crc = CRC32_INITIAL;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? CRC32_REVERSED_POLYNOMIAL : 0);
  }
  return (crc ^ CRC32_INITIAL) >>> 0;
}
async function officeArchive(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  const entries = new Map<string, { offset: number; packed: number; size: number; method: number; crc: number }>();
  const uint16 = (p: number) => view.getUint16(p, true), uint32 = (p: number) => view.getUint32(p, true);
  const endRecord = END_OF_CENTRAL_DIRECTORY;
  const central = CENTRAL_DIRECTORY_ENTRY;
  const localHeader = LOCAL_FILE_HEADER;
  const lastPossibleEndRecord = bytes.length - endRecord.FIXED_SIZE;
  const firstPossibleEndRecord = Math.max(0, lastPossibleEndRecord - MAX_ZIP_COMMENT_BYTES);
  let end = -1;
  for (let position = lastPossibleEndRecord; position >= firstPossibleEndRecord; position--) {
    if (uint32(position) !== endRecord.SIGNATURE) continue;
    const commentLength = uint16(position + endRecord.COMMENT_LENGTH);
    if (position + endRecord.FIXED_SIZE + commentLength === bytes.length) {
      end = position;
      break;
    }
  }
  // Office 附件使用单卷 ZIP，两个磁盘编号都应为零。
  if (end < 0 || uint16(end + endRecord.DISK_NUMBER) || uint16(end + endRecord.DIRECTORY_DISK)) throw officeFailure();
  const count = uint16(end + endRecord.ENTRY_COUNT);
  const directorySize = uint32(end + endRecord.DIRECTORY_SIZE);
  const directoryOffset = uint32(end + endRecord.DIRECTORY_OFFSET);
  const directoryEnd = directoryOffset + directorySize;
  if (count !== uint16(end + endRecord.ENTRIES_ON_DISK) || count > MAX_OFFICE_ZIP_ENTRIES || directoryEnd > end) {
    throw officeFailure();
  }

  let offset = directoryOffset;
  let total = 0;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  for (let index = 0; index < count; index++) {
    const nameOffset = offset + central.FIXED_SIZE;
    if (nameOffset > end || uint32(offset) !== central.SIGNATURE) throw officeFailure();
    const flags = uint16(offset + central.FLAGS);
    const method = uint16(offset + central.METHOD);
    const crc = uint32(offset + central.CRC);
    const packed = uint32(offset + central.PACKED_SIZE);
    const size = uint32(offset + central.SIZE);
    const nameLength = uint16(offset + central.NAME_LENGTH);
    const next = nameOffset + nameLength + uint16(offset + central.EXTRA_LENGTH) + uint16(offset + central.COMMENT_LENGTH);
    const local = uint32(offset + central.LOCAL_HEADER_OFFSET);
    if ((flags & ZIP_ENCRYPTED_FLAG) || next > directoryEnd || size === ZIP64_SIZE_MARKER
      || packed === ZIP64_SIZE_MARKER || local + localHeader.FIXED_SIZE > directoryOffset) throw officeFailure();
    const name = officePath('', decoder.decode(bytes.subarray(nameOffset, nameOffset + nameLength)));
    if (entries.has(name)) throw officeFailure();
    total += size;
    if (total > MAX_OFFICE_EXPANDED_BYTES) throw new Error('ATTACHMENT_SIZE');
    if (uint32(local) !== localHeader.SIGNATURE || uint16(local + localHeader.METHOD) !== method || (uint16(local + localHeader.FLAGS) & ZIP_ENCRYPTED_FLAG)) throw officeFailure();
    const dataOffset = local + localHeader.FIXED_SIZE + uint16(local + localHeader.NAME_LENGTH) + uint16(local + localHeader.EXTRA_LENGTH);
    if (dataOffset + packed > directoryOffset) throw officeFailure();
    entries.set(name, { offset: dataOffset, packed, size, method, crc });
    offset = next;
  }
  if (offset !== directoryEnd) throw officeFailure();
  const cache = new Map<string, Document>();
  return async (path: string, optional = false): Promise<Document | undefined> => {
    if (cache.has(path)) return cache.get(path);
    const entry = entries.get(path);
    if (!entry) { if (optional) return undefined; throw officeFailure(); }
    const packed = bytes.slice(entry.offset, entry.offset + entry.packed);
    let output: Uint8Array;
    if (entry.method === ZIP_METHOD.STORED) output = packed;
    else if (entry.method === ZIP_METHOD.DEFLATE && typeof DecompressionStream !== 'undefined') {
      const reader = new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
      const chunks: Uint8Array[] = []; let length = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > entry.size || length > MAX_OFFICE_EXPANDED_BYTES) { await reader.cancel(); throw new Error('ATTACHMENT_SIZE'); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      output = new Uint8Array(length); let cursor = 0;
      for (const chunk of chunks) { output.set(chunk, cursor); cursor += chunk.byteLength; }
    } else throw officeFailure();
    if (output.length !== entry.size || officeCrc(output) !== entry.crc) throw officeFailure();
    const doc = parseOfficeXml(decoder.decode(output)); cache.set(path, doc); return doc;
  };
}
function wordText(node: Element): string {
  if (node.localName === 'del' || node.localName === 'instrText') return '';
  if (node.localName === 't') return node.textContent || '';
  if (node.localName === 'tab') return '\t';
  if (node.localName === 'br' || node.localName === 'cr') return '\n';
  return Array.from(node.children).map(wordText).join('');
}
function wordBlocks(root: Element): string[] {
  const result: string[] = [];
  for (const child of Array.from(root.children)) {
    if (child.localName === 'p') result.push(wordText(child));
    else if (child.localName === 'tbl') {
      const rows = Array.from(child.children).filter(el => el.localName === 'tr');
      result.push(rows.map(row => Array.from(row.children).filter(el => el.localName === 'tc').map(cell => wordBlocks(cell).join(' / ')).join('\t')).join('\n'));
    } else if (child.localName !== 'del') result.push(...wordBlocks(child));
  }
  return result;
}
function presentationText(root: Element): string {
  return xmlElements(root, 'p').map(paragraph => Array.from(paragraph.children).map(part => part.localName === 'br' ? '\n' : xmlElements(part, 't').map(text => text.textContent || '').join('')).join('')).join('\n').trim();
}
function presentationBlocks(root: Element): string[] {
  const blocks: string[] = [];
  for (const shape of Array.from(root.children)) {
    if (shape.localName === 'sp') {
      const placeholder = xmlElements(shape, 'ph')[0]?.getAttribute('type');
      // 跳过自动页码、日期、页眉页脚及备注中的幻灯片缩略图占位。
      if (['sldNum', 'dt', 'hdr', 'ftr', 'sldImg'].includes(placeholder || '')) continue;
      const body = Array.from(shape.children).find(child => child.localName === 'txBody');
      if (body) blocks.push(presentationText(body));
    } else if (shape.localName === 'graphicFrame') {
      for (const table of xmlElements(shape, 'tbl')) {
        blocks.push(Array.from(table.children).filter(row => row.localName === 'tr').map(row =>
          Array.from(row.children).filter(cell => cell.localName === 'tc').map(cell => presentationText(cell).replace(/\n/g, ' / ')).join('\t')).join('\n'));
      }
    } else if (shape.localName === 'grpSp') blocks.push(...presentationBlocks(shape));
  }
  return blocks.filter(block => block.trim());
}
async function readPresentation(read: Awaited<ReturnType<typeof officeArchive>>): Promise<string> {
  const presentation = await read('ppt/presentation.xml'), relationships = await read('ppt/_rels/presentation.xml.rels');
  if (!presentation || !relationships) throw officeFailure();
  const slides = xmlElements(presentation, 'sldId'), rels = xmlElements(relationships, 'Relationship');
  if (slides.length > MAX_DOCUMENT_PAGES) throw new Error('DOCUMENT_PAGES');
  const output: string[] = []; let bytes = 0, hasText = false;
  // 按 presentation.xml 中的顺序读取，避免 slide10 / slide2 文件名排序错误。
  for (const [index, slide] of slides.entries()) {
    const id = slide.getAttribute('r:id') || Array.from(slide.attributes).find(attr => attr.localName === 'id')?.value;
    const rel = rels.find(item => item.getAttribute('Id') === id);
    if (!rel || rel.getAttribute('TargetMode') === 'External' || !rel.getAttribute('Type')?.endsWith('/slide')) throw officeFailure();
    const path = officePath('ppt/', rel.getAttribute('Target') || '');
    if (!path.startsWith('ppt/slides/')) throw officeFailure();
    const xml = await read(path), root = xml && xmlElements(xml, 'spTree')[0];
    if (!root) throw officeFailure();
    const blocks = presentationBlocks(root);
    const slash = path.lastIndexOf('/');
    const slideRels = await read(`${path.slice(0, slash + 1)}_rels/${path.slice(slash + 1)}.rels`, true);
    const notesRel = slideRels && xmlElements(slideRels, 'Relationship').find(item => item.getAttribute('Type')?.endsWith('/notesSlide'));
    if (notesRel && notesRel.getAttribute('TargetMode') !== 'External') {
      const notesPath = officePath(path.slice(0, slash + 1), notesRel.getAttribute('Target') || '');
      if (!notesPath.startsWith('ppt/notesSlides/')) throw officeFailure();
      const notesXml = await read(notesPath), notesRoot = notesXml && xmlElements(notesXml, 'spTree')[0];
      // 备注以引用块跟在所属页后面；不增加界面文案或语言包键。
      if (notesRoot) blocks.push(...presentationBlocks(notesRoot).map(text => '> ' + text.replace(/\n/g, '\n> ')));
    }
    hasText ||= blocks.length > 0;
    const block = `## ${index + 1}\n${blocks.join('\n\n')}`;
    bytes += new TextEncoder().encode(block).length;
    if (bytes > MAX_ATTACHMENT_BYTES) throw new Error('ATTACHMENT_SIZE');
    output.push(block);
  }
  return hasText ? output.join('\n\n') : '';
}
function excelColumn(reference: string): number {
  const letters = /^([A-Z]+)[1-9]\d*$/i.exec(reference)?.[1];
  if (!letters) throw officeFailure();
  let column = 0;
  for (const letter of letters.toUpperCase()) column = column * 26 + letter.charCodeAt(0) - 64;
  if (column > 16384) throw officeFailure();
  return column - 1;
}
const MAX_SPREADSHEET_CELLS = 50_000;
const MAX_SPREADSHEET_COLUMN_INDEX = 1023; // 解析器接受从零开始的列索引，最多 1024 列。
const SECONDS_PER_DAY = 86_400;
const MILLISECONDS_PER_DAY = SECONDS_PER_DAY * 1000;
const EXCEL_1900_LEAP_DAY_SERIAL = 60; // Excel 的 1900 日期系统保留了一个虚构的 2 月 29 日。

function excelValue(raw: string, formatId: number, format: string, date1904: boolean): string {
  if (!raw || !Number.isFinite(Number(raw))) return raw;
  const value = Number(raw);
  // 引号/转义内容不是日期模式；内置日期格式和自定义日期格式均识别。
  const pattern = format.replace(/"[^"]*"|\\.|\[(?!h+\]|m+\]|s+\])[^\]]*\]/gi, '').toLowerCase();
  const isDate = (formatId >= 14 && formatId <= 22) || (formatId >= 27 && formatId <= 36) || (formatId >= 45 && formatId <= 47) || (formatId >= 50 && formatId <= 58) || /[ydhs]|m{2,}/.test(pattern);
  if (isDate) {
    const days = Math.floor(value), fraction = value - days;
    const hasTime = /[hs]/.test(pattern) || (formatId >= 18 && formatId <= 22) || (formatId >= 45 && formatId <= 47) || fraction !== 0;
    const timeOnly = /[hs]/.test(pattern) && !/[yd]/.test(pattern) || [18,19,20,21,45,46,47].includes(formatId);
    const seconds = Math.round(fraction * SECONDS_PER_DAY);
    const time = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':');
    if (timeOnly) return /\[h+\]/.test(pattern) || formatId === 46 ? `${Math.floor(value * 24)}:${time.slice(3)}` : time;
    const date = new Date(Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 31) + (days - (!date1904 && days >= EXCEL_1900_LEAP_DAY_SERIAL ? 1 : 0)) * MILLISECONDS_PER_DAY);
    if (!Number.isFinite(date.getTime())) return raw;
    const text = !date1904 && days === 60 ? '1900-02-29' : date.toISOString().slice(0, 10);
    return hasTime ? `${text} ${time}` : text;
  }
  if ([9,10].includes(formatId) || pattern.includes('%')) {
    const decimals = /\.([0#]+)%/.exec(pattern)?.[1].length ?? (formatId === 10 ? 2 : 0);
    return `${(value * 100).toFixed(Math.min(decimals, 10))}%`;
  }
  if (/^0{2,}$/.test(pattern) && Number.isInteger(value) && value >= 0) return raw.padStart(pattern.length, '0');
  return raw;
}
export async function readOfficeFile(file: File): Promise<string> {
  const read = await officeArchive(await file.arrayBuffer());
  if (/\.pptx$/i.test(file.name)) return readPresentation(read);
  if (/\.docx$/i.test(file.name)) {
    const doc = await read('word/document.xml');
    const body = doc && xmlElements(doc, 'body')[0];
    if (!body) throw officeFailure();
    return wordBlocks(body).join('\n\n').trim();
  }
  const workbook = await read('xl/workbook.xml'), relationships = await read('xl/_rels/workbook.xml.rels');
  if (!workbook || !relationships) throw officeFailure();
  const sharedXml = await read('xl/sharedStrings.xml', true), styles = await read('xl/styles.xml', true);
  const shared = sharedXml ? xmlElements(sharedXml, 'si').map(item => xmlElements(item, 't').filter(text => text.parentElement?.localName !== 'rPh').map(text => text.textContent || '').join('')) : [];
  const formats = new Map(styles ? xmlElements(styles, 'numFmt').map(el => [Number(el.getAttribute('numFmtId')), el.getAttribute('formatCode') || '']) : []);
  const styleRoot = styles && xmlElements(styles, 'cellXfs')[0];
  const styleIds = styleRoot ? Array.from(styleRoot.children).map(el => Number(el.getAttribute('numFmtId') || 0)) : [];
  const date1904 = ['1', 'true'].includes(xmlElements(workbook, 'workbookPr')[0]?.getAttribute('date1904') || '');
  const rels = xmlElements(relationships, 'Relationship');
  const sheets = xmlElements(workbook, 'sheet'), output: string[] = [];
  if (!sheets.length || sheets.length > 100) throw officeFailure();
  let cellCount = 0, textBytes = 0;
  for (const sheet of sheets) {
    const id = sheet.getAttribute('r:id') || Array.from(sheet.attributes).find(attr => attr.localName === 'id')?.value;
    const rel = rels.find(item => item.getAttribute('Id') === id);
    if (!rel || rel.getAttribute('TargetMode') === 'External') throw officeFailure();
    // Chartsheets have no cells; do not confuse a chart-only workbook with a readable data table.
    if (!rel.getAttribute('Type')?.endsWith('/worksheet')) continue;
    const path = officePath('xl/', rel.getAttribute('Target') || '');
    if (!path.startsWith('xl/worksheets/')) throw officeFailure();
    const xml = await read(path); if (!xml) throw officeFailure();
    const sheetData = xmlElements(xml, 'sheetData')[0]; if (!sheetData) throw officeFailure();
    const rows: string[] = []; let previousRow = 0, maxColumns = 0;
    for (const row of Array.from(sheetData.children).filter(el => el.localName === 'row')) {
      const rowNumber = Number(row.getAttribute('r') || previousRow + 1);
      if (!Number.isInteger(rowNumber) || rowNumber <= previousRow || rowNumber > 1048576) throw officeFailure();
      // Explicit row numbers retain sparse row locations without allocating millions of empty rows.
      const cells: string[] = []; let previousColumn = -1;
      for (const cell of Array.from(row.children).filter(el => el.localName === 'c')) {
        if (++cellCount > MAX_SPREADSHEET_CELLS) throw new Error('ATTACHMENT_SIZE');
        const address = cell.getAttribute('r'), column = address ? excelColumn(address) : previousColumn + 1;
        if (column <= previousColumn || column > MAX_SPREADSHEET_COLUMN_INDEX) throw new Error('ATTACHMENT_SIZE');
        if (address && Number(/\d+$/.exec(address)?.[0]) !== rowNumber) throw officeFailure();
        previousColumn = column;
        const type = cell.getAttribute('t'), value = xmlElements(cell, 'v')[0]?.textContent || '';
        let text = value;
        if (type === 's') {
          if (!/^\d+$/.test(value) || Number(value) >= shared.length) throw officeFailure();
          text = shared[Number(value)];
        } else if (type === 'inlineStr') text = xmlElements(cell, 't').map(part => part.textContent || '').join('');
        else if (type === 'b') text = value === '1' ? 'TRUE' : 'FALSE';
        else if (!type || type === 'n') {
          const formatId = styleIds[Number(cell.getAttribute('s') || 0)] || 0;
          text = excelValue(value, formatId, formats.get(formatId) || '', date1904);
        }
        // Formula values are cached by Excel; if not cached, preserve the literal formula and never invent a result.
        if (!text && xmlElements(cell, 'f').length) text = `=${xmlElements(cell, 'f')[0].textContent || ''}`;
        cells[column] = /[\t\r\n"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        textBytes += new TextEncoder().encode(text).length;
        if (textBytes > MAX_ATTACHMENT_BYTES) throw new Error('ATTACHMENT_SIZE');
      }
      if (cells.length) {
        maxColumns = Math.max(maxColumns, cells.length);
        const line = `${rowNumber}\t${Array.from({ length: cells.length }, (_, index) => cells[index] || '').join('\t')}`;
        textBytes += line.length - cells.filter(Boolean).join('').length;
        if (textBytes > MAX_ATTACHMENT_BYTES) throw new Error('ATTACHMENT_SIZE');
        rows.push(line);
      }
      previousRow = rowNumber;
    }
    if (rows.length) {
      const columns = Array.from({ length: maxColumns }, (_, index) => {
        let number = index + 1, name = '';
        while (number) { number--; name = String.fromCharCode(65 + number % 26) + name; number = Math.floor(number / 26); }
        return name;
      });
      output.push(`## ${sheet.getAttribute('name') || sheet.getAttribute('sheetId') || ''}\n#\t${columns.join('\t')}\n${rows.join('\n')}`);
    }
  }
  return output.join('\n\n');
}

export function validAttachmentName(name: string) { return ATTACHMENT_ACCEPT.split(',').some(ext => name.toLowerCase().endsWith(ext)); }
export function readAttachments(value: unknown): TextAttachment[] {
  if (!Array.isArray(value)) return [];
  const result: TextAttachment[] = []; let total = 0;
  for (const file of value) {
    if (result.length >= MAX_ATTACHMENTS) break;
    // 停止接收新 TSV，但已保存的历史附件仍可阅读，避免升级后丢失原内容。
    if (!isRecord(file) || typeof file.name !== 'string' || typeof file.content !== 'string' || !(validAttachmentName(file.name) || /\.tsv$/i.test(file.name))) continue;
    if (!file.content.trim() || file.content.includes('\0') || file.content.length > MAX_ATTACHMENT_BYTES) continue;
    const size = new TextEncoder().encode(file.content).length;
    if (size > MAX_ATTACHMENT_BYTES || total + size > MAX_ATTACHMENT_TOTAL) continue;
    result.push({ id: typeof file.id === 'string' ? file.id : uid(), name: file.name.slice(0, 240), content: file.content, size }); total += size;
  }
  return result;
}
export function attachmentRequestContent(question: string, files: TextAttachment[]) {
  if (!files.length) return question;
  // 请求格式保持为原接口的纯文本 content；文件用 JSON 表达边界，显示与本地历史仍保留独立文件卡片。
  return `${question}\n\n<attached_files format="json">\n${JSON.stringify(files.map(({ name, content }) => ({ name, content })), null, 2)}\n</attached_files>`;
}
