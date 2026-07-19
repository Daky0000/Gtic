import "server-only";
import { db } from "@/lib/db";

export type NavForm = { slug: string; title: string; href: string; isAdmission: boolean };

/** Published forms placed in the public site nav. The admission form links to
 * the apply flow (/signup); generic forms link to their fill page. */
export async function publicNavForms(): Promise<NavForm[]> {
  const forms = await db.formDef.findMany({
    where: { status: "PUBLISHED", placement: "PUBLIC_NAV" },
    orderBy: { createdAt: "asc" },
    select: { slug: true, title: true, type: true },
  });
  return forms.map((f) => ({
    slug: f.slug,
    title: f.title,
    href: f.type === "ADMISSION" ? "/signup" : `/forms/${f.slug}`,
    isAdmission: f.type === "ADMISSION",
  }));
}

/** The admission form's current state, or null if it was deleted (apply flow
 * then falls back to always-open with default copy). */
export async function admissionForm() {
  return db.formDef.findFirst({ where: { type: "ADMISSION" } });
}
