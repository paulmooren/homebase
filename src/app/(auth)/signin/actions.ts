"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";

import { auth } from "@/lib/auth";
import { isDemoServer } from "@/lib/demo";

export async function signInWithGoogle() {
  const { url } = await auth.api.signInSocial({
    body: { provider: "google", callbackURL: "/dashboard", errorCallbackURL: "/signin" },
    headers: await headers(),
  });
  redirect(url ?? "/signin?error=unknown");
}

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  try {
    await auth.api.signInEmail({ body: { email, password, callbackURL: "/dashboard" }, headers: await headers() });
  } catch (error) {
    if (error instanceof APIError) {
      // Right password but the email was never confirmed: Better Auth has just emailed a new link.
      if (error.body?.code === "EMAIL_NOT_VERIFIED") redirect("/verify-email?state=unverified");
      redirect("/signin?error=invalid-credentials");
    }
    throw error;
  }
  redirect("/dashboard");
}

/** The Demo's sign-in as one of its two made-up people. Does nothing outside the Demo. */
export async function signInAsPersona(formData: FormData) {
  if (!isDemoServer()) redirect("/signin");
  await auth.api.signInDemo({ body: { persona: String(formData.get("persona") ?? "") }, headers: await headers() });
  redirect("/dashboard");
}
