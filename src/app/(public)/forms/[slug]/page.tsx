import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/rbac";
import { submitFormResponse } from "@/lib/actions/forms";
import { parseFields } from "@/lib/forms";

export const dynamic = "force-dynamic";

export const metadata = { title: "Form" };

export default async function FillFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { slug } = await params;
  const { error, done } = await searchParams;

  const form = await db.formDef.findUnique({ where: { slug } });
  if (!form || form.status === "DRAFT") notFound();
  const fields = parseFields(form.fields);
  const user = await getCurrentUser();

  const field =
    "mt-1.5 w-full rounded-[11px] border border-line bg-cream px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-forest";

  return (
    <div className="scr mx-auto max-w-[640px] px-7 py-16">
      <div className="mb-3 eyebrow">SYDA-GTIC</div>
      <h1 className="mb-2 font-serif text-[36px] font-normal leading-[1.1]">{form.title}</h1>
      {form.description && <p className="mb-6 text-[15px] leading-[1.6] text-muted">{form.description}</p>}

      {done ? (
        <div className="rounded-[18px] border-2 border-forest bg-[#eaf0ea] p-7 text-center">
          <div className="font-serif text-[22px] text-forest">✓ Response recorded</div>
          <p className="mt-2 text-sm text-muted">Thank you — your response has been submitted.</p>
        </div>
      ) : form.status === "CLOSED" ? (
        <p className="rounded-[14px] border border-gold/30 bg-[#f6efdf] p-4 text-sm text-[#7a5a22]">
          This form is no longer accepting responses.
        </p>
      ) : (
        <>
          {error && (
            <p role="alert" className="mb-5 rounded-[11px] bg-[#faece9] p-3 text-sm text-[#b23a2e]">{error}</p>
          )}
          <form action={submitFormResponse} className="space-y-5">
            <input type="hidden" name="slug" value={form.slug} />

            {!user && (
              <div className="grid gap-4 rounded-2xl border border-line bg-paper p-5 sm:grid-cols-2">
                <label className="block text-[13px] text-muted">
                  Your name (optional)
                  <input name="respondentName" autoComplete="name" className={field} />
                </label>
                <label className="block text-[13px] text-muted">
                  Your email (optional)
                  <input name="respondentEmail" type="email" autoComplete="email" className={field} />
                </label>
              </div>
            )}

            {fields.map((f) => (
              <div key={f.id} className="rounded-2xl border border-line bg-paper p-5">
                <label className="block text-[14px] font-medium text-ink">
                  {f.label} {f.required && <span className="text-[#b23a2e]">*</span>}
                </label>
                {f.type === "TEXT" && <input name={f.id} required={f.required} className={field} />}
                {f.type === "PARAGRAPH" && <textarea name={f.id} required={f.required} rows={4} className={field} />}
                {f.type === "NUMBER" && <input name={f.id} type="number" step="any" required={f.required} className={field} />}
                {f.type === "DATE" && <input name={f.id} type="date" required={f.required} className={field} />}
                {f.type === "SELECT" && (
                  <div className="mt-2 space-y-2">
                    {(f.options ?? []).map((o) => (
                      <label key={o} className="flex items-center gap-2.5 text-sm text-ink">
                        <input type="radio" name={f.id} value={o} required={f.required} className="h-4 w-4" />
                        {o}
                      </label>
                    ))}
                  </div>
                )}
                {f.type === "CHECKBOX" && (
                  <div className="mt-2 space-y-2">
                    {(f.options ?? []).map((o) => (
                      <label key={o} className="flex items-center gap-2.5 text-sm text-ink">
                        <input type="checkbox" name={f.id} value={o} className="h-4 w-4" />
                        {o}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <button
              type="submit"
              className="w-full rounded-xl bg-forest py-[14px] text-[15px] font-medium text-white transition-colors hover:bg-forest-deep"
            >
              Submit response
            </button>
          </form>
        </>
      )}
    </div>
  );
}
