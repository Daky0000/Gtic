import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { formatGHS } from "@/lib/money";
import { borrowItem, returnItem } from "@/lib/actions/library";

export const metadata = { title: "Library" };

export default async function LibraryPage() {
  await requirePortal("staff");

  const items = await db.libraryItem.findMany({ orderBy: { title: "asc" } });
  const loans = await db.loan.findMany({
    where: { returnedAt: null },
    include: { item: true, user: true },
    orderBy: { dueAt: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Library</h1>

      <h2 className="mt-6 font-semibold text-ink-700">Catalogue</h2>
      <div className="mt-3 overflow-x-auto rounded-lg border border-ink-300/60 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-50 text-xs uppercase text-ink-500">
            <tr><th className="px-4 py-2">Title</th><th className="px-4 py-2">Author</th><th className="px-4 py-2">Available</th><th className="px-4 py-2" /></tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-ink-100">
                <td className="px-4 py-2">{i.title}</td>
                <td className="px-4 py-2">{i.author}</td>
                <td className="px-4 py-2">{i.copiesAvailable} / {i.copiesTotal}</td>
                <td className="px-4 py-2">
                  {i.copiesAvailable > 0 && (
                    <form action={borrowItem} className="flex gap-2">
                      <input type="hidden" name="itemId" value={i.id} />
                      <input name="email" type="email" placeholder="Borrower email" required className="rounded-md border border-ink-300 px-2 py-1 text-xs" />
                      <button type="submit" className="rounded-md bg-brand-800 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700">Borrow</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 font-semibold text-ink-700">Current loans</h2>
      <div className="mt-3 overflow-x-auto rounded-lg border border-ink-300/60 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-50 text-xs uppercase text-ink-500">
            <tr><th className="px-4 py-2">Item</th><th className="px-4 py-2">Borrower</th><th className="px-4 py-2">Due</th><th className="px-4 py-2" /></tr>
          </thead>
          <tbody>
            {loans.map((l) => {
              const overdue = new Date() > l.dueAt;
              return (
                <tr key={l.id} className="border-t border-ink-100">
                  <td className="px-4 py-2">{l.item.title}</td>
                  <td className="px-4 py-2">{l.user.name}</td>
                  <td className={`px-4 py-2 ${overdue ? "text-red-700" : ""}`}>{l.dueAt.toLocaleDateString()}{overdue ? " (overdue)" : ""}</td>
                  <td className="px-4 py-2">
                    <form action={returnItem}>
                      <input type="hidden" name="loanId" value={l.id} />
                      <button type="submit" className="text-xs text-brand-800 hover:underline">Mark returned</button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {loans.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-ink-500">No active loans.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-500">Overdue returns generate a fine invoice ({formatGHS(100)}/day) automatically.</p>
    </div>
  );
}
