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

  // Self-healing: the seed normally creates roles, but a fresh production
  // database must never turn public signup into a 500 — create the role on
  // first use if it's missing. Atomic so an account is never left without a
  // role (the auth user already exists at this point regardless).
  await db.$transaction(async (tx) => {
    const role = await tx.role.upsert({
      where: { code: ROLES.APPLICANT },
      update: {},
      create: { code: ROLES.APPLICANT, name: "Prospective Applicant" },
    });
    await tx.roleAssignment.create({ data: { userId, roleId: role.id } });
  });

  await audit({ actorId: userId, action: "account.applicant_registered", entityType: "User", entityId: userId });
  // Best-effort: a notification failure must not undo the role grant above
  // or block the user from reaching their new account.
  try {
    await notify(
      userId,
      "Welcome to CampusCore",
      "Your applicant account is ready. Complete your application, upload your documents and pay the application fee to submit.",
      "/apply"
    );
  } catch (e) {
    console.error("[signup] welcome notification failed", e);
  }

  redirect("/apply");
}
