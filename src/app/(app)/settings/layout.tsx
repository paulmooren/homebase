import { TabBar } from "@/components/tab-bar";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <TabBar
        tabs={[
          { href: "/settings/profile", label: "Profile" },
          { href: "/settings/categories", label: "Categories" },
          { href: "/settings/household", label: "Household" },
          { href: "/settings/data", label: "Data" },
        ]}
      />
      <div className="rounded-[20px] border border-border-soft bg-surface px-6 py-6 md:px-10 md:py-8">
        <div className="max-w-[560px]">{children}</div>
      </div>
    </div>
  );
}
