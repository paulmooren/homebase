import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@base-ui/react/button";
import { Input } from "@base-ui/react/input";

import { AuthFrame } from "@/components/auth-frame";
import { AuthHeader, AuthNote, authInputClass, authPrimaryButtonClass } from "@/components/auth-ui";
import { isDemoServer } from "@/lib/demo";
import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  if (isDemoServer()) redirect("/signin");
  const { sent } = await searchParams;

  return (
    <AuthFrame>
      <div>
        <AuthHeader eyebrow="Password" title="Forgot your password?" />
        {sent ? (
          <AuthNote>If that email has a Nest account, a reset link is on its way. It works for one hour.</AuthNote>
        ) : (
          <>
            <p className="mb-4 text-[14px] leading-relaxed text-text-muted">
              Enter your email and we&apos;ll send you a link to choose a new one.
            </p>
            <form action={requestPasswordReset} className="flex flex-col gap-3">
              <Input type="email" name="email" required placeholder="you@example.com" className={authInputClass} />
              <Button type="submit" className={authPrimaryButtonClass}>
                Send reset link
              </Button>
            </form>
          </>
        )}
        <p className="mt-5 text-center text-[13px] text-text-muted">
          <Link href="/signin" className="font-semibold text-accent hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthFrame>
  );
}
