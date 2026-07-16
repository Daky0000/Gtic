export const APPLICATION_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft — not yet submitted",
  SUBMITTED: "Submitted — awaiting review",
  UNDER_REVIEW: "Under review",
  INFO_REQUESTED: "Action needed — more information requested",
  RECOMMENDED: "Recommendation recorded — awaiting final decision",
  APPROVED: "Approved",
  WAITLISTED: "On the waitlist",
  OFFER_ISSUED: "Admission offer issued",
  ACCEPTED: "Offer accepted — welcome!",
  DECLINED: "Offer declined",
  REJECTED: "Not successful this cycle",
  ENROLLED: "Enrolled as a student",
};

// Chip tone (see components/ui StatusChip) for the SYDA-GTIC design system.
export type StatusTone = "green" | "amber" | "sky" | "violet" | "neutral";
export const APPLICATION_STATUS_TONE: Record<string, StatusTone> = {
  DRAFT: "neutral",
  SUBMITTED: "sky",
  UNDER_REVIEW: "sky",
  INFO_REQUESTED: "amber",
  RECOMMENDED: "violet",
  APPROVED: "violet",
  WAITLISTED: "amber",
  OFFER_ISSUED: "green",
  ACCEPTED: "green",
  DECLINED: "neutral",
  REJECTED: "amber",
  ENROLLED: "green",
};

// Warm design-system chip colours (see StatusChip tones in components/ui).
export const APPLICATION_STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-line-soft text-muted",
  SUBMITTED: "bg-[#deebf0] text-[#2e6f86]",
  UNDER_REVIEW: "bg-[#deebf0] text-[#2e6f86]",
  INFO_REQUESTED: "bg-[#f3e3d6] text-[#a85a2e]",
  RECOMMENDED: "bg-[#e7e2f2] text-[#5b4a86]",
  APPROVED: "bg-[#e7e2f2] text-[#5b4a86]",
  WAITLISTED: "bg-[#f3e3d6] text-[#a85a2e]",
  OFFER_ISSUED: "bg-[#e4eee6] text-forest",
  ACCEPTED: "bg-[#e4eee6] text-forest",
  DECLINED: "bg-line-soft text-muted",
  REJECTED: "bg-[#f3e3d6] text-[#a85a2e]",
  ENROLLED: "bg-[#e4eee6] text-forest",
};
