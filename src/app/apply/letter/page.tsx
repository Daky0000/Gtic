import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getOrCreateDraftApplication, acceptOffer, payAcceptanceFeeMock, declineOffer } from "@/lib/actions/admissions";

export const metadata = { title: "Admission Letter" };

export default async function LetterPage() {
  const user = await requirePortal("apply");
  const app = await getOrCreateDraftApplication(user.id);
  if (!app) redirect("/apply");

  const offer = await db.offer.findUnique({
    where: { applicationId: app.id },
    include: { programme: true },
  });

  if (!offer) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-2xl font-bold">Admission letter</h1>
        <p className="mt-3 text-ink-500">No offer has been issued yet. Check back after your application is reviewed.</p>
      </div>
    );
  }

  const acceptanceInvoice = await db.invoice.findFirst({
    where: { userId: user.id, kind: "ACCEPTANCE", meta: { path: ["applicationId"], equals: app.id } },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-lg border-2 border-brand-800 bg-white p-8 print:border-none">
        <div className="flex items-center justify-between border-b border-ink-300/60 pb-4">
          <div>
            <div className="text-lg font-bold text-brand-800">CampusCore Demo University</div>
            <div className="text-xs text-ink-500">Office of the Registrar</div>
          </div>
          <div className="text-right text-xs text-ink-500">
            <div>Ref: {app.refNo}</div>
            <div>Issued: {offer.issuedAt.toLocaleDateString()}</div>
          </div>
        </div>

        <h1 className="mt-6 text-xl font-bold">Offer of Admission</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-700">
          Dear {[app.firstName, app.surname].filter(Boolean).join(" ") || user.name},
          <br /><br />
          I am pleased to inform you that you have been offered admission to study{" "}
          <strong>{offer.programme.name}</strong> at CampusCore Demo University, subject to the terms and
          conditions of the university.
          <br /><br />
          Please accept this offer and pay the acceptance fee by the deadline shown below to secure your place.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 rounded-md bg-ink-50 p-4 text-sm">
          <div><span className="text-ink-500">Programme</span><div className="font-medium">{offer.programme.name}</div></div>
          <div><span className="text-ink-500">Offer expires</span><div className="font-medium">{offer.expiresAt?.toLocaleDateString() ?? "—"}</div></div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-ink-300/60 pt-4">
          <div className="text-xs text-ink-500">
            Verify this letter at <span className="font-mono">/verify/{offer.letterCode}</span>
          </div>
          <Link
            href={`/verify/${offer.letterCode}`}
            className="rounded-md border border-ink-300 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-100 print:hidden"
          >
            Open verification page
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
        Beware of fake admission letters. This university never asks for payment to a private individual&apos;s
        account. Always confirm a letter using the public verification code above.
      </div>

      {app.status === "OFFER_ISSUED" && (
        <div className="mt-6 flex flex-wrap gap-3">
          {!acceptanceInvoice ? (
            <form action={acceptOffer}>
              <input type="hidden" name="applicationId" value={app.id} />
              <button type="submit" className="rounded-md bg-brand-800 px-5 py-2.5 font-medium text-white hover:bg-brand-700">
                Accept offer
              </button>
            </form>
          ) : acceptanceInvoice.status !== "PAID" ? (
            <form action={payAcceptanceFeeMock}>
              <input type="hidden" name="applicationId" value={app.id} />
              <button type="submit" className="rounded-md bg-brand-800 px-5 py-2.5 font-medium text-white hover:bg-brand-700">
                Pay acceptance fee to confirm
              </button>
            </form>
          ) : null}
          <form action={declineOffer}>
            <input type="hidden" name="applicationId" value={app.id} />
            <button type="submit" className="rounded-md border border-ink-300 px-5 py-2.5 font-medium text-ink-700 hover:bg-ink-100">
              Decline offer
            </button>
          </form>
        </div>
      )}

      {app.status === "ACCEPTED" && (
        <div className="mt-6 rounded-md bg-brand-50 p-4 text-sm text-brand-900">
          You have accepted this offer. Enrollment instructions will follow once the Registrar processes your
          admission (Phase 2).
        </div>
      )}
    </div>
  );
}
