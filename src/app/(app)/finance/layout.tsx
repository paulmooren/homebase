import { FinanceTabs } from "@/components/finance/finance-tabs";
import { ModuleGate } from "@/components/use-modules";

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleGate module="finance">
      <FinanceTabs>{children}</FinanceTabs>
    </ModuleGate>
  );
}
