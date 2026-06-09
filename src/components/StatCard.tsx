import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { formatRupiah } from "@/lib/budget-format";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number;
  tone?: "income" | "expense" | "balance" | "neutral";
  icon?: LucideIcon;
  className?: string;
  hint?: string;
}

const toneStyles = {
  income: "bg-income-soft text-income",
  expense: "bg-expense-soft text-expense",
  balance: "bg-balance-soft text-balance",
  neutral: "bg-muted text-foreground",
} as const;

export function StatCard({ label, value, tone = "neutral", icon: Icon, className, hint }: StatCardProps) {
  const ToneIcon =
    Icon ?? (tone === "income" ? ArrowDownRight : tone === "expense" ? ArrowUpRight : ArrowRight);
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 shadow-sm", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              "mt-1 text-xl font-bold tracking-tight",
              tone === "income" && "text-income",
              tone === "expense" && "text-expense",
              tone === "balance" && "text-balance",
            )}
          >
            {formatRupiah(value)}
          </p>
          {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", toneStyles[tone])}>
          <ToneIcon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
