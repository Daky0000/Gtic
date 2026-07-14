import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { updateWindowDates } from "@/lib/actions/calendar";

export const metadata = { title: "Academic Calendar" };

const WINDOW_LABEL: Record<string, string> = {
  REGISTRATION: "Course registration",
  ADD_DROP: "Add/drop",
  HOSTEL_BOOKING: "Hostel booking",
  EVALUATION: "Course evaluation",
};

function toLocalInput(d: Date) {
  return d.toISOString().slice(0, 16);
}

export default async function CalendarAdminPage() {
  await requirePortal("admin");

  const year = await db.academicYear.findFirst({ where: { isCurrent: true } });
  const semester = year
    ? await db.semester.findFirst({ where: { academicYearId: year.id, isCurrent: true } })
    : null;
  const windows = semester
    ? await db.window.findMany({ where: { semesterId: semester.id }, orderBy: { type: "asc" } })
    : [];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Academic calendar</h1>

      {!year || !semester ? (
        <p className="mt-4 text-ink-500">No current academic year/semester configured.</p>
      ) : (
        <>
          <div className="mt-4 rounded-lg border border-ink-300/60 bg-white p-5">
            <div className="font-semibold text-brand-800">{year.label}</div>
            <div className="text-sm text-ink-500">{semester.label}</div>
            <div className="mt-1 text-xs text-ink-500">
              {semester.startsOn.toLocaleDateString()} – {semester.endsOn.toLocaleDateString()}
            </div>
          </div>

          <h2 className="mt-6 font-semibold text-ink-700">Windows</h2>
          <p className="text-xs text-ink-500">
            These dates gate registration, add/drop, hostel booking and course evaluation across the whole
            system (XC-10) — nothing is hard-coded.
          </p>
          <div className="mt-3 space-y-3">
            {windows.map((w) => {
              const now = new Date();
              const isOpen = now >= w.opensAt && now <= w.closesAt;
              return (
                <form
                  key={w.id}
                  action={updateWindowDates}
                  className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-300/60 bg-white p-4"
                >
                  <input type="hidden" name="windowId" value={w.id} />
                  <div className="min-w-32">
                    <div className="text-sm font-medium text-ink-700">{WINDOW_LABEL[w.type]}</div>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${isOpen ? "bg-brand-100 text-brand-800" : "bg-ink-100 text-ink-600"}`}>
                      {isOpen ? "Open now" : "Closed"}
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs text-ink-500">Opens</label>
                    <input type="datetime-local" name="opensAt" defaultValue={toLocalInput(w.opensAt)} className="rounded-md border border-ink-300 px-2 py-1 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-ink-500">Closes</label>
                    <input type="datetime-local" name="closesAt" defaultValue={toLocalInput(w.closesAt)} className="rounded-md border border-ink-300 px-2 py-1 text-sm" />
                  </div>
                  <button type="submit" className="rounded-md bg-brand-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                    Save
                  </button>
                </form>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
