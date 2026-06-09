import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, Plus, PiggyBank, Wallet,
  AlertTriangle, Users, Calendar as CalendarIcon, ChevronRight,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { TransactionFormDialog } from "@/components/TransactionFormDialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useTransactions, useCategories, usePICs, useBudgetPeriods, useBudgetItems,
  useCurrentUser,
} from "@/lib/cloud-store";
import { formatRupiah, formatRupiahShort, formatDate, formatDateRange } from "@/lib/budget-format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Beranda – Kantong Aman" },
      { name: "description", content: "Pantau total budget, realisasi, sisa, dan PIC budget owner." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const transactions = useTransactions();
  const categories = useCategories();
  const pics = usePICs();
  const periods = useBudgetPeriods();
  const items = useBudgetItems();

  const [openForm, setOpenForm] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");

  const activePeriods = useMemo(
    () => periods.filter((p) => p.status === "active").sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [periods],
  );

  const periodId = selectedPeriodId || activePeriods[0]?.id || "";

  const period = useMemo(() => periods.find((p) => p.id === periodId), [periods, periodId]);

  const data = useMemo(() => {
    if (!period) {
      return {
        totalBudget: 0, totalReal: 0, remaining: 0, util: 0,
        catRows: [], picRows: [], recent: [],
        overBudgetCats: [], nearLimitCats: [], totalIncome: 0, totalExpense: 0,
      };
    }

    const catById = new Map(categories.map((c) => [c.id, c]));
    const picById = new Map(pics.map((p) => [p.id, p]));
    const periodItems = items.filter((it) => it.budgetPeriodId === period.id);

    // Realization: match expense transactions to budget items within period date range
    const expByItem = new Map<string, number>();
    transactions.forEach((t) => {
      if (t.type !== "expense") return;
      if (t.date < period.startDate || t.date > period.endDate) return;
      if (t.budgetItemId && periodItems.some((it) => it.id === t.budgetItemId)) {
        expByItem.set(t.budgetItemId, (expByItem.get(t.budgetItemId) ?? 0) + t.amount);
      } else {
        const cat = categories.find((c) => c.name === t.category);
        if (!cat) return;
        const match = periodItems.find((it) => it.categoryId === cat.id);
        if (match) expByItem.set(match.id, (expByItem.get(match.id) ?? 0) + t.amount);
      }
    });

    const totalBudget = periodItems.reduce((a, it) => a + it.amount, 0);
    const totalReal = Array.from(expByItem.values()).reduce((a, v) => a + v, 0);
    const remaining = totalBudget - totalReal;
    const util = totalBudget > 0 ? (totalReal / totalBudget) * 100 : 0;

    // All transactions within this budget period
    const periodTx = transactions.filter(
      (t) => t.date >= period.startDate && t.date <= period.endDate,
    );
    const totalIncome = periodTx.filter((t) => t.type === "income").reduce((a, t) => a + t.amount, 0);
    const totalExpense = periodTx.filter((t) => t.type === "expense").reduce((a, t) => a + t.amount, 0);

    // Category aggregation
    const catRows = periodItems.map((it) => {
      const cat = catById.get(it.categoryId);
      const pic = picById.get(it.picId);
      const real = expByItem.get(it.id) ?? 0;
      const pct = it.amount > 0 ? (real / it.amount) * 100 : 0;
      return {
        id: it.id,
        categoryName: cat?.name ?? "—",
        picName: pic?.name ?? "—",
        budget: it.amount,
        actual: real,
        sisa: it.amount - real,
        pct,
      };
    }).sort((a, b) => b.budget - a.budget);

    // PIC aggregation
    type PicRow = { id: string; name: string; budget: number; actual: number; sisa: number; pct: number; count: number };
    const picMap = new Map<string, PicRow>();
    periodItems.forEach((it) => {
      const cur = picMap.get(it.picId) ?? { id: it.picId, name: picById.get(it.picId)?.name ?? "—", budget: 0, actual: 0, sisa: 0, pct: 0, count: 0 };
      cur.budget += it.amount;
      cur.actual += expByItem.get(it.id) ?? 0;
      cur.count += 1;
      picMap.set(it.picId, cur);
    });
    const picRows = Array.from(picMap.values()).map((r) => ({
      ...r, sisa: r.budget - r.actual, pct: r.budget > 0 ? (r.actual / r.budget) * 100 : 0,
    })).sort((a, b) => b.budget - a.budget);

    // Recent transactions within period
    const recent = [...periodTx]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt)))
      .slice(0, 5);

    const overBudgetCats = catRows.filter((r) => r.pct >= 100);
    const nearLimitCats = catRows.filter((r) => r.pct >= 80 && r.pct < 100);

    return {
      totalBudget, totalReal, remaining, util,
      catRows, picRows, recent,
      overBudgetCats, nearLimitCats,
      totalIncome, totalExpense,
    };
  }, [transactions, categories, pics, periods, items, period]);

  const tone = data.util >= 100 ? "expense" : data.util >= 80 ? "warning" : "primary";

  return (
    <AppShell
      title="Beranda"
      subtitle={period ? period.name : "Kantong Aman"}
      action={
        <Button size="sm" onClick={() => setOpenForm(true)} className="rounded-full">
          <Plus className="mr-1 h-4 w-4" /> Tambah
        </Button>
      }
    >
      {/* Budget selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Pilih Budget</label>
        <Select value={periodId} onValueChange={setSelectedPeriodId}>
          <SelectTrigger className="rounded-xl">
            <SelectValue placeholder={activePeriods.length ? "Pilih budget aktif" : "Belum ada budget aktif"} />
          </SelectTrigger>
          <SelectContent>
            {activePeriods.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} ({formatDateRange(p.startDate, p.endDate)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!period ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <CalendarIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Belum ada budget aktif</p>
          <p className="mt-1 text-xs text-muted-foreground">Buat budget periode pertama Anda.</p>
          <Link to="/pengaturan/budget" className="mt-3 inline-block">
            <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Buat Budget</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Period info */}
          <p className="mt-2 text-xs text-muted-foreground">
            {formatDateRange(period.startDate, period.endDate)}
          </p>

          {/* Hero */}
          <div className="relative mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-balance p-5 text-primary-foreground shadow-lg">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
            <p className="text-xs uppercase tracking-wider opacity-80">Total Budget</p>
            <p className="mt-1 text-3xl font-bold">{formatRupiah(data.totalBudget)}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl bg-white/15 p-2.5 backdrop-blur">
                <p className="opacity-80">Realisasi</p>
                <p className="mt-0.5 font-semibold">{formatRupiahShort(data.totalReal)}</p>
              </div>
              <div className="rounded-xl bg-white/15 p-2.5 backdrop-blur">
                <p className="opacity-80">Sisa</p>
                <p className="mt-0.5 font-semibold">{formatRupiahShort(data.remaining)}</p>
              </div>
              <div className="rounded-xl bg-white/15 p-2.5 backdrop-blur">
                <p className="opacity-80">Utilisasi</p>
                <p className="mt-0.5 font-semibold">{data.totalBudget > 0 ? `${data.util.toFixed(0)}%` : "—"}</p>
              </div>
            </div>
          </div>

          {/* Stat grid */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatCard label="Total Budget" value={data.totalBudget} tone="neutral" icon={Wallet} />
            <StatCard label="Realisasi" value={data.totalReal} tone="expense" icon={ArrowUpRight} />
            <StatCard label="Sisa Budget" value={data.remaining} tone={data.remaining < 0 ? "expense" : "balance"} icon={PiggyBank} />
            <StatCard label="Utilisasi" value={Math.round(data.util)} tone={tone === "expense" ? "expense" : "neutral"} hint={`${data.util.toFixed(1)}%`} icon={ArrowDownLeft} />
          </div>

          {/* Insights */}
          {(data.overBudgetCats.length > 0 || data.nearLimitCats.length > 0) && (
            <section className="mt-4 space-y-2">
              {data.overBudgetCats.map((c) => (
                <div key={c.id} className="flex items-start gap-2 rounded-xl bg-expense-soft p-2.5 text-xs text-expense">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span><b>{c.categoryName}</b> ({c.picName}) melebihi budget +{formatRupiah(c.actual - c.budget)}</span>
                </div>
              ))}
              {data.nearLimitCats.map((c) => (
                <div key={c.id} className="flex items-start gap-2 rounded-xl bg-warning/20 p-2.5 text-xs text-warning-foreground">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span><b>{c.categoryName}</b> mendekati limit ({c.pct.toFixed(0)}%)</span>
                </div>
              ))}
            </section>
          )}

          {/* Budget per Kategori */}
          <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">Budget per Kategori</h2>
            {data.catRows.length === 0 ? (
              <EmptyHint text="Belum ada budget item untuk periode ini." />
            ) : (
              <ul className="space-y-2.5">
                {data.catRows.map((r) => {
                  const itone = r.pct >= 100 ? "expense" : r.pct >= 80 ? "warning" : "primary";
                  return (
                    <li key={r.id} className="rounded-xl bg-muted/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-sm font-medium">{r.categoryName}</p>
                          <span className="truncate rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            {r.picName}
                          </span>
                        </div>
                        <span className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          itone === "expense" && "bg-expense-soft text-expense",
                          itone === "warning" && "bg-warning/30 text-warning-foreground",
                          itone === "primary" && "bg-primary/15 text-primary",
                        )}>{r.pct.toFixed(0)}%</span>
                      </div>
                      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                        <span>{formatRupiah(r.actual)} / {formatRupiah(r.budget)}</span>
                        <span className={r.sisa < 0 ? "text-expense font-medium" : ""}>
                          {r.sisa >= 0 ? "Sisa " : "Over "}{formatRupiah(Math.abs(r.sisa))}
                        </span>
                      </div>
                      <Progress
                        value={Math.min(r.pct, 100)}
                        className={cn(
                          "mt-1.5 h-1.5",
                          itone === "expense" && "[&>div]:bg-expense",
                          itone === "warning" && "[&>div]:bg-warning",
                          itone === "primary" && "[&>div]:bg-primary",
                        )}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Budget per PIC */}
          {data.picRows.length > 0 && (
            <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Budget per PIC</h2>
              </div>
              <ul className="space-y-2.5">
                {data.picRows.map((r) => {
                  const itone = r.pct >= 100 ? "expense" : r.pct >= 80 ? "warning" : "primary";
                  return (
                    <li key={r.id} className="rounded-xl bg-muted/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{r.name}</p>
                        <span className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          itone === "expense" && "bg-expense-soft text-expense",
                          itone === "warning" && "bg-warning/30 text-warning-foreground",
                          itone === "primary" && "bg-primary/15 text-primary",
                        )}>{r.budget > 0 ? `${r.pct.toFixed(0)}%` : "—"}</span>
                      </div>
                      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                        <span>{r.count} kategori</span>
                        <span>{formatRupiah(r.actual)} / {formatRupiah(r.budget)}</span>
                      </div>
                      {r.budget > 0 && (
                        <Progress
                          value={Math.min(r.pct, 100)}
                          className={cn(
                            "mt-1.5 h-1.5",
                            itone === "expense" && "[&>div]:bg-expense",
                            itone === "warning" && "[&>div]:bg-warning",
                            itone === "primary" && "[&>div]:bg-primary",
                          )}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Recent transactions */}
          <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Transaksi Terakhir</h2>
              <Link to="/transaksi" className="text-xs font-medium text-primary">Lihat semua →</Link>
            </div>
            {data.recent.length === 0 ? (
              <EmptyHint text="Belum ada transaksi pada budget ini." />
            ) : (
              <ul className="divide-y divide-border">
                {data.recent.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <div className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full",
                      t.type === "income" ? "bg-income-soft text-income" : "bg-expense-soft text-expense",
                    )}>
                      {t.type === "income" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.category}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.notes || formatDate(t.date)}</p>
                    </div>
                    <p className={cn("text-sm font-semibold", t.type === "income" ? "text-income" : "text-expense")}>
                      {t.type === "income" ? "+" : "-"} {formatRupiah(t.amount)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <TransactionFormDialog open={openForm} onOpenChange={setOpenForm} />
    </AppShell>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-center text-xs text-muted-foreground">
      {text}
    </p>
  );
}
