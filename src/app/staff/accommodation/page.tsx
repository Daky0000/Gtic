import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { checkInStudent, checkOutStudent, expireUnpaidBookings } from "@/lib/actions/accommodation";

export const metadata = { title: "Accommodation Management" };

export default async function AccommodationManagementPage() {
  await requirePortal("staff");

  const year = await db.academicYear.findFirst({ where: { isCurrent: true } });
  const hostels = await db.hostel.findMany({
    include: { rooms: { include: { beds: true } } },
  });
  const bookings = year
    ? await db.booking.findMany({
        where: { academicYearId: year.id, status: { in: ["HELD", "PAID", "CHECKED_IN"] } },
        include: { student: { include: { user: true } }, bed: { include: { room: { include: { hostel: true } } } } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div>
      <h1 className="text-2xl font-bold">Accommodation management</h1>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {hostels.map((h) => {
          const totalBeds = h.rooms.reduce((s, r) => s + r.beds.length, 0);
          const occupied = bookings.filter((b) => b.bed.room.hostel.id === h.id).length;
          return (
            <div key={h.id} className="rounded-lg border border-ink-300/60 bg-white p-4">
              <div className="font-semibold">{h.name}</div>
              <div className="mt-1 text-sm text-ink-500">{occupied} / {totalBeds} beds occupied</div>
            </div>
          );
        })}
      </div>

      <form action={expireUnpaidBookings} className="mt-4">
        <button type="submit" className="rounded-md border border-ink-300 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100">
          Run expiry sweep (release unpaid holds past deadline)
        </button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-lg border border-ink-300/60 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-50 text-xs uppercase text-ink-500">
            <tr><th className="px-4 py-2">Student</th><th className="px-4 py-2">Hostel / Bed</th><th className="px-4 py-2">Status</th><th className="px-4 py-2" /></tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-t border-ink-100">
                <td className="px-4 py-2">{b.student.user.name}</td>
                <td className="px-4 py-2">{b.bed.room.hostel.name} — {b.bed.room.label}/{b.bed.label}</td>
                <td className="px-4 py-2">{b.status.replace("_", " ")}</td>
                <td className="px-4 py-2 text-right">
                  {b.status === "PAID" && (
                    <form action={checkInStudent}><input type="hidden" name="bookingId" value={b.id} /><button type="submit" className="text-xs text-brand-800 hover:underline">Check in</button></form>
                  )}
                  {b.status === "CHECKED_IN" && (
                    <form action={checkOutStudent}><input type="hidden" name="bookingId" value={b.id} /><button type="submit" className="text-xs text-ink-500 hover:underline">Check out</button></form>
                  )}
                </td>
              </tr>
            ))}
            {bookings.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-ink-500">No active bookings.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
