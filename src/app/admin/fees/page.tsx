import { redirect } from "next/navigation";

// Fees & pricing moved to the developer portal (developer-only console).
export default function LegacyFeesRedirect() {
  redirect("/developer/fees");
}
