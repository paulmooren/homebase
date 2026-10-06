import { TabBar } from "@/components/tab-bar";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <TabBar
        tabs={[
          { href: "/settings/profile", label: "Profile" },
          { href: "/settings/categories", label: "Categories" },
          { href: "/settings/household", label: "Household" },
          { href: "/settings/notifications", label: "Notifications" },
          { href: "/settings/data", label: "Data" },
        ]}
      />
      <div className="max-w-[560px]">{children}</div>
    </div>
  );
}
