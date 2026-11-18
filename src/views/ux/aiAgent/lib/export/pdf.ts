import { PDFDocument, PageSizes } from 'pdf-lib';
import { CHART_HEIGHT, CHART_WIDTH, type Block } from './content';

// 正文使用浏览器字体逐行绘制，支持中文和混排；每页独立生成，长会话无需创建超高画布。
export async function pdfFile(blocks: Block[]) {
  const pdf = await PDFDocument.create();
  const [width, height] = PageSizes.A4;
  const margin = 42,
    scale = 2,
    usable = width - margin * 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.scale(scale, scale);
  ctx.textBaseline = 'top';
  let y = margin;
  function clearPage() {
    ctx!.fillStyle = 'white';
    ctx!.fillRect(0, 0, canvas.width, canvas.height);
    y = margin;
  }
  async function flush() {
    const image = await pdf.embedPng(canvas.toDataURL('image/png'));
    pdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
    clearPage();
  }
  async function reserve(h: number) {
    if (y + h > height - margin) await flush();
  }
  function wrap(text: string, maxWidth: number) {
    const lines: string[] = [];
    for (const paragraph of text.split(/\r?\n/)) {
      let line = '';
      for (const char of paragraph) {
        if (line && ctx!.measureText(line + char).width > maxWidth) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
      lines.push(line);
    }
    return lines;
  }
  clearPage();
  for (const block of blocks) {
    if (block.kind === 'chart') {
      const image = new Image();
      image.src = block.png;
      await image.decode();
      const h = (usable * CHART_HEIGHT) / CHART_WIDTH;
      await reserve(h);
      ctx.drawImage(image, margin, y, usable, h);
      y += h + 8;
    } else if (block.kind === 'table') {
      ctx.font = '10px sans-serif';
      const cols = Math.max(1, block.rows[0]?.length ?? 1);
      const cellWidth = usable / cols;
      for (const [index, row] of block.rows.entries()) {
        const cells = row.map((cell) => wrap(cell, Math.max(1, cellWidth - 6)));
        const lines = cells.reduce((max, cell) => Math.max(max, cell.length), 1);
        // 按行内的文字分片分页，单个超长单元格也能完整输出。
        for (let line = 0; line < lines; line++) {
          await reserve(15);
          for (const [col, cell] of cells.entries()) {
            const x = margin + col * cellWidth;
            if (index === 0) {
              ctx.fillStyle = '#edf1f7';
              ctx.fillRect(x, y, cellWidth, 15);
            }
            ctx.fillStyle = '#202735';
            ctx.fillText(cell[line] ?? '', x + 2, y + 2, cellWidth - 2);
          }
          y += 15;
        }
        ctx.strokeStyle = '#d8dee8';
        ctx.beginPath();
        ctx.moveTo(margin, y);
        ctx.lineTo(width - margin, y);
        ctx.stroke();
      }
      y += 8;
    } else {
      const heading = block.kind === 'heading';
      ctx.font = heading ? 'bold 15px sans-serif' : '11px sans-serif';
      const lineHeight = heading ? 22 : 17;
      for (const line of wrap(block.text, usable)) {
        await reserve(lineHeight);
        ctx.fillStyle = '#202735';
        ctx.fillText(line, margin, y);
        y += lineHeight;
      }
      y += 5;
    }
  }
  await flush();
  return new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' });
}
