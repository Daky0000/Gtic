"use server";

import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { ROLES } from "@/lib/rbac";

export type SignupState = { error: string } | null;

/**
 * Public self-registration for applicants (AP-01). Creates the auth account,
 * signs the user in (session cookie via better-auth's nextCookies plugin) and
 * grants the `applicant` role so /apply opens immediately.
 */
export async function registerApplicant(
  _prev: SignupState,
  formData: FormData
): Promise<SignupState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (name.length < 2) return { error: "Enter your full name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  let userId: string;
  try {
    const res = await auth.api.signUpEmail({
      body: { name, email, password },
    });
    userId = res.user.id;
  } catch (e) {
    if (e instanceof APIError) {
      return { error: e.message || "Could not create your account." };
    }
    throw e;
  }

  const role = await db.role.findUniqueOrThrow({ where: { code: ROLES.APPLICANT } });
  await db.roleAssignment.create({ data: { userId, roleId: role.id } });

  await audit({ actorId: userId, action: "account.applicant_registered", entityType: "User", entityId: userId });
  await notify(
    userId,
    "Welcome to CampusCore",
    "Your applicant account is ready. Complete your application, upload your documents and pay the application fee to submit.",
    "/apply"
  );

  redirect("/apply");
}
