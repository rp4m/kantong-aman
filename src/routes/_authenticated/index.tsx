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
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useTransactions, useCategories, usePICs, useBudgetPeriods, useBudgetItems,
} from "@/lib/budget-store";
import { formatRupiah, formatRupiahShort, formatDate, formatDateRange, todayISO, toISODate } from "@/lib/budget-format";
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

type FilterKey = "today" | "week" | "month" | "year" | "custom";

function rangeFor(filter: FilterKey, customStart: string, customEnd: string): { start: string; end: string; label: string } {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  if (filter === "today") {
    const s = toISODate(now); return { start: s, end: s, label: formatDate(s) };
  }
  if (filter === "week") {
    const day = (now.getDay() + 6) % 7;
    const s = new Date(now); s.setDate(now.getDate() - day);
    const e = new Date(s); e.setDate(s.getDate() + 6);
    return { start: toISODate(s), end: toISODate(e), label: formatDateRange(toISODate(s), toISODate(e)) };
  }
  if (filter === "month") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: toISODate(s), end: toISODate(e), label: formatDateRange(toISODate(s), toISODate(e)) };
  }
  if (filter === "year") {
    const s = new Date(now.getFullYear(), 0, 1);
    const e = new Date(now.getFullYear(), 11, 31);
    return { start: toISODate(s), end: toISODate(e), label: String(now.getFullYear()) };
  }
  return { start: customStart, end: customEnd, label: formatDateRange(customStart, customEnd) };
}

function HomePage() {
  const transactions = useTransactions();
  const categories = useCategories();
  const pics = usePICs();
  const periods = useBudgetPeriods();
  const items = useBudgetItems();

  const [openForm, setOpenForm] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("today");
  const [customStart, setCustomStart] = useState(todayISO());
  const [customEnd, setCustomEnd] = useState(todayISO());

  const { start, end, label } = useMemo(
    () => rangeFor(filter, customStart, customEnd),
    [filter, customStart, customEnd],
  );

  const data = useMemo(() => {
    const catById = new Map(categories.map((c) => [c.id, c]));
    const picById = new Map(pics.map((p) => [p.id, p]));
    const periodById = new Map(periods.map((p) => [p.id, p]));

    // Only show ACTIVE budget periods that contain the filter range (today by default)
    const overlappingPeriods = periods.filter(
      (p) => p.status === "active" && p.startDate <= end && p.endDate >= start,
    );
    const overlappingIds = new Set(overlappingPeriods.map((p) => p.id));
    const activeItems = items.filter((it) => overlappingIds.has(it.budgetPeriodId));

    // Realization within filter range AND within budget item's period
    const expByItem = new Map<string, number>();
    transactions.forEach((t) => {
      if (t.type !== "expense") return;
      if (t.date < start || t.date > end) return;
      if (t.budgetItemId && activeItems.some((it) => it.id === t.budgetItemId)) {
        expByItem.set(t.budgetItemId, (expByItem.get(t.budgetItemId) ?? 0) + t.amount);
      } else {
        // try implicit match by category + date in period
        const cat = categories.find((c) => c.name === t.category);
        if (!cat) return;
        const match = activeItems.find((it) => {
          if (it.categoryId !== cat.id) return false;
          const p = periodById.get(it.budgetPeriodId);
          return p && t.date >= p.startDate && t.date <= p.endDate;
        });
        if (match) expByItem.set(match.id, (expByItem.get(match.id) ?? 0) + t.amount);
      }
    });

    const totalBudget = activeItems.reduce((a, it) => a + it.amount, 0);
    const totalReal = Array.from(expByItem.values()).reduce((a, v) => a + v, 0);
    const remaining = totalBudget - totalReal;
    const util = totalBudget > 0 ? (totalReal / totalBudget) * 100 : 0;

    // Category aggregation
    const catRows = activeItems.map((it) => {
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
        periodName: periodById.get(it.budgetPeriodId)?.name ?? "",
      };
    }).sort((a, b) => b.budget - a.budget);

    // PIC aggregation
    type PicRow = { id: string; name: string; budget: number; actual: number; sisa: number; pct: number; count: number };
    const picMap = new Map<string, PicRow>();
    activeItems.forEach((it) => {
      const cur = picMap.get(it.picId) ?? { id: it.picId, name: picById.get(it.picId)?.name ?? "—", budget: 0, actual: 0, sisa: 0, pct: 0, count: 0 };
      cur.budget += it.amount;
      cur.actual += expByItem.get(it.id) ?? 0;
      cur.count += 1;
      picMap.set(it.picId, cur);
    });
    const picRows = Array.from(picMap.values()).map((r) => ({
      ...r, sisa: r.budget - r.actual, pct: r.budget > 0 ? (r.actual / r.budget) * 100 : 0,
    })).sort((a, b) => b.budget - a.budget);

    // Recent transactions in range
    const recent = transactions
      .filter((t) => t.date >= start && t.date <= end)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt)))
      .slice(0, 5);

    const overBudgetCats = catRows.filter((r) => r.pct >= 100);
    const nearLimitCats = catRows.filter((r) => r.pct >= 80 && r.pct < 100);

    return {
      totalBudget, totalReal, remaining, util,
      catRows, picRows, recent, overlappingPeriods,
      overBudgetCats, nearLimitCats,
    };
  }, [transactions, categories, pics, periods, items, start, end]);

  const tone = data.util >= 100 ? "expense" : data.util >= 80 ? "warning" : "primary";

  return (
    <AppShell
      title="Beranda"
      subtitle={label}
      action={
        <Button size="sm" onClick={() => setOpenForm(true)} className="rounded-full">
          <Plus className="mr-1 h-4 w-4" /> Tambah
        </Button>
      }
    >
      {/* Period filter */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
        <TabsList className="grid w-full grid-cols-5 text-[11px]">
          <TabsTrigger value="today">Hari</TabsTrigger>
          <TabsTrigger value="week">Minggu</TabsTrigger>
          <TabsTrigger value="month">Bulan</TabsTrigger>
          <TabsTrigger value="year">Tahun</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>
      </Tabs>
      {filter === "custom" && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
          <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
        </div>
      )}

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

      {/* Active budgets */}
      <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Budget Aktif</h2>
          </div>
          <Link to="/pengaturan/budget" className="text-xs font-medium text-primary">Kelola →</Link>
        </div>
        {data.overlappingPeriods.length === 0 ? (
          <EmptyHint text="Belum ada budget aktif pada periode ini." />
        ) : (
          <ul className="space-y-2">
            {data.overlappingPeriods.map((p) => (
              <li key={p.id}>
                <Link to="/pengaturan/budget/$id" params={{ id: p.id }} className="flex items-center justify-between rounded-xl bg-muted/40 p-3 hover:bg-muted">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDateRange(p.startDate, p.endDate)}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

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
          <EmptyHint text="Belum ada transaksi pada periode ini." />
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
