// Generates docs/University-Management-System-Plan.docx
// Run: node docs/generate-plan-docx.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, TableOfContents,
  Footer, Header, PageNumber, PageBreak, BorderStyle,
} from "docx";
import { BRAND } from "./gen/helpers.mjs";
import { executiveSummary, uenrCaseStudy, visionScope } from "./gen/content-overview.mjs";
import { actorsCatalog, functionalRequirements } from "./gen/content-actors.mjs";
import { moduleSpecs, aiCore, aiArchitecture } from "./gen/content-modules.mjs";
import { nonFunctional, technicalArchitecture, dataModel } from "./gen/content-tech.mjs";
import { roadmap, risksAndClosing } from "./gen/content-roadmap.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "University-Management-System-Plan.docx");

const FONT = "Calibri";
const A4 = { width: 11906, height: 16838 }; // twips
const MARGINS = { top: 1134, bottom: 1134, left: 1134, right: 1134 }; // 2cm

// ---------- styles ----------
const styles = {
  default: {
    document: {
      run: { font: FONT, size: 22, color: BRAND.dark }, // 11pt
      paragraph: { spacing: { line: 276, after: 120 } },
    },
  },
  paragraphStyles: [
    {
      id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { font: FONT, size: 34, bold: true, color: BRAND.primary },
      paragraph: {
        spacing: { before: 360, after: 200 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND.primary, space: 4 } },
      },
    },
    {
      id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { font: FONT, size: 27, bold: true, color: BRAND.dark },
      paragraph: { spacing: { before: 280, after: 140 } },
    },
    {
      id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { font: FONT, size: 23, bold: true, color: BRAND.mid },
      paragraph: { spacing: { before: 220, after: 120 } },
    },
  ],
};

// ---------- cover ----------
const coverChildren = [
  new Paragraph({ spacing: { before: 3200 }, children: [] }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "CAMPUSCORE", bold: true, size: 76, color: BRAND.primary, font: FONT })],
    spacing: { after: 160 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "AI-Cored University Management System", bold: true, size: 36, color: BRAND.dark })],
    spacing: { after: 120 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Full System Plan — Requirements, Architecture and Implementation Roadmap", size: 26, color: BRAND.mid })],
    spacing: { after: 600 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Case study institution: University of Energy and Natural Resources (UENR), Sunyani, Ghana", italics: true, size: 22, color: BRAND.mid })],
    spacing: { after: 80 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Powered by Anthropic Claude  ·  Next.js + TypeScript + PostgreSQL", size: 22, color: BRAND.mid })],
    spacing: { after: 1400 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Version 1.0  ·  July 2026  ·  Status: For Review", bold: true, size: 22, color: BRAND.dark })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Working title — product is fully rebrandable per deployment", size: 18, color: BRAND.mid, italics: true })],
  }),
];

// ---------- table of contents ----------
const tocChildren = [
  new Paragraph({
    children: [new TextRun({ text: "Contents", bold: true, size: 34, color: BRAND.primary })],
    spacing: { after: 240 },
  }),
  new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }),
  new Paragraph({
    children: [new TextRun({ text: "In Microsoft Word, right-click the table above and choose “Update Field” to refresh page numbers.", italics: true, size: 18, color: BRAND.mid })],
    spacing: { before: 240 },
  }),
];

// ---------- body ----------
const body = [
  ...executiveSummary(),
  new Paragraph({ children: [new PageBreak()] }),
  ...uenrCaseStudy(),
  new Paragraph({ children: [new PageBreak()] }),
  ...visionScope(),
  new Paragraph({ children: [new PageBreak()] }),
  ...actorsCatalog(),
  new Paragraph({ children: [new PageBreak()] }),
  ...functionalRequirements(),
  new Paragraph({ children: [new PageBreak()] }),
  ...moduleSpecs(),
  new Paragraph({ children: [new PageBreak()] }),
  ...aiCore(),
  new Paragraph({ children: [new PageBreak()] }),
  ...aiArchitecture(),
  new Paragraph({ children: [new PageBreak()] }),
  ...nonFunctional(),
  new Paragraph({ children: [new PageBreak()] }),
  ...technicalArchitecture(),
  new Paragraph({ children: [new PageBreak()] }),
  ...dataModel(),
  new Paragraph({ children: [new PageBreak()] }),
  ...roadmap(),
  new Paragraph({ children: [new PageBreak()] }),
  ...risksAndClosing(),
];

const pageFooter = new Footer({
  children: [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: "CampusCore — Full System Plan  ·  Page ", size: 18, color: BRAND.mid }),
        new TextRun({ children: [PageNumber.CURRENT], size: 18, color: BRAND.mid }),
        new TextRun({ text: " of ", size: 18, color: BRAND.mid }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: BRAND.mid }),
      ],
    }),
  ],
});

const pageHeader = new Header({
  children: [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: "CampusCore · AI-Cored University Management System", size: 16, color: BRAND.mid, italics: true })],
    }),
  ],
});

const doc = new Document({
  creator: "CampusCore Planning",
  title: "CampusCore — AI-Cored University Management System: Full System Plan",
  description: "Complete system plan: actors, requirements, modules, AI core (Claude), architecture and phased roadmap. Case study: UENR, Ghana.",
  features: { updateFields: true },
  styles,
  sections: [
    { properties: { page: { size: A4, margin: MARGINS } }, children: coverChildren },
    { properties: { page: { size: A4, margin: MARGINS } }, children: tocChildren },
    {
      properties: { page: { size: A4, margin: MARGINS } },
      headers: { default: pageHeader },
      footers: { default: pageFooter },
      children: body,
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(OUT, buffer);
console.log(`Written: ${OUT} (${(buffer.length / 1024).toFixed(1)} KB)`);
