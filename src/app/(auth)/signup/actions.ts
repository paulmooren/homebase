"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { signIn } from "@/lib/auth";
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

  await prisma.user.create({
    data: { email, name: name || null, password: await hashPassword(password) },
  });

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/signup?error=${error.type}`);
    }
    throw error;
  }
}
