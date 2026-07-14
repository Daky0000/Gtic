import { requirePortal } from "@/lib/rbac";

export const metadata = { title: "Applicant Portal" };

export default async function ApplyHome() {
  const user = await requirePortal("apply");
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Welcome, {user.name}</h1>
      <p className="mt-2 text-ink-500">
        The full application journey (form, documents, payment, status tracking)
        arrives with Phase 1. Meanwhile, the AI assistant in the corner can answer
        questions about programmes and admission requirements.
      </p>
      <div className="mt-6 rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
        Tip: ask the assistant “What are the entry requirements for BSc Computer
        Engineering?”
      </div>
    </div>
  );
}
