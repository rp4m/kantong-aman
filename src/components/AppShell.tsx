import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { NotificationBell } from "./NotificationBell";
import { ChatbotPopup } from "./ChatbotPopup";

interface AppShellProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function AppShell({ title, subtitle, action, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight text-foreground">{title}</h1>
            {subtitle ? (
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            {action}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-4">{children}</main>
      <BottomNav />
      <ChatbotPopup />
    </div>
  );
}
