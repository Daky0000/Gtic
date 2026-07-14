// Pure text chunker — no server-only import so the seed script can use it too.

const MAX_CHUNK_CHARS = 1500;

export function chunkDocument(
  sourceText: string
): { heading: string | null; content: string }[] {
  const lines = sourceText.split(/\r?\n/);
  const sections: { heading: string | null; body: string[] }[] = [
    { heading: null, body: [] },
  ];

  for (const line of lines) {
    const h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) {
      sections.push({ heading: h[1].trim(), body: [] });
    } else {
      sections[sections.length - 1].body.push(line);
    }
  }

  const chunks: { heading: string | null; content: string }[] = [];
  for (const s of sections) {
    const text = s.body.join("\n").trim();
    if (!text) continue;
    if (text.length <= MAX_CHUNK_CHARS) {
      chunks.push({ heading: s.heading, content: text });
      continue;
    }
    let buf = "";
    for (const para of text.split(/\n{2,}/)) {
      if (buf && buf.length + para.length + 2 > MAX_CHUNK_CHARS) {
        chunks.push({ heading: s.heading, content: buf.trim() });
        buf = "";
      }
      buf += (buf ? "\n\n" : "") + para;
    }
    if (buf.trim()) chunks.push({ heading: s.heading, content: buf.trim() });
  }
  return chunks;
}
