import { requirePortal } from "@/lib/rbac";

export const metadata = { title: "Student Portal" };

export default async function StudentHome() {
  const user = await requirePortal("student");
  return (
    <div>
      <h1 className="text-2xl font-bold">Welcome back, {user.name}</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          ["Registration", "Opens with Phase 3"],
          ["Outstanding fees", "Available with Phase 5"],
          ["Published results", "Available with Phase 4"],
        ].map(([title, note]) => (
          <div key={title} className="rounded-lg border border-ink-300/60 bg-white p-5">
            <div className="text-sm font-medium text-ink-500">{title}</div>
            <div className="mt-1 text-lg font-semibold text-ink-700">—</div>
            <div className="mt-1 text-xs text-ink-500">{note}</div>
          </div>
        ))}
      </div>
      <p className="mt-6 text-sm text-ink-500">
        The AI assistant (bottom-right) answers questions from the student handbook
        and examination regulations.
      </p>
    </div>
  );
}
