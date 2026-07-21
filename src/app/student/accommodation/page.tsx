import { redirect } from "next/navigation";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { formatGHS } from "@/lib/money";
import { bookBed, payHostelFee } from "@/lib/actions/accommodation";
import type { BookingStatus } from "@prisma/client";

export const metadata = { title: "Accommodation" };

const ACTIVE_STATUSES: BookingStatus[] = ["HELD", "PAID", "CHECKED_IN"];

export default async function AccommodationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; paid?: string }>;
}) {
  const user = await requirePortal("student");
  const { error, paid } = await searchParams;
  const student = await db.student.findUnique({ where: { userId: user.id } });
  if (!student) redirect("/student");

  const year = await db.academicYear.findFirst({ where: { isCurrent: true } });
  const semester = await db.semester.findFirst({ where: { isCurrent: true } });
  const window = semester
    ? await db.window.findUnique({ where: { semesterId_type: { semesterId: semester.id, type: "HOSTEL_BOOKING" } } })
    : null;
  const now = new Date();
  const isOpen = !!window && now >= window.opensAt && now <= window.closesAt;

  const myBooking = year
    ? await db.booking.findFirst({
        where: { studentId: student.id, academicYearId: year.id, status: { in: ACTIVE_STATUSES } },
        include: { bed: { include: { room: { include: { hostel: true } } } } },
      })
    : null;
  const hostels = await db.hostel.findMany({
    include: { rooms: { include: { beds: { include: { bookings: { where: { academicYearId: year?.id, status: { in: ACTIVE_STATUSES } } } } } } } },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Accommodation</h1>

      {error && <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {paid && <div className="mt-4 rounded-md bg-brand-50 p-3 text-sm text-brand-800">Payment received — thank you.</div>}

      {!isOpen && !myBooking && (
        <div className="mt-4 rounded-md bg-ink-100 p-3 text-sm text-ink-700">Hostel booking is not currently open.</div>
      )}

      {myBooking ? (
        <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-5">
          <div className="font-semibold text-brand-900">
            {myBooking.bed.room.hostel.name} · Room {myBooking.bed.room.label} · Bed {myBooking.bed.label}
          </div>
          <div className="mt-1 text-sm text-brand-800">Status: {myBooking.status.replace("_", " ")}</div>
          {myBooking.status === "HELD" && (
            <>
              <p className="mt-1 text-xs text-brand-700">
                Pay before {myBooking.heldUntil?.toLocaleDateString()} or this hold is released.
              </p>
              <form action={payHostelFee} className="mt-3">
                <input type="hidden" name="bookingId" value={myBooking.id} />
                <button type="submit" className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-deep">
                  Pay {formatGHS(myBooking.bed.room.hostel.feePerYear)} hostel fee
                </button>
              </form>
            </>
          )}
        </div>
      ) : (
        isOpen && (
          <div className="mt-6 space-y-6">
            {hostels.map((h) => (
              <div key={h.id} className="rounded-2xl border border-line bg-paper p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-brand-800">{h.name}</h2>
                  <span className="text-xs text-ink-500">{h.gender} · {formatGHS(h.feePerYear)}/year</span>
                </div>
                {h.description && <p className="mt-1 text-xs text-ink-500">{h.description}</p>}
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {h.rooms.flatMap((r) =>
                    r.beds.map((b) => {
                      const available = b.bookings.length === 0;
                      return (
                        <form key={b.id} action={bookBed}>
                          <input type="hidden" name="bedId" value={b.id} />
                          <button
                            type="submit" disabled={!available}
                            className={`w-full rounded-md border px-2 py-2 text-xs font-medium ${available ? "border-brand-300 bg-brand-50 text-brand-800 hover:bg-brand-100" : "border-ink-200 bg-ink-100 text-ink-400"}`}
                          >
                            {r.label}-{b.label} {available ? "" : "(taken)"}
                          </button>
                        </form>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
