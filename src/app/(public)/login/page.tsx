import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already signed in? Straight to their portal instead of a dead-end form.
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return <LoginForm />;
}
