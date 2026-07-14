import { NextRequest, NextResponse } from "next/server";
import { getApiUser, hasRole, ROLES } from "@/lib/rbac";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { id } = await params;
  const offering = await db.courseOffering.findUnique({
    where: { id },
    include: {
      course: true,
      lecturers: true,
      registrationCourses: {
        where: { registration: { status: "SUBMITTED" } },
        include: { registration: { include: { student: { include: { user: true, programme: true } } } } },
      },
    },
  });
  if (!offering) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAssigned = offering.lecturers.some((l) => l.staffUserId === user.id);
  if (!isAssigned && !hasRole(user, ROLES.SYSTEM_ADMIN, ROLES.HOD, ROLES.DEAN, ROLES.REGISTRAR)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = offering.registrationCourses
    .map((rc) => rc.registration.student)
    .sort((a, b) => a.user.name.localeCompare(b.user.name));

  const csv = [
    "Index No,Name,Email,Programme",
    ...rows.map((s) => [s.indexNo, s.user.name, s.user.email, s.programme.name].map(csvEscape).join(",")),
  ].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${offering.course.code.replace(/\s+/g, "_")}_roster.csv"`,
    },
  });
}

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
