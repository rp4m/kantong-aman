import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useTransactions, useBudgetPeriods, useProfiles, getProfileById } from "@/lib/cloud-store";
import { formatRupiah, formatDate } from "@/lib/budget-format";
import { ArrowDownLeft, ArrowUpRight, Calendar, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";

const PREVIEW_LIMIT = 10;

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

  const { allFiltered, preview, hasMore } = useMemo(() => {
    if (!categoryName) return { allFiltered: [], preview: [], hasMore: false };
    const allFiltered = transactions
      .filter((t) => t.category.toLowerCase() === categoryName.toLowerCase())
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.createdAt.localeCompare(a.createdAt);
      });
    return {
      allFiltered,
      preview: allFiltered.slice(0, PREVIEW_LIMIT),
      hasMore: allFiltered.length > PREVIEW_LIMIT,
    };
  }, [transactions, categoryName]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[82vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border">
          <DialogTitle className="text-base font-bold">
            Riwayat Transaksi: {categoryName}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            {allFiltered.length === 0
              ? "Belum ada transaksi untuk kategori ini"
              : `${allFiltered.length} transaksi di semua periode budget`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {preview.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground px-6">
              Tidak ada transaksi untuk kategori ini.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {preview.map((t) => {
                const creator = getProfileById(t.createdBy);
                const period = periods.find((p) => p.id === (t as any).budgetPeriodId);
                return (
                  <li key={t.id} className="flex items-start gap-3 px-6 py-3.5">
                    <div className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full mt-0.5",
                      t.type === "income" ? "bg-income-soft text-income" : "bg-expense-soft text-expense",
                    )}>
                      {t.type === "income" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-snug">{t.category}</p>
                        <p className={cn(
                          "text-sm font-bold shrink-0 leading-snug",
                          t.type === "income" ? "text-income" : "text-expense"
                        )}>
                          {formatRupiah(t.amount)}
                        </p>
                      </div>

                      {t.notes && (
                        <p className="text-xs text-muted-foreground break-words">{t.notes}</p>
                      )}

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

        {/* Footer — selengkapnya link */}
        {allFiltered.length > 0 && (
          <div className="border-t border-border px-6 py-3 flex items-center justify-between bg-muted/30">
            <p className="text-[11px] text-muted-foreground">
              {hasMore
                ? `Menampilkan ${PREVIEW_LIMIT} dari ${allFiltered.length} transaksi`
                : `${allFiltered.length} transaksi ditampilkan`}
            </p>
            <Link
              to="/transaksi"
              search={{ filterCategory: categoryName }}
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              Selengkapnya <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
