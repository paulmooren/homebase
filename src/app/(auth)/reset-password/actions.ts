"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";

import { auth } from "@/lib/auth";
import { isDemoServer } from "@/lib/demo";

export async function resetPassword(formData: FormData) {
  if (isDemoServer()) redirect("/signin");
  const token = String(formData.get("token") ?? "");
  const newPassword = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!token) redirect("/reset-password?error=INVALID_TOKEN");
  const back = `/reset-password?token=${encodeURIComponent(token)}`;
  if (newPassword.length < 8) redirect(`${back}&error=weak-password`);
  if (newPassword !== confirm) redirect(`${back}&error=mismatch`);

  try {
    await auth.api.resetPassword({ body: { newPassword, token }, headers: await headers() });
  } catch (error) {
    if (error instanceof APIError) redirect("/reset-password?error=INVALID_TOKEN");
    throw error;
  }
  redirect("/signin?reset=1");
}
