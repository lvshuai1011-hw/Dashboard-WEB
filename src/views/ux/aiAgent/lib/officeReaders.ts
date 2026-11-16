import { excelValue } from './spreadsheetFormats';
import { MAX_DOCUMENT_PAGES, MAX_ATTACHMENT_BYTES } from '../types';
import { officeArchive } from './officeArchive';
import { officeFailure, officePath, xmlElements } from './officeXml';

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
      const rows = Array.from(child.children).filter((el) => el.localName === 'tr');
      result.push(
        rows
          .map((row) =>
            Array.from(row.children)
              .filter((el) => el.localName === 'tc')
              .map((cell) => wordBlocks(cell).join(' / '))
              .join('\t'),
          )
          .join('\n'),
      );
    } else if (child.localName !== 'del') result.push(...wordBlocks(child));
  }
  return result;
}
function presentationText(root: Element): string {
  return xmlElements(root, 'p')
    .map((paragraph) =>
      Array.from(paragraph.children)
        .map((part) =>
          part.localName === 'br'
            ? '\n'
            : xmlElements(part, 't')
                .map((text) => text.textContent || '')
                .join(''),
        )
        .join(''),
    )
    .join('\n')
    .trim();
}
function presentationBlocks(root: Element): string[] {
  const blocks: string[] = [];
  for (const shape of Array.from(root.children)) {
    if (shape.localName === 'sp') {
      const placeholder = xmlElements(shape, 'ph')[0]?.getAttribute('type');
      // 跳过自动页码、日期、页眉页脚及备注中的幻灯片缩略图占位。
      if (['sldNum', 'dt', 'hdr', 'ftr', 'sldImg'].includes(placeholder || '')) continue;
      const body = Array.from(shape.children).find((child) => child.localName === 'txBody');
      if (body) blocks.push(presentationText(body));
    } else if (shape.localName === 'graphicFrame') {
      for (const table of xmlElements(shape, 'tbl')) {
        blocks.push(
          Array.from(table.children)
            .filter((row) => row.localName === 'tr')
            .map((row) =>
              Array.from(row.children)
                .filter((cell) => cell.localName === 'tc')
                .map((cell) => presentationText(cell).replace(/\n/g, ' / '))
                .join('\t'),
            )
            .join('\n'),
        );
      }
    } else if (shape.localName === 'grpSp') blocks.push(...presentationBlocks(shape));
  }
  return blocks.filter((block) => block.trim());
}
async function readPresentation(read: Awaited<ReturnType<typeof officeArchive>>): Promise<string> {
  const presentation = await read('ppt/presentation.xml'),
    relationships = await read('ppt/_rels/presentation.xml.rels');
  if (!presentation || !relationships) throw officeFailure();
  const slides = xmlElements(presentation, 'sldId'),
    rels = xmlElements(relationships, 'Relationship');
  if (slides.length > MAX_DOCUMENT_PAGES) throw new Error('DOCUMENT_PAGES');
  const output: string[] = [];
  let bytes = 0,
    hasText = false;
  // 按 presentation.xml 中的顺序读取，避免 slide10 / slide2 文件名排序错误。
  for (const [index, slide] of slides.entries()) {
    const id =
      slide.getAttribute('r:id') ||
      Array.from(slide.attributes).find((attr) => attr.localName === 'id')?.value;
    const rel = rels.find((item) => item.getAttribute('Id') === id);
    if (
      !rel ||
      rel.getAttribute('TargetMode') === 'External' ||
      !rel.getAttribute('Type')?.endsWith('/slide')
    )
      throw officeFailure();
    const path = officePath('ppt/', rel.getAttribute('Target') || '');
    if (!path.startsWith('ppt/slides/')) throw officeFailure();
    const xml = await read(path),
      root = xml && xmlElements(xml, 'spTree')[0];
    if (!root) throw officeFailure();
    const blocks = presentationBlocks(root);
    const slash = path.lastIndexOf('/');
    const slideRels = await read(
      `${path.slice(0, slash + 1)}_rels/${path.slice(slash + 1)}.rels`,
      true,
    );
    const notesRel =
      slideRels &&
      xmlElements(slideRels, 'Relationship').find((item) =>
        item.getAttribute('Type')?.endsWith('/notesSlide'),
      );
    if (notesRel && notesRel.getAttribute('TargetMode') !== 'External') {
      const notesPath = officePath(path.slice(0, slash + 1), notesRel.getAttribute('Target') || '');
      if (!notesPath.startsWith('ppt/notesSlides/')) throw officeFailure();
      const notesXml = await read(notesPath),
        notesRoot = notesXml && xmlElements(notesXml, 'spTree')[0];
      // 备注以引用块跟在所属页后面；不增加界面文案或语言包键。
      if (notesRoot)
        blocks.push(
          ...presentationBlocks(notesRoot).map((text) => '> ' + text.replace(/\n/g, '\n> ')),
        );
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
  if (column > EXCEL_MAX_COLUMNS) throw officeFailure();
  return column - 1;
}
const EXCEL_MAX_COLUMNS = 16_384;
const EXCEL_MAX_ROWS = 1_048_576;
const MAX_WORKSHEETS = 100;
const MAX_SPREADSHEET_CELLS = 50_000;
const MAX_SPREADSHEET_COLUMN_INDEX = 1023; // 解析器接受从零开始的列索引，最多 1024 列。
export async function readOfficeFile(file: File): Promise<string> {
  const read = await officeArchive(await file.arrayBuffer());
  if (/\.pptx$/i.test(file.name)) return readPresentation(read);
  if (/\.docx$/i.test(file.name)) {
    const doc = await read('word/document.xml');
    const body = doc && xmlElements(doc, 'body')[0];
    if (!body) throw officeFailure();
    return wordBlocks(body).join('\n\n').trim();
  }
  const workbook = await read('xl/workbook.xml'),
    relationships = await read('xl/_rels/workbook.xml.rels');
  if (!workbook || !relationships) throw officeFailure();
  const sharedXml = await read('xl/sharedStrings.xml', true),
    styles = await read('xl/styles.xml', true);
  const shared = sharedXml
    ? xmlElements(sharedXml, 'si').map((item) =>
        xmlElements(item, 't')
          .filter((text) => text.parentElement?.localName !== 'rPh')
          .map((text) => text.textContent || '')
          .join(''),
      )
    : [];
  const formats = new Map(
    styles
      ? xmlElements(styles, 'numFmt').map((el) => [
          Number(el.getAttribute('numFmtId')),
          el.getAttribute('formatCode') || '',
        ])
      : [],
  );
  const styleRoot = styles && xmlElements(styles, 'cellXfs')[0];
  const styleIds = styleRoot
    ? Array.from(styleRoot.children).map((el) => Number(el.getAttribute('numFmtId') || 0))
    : [];
  const date1904 = ['1', 'true'].includes(
    xmlElements(workbook, 'workbookPr')[0]?.getAttribute('date1904') || '',
  );
  const rels = xmlElements(relationships, 'Relationship');
  const sheets = xmlElements(workbook, 'sheet'),
    output: string[] = [];
  if (!sheets.length || sheets.length > MAX_WORKSHEETS) throw officeFailure();
  let cellCount = 0,
    textBytes = 0;
  for (const sheet of sheets) {
    const id =
      sheet.getAttribute('r:id') ||
      Array.from(sheet.attributes).find((attr) => attr.localName === 'id')?.value;
    const rel = rels.find((item) => item.getAttribute('Id') === id);
    if (!rel || rel.getAttribute('TargetMode') === 'External') throw officeFailure();
    // Chartsheets have no cells; do not confuse a chart-only workbook with a readable data table.
    if (!rel.getAttribute('Type')?.endsWith('/worksheet')) continue;
    const path = officePath('xl/', rel.getAttribute('Target') || '');
    if (!path.startsWith('xl/worksheets/')) throw officeFailure();
    const xml = await read(path);
    if (!xml) throw officeFailure();
    const sheetData = xmlElements(xml, 'sheetData')[0];
    if (!sheetData) throw officeFailure();
    const rows: string[] = [];
    let previousRow = 0,
      maxColumns = 0;
    for (const row of Array.from(sheetData.children).filter((el) => el.localName === 'row')) {
      const rowNumber = Number(row.getAttribute('r') || previousRow + 1);
      if (!Number.isInteger(rowNumber) || rowNumber <= previousRow || rowNumber > EXCEL_MAX_ROWS)
        throw officeFailure();
      // Explicit row numbers retain sparse row locations without allocating millions of empty rows.
      const cells: string[] = [];
      let previousColumn = -1;
      for (const cell of Array.from(row.children).filter((el) => el.localName === 'c')) {
        if (++cellCount > MAX_SPREADSHEET_CELLS) throw new Error('ATTACHMENT_SIZE');
        const address = cell.getAttribute('r'),
          column = address ? excelColumn(address) : previousColumn + 1;
        if (column <= previousColumn || column > MAX_SPREADSHEET_COLUMN_INDEX)
          throw new Error('ATTACHMENT_SIZE');
        if (address && Number(/\d+$/.exec(address)?.[0]) !== rowNumber) throw officeFailure();
        previousColumn = column;
        const type = cell.getAttribute('t'),
          value = xmlElements(cell, 'v')[0]?.textContent || '';
        let text = value;
        if (type === 's') {
          if (!/^\d+$/.test(value) || Number(value) >= shared.length) throw officeFailure();
          text = shared[Number(value)];
        } else if (type === 'inlineStr')
          text = xmlElements(cell, 't')
            .map((part) => part.textContent || '')
            .join('');
        else if (type === 'b') text = value === '1' ? 'TRUE' : 'FALSE';
        else if (!type || type === 'n') {
          const formatId = styleIds[Number(cell.getAttribute('s') || 0)] || 0;
          text = excelValue(value, formatId, formats.get(formatId) || '', date1904);
        }
        // Formula values are cached by Excel; if not cached, preserve the literal formula and never invent a result.
        if (!text && xmlElements(cell, 'f').length)
          text = `=${xmlElements(cell, 'f')[0].textContent || ''}`;
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
        let number = index + 1,
          name = '';
        while (number) {
          number--;
          name = String.fromCharCode(65 + (number % 26)) + name;
          number = Math.floor(number / 26);
        }
        return name;
      });
      output.push(
        `## ${sheet.getAttribute('name') || sheet.getAttribute('sheetId') || ''}\n#\t${columns.join('\t')}\n${rows.join('\n')}`,
      );
    }
  }
  return output.join('\n\n');
}
