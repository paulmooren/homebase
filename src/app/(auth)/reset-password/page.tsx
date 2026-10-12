import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@base-ui/react/button";
import { Input } from "@base-ui/react/input";

import { AuthFrame } from "@/components/auth-frame";
import { AuthError, AuthHeader, authInputClass, authPrimaryButtonClass } from "@/components/auth-ui";
import { isDemoServer } from "@/lib/demo";
import { resetPassword } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  "weak-password": "Password must be at least 8 characters.",
  mismatch: "The two passwords don't match.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  if (isDemoServer()) redirect("/signin");
  const { token, error } = await searchParams;

  // Better Auth sends people here with ?error=INVALID_TOKEN when the emailed link is wrong or expired.
  if (!token || error === "INVALID_TOKEN") {
    return (
      <AuthFrame>
        <div>
          <AuthHeader eyebrow="Password" title="That link has expired" />
          <p className="text-[14px] leading-relaxed text-text-muted">
            Reset links work once, for one hour. Ask for a new one and we&apos;ll send it right away.
          </p>
          <p className="mt-5 text-center text-[13px] text-text-muted">
            <Link href="/forgot-password" className="font-semibold text-accent hover:underline">
              Send a new link
            </Link>
          </p>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      <div>
        <AuthHeader eyebrow="Password" title="Choose a new password" />
        {error && ERROR_MESSAGES[error] && <AuthError>{ERROR_MESSAGES[error]}</AuthError>}
        <form action={resetPassword} className="flex flex-col gap-3">
          <input type="hidden" name="token" value={token} />
          <Input
            type="password"
            name="password"
            required
            minLength={8}
            placeholder="New password (min. 8 characters)"
            className={authInputClass}
          />
          <Input type="password" name="confirm" required minLength={8} placeholder="Repeat the new password" className={authInputClass} />
          <Button type="submit" className={authPrimaryButtonClass}>
            Save password
          </Button>
        </form>
      </div>
    </AuthFrame>
  );
}
