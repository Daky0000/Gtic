import { redirect } from "next/navigation";

// System settings moved to the developer portal (developer-only console).
export default function LegacySettingsRedirect() {
  redirect("/developer/settings");
}
