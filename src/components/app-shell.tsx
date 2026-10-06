"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { trpc } from "@/trpc/react";
import { Avatar } from "@/components/avatar";
import { useModules } from "@/components/use-modules";
import type { ModuleKey } from "@/lib/modules";

import {
  DashboardIcon,
  ListIcon,
  SettingsIcon,
  TasksIcon,
  TransactionsIcon,
  VaultIcon,
} from "@/components/nav-icons";

// `modules` ties an item to Household-switchable Modules (shown if any is on); items without one are always shown.
const ALL_NAV_ITEMS: { href: string; label: string; Icon: typeof DashboardIcon; modules?: ModuleKey[] }[] = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/finance", label: "Finance", Icon: TransactionsIcon, modules: ["finance"] },
  { href: "/tasks", label: "Tasks", Icon: TasksIcon, modules: ["tasks"] },
  { href: "/lists", label: "Lists", Icon: ListIcon, modules: ["shopping", "wishlist"] },
  { href: "/vault", label: "Vault", Icon: VaultIcon, modules: ["vault"] },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * The frame of the app: a light-grey shell (sidebar, bottom bar) around one
 * white content panel, so the eye lands on the content, not the navigation.
 * On desktop the panel floats inside the shell with rounded corners; on a
 * phone it runs edge to edge and only the bottom bar stays grey.
 */
export function AppShell({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: me } = trpc.user.me.useQuery();
  const { isEnabled } = useModules();
  const NAV_ITEMS = ALL_NAV_ITEMS.filter((item) => !item.modules || item.modules.some(isEnabled));

  const section = [...NAV_ITEMS, { href: "/settings", label: "Settings" }].find((item) =>
    pathname.startsWith(item.href),
  );
  // The dashboard greets you; every other page is titled by its section.
  const title = section?.href === "/dashboard" || !section ? `${greeting()}, ${userName}` : section.label;

  const settingsActive = pathname.startsWith("/settings");

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Desktop sidebar — same grey as the shell, no panel of its own */}
      <nav className="fixed inset-y-0 left-0 z-20 hidden w-[240px] flex-col px-5 pt-7 pb-5 md:flex">
        <div className="mb-9 flex items-center gap-2.5 px-2">
          <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-accent-fill">
            <span className="font-display text-[16px] font-bold text-accent-ink">K</span>
          </div>
          <span className="font-display text-[17px] font-bold tracking-tight">Kontor</span>
        </div>

        <div className="flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] transition-colors ${
                  active ? "font-semibold text-text" : "font-medium text-text-muted hover:text-text"
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

        <Link
          href="/settings"
          className={`mb-3 px-3 py-1.5 text-[13.5px] transition-colors ${
            settingsActive ? "font-semibold text-text" : "font-medium text-text-muted hover:text-text"
          }`}
        >
          Settings
        </Link>
        <Link
          href="/settings"
          aria-label="Your profile and settings"
          className="flex items-center gap-2.5 rounded-xl border border-border-soft bg-surface px-3 py-2.5 transition-colors hover:border-border"
        >
          <Avatar name={userName} image={me?.image} size={26} />
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{userName}</span>
        </Link>
      </nav>

      {/* Mobile bottom bar — the one grey strip left on a phone */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-border-soft bg-bg px-1.5 py-2 md:hidden [padding-bottom:calc(0.5rem+env(safe-area-inset-bottom))]">
        {[...NAV_ITEMS, { href: "/settings", label: "More", Icon: SettingsIcon }].map(
          ({ href, label, Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 px-1.5 py-1.5 sm:px-2.5 ${
                  active ? "text-text" : "text-text-faint"
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

      <main className="w-full min-w-0 md:ml-[240px] md:py-3 md:pr-3">
        <div className="min-h-screen bg-surface px-4 pt-7 pb-28 md:min-h-[calc(100vh-1.5rem)] md:rounded-[24px] md:px-10 md:pt-9 md:pb-14">
          <div className="mx-auto max-w-[1180px]">
            <h1 className="mb-7 font-display text-[26px] font-bold tracking-tight md:text-[32px]">{title}</h1>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
