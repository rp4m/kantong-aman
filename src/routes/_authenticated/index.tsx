import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus, PiggyBank, Wallet, TriangleAlert as AlertTriangle, Users, Calendar as CalendarIcon, ChevronRight, ChevronDown } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { TransactionFormDialog } from "@/components/TransactionFormDialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  useTransactions, useCategories, usePICs, useBudgetPeriods, useBudgetItems,
  useCurrentUser, useProfiles, getProfileById,
} from "@/lib/cloud-store";
import { formatRupiah, formatRupiahShort, formatDate, formatDateRange, todayISO, toISODate } from "@/lib/budget-format";
import { cn } from "@/lib/utils";
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, format } from "date-fns";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Beranda – Kantong Aman" },
      { name: "description", content: "Pantau total budget, realisasi, sisa, dan PIC budget owner." },
    ],
  }),
  component: HomePage,
});

type FilterKey = "today" | "month" | "year" | "custom";

function rangeFor(
  key: FilterKey,
  custom?: { from: Date; to: Date }
): { start: string; end: string; label: string } {
  const now = new Date();

  switch (key) {
    case "today": {
      return {
        start: todayISO(),
        end: todayISO(),
        label: formatDate(todayISO()),
      };
    }

    case "month": {
      return {
        start: toISODate(startOfMonth(now)),
        end: toISODate(endOfMonth(now)),
        label: formatDateRange(toISODate(startOfMonth(now)), toISODate(endOfMonth(now))),
      };
    }

    case "year": {
      return {
        start: toISODate(startOfYear(now)),
        end: toISODate(endOfYear(now)),
        label: String(now.getFullYear()),
      };
    }

    case "custom": {
      if (!custom) {
        return {
          start: todayISO(),
          end: todayISO(),
          label: formatDate(todayISO()),
        };
      }
      
      return {
        start: toISODate(custom.from),
        end: toISODate(custom.to),
        label: formatDateRange(toISODate(custom.from), toISODate(custom.to)),
      };
    }
  }
}

