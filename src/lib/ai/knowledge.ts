import "server-only";
import { db } from "@/lib/db";
import { chunkDocument } from "./chunker";
import type { RetrievedChunk } from "./types";

/** (Re)ingest a document: replace its chunks from sourceText. */
export async function reindexDocument(documentId: string): Promise<number> {
  const doc = await db.knowledgeDocument.findUniqueOrThrow({ where: { id: documentId } });
  const chunks = chunkDocument(doc.sourceText);
  await db.$transaction([
    db.knowledgeChunk.deleteMany({ where: { documentId } }),
    db.knowledgeChunk.createMany({
      data: chunks.map((c, i) => ({
        documentId,
        ord: i,
        heading: c.heading,
        content: c.content,
      })),
    }),
  ]);
  return chunks.length;
}

// ─── Retrieval (PostgreSQL full-text search; pgvector is the later upgrade) ───

type SearchRow = {
  content: string;
  heading: string | null;
  slug: string;
  title: string;
  rank: number;
};

// Question words that carry no retrieval signal on their own.
const STOPWORDS = new Set([
  "what", "when", "where", "which", "whose", "does", "need", "needs", "have",
  "this", "that", "with", "from", "about", "should", "would", "could", "will",
  "they", "them", "then", "than", "your", "much", "many", "please", "tell",
  "know", "want", "there", "their", "into", "some", "also", "being", "been",
]);

export async function retrieveChunks(query: string, limit = 6): Promise<RetrievedChunk[]> {
  // First pass: websearch semantics (all words must match).
  const rows = await ftsQuery(query, limit);
  if (rows.length > 0) return rows;

  // Fallback: OR of significant words — but only keep chunks that contain
  // enough of them, so a single stray word can't drag in irrelevant text.
  const words = [...new Set(
    query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w))
  )];
  if (words.length === 0) return [];

  const candidates = await ftsQuery(words.join(" OR "), limit * 2);
  const required = Math.min(words.length, 2);
  return candidates
    .map((c) => {
      const haystack = `${c.heading ?? ""} ${c.content}`.toLowerCase();
      const matches = words.filter((w) => haystack.includes(w)).length;
      return { chunk: c, matches };
    })
    .filter((x) => x.matches >= required)
    .sort((a, b) => b.matches - a.matches || b.chunk.rank - a.chunk.rank)
    .slice(0, limit)
    .map((x) => x.chunk);
}

async function ftsQuery(q: string, limit: number): Promise<RetrievedChunk[]> {
  const rows = await db.$queryRaw<SearchRow[]>`
    SELECT c.content, c.heading, d.slug, d.title,
           ts_rank(to_tsvector('english', coalesce(c.heading,'') || ' ' || c.content),
                   websearch_to_tsquery('english', ${q})) AS rank
    FROM "KnowledgeChunk" c
    JOIN "KnowledgeDocument" d ON d.id = c."documentId"
    WHERE d.status = 'PUBLISHED'
      AND to_tsvector('english', coalesce(c.heading,'') || ' ' || c.content)
          @@ websearch_to_tsquery('english', ${q})
    ORDER BY rank DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    content: r.content,
    heading: r.heading,
    documentSlug: r.slug,
    documentTitle: r.title,
    rank: Number(r.rank),
  }));
}
