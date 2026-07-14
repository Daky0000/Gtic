export const APPLICATION_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft — not yet submitted",
  SUBMITTED: "Submitted — awaiting review",
  UNDER_REVIEW: "Under review",
  INFO_REQUESTED: "Action needed — more information requested",
  RECOMMENDED: "Recommendation recorded — awaiting final decision",
  APPROVED: "Approved",
  OFFER_ISSUED: "Admission offer issued",
  ACCEPTED: "Offer accepted — welcome!",
  DECLINED: "Offer declined",
  REJECTED: "Not successful this cycle",
  ENROLLED: "Enrolled as a student",
};

export const APPLICATION_STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-ink-100 text-ink-700",
  SUBMITTED: "bg-blue-100 text-blue-800",
  UNDER_REVIEW: "bg-blue-100 text-blue-800",
  INFO_REQUESTED: "bg-amber-100 text-amber-800",
  RECOMMENDED: "bg-purple-100 text-purple-800",
  APPROVED: "bg-purple-100 text-purple-800",
  OFFER_ISSUED: "bg-brand-100 text-brand-800",
  ACCEPTED: "bg-brand-100 text-brand-800",
  DECLINED: "bg-ink-100 text-ink-700",
  REJECTED: "bg-red-100 text-red-800",
  ENROLLED: "bg-brand-100 text-brand-800",
};