function HomePage() {
  const transactions = useTransactions();
  const categories = useCategories();
  const pics = usePICs();
  const periods = useBudgetPeriods();
  const items = useBudgetItems();
  useProfiles();

  const [openForm, setOpenForm] = useState(false);
  const [filterKey, setFilterKey] = useState<FilterKey>("month");
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [calOpen, setCalOpen] = useState(false);

  const range = useMemo(() => rangeFor(filterKey, customRange), [filterKey, customRange]);

  // Budgets whose period overlaps with the selected date range
  const filteredPeriods = useMemo(() => {
    const { start, end } = range;
    return periods.filter((p) => {
      // overlap: p.startDate <= end AND p.endDate >= start
      return p.status === "active" && p.startDate <= end && p.endDate >= start;
    }).sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [periods, range]);

  // All budget items belonging to filtered periods
  const filteredPeriodIds = useMemo(() => new Set(filteredPeriods.map((p) => p.id)), [filteredPeriods]);

  const filteredItems = useMemo(
    () => items.filter((it) => filteredPeriodIds.has(it.budgetPeriodId)),
    [items, filteredPeriodIds],
  );

  // All transactions belonging to filtered budgets (via budgetPeriodId or via item matching)
  const filteredTransactions = useMemo(() => {
    const { start, end } = range;
    const filteredItemIds = new Set(filteredItems.map((it) => it.id));

    return transactions.filter((t) => {
      // Must be within the date range
      // if (t.date < start || t.date > end) return false;
      // Must belong to one of the filtered budgets
      // Check via budgetItemId
      if (t.budgetItemId && filteredItemIds.has(t.budgetItemId)) return true;
      // Check via budgetPeriodId
      if ((t as any).budgetPeriodId && filteredPeriodIds.has((t as any).budgetPeriodId)) return true;
      // For expense: match by category to a filtered item
      if (t.type === "expense") {
        const cat = categories.find((c) => c.name === t.category);
        if (cat && filteredItems.some((it) => it.categoryId === cat.id)) return true;
      }
      // For income transactions linked to a filtered period
      if (t.type === "income") {
        if ((t as any).budgetPeriodId && filteredPeriodIds.has((t as any).budgetPeriodId)) return true;
      }
      return false;
    });
  }, [transactions, categories, filteredItems, filteredPeriodIds, range]);

  const data = useMemo(() => {
    if (filteredPeriods.length === 0) {
      return {
        totalBudget: 0, totalReal: 0, remaining: 0, util: 0,
        catRows: [], picRows: [], recent: [],
        overBudgetCats: [], nearLimitCats: [], totalIncome: 0, totalExpense: 0,
      };
    }

    const catById = new Map(categories.map((c) => [c.id, c]));
    const picById = new Map(pics.map((p) => [p.id, p]));

    // Realization: match expense transactions to budget items
    const expByItem = new Map<string, number>();
    filteredTransactions.forEach((t) => {
      if (t.type !== "expense") return;
      if (t.budgetItemId && filteredItems.some((it) => it.id === t.budgetItemId)) {
        expByItem.set(t.budgetItemId, (expByItem.get(t.budgetItemId) ?? 0) + t.amount);
      } else {
        const cat = categories.find((c) => c.name === t.category);
        if (!cat) return;
        const match = filteredItems.find((it) => it.categoryId === cat.id);
        if (match) expByItem.set(match.id, (expByItem.get(match.id) ?? 0) + t.amount);
      }
    });

    const totalBudget = filteredItems.reduce((a, it) => a + it.amount, 0);
    const totalReal = Array.from(expByItem.values()).reduce((a, v) => a + v, 0);
    const remaining = totalBudget - totalReal;
    const util = totalBudget > 0 ? (totalReal / totalBudget) * 100 : 0;

    const totalIncome = filteredTransactions.filter((t) => t.type === "income").reduce((a, t) => a + t.amount, 0);
    const totalExpense = filteredTransactions.filter((t) => t.type === "expense").reduce((a, t) => a + t.amount, 0);

    // Category aggregation (deduplicate across periods by category+pic combo)
    const catMap = new Map<string, { id: string; categoryName: string; picName: string; budget: number; actual: number }>();
    filteredItems.forEach((it) => {
      const cat = catById.get(it.categoryId);
      const pic = picById.get(it.picId);
      const key = `${it.categoryId}-${it.picId}`;
      const cur = catMap.get(key) ?? {
        id: it.id, categoryName: cat?.name ?? "—", picName: pic?.name ?? "—",
        budget: 0, actual: 0,
      };
      cur.budget += it.amount;
      cur.actual += expByItem.get(it.id) ?? 0;
      catMap.set(key, cur);
    });

    const catRows = Array.from(catMap.values()).map((r) => ({
      ...r, sisa: r.budget - r.actual, pct: r.budget > 0 ? (r.actual / r.budget) * 100 : 0,
    })).sort((a, b) => b.budget - a.budget);

    // PIC aggregation
    type PicRow = { id: string; name: string; budget: number; actual: number; sisa: number; pct: number; count: number };
    const picMap = new Map<string, PicRow>();
    filteredItems.forEach((it) => {
      const cur = picMap.get(it.picId) ?? {
        id: it.picId, name: picById.get(it.picId)?.name ?? "—",
        budget: 0, actual: 0, sisa: 0, pct: 0, count: 0,
      };
      cur.budget += it.amount;
      cur.actual += expByItem.get(it.id) ?? 0;
      cur.count += 1;
      picMap.set(it.picId, cur);
    });
    const picRows = Array.from(picMap.values()).map((r) => ({
      ...r, sisa: r.budget - r.actual, pct: r.budget > 0 ? (r.actual / r.budget) * 100 : 0,
    })).sort((a, b) => b.budget - a.budget);

    // Recent transactions
    const recent = [...transactions]
      .filter((t) => (t as any).budgetPeriodId && filteredPeriodIds.has((t as any).budgetPeriodId))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt)))
      .slice(0, 5);

    const overBudgetCats = catRows.filter((r) => r.pct > 100);
    const nearLimitCats = catRows.filter((r) => r.pct >= 90 && r.pct < 100);

    return {
      totalBudget, totalReal, remaining, util,
      catRows, picRows, recent,
      overBudgetCats, nearLimitCats,
      totalIncome, totalExpense,
    };
  }, [filteredPeriods, filteredItems, filteredTransactions, categories, pics]);

  const tone = data.util >= 100 ? "expense" : data.util >= 80 ? "warning" : "primary";

  const filterLabel: Record<FilterKey, string> = {
    today: "Hari Ini",
    month: "Bulan Ini",
    year: "Tahun Ini",
    custom: "Custom",
  };

  return (
    <AppShell
      title="Beranda"
      subtitle={`${range.label} • ${filteredPeriods.length} budget aktif`}
      action={
        <Button size="sm" onClick={() => setOpenForm(true)} className="rounded-full">
          <Plus className="mr-1 h-4 w-4" /> Tambah
        </Button>
      }
    >
      {/* Date filter tabs */}
      <div className="space-y-2">
        <Tabs value={filterKey} onValueChange={(v) => setFilterKey(v as FilterKey)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="today">Hari Ini</TabsTrigger>
            <TabsTrigger value="month">Bulan Ini</TabsTrigger>
            <TabsTrigger value="year">Tahun Ini</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>
        </Tabs>
        {filterKey === "custom" && (
          <div className="mt-2 flex justify-center gap-2">
            <Input
              type="date"
              className="w-40"
              value={range.start}
              onChange={(e) =>
                setCustomRange((prev) => ({
                  ...prev,
                  from: new Date(e.target.value),
                }))
              }
            />
        
            <Input
              type="date"
              className="w-40"
              value={range.end}
              onChange={(e) =>
                setCustomRange((prev) => ({
                  ...prev,
                  to: new Date(e.target.value),
                }))
              }
            />
          </div>
        )}
      </div>

      {filteredPeriods.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <CalendarIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Tidak ada budget untuk periode ini</p>
          <p className="mt-1 text-xs text-muted-foreground">Buat budget yang mencakup rentang tanggal yang dipilih.</p>
          <Link to="/pengaturan/budget" className="mt-3 inline-block">
            <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Buat Budget</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Filtered budget periods summary */}
          {filteredPeriods.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {filteredPeriods.map((p) => (
                <span key={p.id} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {p.name}
                </span>
              ))}
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
                <p className="mt-0.5 font-semibold">{data.totalBudget > 0 ? `${data.util % 1 === 0 ? data.util.toFixed(0) : data.util.toFixed(1)}%` : "—"}</p>
              </div>
            </div>
          </div>

          {/* Stat grid */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatCard label="Total Budget" value={data.totalBudget} tone="neutral" icon={Wallet} />
            <StatCard label="Realisasi" value={data.totalReal} tone="expense" icon={ArrowUpRight} />
            <StatCard label="Sisa Budget" value={data.remaining} tone={data.remaining < 0 ? "expense" : "balance"} icon={PiggyBank} />
            <UtilCard value={Math.round(data.util)} tone={tone} />
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
                  <span><b>{c.categoryName}</b> mendekati limit ({c.pct % 1 === 0 ? c.pct.toFixed(0) : c.pct.toFixed(1)}%)</span>
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
            {filteredPeriods.length === 0 ? (
              <EmptyHint text="Belum ada budget aktif pada periode ini." />
            ) : (
              <ul className="space-y-2">
                {filteredPeriods.map((p) => (
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
                        )}>{r.pct % 1 === 0 ? r.pct.toFixed(0) : r.pct.toFixed(1)}%</span>
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
                {data.recent.map((t) => {
                  const creator = getProfileById(t.createdBy);
                  return (
                    <li key={t.id} className="flex items-center gap-3 py-2.5">
                      <div className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full",
                        t.type === "income" ? "bg-income-soft text-income" : "bg-expense-soft text-expense",
                      )}>
                        {t.type === "income" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium">{t.category}</p>
                          {creator ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Dibuat oleh {creator.fullName}
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{t.notes || formatDate(t.date)}</p>
                      </div>
                      <p className={cn("text-sm font-semibold", t.type === "income" ? "text-income" : "text-expense")}>
                        {t.type === "income" ? "+" : "-"} {formatRupiah(t.amount)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      <TransactionFormDialog open={openForm} onOpenChange={setOpenForm} />
    </AppShell>
  );
}

function UtilCard({ value, tone }: { value: number; tone: string }) {
  const itone = tone === "expense" ? "expense" : tone === "warning" ? "warning" : "primary";
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Utilisasi</p>
          <p className={cn(
            "mt-1 text-xl font-bold tracking-tight",
            itone === "expense" && "text-expense",
            itone === "warning" && "text-warning-foreground",
            itone === "primary" && "text-primary",
          )}>
            {value}%
          </p>
        </div>
        <div className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl",
          itone === "expense" && "bg-expense-soft text-expense",
          itone === "warning" && "bg-warning/30 text-warning-foreground",
          itone === "primary" && "bg-primary/15 text-primary",
        )}>
          <ArrowDownLeft className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-center text-xs text-muted-foreground">
      {text}
    </p>
  );
}
