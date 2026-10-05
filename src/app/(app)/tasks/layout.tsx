import { ModuleGate } from "@/components/use-modules";

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="tasks">{children}</ModuleGate>;
}
