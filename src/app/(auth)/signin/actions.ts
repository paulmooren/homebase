"use server";

import { signIn } from "@/lib/auth";

export async function signInWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  await signIn("resend", { email, redirectTo: "/dashboard" });
}
