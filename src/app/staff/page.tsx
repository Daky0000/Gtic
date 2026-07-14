import { requirePortal } from "@/lib/rbac";

export const metadata = { title: "Staff Portal" };

export default async function StaffHome() {
  const user = await requirePortal("staff");
  return (
    <div>
      <h1 className="text-2xl font-bold">Staff dashboard</h1>
      <p className="mt-2 text-ink-500">
        Signed in as {user.email} · roles: {user.roles.join(", ") || "none"}
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          ["Admissions review", "Phase 1"],
          ["Class lists & grading", "Phases 3–4"],
          ["Pending approvals", "Phases 1–4"],
        ].map(([title, note]) => (
          <div key={title} className="rounded-lg border border-ink-300/60 bg-white p-5">
            <div className="text-sm font-medium text-ink-500">{title}</div>
            <div className="mt-1 text-lg font-semibold text-ink-700">—</div>
            <div className="mt-1 text-xs text-ink-500">Arrives with {note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
