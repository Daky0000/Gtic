import { requireFeesConsole } from "@/lib/rbac";
import { FeesConsole } from "./fees-console";

export const metadata = { title: "Fees & Pricing" };

export default async function DeveloperFeesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireFeesConsole();
  return <FeesConsole basePath="/developer/fees" isDev={true} searchParams={await searchParams} />;
}
