import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableCell,
  TableRow,
  WidthType,
  HeadingLevel,
  convertMillimetersToTwip,
} from 'docx';
import { CHART_HEIGHT, CHART_WIDTH, type Block } from './content';

export async function wordFile(blocks: Block[]) {
  const children: (Paragraph | Table)[] = [];
  for (const block of blocks) {
    if (block.kind === 'chart') {
      const bytes = Uint8Array.from(atob(block.png.split(',')[1]), (c) => c.charCodeAt(0));
      const width = 610;
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              type: 'png',
              data: bytes,
              transformation: { width, height: (width * CHART_HEIGHT) / CHART_WIDTH },
            }),
          ],
        }),
      );
    } else if (block.kind === 'table') {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: block.rows.map(
            (row, i) =>
              new TableRow({
                tableHeader: i === 0,
                children: row.map((text) => new TableCell({ children: [new Paragraph(text)] })),
              }),
          ),
        }),
      );
    } else {
      const lines = block.text.split(/\r?\n/);
      children.push(
        new Paragraph({
          heading: block.kind === 'heading' ? HeadingLevel.HEADING_2 : undefined,
          children: lines.map((text, i) => new TextRun({ text, break: i ? 1 : 0 })),
        }),
      );
    }
  }
  const margin = convertMillimetersToTwip(20);
  return Packer.toBlob(
    new Document({
      sections: [
        {
          properties: {
            page: { margin: { left: margin, right: margin, top: margin, bottom: margin } },
          },
          children,
        },
      ],
    }),
  );
}
