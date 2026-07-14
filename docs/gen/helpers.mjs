// Shared building blocks for the system-plan DOCX.
import {
  Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType, VerticalAlign,
} from "docx";

export const BRAND = {
  primary: "166534",   // deep green accent (energy / natural resources)
  dark: "1F2937",      // near-black body text
  mid: "4B5563",       // secondary gray
  light: "F0FDF4",     // pale green fill for table headers
  rowAlt: "F9FAFB",
  border: "D1D5DB",
};

export const h1 = (text) =>
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });

export const h2 = (text) =>
  new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });

export const h3 = (text) =>
  new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });

// Body paragraph. Accepts a string, or an array of TextRun-ish specs:
// strings become plain runs, {t, b, i} objects become styled runs.
export const p = (content, opts = {}) => {
  const runs = (Array.isArray(content) ? content : [content]).map((c) =>
    typeof c === "string"
      ? new TextRun({ text: c })
      : new TextRun({ text: c.t, bold: !!c.b, italics: !!c.i, color: c.color })
  );
  return new Paragraph({
    children: runs,
    spacing: { after: opts.after ?? 120 },
    alignment: opts.align,
  });
};

export const bullet = (content, level = 0) => {
  const runs = (Array.isArray(content) ? content : [content]).map((c) =>
    typeof c === "string"
      ? new TextRun({ text: c })
      : new TextRun({ text: c.t, bold: !!c.b, italics: !!c.i })
  );
  return new Paragraph({ children: runs, bullet: { level }, spacing: { after: 60 } });
};

// A single traceable requirement line: "AP-01  The applicant shall be able to ..."
export const req = (id, text) =>
  new Paragraph({
    children: [
      new TextRun({ text: `${id}   `, bold: true, color: BRAND.primary }),
      new TextRun({ text }),
    ],
    spacing: { after: 80 },
    indent: { left: 360, hanging: 360 },
  });

// Emits a block of requirements from [[id, text], ...]
export const reqBlock = (rows) => rows.map(([id, text]) => req(id, text));

const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };
const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: BRAND.border };
const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

const cellPara = (content, { bold = false } = {}) => {
  const runs = (Array.isArray(content) ? content : [content]).map((c) =>
    typeof c === "string"
      ? new TextRun({ text: c, bold, size: 20 })
      : new TextRun({ text: c.t, bold: bold || !!c.b, italics: !!c.i, size: 20 })
  );
  return new Paragraph({ children: runs, spacing: { after: 0 } });
};

// table(["H1","H2"], [["a","b"], ...], { widths: [30,70] })
export const table = (headers, rows, opts = {}) => {
  const widths = opts.widths ?? headers.map(() => Math.floor(100 / headers.length));
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((hText, i) =>
      new TableCell({
        children: [cellPara(hText, { bold: true })],
        shading: { type: ShadingType.CLEAR, fill: BRAND.light },
        width: { size: widths[i], type: WidthType.PERCENTAGE },
        borders: allBorders,
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
      })
    ),
  });
  const bodyRows = rows.map((r, ri) =>
    new TableRow({
      children: r.map((c, i) =>
        new TableCell({
          children: [cellPara(c)],
          width: { size: widths[i], type: WidthType.PERCENTAGE },
          shading: ri % 2 === 1 ? { type: ShadingType.CLEAR, fill: BRAND.rowAlt } : undefined,
          borders: allBorders,
          margins: cellMargins,
        })
      ),
    })
  );
  return new Table({
    rows: [headerRow, ...bodyRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
};

export const spacer = () => new Paragraph({ children: [], spacing: { after: 120 } });

// Callout box: single-cell shaded table used for notes.
export const callout = (label, text) =>
  new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `${label}  `, bold: true, color: BRAND.primary, size: 20 }),
                  new TextRun({ text, size: 20 }),
                ],
                spacing: { after: 0 },
              }),
            ],
            shading: { type: ShadingType.CLEAR, fill: BRAND.light },
            borders: allBorders,
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
          }),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
