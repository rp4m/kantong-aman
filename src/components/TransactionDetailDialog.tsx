import { useMemo } from "react";
import { CalendarDays, CircleDollarSign, StickyNote, User, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBudgetItems, useBudgetPeriods, useCategories, usePICs, useProfiles, getProfileById } from "@/lib/cloud-store";
import { formatDate, formatRupiah } from "@/lib/budget-format";
import type { Transaction } from "@/lib/budget-types";
import { cn } from "@/lib/utils";

interface Props {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionDetailDialog({ transaction, open, onOpenChange }: Props) {
  const categories = useCategories();
  const periods = useBudgetPeriods();
  const budgetItems = useBudgetItems();
  const pics = usePICs();
  useProfiles();

  const detail = useMemo(() => {
    if (!transaction) return null;

    const category = categories.find((item) => item.name === transaction.category);
    const budgetItem = transaction.budgetItemId
      ? budgetItems.find((item) => item.id === transaction.budgetItemId)
      : undefined;
    const budgetPeriod = budgetItem
      ? periods.find((item) => item.id === budgetItem.budgetPeriodId)
      : undefined;
    const pic = budgetItem ? pics.find((item) => item.id === budgetItem.picId) : undefined;
    const budgetPeriodId = (transaction as Transaction & { budgetPeriodId?: string }).budgetPeriodId;
    const fallbackPeriod = budgetPeriodId
      ? periods.find((item) => item.id === budgetPeriodId)
      : undefined;
    const creator = transaction.createdBy ? getProfileById(transaction.createdBy) : undefined;

    return {
      category,
      budgetItem,
      budgetPeriod: budgetPeriod ?? fallbackPeriod,
      pic,
      creator,
    };
  }, [transaction, categories, periods, budgetItems, pics]);

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <DialogTitle className="text-left">Detail Transaksi</DialogTitle>
              <DialogDescription className="mt-1 text-left">
                Informasi lengkap transaksi yang dipilih.
              </DialogDescription>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-semibold",
                transaction.type === "income"
                  ? "bg-income-soft text-income"
                  : "bg-expense-soft text-expense",
              )}
            >
              {transaction.type === "income" ? "Pemasukan" : "Pengeluaran"}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-2xl bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Nominal</p>
            <p className={cn("mt-1 text-2xl font-semibold", transaction.type === "income" ? "text-income" : "text-expense")}>
              {formatRupiah(transaction.amount)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailItem icon={CalendarDays} label="Tanggal" value={formatDate(transaction.date)} />
            <DetailItem icon={CircleDollarSign} label="Kategori" value={transaction.category} />
            {detail?.budgetPeriod ? (
              <DetailItem icon={CircleDollarSign} label="Budget Periode" value={detail.budgetPeriod.name} />
            ) : null}
            {detail?.pic ? (
              <DetailItem icon={User} label="PIC" value={detail.pic.name} />
            ) : null}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <StickyNote className="h-4 w-4" />
              Catatan
            </div>
            <p className="text-sm text-muted-foreground">
              {transaction.notes?.trim() ? transaction.notes : "Tidak ada catatan."}
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-2xl bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {transaction.type === "income" ? <ArrowDownLeft className="h-4 w-4 text-income" /> : <ArrowUpRight className="h-4 w-4 text-expense" />}
            <span>
              {detail?.creator?.fullName ? `Dicatat oleh ${detail.creator.fullName}` : "Detail transaksi"}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailItem({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}
