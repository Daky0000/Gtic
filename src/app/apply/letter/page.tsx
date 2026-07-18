import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getOrCreateDraftApplication, acceptOffer, payAcceptanceFee, declineOffer } from "@/lib/actions/admissions";
import { Flash } from "@/components/flash";

export const metadata = { title: "Admission Letter" };

export default async function LetterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; paid?: string }>;
}) {
  const user = await requirePortal("apply");
  const { error, paid } = await searchParams;
  const app = await getOrCreateDraftApplication(user.id);
  if (!app) redirect("/apply");

  const offer = await db.offer.findUnique({
    where: { applicationId: app.id },
    include: { programme: true },
  });

  if (!offer) {
    return (
      <div className="scr mx-auto max-w-2xl">
        <h1 className="font-serif text-[30px] font-normal leading-[1.1]">
          Admission <em className="text-forest">letter.</em>
        </h1>
        <div className="mt-6 rounded-2xl border border-line bg-paper p-6 text-sm leading-[1.6] text-muted">
          No offer has been issued yet — your letter will appear here the moment the admissions
          office makes a decision, and you&apos;ll get a notification too. In the meantime you can
          track progress from your{" "}
          <Link href="/apply" className="text-forest hover:text-moss">
            overview page
          </Link>
          .
        </div>
      </div>
    );
  }

  const acceptanceInvoice = await db.invoice.findFirst({
    where: { userId: user.id, kind: "ACCEPTANCE", meta: { path: ["applicationId"], equals: app.id } },
  });
  const institution = await db.institution.findFirst();
  const institutionName = institution?.name ?? "SYDA — Green Energy & Innovation Center";

  // Server component rendered per-request, so reading the clock is sound here.
  // eslint-disable-next-line react-hooks/purity
  const expired = !offer.acceptedAt && !!offer.expiresAt && offer.expiresAt.getTime() < Date.now();

  return (
    <div className="mx-auto max-w-2xl">
      <Flash error={error} success={paid ? "Payment received — thank you." : undefined} />
      {expired && app.status === "OFFER_ISSUED" && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          This offer expired on {offer.expiresAt!.toLocaleDateString()}. Contact the admissions office if you
          still wish to take up your place.
        </div>
      )}
      <div className="rounded-lg border-2 border-brand-800 bg-white p-8 print:border-none">
        <div className="flex items-center justify-between border-b border-ink-300/60 pb-4">
          <div>
            <div className="text-lg font-bold text-brand-800">{institutionName}</div>
            <div className="text-xs text-ink-500">Admissions &amp; Training Office</div>
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
          I am pleased to inform you that you have been offered a place on our{" "}
          <strong>{offer.programme.name}</strong> training cohort at {institutionName}, subject to the terms
          and conditions of the Center.
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
        Beware of fake admission letters. The Center never asks for payment to a private individual&apos;s
        account. Always confirm a letter using the public verification code above.
      </div>

      {app.status === "OFFER_ISSUED" && !expired && (
        <div className="mt-6 flex flex-wrap gap-3">
          {!acceptanceInvoice ? (
            <form action={acceptOffer}>
              <input type="hidden" name="applicationId" value={app.id} />
              <button type="submit" className="rounded-full bg-forest px-5 py-2.5 font-medium text-white hover:bg-forest-deep">
                Accept offer
              </button>
            </form>
          ) : acceptanceInvoice.status !== "PAID" ? (
            <form action={payAcceptanceFee}>
              <input type="hidden" name="applicationId" value={app.id} />
              <button type="submit" className="rounded-full bg-forest px-5 py-2.5 font-medium text-white hover:bg-forest-deep">
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
