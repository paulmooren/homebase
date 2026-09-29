import { FinanceTabs } from "@/components/finance/finance-tabs";

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return <FinanceTabs>{children}</FinanceTabs>;
}
