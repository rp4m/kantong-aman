import { useMemo } from "react";
import { CalendarDays, Wallet, StickyNote, User, ArrowDownLeft, ArrowUpRight, Tag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBudgetItems, useBudgetPeriods, useCategories, usePICs, useProfiles, getProfileById } from "@/lib/cloud-store";
import { formatDate, formatRupiah } from "@/lib/budget-format";
import type { Transaction } from "@/lib/budget-types";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, differenceInDays, format as formatDate2 } from "date-fns";
import { id as idLocale } from "date-fns/locale";

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

  const isIncome = transaction.type === "income";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        {/* Header band */}
        <div
          className={cn(
            "relative px-6 pb-6 pt-5",
            isIncome
              ? "bg-gradient-to-br from-income/10 via-income/5 to-transparent"
              : "bg-gradient-to-br from-expense/10 via-expense/5 to-transparent",
          )}
        >
          <DialogHeader className="space-y-0">
            <div className="flex items-start justify-between gap-3 pr-8">
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                  isIncome ? "bg-income text-white" : "bg-expense text-white",
                )}
              >
                {isIncome ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
              </div>
              <div className="flex-1 text-left">
                <DialogTitle className="text-base font-semibold leading-tight">
                  {transaction.category}
                </DialogTitle>
                <p
                  className={cn(
                    "mt-0.5 text-xs font-medium",
                    isIncome ? "text-income" : "text-expense",
                  )}
                >
                  {isIncome ? "Pemasukan" : "Pengeluaran"} &middot; {formatDate(transaction.date)}
                </p>
              </div>
            </div>
          </DialogHeader>

          <p
            className={cn(
              "mt-5 text-3xl font-bold tracking-tight",
              isIncome ? "text-income" : "text-expense",
            )}
          >
            {formatRupiah(transaction.amount)}
          </p>
        </div>

        {/* Body */}
        <div className="space-y-1 px-6 pb-6 pt-1">
          <InfoRow icon={Tag} label="Kategori" value={transaction.category} />
          {detail?.budgetPeriod ? (
            <InfoRow icon={Wallet} label="Budget Periode" value={detail.budgetPeriod.name} />
          ) : null}
          {detail?.pic ? <InfoRow icon={User} label="PIC" value={detail.pic.name} /> : null}
          <InfoRow icon={CalendarDays} label="Tanggal" value={formatDate(transaction.date)} />

          <div className="my-3 h-px bg-border" />

          <div className="flex items-start gap-3 py-2">
            <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Catatan
              </p>
              <p className="mt-0.5 text-sm text-foreground/80">
                {transaction.notes?.trim() ? transaction.notes : "Tidak ada catatan."}
              </p>
            </div>
          </div>

          {detail?.creator?.fullName ? (
            // <p className="pt-2 text-center text-xs text-muted-foreground">
            //   Dicatat oleh <span className="font-medium text-foreground/70">{detail.creator.fullName}</span>
            //   <span className="mx-1">•</span>
            //     {differenceInDays(new Date(), new Date(t.createdAt)) > 0
            //         ? formatDate2(new Date(t.createdAt), "dd MMM yyyy", { locale: idLocale })
            //         : formatDistanceToNow(new Date(t.createdAt), { addSuffix: true, locale: idLocale })}
            // </p>
            <div className="mt-2 flex items-baseline justify-center gap-1">
                <span className="shrink-0 text-[10px] text-emerald-600">👤</span>
                <p className="max-w-[85%] truncate text-center text-[10px] font-light text-emerald-600">
                    {detail.creator.fullName}
                    <span className="mx-1">•</span>
                    {differenceInDays(new Date(), new Date(transaction.createdAt)) > 0
                    ? formatDate2(new Date(transaction.createdAt), "dd MMM yyyy", { locale: idLocale })
                    : formatDistanceToNow(new Date(transaction.createdAt), { addSuffix: true, locale: idLocale })}
                </p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
