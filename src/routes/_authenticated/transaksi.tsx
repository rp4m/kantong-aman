import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  Plus, Search, Filter, Pencil, Trash2,
  ArrowDownLeft, ArrowUpRight, X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TransactionFormDialog } from "@/components/TransactionFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  useTransactions, deleteTransaction, useCategories, usePICs, useBudgetItems,
  useProfiles, getProfileById, useCurrentUser,
} from "@/lib/cloud-store";
import { formatRupiah, formatDate } from "@/lib/budget-format";
import { INCOME_CATEGORIES, type Transaction } from "@/lib/budget-types";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, differenceInDays, format as formatDate2 } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/transaksi")({
  head: () => ({
    meta: [
      { title: "Transaksi – Kantong Aman" },
      { name: "description", content: "Daftar pemasukan & pengeluaran." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    filterCategory: typeof search.filterCategory === "string" ? search.filterCategory : undefined,
  }),
  component: TransaksiPage,
});

function TransaksiPage() {
  const transactions = useTransactions();
  const categories = useCategories();
  const pics = usePICs();
  const items = useBudgetItems();
  useProfiles();
  const { userId } = useCurrentUser();
  const { filterCategory: initialFilterCategory } = Route.useSearch();

  // tx.budgetItemId → picId
  const txToPicId = useMemo(() => {
    const m = new Map<string, string | undefined>();
    items.forEach((it) => m.set(it.id, it.picId));
    return m;
  }, [items]);

  const allCategoryNames = useMemo(
    () => Array.from(new Set([...INCOME_CATEGORIES, ...categories.map((c) => c.name)])),
    [categories],
  );

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Transaction | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPic, setFilterPic] = useState<string>("all");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [filterOnlyMe, setFilterOnlyMe] = useState(false);

  // Apply pre-set category from URL search param (e.g. from CategoryTransactionsDialog)
  useEffect(() => {
    if (initialFilterCategory) {
      setFilterCategory(initialFilterCategory);
    }
  }, [initialFilterCategory]);

  const filtered = useMemo(() => {
    return transactions
      .filter((t) => {
        if (search && !(t.notes || t.category || "").toLowerCase().includes(search.toLowerCase())) return false;
        if (filterType !== "all" && t.type !== filterType) return false;
        if (filterCategory !== "all" && t.category !== filterCategory) return false;
        if (filterPic !== "all") {
          if (t.type !== "expense") return false;
          const pid = t.budgetItemId ? txToPicId.get(t.budgetItemId) : undefined;
          if (pid !== filterPic) return false;
        }
        if (filterFrom && t.date < filterFrom) return false;
        if (filterTo && t.date > filterTo) return false;
        if (filterOnlyMe && t.createdBy !== userId) return false;
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt)));
  }, [transactions, search, filterType, filterCategory, filterPic, filterFrom, filterTo, txToPicId, filterOnlyMe, userId]);

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    filtered.forEach((t) => {
      const arr = map.get(t.date) ?? [];
      arr.push(t); map.set(t.date, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const hasActiveFilter =
    filterType !== "all" || filterCategory !== "all" || filterPic !== "all" || !!filterFrom || !!filterTo || filterOnlyMe;

  const clearFilters = () => {
    setFilterType("all"); setFilterCategory("all"); setFilterPic("all");
    setFilterFrom(""); setFilterTo(""); setFilterOnlyMe(false);
  };

  // Build active filter chip list
  const activeFilterChips = useMemo(() => {
    const chips: { label: string; onRemove: () => void }[] = [];
    if (filterType !== "all") {
      chips.push({
        label: filterType === "income" ? "Pemasukan" : "Pengeluaran",
        onRemove: () => setFilterType("all"),
      });
    }
    if (filterCategory !== "all") {
      chips.push({ label: filterCategory, onRemove: () => setFilterCategory("all") });
    }
    if (filterPic !== "all") {
      const picName = pics.find((p) => p.id === filterPic)?.name ?? filterPic;
      chips.push({ label: `PIC: ${picName}`, onRemove: () => setFilterPic("all") });
    }
    if (filterFrom) {
      chips.push({ label: `Dari: ${filterFrom}`, onRemove: () => setFilterFrom("") });
    }
    if (filterTo) {
      chips.push({ label: `Sampai: ${filterTo}`, onRemove: () => setFilterTo("") });
    }
    if (filterOnlyMe) {
      chips.push({ label: "Hanya saya", onRemove: () => setFilterOnlyMe(false) });
    }
    return chips;
  }, [filterType, filterCategory, filterPic, filterFrom, filterTo, filterOnlyMe, pics]);

  return (
    <AppShell title="Transaksi" subtitle={`${filtered.length} transaksi`}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari catatan atau kategori..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="rounded-full pl-9"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon"
              className={cn("rounded-full", hasActiveFilter && "border-primary text-primary bg-primary/5")}>
              <Filter className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Filter</p>
              {hasActiveFilter && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearFilters}>
                  <X className="mr-1 h-3 w-3" /> Reset
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Jenis</label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="income">Pemasukan</SelectItem>
                  <SelectItem value="expense">Pengeluaran</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Kategori</label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  {allCategoryNames.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">PIC</label>
              <Select value={filterPic} onValueChange={setFilterPic}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua PIC</SelectItem>
                  {pics.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2 pt-1 pb-1">
              <Checkbox
                id="only-me"
                checked={filterOnlyMe}
                onCheckedChange={(checked) => setFilterOnlyMe(checked === true)}
              />
              <label
                htmlFor="only-me"
                className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Hanya saya
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Dari</label>
                <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Sampai</label>
                <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active filter chips */}
      {activeFilterChips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mr-0.5">Filter:</span>
          {activeFilterChips.map((chip) => (
            <span
              key={chip.label}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
            >
              {chip.label}
              <button
                onClick={chip.onRemove}
                className="ml-0.5 rounded-full hover:text-primary/60 transition-colors"
                aria-label={`Hapus filter ${chip.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            onClick={clearFilters}
            className="ml-1 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Hapus semua
          </button>
        </div>
      )}

      <div className="mt-4 space-y-4 pb-20">
        {grouped.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Tidak ada transaksi.
          </div>
        ) : (
          grouped.map(([date, items]) => {
            const dayIncome = items.filter((i) => i.type === "income").reduce((a, b) => a + b.amount, 0);
            const dayExpense = items.filter((i) => i.type === "expense").reduce((a, b) => a + b.amount, 0);
            return (
              <div key={date} className="rounded-2xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <p className="text-xs font-semibold text-muted-foreground">{formatDate(date)}</p>
                  <div className="flex gap-2 text-[11px]">
                    {dayIncome > 0 && <span className="text-income">{formatRupiah(dayIncome)}</span>}
                    {dayExpense > 0 && <span className="text-expense">{formatRupiah(dayExpense)}</span>}
                  </div>
                </div>
                <ul className="divide-y divide-border">
                  {items.map((t) => {
                    const creator = getProfileById(t.createdBy);
                    return (
                      <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                        <div className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                          t.type === "income" ? "bg-income-soft text-income" : "bg-expense-soft text-expense",
                        )}>
                          {t.type === "income" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{t.category}</p>
                          {t.notes ? <p className="mt-1 truncate text-xs text-muted-foreground">{t.notes}</p> : null}
                          {creator && (
                            <div className="mt-2 flex items-baseline gap-1">
                              <span className="shrink-0 text-[10px] text-emerald-600">👤</span>
                              <p className="truncate text-[10px] font-light text-emerald-600">
                                {creator.fullName}
                                <span className="mx-1">•</span>
                                {differenceInDays(new Date(), new Date(t.createdAt)) > 0
                                  ? formatDate2(new Date(t.createdAt), "dd MMM yyyy", { locale: idLocale })
                                  : formatDistanceToNow(new Date(t.createdAt), { addSuffix: true, locale: idLocale })}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* nominal + tombol disusun vertikal */}
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <p className={cn(
                            "text-sm font-semibold",
                            t.type === "income" ? "text-income" : "text-expense",
                          )}>
                            {formatRupiah(t.amount)}
                          </p>
                          <div className="flex">
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => { setEditing(t); setOpenForm(true); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-expense"
                              onClick={() => setDeleteId(t.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => { setEditing(undefined); setOpenForm(true); }}
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 transition-transform active:scale-95"
        aria-label="Tambah transaksi"
      >
        <Plus className="h-6 w-6" />
      </button>

      <TransactionFormDialog open={openForm} onOpenChange={setOpenForm} initial={editing} />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus transaksi?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-expense text-expense-foreground hover:bg-expense/90"
              onClick={() => {
                if (deleteId) { deleteTransaction(deleteId); toast.success("Transaksi dihapus"); setDeleteId(null); }
              }}
            >Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
