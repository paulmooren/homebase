"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  DashboardIcon,
  SettingsIcon,
  TasksIcon,
  TransactionsIcon,
} from "@/components/nav-icons";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/finance", label: "Finance", Icon: TransactionsIcon },
  { href: "/tasks", label: "Tasks", Icon: TasksIcon },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AppShell({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const eyebrow =
    [...NAV_ITEMS, { href: "/settings", label: "Admin" }].find((item) =>
      pathname.startsWith(item.href),
    )?.label ?? "Kontor";

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <nav className="fixed inset-y-0 left-0 z-20 hidden w-[240px] flex-col border-r border-border-soft bg-[rgba(255,255,255,0.75)] px-4 pt-6 pb-4 backdrop-blur-md md:flex">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-accent-fill">
            <span className="pl-[2px] font-serif text-[16px] italic text-accent-ink">
              K
            </span>
          </div>
          <span className="font-serif text-[16px]">Kontor</span>
        </div>

        <div className="flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
                  active ? "text-text" : "text-text-muted hover:text-text"
                }`}
              >
                <span className="block h-[18px] w-[18px] shrink-0">
                  <Icon active={active} />
                </span>
                {label}
              </Link>
            );
          })}
        </div>

        <div className="flex-1" />

        <div className="flex flex-col gap-0.5 px-3 pb-1 text-[13px]">
          <Link
            href="/settings"
            className={`py-1.5 transition-colors ${
              pathname.startsWith("/settings")
                ? "font-medium text-text"
                : "text-text-muted hover:text-text"
            }`}
          >
            Admin
          </Link>
        </div>
      </nav>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-border-soft bg-[rgba(255,255,255,0.92)] px-1.5 py-2 backdrop-blur-md md:hidden [padding-bottom:calc(0.5rem+env(safe-area-inset-bottom))]">
        {[...NAV_ITEMS, { href: "/settings", label: "More", Icon: SettingsIcon }].map(
          ({ href, label, Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 px-2.5 py-1.5 ${
                  active ? "text-accent" : "text-text-faint"
                }`}
              >
                <span className="block h-5 w-5">
                  <Icon active={active} />
                </span>
                <span className="text-[10.5px]">{label}</span>
              </Link>
            );
          },
        )}
      </nav>

      <main className="w-full min-w-0 px-4 pt-6 pb-24 md:ml-[240px] md:px-10 md:pt-8 md:pb-14">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-[0.11em] text-accent uppercase">
                {eyebrow}
              </p>
              <h1 className="mb-1 font-serif text-[26px] md:text-[30px]">
                {greeting()}, {userName}
              </h1>
              <p className="text-[13px] text-text-muted">{today}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2 text-[12.5px] font-semibold text-text-muted">
              {initials(userName)}
            </div>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}
