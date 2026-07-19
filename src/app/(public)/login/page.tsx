import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string; email?: string; error?: string }>;
}) {
  // Already signed in? Straight to their portal instead of a dead-end form.
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const { registered, email, error } = await searchParams;
  return <LoginForm registered={registered === "1"} presetEmail={email} notice={error} />;
}
