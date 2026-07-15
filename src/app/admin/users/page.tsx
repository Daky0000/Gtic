import { db } from "@/lib/db";
import { requireDeveloperConsole } from "@/lib/rbac";
import { adminCreateUser, assignRole, revokeRole } from "@/lib/actions/system";
import { Flash } from "@/components/flash";

export const metadata = { title: "Users & Roles" };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; q?: string }>;
}) {
  await requireDeveloperConsole();
  const { error, saved, q } = await searchParams;

  const [roles, users] = await Promise.all([
    db.role.findMany({ orderBy: { name: "asc" } }),
    db.user.findMany({
      where: q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }
        : undefined,
      include: { roleAssignments: { include: { role: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const field = "rounded-md border border-ink-300 px-3 py-1.5 text-sm focus:border-brand-600 focus:outline-none";

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold">Users &amp; roles</h1>
      <Flash error={error} success={saved ? "Saved." : undefined} />

      {/* Create user */}
      <form action={adminCreateUser} className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-ink-300/60 bg-white p-5">
        <h2 className="w-full font-semibold text-brand-800">Create an account</h2>
        <label className="text-xs text-ink-600">
          Full name
          <input name="name" required className={`${field} mt-1 block w-44`} />
        </label>
        <label className="text-xs text-ink-600">
          Email
          <input name="email" type="email" required className={`${field} mt-1 block w-56`} />
        </label>
        <label className="text-xs text-ink-600">
          Password
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className={`${field} mt-1 block w-40`} />
        </label>
        <label className="text-xs text-ink-600">
          Initial role
          <select name="roleCode" className={`${field} mt-1 block`}>
            <option value="">(none)</option>
            {roles.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
        </label>
        <button type="submit" className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Create
        </button>
      </form>

      {/* Search */}
      <form className="mt-6 flex gap-2">
        <input name="q" defaultValue={q ?? ""} placeholder="Search name or email…" className={`${field} flex-1`} />
        <button type="submit" className="rounded-md border border-ink-300 px-4 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-100">
          Search
        </button>
      </form>

      {/* User list */}
      <div className="mt-4 space-y-3">
        {users.map((u) => (
          <div key={u.id} className="rounded-lg border border-ink-300/60 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">{u.name}</div>
                <div className="text-xs text-ink-500">{u.email}</div>
              </div>
              <form action={assignRole} className="flex items-center gap-2">
                <input type="hidden" name="userId" value={u.id} />
                <select name="roleCode" required className={`${field} text-xs`}>
                  {roles
                    .filter((r) => !u.roleAssignments.some((a) => a.role.code === r.code))
                    .map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
                </select>
                <button type="submit" className="rounded-md border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-800 hover:bg-brand-100">
                  Assign role
                </button>
              </form>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {u.roleAssignments.length === 0 && <span className="text-xs text-ink-400">No roles</span>}
              {u.roleAssignments.map((a) => (
                <form key={a.id} action={revokeRole} className="inline">
                  <input type="hidden" name="userId" value={u.id} />
                  <input type="hidden" name="roleCode" value={a.role.code} />
                  <button
                    type="submit"
                    title={`Revoke ${a.role.name}`}
                    className="group rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-700 hover:bg-red-100 hover:text-red-800"
                  >
                    {a.role.name} <span className="text-ink-400 group-hover:text-red-700">×</span>
                  </button>
                </form>
              ))}
            </div>
          </div>
        ))}
        {users.length === 0 && <p className="text-sm text-ink-500">No users match.</p>}
      </div>
    </div>
  );
}
