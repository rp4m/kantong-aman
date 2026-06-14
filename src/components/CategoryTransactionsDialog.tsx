import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useTransactions, useBudgetPeriods, useProfiles, getProfileById } from "@/lib/cloud-store";
import { formatRupiah, formatDate } from "@/lib/budget-format";
import { ArrowDownLeft, ArrowUpRight, Calendar } from "lucide-react";
import { formatDistanceToNow, differenceInDays, format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface CategoryTransactionsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  categoryName: string;
}

export function CategoryTransactionsDialog({
  isOpen,
  onOpenChange,
  categoryName,
}: CategoryTransactionsDialogProps) {
  const transactions = useTransactions();
  const periods = useBudgetPeriods();
  useProfiles();

  const filteredTransactions = useMemo(() => {
    if (!categoryName) return [];
    return transactions
      .filter((t) => t.category.toLowerCase() === categoryName.toLowerCase())
      .sort((a, b) => {
        // sort by transaction date descending
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date);
        }
        // fallback to createdAt descending
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [transactions, categoryName]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg font-bold">
            Riwayat Transaksi: {categoryName}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Menampilkan semua transaksi dari kategori ini di semua periode budget
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-3 mt-2">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Tidak ada transaksi untuk kategori ini.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filteredTransactions.map((t) => {
                const creator = getProfileById(t.createdBy);
                const period = periods.find((p) => p.id === (t as any).budgetPeriodId);
                return (
                  <li key={t.id} className="flex items-start gap-3 py-3">
                    <div className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full mt-0.5",
                      t.type === "income" ? "bg-income-soft text-income" : "bg-expense-soft text-expense",
                    )}>
                      {t.type === "income" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{t.category}</p>
                        <p className={cn(
                          "text-sm font-bold shrink-0",
                          t.type === "income" ? "text-income" : "text-expense"
                        )}>
                          {formatRupiah(t.amount)}
                        </p>
                      </div>

                      {t.notes ? (
                        <p className="text-xs text-foreground font-normal break-words">{t.notes}</p>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(t.date)}
                        </span>
                        
                        {period && (
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-medium text-primary">
                            📦 {period.name}
                          </span>
                        )}

                        {creator && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
                            👤 {creator.fullName}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
