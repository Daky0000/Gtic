import { redirect } from "next/navigation";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { updateStudentContact } from "@/lib/actions/sis";

export const metadata = { title: "My Profile" };

export default async function StudentProfilePage() {
  const user = await requirePortal("student");
  const student = await db.student.findUnique({
    where: { userId: user.id },
    include: { programme: true, entryYear: true, application: true },
  });
  if (!student) redirect("/student");

  const field = "w-full rounded-md border border-ink-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none";
  const label = "block text-sm font-medium text-ink-700";

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">My profile</h1>

      <section className="mt-6 rounded-lg border border-ink-300/60 bg-white p-5">
        <h2 className="font-semibold text-brand-800">Identity (read-only)</h2>
        <p className="mt-1 text-xs text-ink-500">
          Changes to name, date of birth or programme require a documented request approved by the
          Registrar — not yet built in this phase.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
          <div><dt className="text-ink-500">Name</dt><dd className="font-medium">{user.name}</dd></div>
          <div><dt className="text-ink-500">Index number</dt><dd className="font-mono font-medium">{student.indexNo}</dd></div>
          <div><dt className="text-ink-500">Programme</dt><dd className="font-medium">{student.programme.name}</dd></div>
          <div><dt className="text-ink-500">Entry year</dt><dd className="font-medium">{student.entryYear.label}</dd></div>
          <div><dt className="text-ink-500">Status</dt><dd className="font-medium">{student.status}</dd></div>
          <div><dt className="text-ink-500">Email</dt><dd className="font-medium">{user.email}</dd></div>
        </dl>
      </section>

      <form action={updateStudentContact} className="mt-6 rounded-lg border border-ink-300/60 bg-white p-5">
        <h2 className="font-semibold text-brand-800">Contact details</h2>
        <p className="mt-1 text-xs text-ink-500">You can update these yourself at any time.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Phone</label>
            <input name="phone" defaultValue={student.application?.phone ?? ""} className={field} />
          </div>
          <div>
            <label className={label}>Address</label>
            <input name="address" defaultValue={student.application?.address ?? ""} className={field} />
          </div>
          <div>
            <label className={label}>Emergency contact name</label>
            <input name="emergencyName" defaultValue={student.application?.emergencyName ?? ""} className={field} />
          </div>
          <div>
            <label className={label}>Emergency contact phone</label>
            <input name="emergencyPhone" defaultValue={student.application?.emergencyPhone ?? ""} className={field} />
          </div>
        </div>
        <button type="submit" className="mt-4 rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Save
        </button>
      </form>
    </div>
  );
}
