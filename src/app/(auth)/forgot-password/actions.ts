"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { isDemoServer } from "@/lib/demo";

export async function requestPasswordReset(formData: FormData) {
  if (isDemoServer()) redirect("/signin");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email) {
    try {
      await auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" }, headers: await headers() });
    } catch (error) {
      // Same answer whether or not the address has an account (and whether or not the email went out), so this
      // form can't be used to find out who is registered.
      console.error("password reset request failed", error);
    }
  }
  redirect("/forgot-password?sent=1");
}
