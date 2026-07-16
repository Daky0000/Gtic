import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { addTeachingSession } from "@/lib/actions/timetable";

export const metadata = { title: "Timetable" };

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePortal("staff");
  const { error } = await searchParams;

  const semester = await db.semester.findFirst({ where: { isCurrent: true } });
  const offerings = semester ? await db.courseOffering.findMany({ where: { semesterId: semester.id }, include: { course: true } }) : [];
  const venues = await db.venue.findMany({ orderBy: { name: "asc" } });
  const sessions = semester
    ? await db.timetableSession.findMany({
        where: { kind: "TEACHING", offering: { semesterId: semester.id } },
        include: { offering: { include: { course: true } }, venue: true },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      })
    : [];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Teaching timetable</h1>
      <p className="mt-1 text-sm text-ink-500">{semester?.label}</p>

      {error && <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <form
        action={addTeachingSession}
        className="mt-4 grid gap-2 rounded-2xl border border-line bg-paper p-4 sm:grid-cols-5"
      >
        <select name="offeringId" required className="rounded-md border border-ink-300 px-2 py-1.5 text-sm sm:col-span-2">
          {offerings.map((o) => <option key={o.id} value={o.id}>{o.course.code}</option>)}
        </select>
        <select name="venueId" required className="rounded-md border border-ink-300 px-2 py-1.5 text-sm">
          {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <select name="dayOfWeek" required className="rounded-md border border-ink-300 px-2 py-1.5 text-sm">
          {DAY_NAMES.slice(1, 6).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
        </select>
        <div className="flex gap-1">
          <input name="startTime" type="time" required className="w-full rounded-md border border-ink-300 px-1 py-1.5 text-sm" />
          <input name="endTime" type="time" required className="w-full rounded-md border border-ink-300 px-1 py-1.5 text-sm" />
        </div>
        <button type="submit" className="rounded-full bg-forest px-3 py-1.5 text-sm font-medium text-white hover:bg-forest-deep sm:col-span-5">
          Add session
        </button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-50 text-xs uppercase text-ink-500">
            <tr><th className="px-4 py-2">Day</th><th className="px-4 py-2">Time</th><th className="px-4 py-2">Course</th><th className="px-4 py-2">Venue</th></tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-t border-ink-100">
                <td className="px-4 py-2">{DAY_NAMES[s.dayOfWeek ?? 0]}</td>
                <td className="px-4 py-2">{s.startTime}–{s.endTime}</td>
                <td className="px-4 py-2">{s.offering.course.code}</td>
                <td className="px-4 py-2">{s.venue?.name}</td>
              </tr>
            ))}
            {sessions.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-ink-500">No sessions scheduled yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
