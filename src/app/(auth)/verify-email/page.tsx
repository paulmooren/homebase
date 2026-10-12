import Link from "next/link";

import { AuthFrame } from "@/components/auth-frame";
import { AuthHeader, AuthNote } from "@/components/auth-ui";

const NOTES: Record<string, string> = {
  invalid: "That confirmation link is invalid or has expired. Sign in and we'll send you a new one.",
  unverified: "Your email isn't confirmed yet. We've just sent you a new link.",
};

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ error?: string; state?: string }> }) {
  const { error, state } = await searchParams;
  const note = error ? NOTES.invalid : state ? NOTES[state] : null;

  return (
    <AuthFrame>
      <div>
        <AuthHeader eyebrow="One more step" title="Check your email" />
        {note && <AuthNote>{note}</AuthNote>}
        <p className="text-[14px] leading-relaxed text-text-muted">
          We sent you a link to confirm your email address. Open it and you&apos;re in. It can take a minute, and it&apos;s
          worth a look in your spam folder.
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-text-muted">
          Lost it? Try signing in and we&apos;ll send a new one.
        </p>
        <p className="mt-5 text-center text-[13px] text-text-muted">
          <Link href="/signin" className="font-semibold text-accent hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthFrame>
  );
}
