import { isDeveloper, requireDeveloperConsole } from "@/lib/rbac";
import { FeesConsole } from "../../developer/fees/fees-console";

export const metadata = { title: "Fees & Pricing" };

export default async function AdminFeesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const user = await requireDeveloperConsole();
  return <FeesConsole basePath="/admin/fees" isDev={isDeveloper(user)} searchParams={await searchParams} />;
}
