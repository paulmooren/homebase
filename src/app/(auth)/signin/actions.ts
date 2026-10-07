"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

import { signIn } from "@/lib/auth";
import { isDemoServer } from "@/lib/demo";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/signin?error=${error.type}`);
    }
    throw error;
  }
}

/** The Demo's sign-in as one of its two made-up people. Does nothing outside the Demo. */
export async function signInAsPersona(formData: FormData) {
  if (!isDemoServer()) redirect("/signin");
  await signIn("demo", { persona: String(formData.get("persona") ?? ""), redirectTo: "/dashboard" });
}
