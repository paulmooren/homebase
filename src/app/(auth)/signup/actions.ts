"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isDemoServer } from "@/lib/demo";

export async function signUpWithPassword(formData: FormData) {
  if (isDemoServer()) redirect("/signin");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!email || password.length < 8) {
    redirect("/signup?error=weak-password");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirect("/signup?error=email-taken");
  }

  try {
    await auth.api.signUpEmail({
      body: { email, password, name: name || email.split("@")[0] },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) redirect("/signup?error=unknown");
    throw error;
  }
  redirect("/dashboard");
}
