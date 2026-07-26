import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { 
  FileText, FileSpreadsheet, TrendingUp, TrendingDown, 
  Wallet, Activity, PieChart, Clock, BarChart3, Filter
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useTransactions, useCategories, usePICs, useBudgetPeriods, useBudgetItems,
} from "@/lib/cloud-store";
import { formatRupiah, formatDate, formatDateRange, monthLabel, todayISO, toISODate } from "@/lib/budget-format";
import { MONTH_NAMES, type Transaction } from "@/lib/budget-types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/laporan")({
  head: () => ({
    meta: [
      { title: "Analitik – Kantong Aman" },
      { name: "description", content: "Dashboard analitik dan laporan keuangan." },
    ],
  }),
  component: LaporanPage,
});

type ReportMode = "monthly" | "range" | "period";

function LaporanPage() {
  const [mainTab, setMainTab] = useState<"dashboard" | "laporan">("dashboard");

  const transactions = useTransactions();
  const categories = useCategories();
  const pics = usePICs();
  const periods = useBudgetPeriods();
  const items = useBudgetItems();

  const now = new Date();
  
  // Dashboard state
  const [dashMonth, setDashMonth] = useState<number>(now.getMonth() + 1);
  const [dashYear, setDashYear] = useState<number>(now.getFullYear());

  // Laporan state
  const [reportMode, setReportMode] = useState<ReportMode>("monthly");
  const [reportMonth, setReportMonth] = useState<number>(now.getMonth() + 1);
  const [reportYear, setReportYear] = useState<number>(now.getFullYear());
  const [rangeStart, setRangeStart] = useState<string>(todayISO());
  const [rangeEnd, setRangeEnd] = useState<string>(todayISO());
  const [periodId, setPeriodId] = useState<string>("");
  const [filterPic, setFilterPic] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const yearOptions = Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i);

  // --- Dashboard Logic ---
  const dashData = useMemo(() => {
    const s = new Date(dashYear, dashMonth - 1, 1);
    const e = new Date(dashYear, dashMonth, 0, 23, 59, 59);
    const startIso = toISODate(s);
    const endIso = toISODate(e);
    
    const monthlyTx = transactions.filter(t => t.date >= startIso && t.date <= endIso);
    
    const income = monthlyTx.filter(t => t.type === "income").reduce((a, b) => a + b.amount, 0);
    const expense = monthlyTx.filter(t => t.type === "expense").reduce((a, b) => a + b.amount, 0);
    const balance = income - expense;
    const savingsRate = income > 0 ? ((balance / income) * 100) : 0;
    
    const byCat = new Map<string, number>();
    monthlyTx.filter((t) => t.type === "expense")
      .forEach((t) => byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount));
    const sortedCats = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]);
    
    const recentTx = monthlyTx.slice(0, 5);
    
    const trend = [];
    let maxTrendVal = 0;
    for (let i = 5; i >= 0; i--) {
      const d = new Date(dashYear, dashMonth - 1 - i, 1);
      const mStart = toISODate(d);
      const mEnd = toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
      
      const mTx = transactions.filter(t => t.date >= mStart && t.date <= mEnd);
      const inc = mTx.filter(t => t.type === "income").reduce((a, b) => a + b.amount, 0);
      const exp = mTx.filter(t => t.type === "expense").reduce((a, b) => a + b.amount, 0);
      maxTrendVal = Math.max(maxTrendVal, inc, exp);
      trend.push({
        label: MONTH_NAMES[d.getMonth()].slice(0, 3),
        income: inc,
        expense: exp,
      });
    }

    const picExpense = new Map<string, number>();
    monthlyTx.filter(t => t.type === "expense").forEach(t => {
      let pid = "Unknown";
      if (t.budgetItemId) {
         const item = items.find(i => i.id === t.budgetItemId);
         if (item) pid = item.picId;
      }
      picExpense.set(pid, (picExpense.get(pid) ?? 0) + t.amount);
    });
    
    const picBreakdown = Array.from(picExpense.entries()).map(([pid, amt]) => {
      const p = pics.find(x => x.id === pid);
      return { name: p ? p.name : "Tanpa PIC", amount: amt };
    }).sort((a, b) => b.amount - a.amount);
    
    return {
       income, expense, balance, savingsRate, sortedCats, recentTx, trend, maxTrendVal, picBreakdown
    };
  }, [transactions, items, pics, dashMonth, dashYear]);

  // --- Laporan Logic ---
  const reportRange = useMemo(() => {
    if (reportMode === "monthly") {
      const s = new Date(reportYear, reportMonth - 1, 1);
      const e = new Date(reportYear, reportMonth, 0);
      return { start: toISODate(s), end: toISODate(e), label: monthLabel(reportMonth, reportYear) };
    }
    if (reportMode === "range") {
      return { start: rangeStart, end: rangeEnd, label: formatDateRange(rangeStart, rangeEnd) };
    }
    const p = periods.find((x) => x.id === periodId);
    if (!p) return { start: todayISO(), end: todayISO(), label: "—" };
    return { start: p.startDate, end: p.endDate, label: `${p.name} (${formatDateRange(p.startDate, p.endDate)})` };
  }, [reportMode, reportMonth, reportYear, rangeStart, rangeEnd, periodId, periods]);

  const itemToPicId = useMemo(() => new Map(items.map((it) => [it.id, it.picId])), [items]);

  const reportData = useMemo(() => {
    const list: Transaction[] = transactions.filter((t) => {
      if (t.date < reportRange.start || t.date > reportRange.end) return false;
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      if (filterPic !== "all") {
        if (t.type !== "expense") return false;
        const pid = t.budgetItemId ? itemToPicId.get(t.budgetItemId) : undefined;
        if (pid !== filterPic) return false;
      }
      return true;
    });
    const totalIncome = list.filter((t) => t.type === "income").reduce((a, b) => a + b.amount, 0);
    const totalExpense = list.filter((t) => t.type === "expense").reduce((a, b) => a + b.amount, 0);
    const selisih = totalIncome - totalExpense;

    const byCat = new Map<string, number>();
    list.filter((t) => t.type === "expense")
      .forEach((t) => byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount));
    const sortedCats = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]);

    return { list, totalIncome, totalExpense, selisih, sortedCats };
  }, [transactions, reportRange, filterCategory, filterPic, itemToPicId]);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("Laporan Keuangan", 14, 16);
    doc.setFontSize(10);
    doc.text(`Periode: ${reportRange.label}`, 14, 23);
    doc.text(`Total Pemasukan: ${formatRupiah(reportData.totalIncome)}`, 14, 30);
    doc.text(`Total Pengeluaran: ${formatRupiah(reportData.totalExpense)}`, 14, 36);
    doc.text(`Selisih: ${formatRupiah(reportData.selisih)}`, 14, 42);

    autoTable(doc, {
      startY: 50,
      head: [["Tanggal", "Jenis", "Kategori", "Catatan", "Nominal"]],
      body: reportData.list.map((t) => [
        formatDate(t.date),
        t.type === "income" ? "Pemasukan" : "Pengeluaran",
        t.category, t.notes, formatRupiah(t.amount),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 105, 105] },
    });
    doc.save(`laporan-${reportMode}-${Date.now()}.pdf`);
    toast.success("PDF berhasil diunduh");
  };

  const exportExcel = () => {
    const rows = reportData.list.map((t) => ({
      Tanggal: t.date,
      Jenis: t.type === "income" ? "Pemasukan" : "Pengeluaran",
      Kategori: t.category, Catatan: t.notes, Nominal: t.amount,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.sheet_add_aoa(ws, [
      [], ["Periode", reportRange.label],
      ["Total Pemasukan", reportData.totalIncome],
      ["Total Pengeluaran", reportData.totalExpense],
      ["Selisih", reportData.selisih],
    ], { origin: -1 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan");
    XLSX.writeFile(wb, `laporan-${reportMode}-${Date.now()}.xlsx`);
    toast.success("Excel berhasil diunduh");
  };

  return (
    <AppShell title="Analitik" subtitle={mainTab === "dashboard" ? "Ringkasan Keuangan" : "Laporan Detail"}>
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="dashboard"><BarChart3 className="w-4 h-4 mr-2" /> Dashboard</TabsTrigger>
          <TabsTrigger value="laporan"><FileText className="w-4 h-4 mr-2" /> Laporan</TabsTrigger>
        </TabsList>

        {/* ================= DASHBOARD TAB ================= */}
        <TabsContent value="dashboard" className="space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">Bulan</h2>
            <div className="flex items-center gap-2">
              <Select value={String(dashMonth)} onValueChange={(v) => setDashMonth(Number(v))}>
                <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i + 1)} className="text-xs">{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(dashYear)} onValueChange={(v) => setDashYear(Number(v))}>
                <SelectTrigger className="h-8 w-[80px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Pemasukan" value={dashData.income} tone="income" icon={TrendingUp} />
            <StatCard label="Pengeluaran" value={dashData.expense} tone="expense" icon={TrendingDown} />
          </div>
          
          <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-primary/5 p-4 shadow-sm relative overflow-hidden">
             <div className="absolute -top-4 -right-4 p-4 opacity-10 pointer-events-none">
               <Wallet className="h-24 w-24" />
             </div>
             <div className="relative z-10 flex justify-between items-end">
               <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">Sisa Saldo</p>
                  <p className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">{formatRupiah(dashData.balance)}</p>
               </div>
               <div className="text-right">
                  <p className="text-[10px] uppercase font-medium text-muted-foreground">Savings Rate</p>
                  <p className="text-lg font-bold text-primary">{dashData.savingsRate.toFixed(1)}%</p>
               </div>
             </div>
             
             <div className="mt-4">
               <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                 {dashData.income > 0 || dashData.expense > 0 ? (
                   <>
                     <div className="h-full bg-income" style={{ width: `${(dashData.income / (dashData.income + dashData.expense)) * 100}%` }} />
                     <div className="h-full bg-expense" style={{ width: `${(dashData.expense / (dashData.income + dashData.expense)) * 100}%` }} />
                   </>
                 ) : null}
               </div>
               <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                 <span>Pemasukan ({(dashData.income / (dashData.income + dashData.expense) * 100 || 0).toFixed(0)}%)</span>
                 <span>Pengeluaran ({(dashData.expense / (dashData.income + dashData.expense) * 100 || 0).toFixed(0)}%)</span>
               </div>
             </div>
          </div>
          
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Tren 6 Bulan Terakhir</h2>
            </div>
            <div className="flex h-32 items-end justify-between gap-1">
              {dashData.trend.map((t, i) => {
                const hInc = dashData.maxTrendVal ? (t.income / dashData.maxTrendVal) * 100 : 0;
                const hExp = dashData.maxTrendVal ? (t.expense / dashData.maxTrendVal) * 100 : 0;
                return (
                  <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                     <div className="flex w-full items-end justify-center gap-0.5 h-[100px]">
                       <div className="w-[40%] max-w-[12px] rounded-t-sm bg-income/60 hover:bg-income transition-all" style={{ height: `${hInc}%` }} title={`Pemasukan: ${formatRupiah(t.income)}`} />
                       <div className="w-[40%] max-w-[12px] rounded-t-sm bg-expense/60 hover:bg-expense transition-all" style={{ height: `${hExp}%` }} title={`Pengeluaran: ${formatRupiah(t.expense)}`} />
                     </div>
                     <span className="text-[10px] text-muted-foreground">{t.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <PieChart className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Top Kategori</h2>
              </div>
              {dashData.sortedCats.length === 0 ? (
                 <p className="text-xs text-muted-foreground text-center py-4">Tidak ada data</p>
              ) : (
                <ul className="space-y-3">
                  {dashData.sortedCats.slice(0, 4).map(([name, amount]) => {
                    const pct = dashData.expense > 0 ? (amount / dashData.expense) * 100 : 0;
                    return (
                      <li key={name}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium truncate pr-2">{name}</span>
                          <span className="text-muted-foreground whitespace-nowrap">{formatRupiah(amount)}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-expense opacity-80" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Pengeluaran per PIC</h2>
              </div>
              {dashData.picBreakdown.length === 0 ? (
                 <p className="text-xs text-muted-foreground text-center py-4">Tidak ada data</p>
              ) : (
                <ul className="space-y-3">
                  {dashData.picBreakdown.slice(0, 4).map((p, i) => {
                    const pct = dashData.expense > 0 ? (p.amount / dashData.expense) * 100 : 0;
                    return (
                      <li key={i}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium truncate pr-2">{p.name}</span>
                          <span className="text-muted-foreground whitespace-nowrap">{formatRupiah(p.amount)}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary opacity-80" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Transaksi Terbaru</h2>
            </div>
            {dashData.recentTx.length === 0 ? (
               <p className="text-xs text-muted-foreground text-center py-4">Tidak ada transaksi</p>
            ) : (
               <ul className="divide-y divide-border">
                 {dashData.recentTx.map(t => (
                   <li key={t.id} className="flex items-center justify-between py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{t.category}</p>
                        <p className="truncate text-xs text-muted-foreground">{t.notes || "Tanpa catatan"} • {formatDate(t.date)}</p>
                      </div>
                      <p className={cn("text-sm font-semibold whitespace-nowrap pl-2", t.type === "income" ? "text-income" : "text-expense")}>
                        {t.type === "income" ? "+" : "-"}{formatRupiah(t.amount)}
                      </p>
                   </li>
                 ))}
               </ul>
            )}
          </div>
        </TabsContent>

        {/* ================= LAPORAN TAB ================= */}
        <TabsContent value="laporan" className="animate-in fade-in duration-300">
          <Tabs value={reportMode} onValueChange={(v) => setReportMode(v as ReportMode)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="monthly" className="text-xs">Bulanan</TabsTrigger>
              <TabsTrigger value="range" className="text-xs">Rentang</TabsTrigger>
              <TabsTrigger value="period" className="text-xs">Budget</TabsTrigger>
            </TabsList>
          </Tabs>

          {reportMode === "monthly" && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Bulan</Label>
                <Select value={String(reportMonth)} onValueChange={(v) => setReportMonth(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tahun</Label>
                <Select value={String(reportYear)} onValueChange={(v) => setReportYear(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {reportMode === "range" && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Dari</Label><Input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} /></div>
              <div><Label className="text-xs">Sampai</Label><Input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} /></div>
            </div>
          )}
          {reportMode === "period" && (
            <div className="mt-3">
              <Label className="text-xs">Pilih Budget Periode</Label>
              <Select value={periodId} onValueChange={setPeriodId}>
                <SelectTrigger><SelectValue placeholder="Pilih periode" /></SelectTrigger>
                <SelectContent>
                  {periods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Filter PIC</Label>
              <Select value={filterPic} onValueChange={setFilterPic}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua PIC</SelectItem>
                  {pics.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Filter Kategori</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua kategori</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatCard label="Pemasukan" value={reportData.totalIncome} tone="income" />
            <StatCard label="Pengeluaran" value={reportData.totalExpense} tone="expense" />
            <StatCard
              label="Selisih" value={reportData.selisih}
              tone={reportData.selisih >= 0 ? "balance" : "expense"}
            />
            <StatCard label="Total Transaksi" value={reportData.list.length} tone="neutral" hint="item" />
          </div>

          <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Pengeluaran per Kategori</h2>
            {reportData.sortedCats.length === 0 ? (
              <p className="mt-3 text-center text-xs text-muted-foreground">Tidak ada pengeluaran.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {reportData.sortedCats.map(([name, amount]) => {
                  const pct = reportData.totalExpense > 0 ? (amount / reportData.totalExpense) * 100 : 0;
                  return (
                    <li key={name}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{name}</span>
                        <span className="text-muted-foreground">{formatRupiah(amount)} · {pct.toFixed(0)}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-expense" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="mt-4 grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={exportPDF} className="rounded-2xl py-6">
              <FileText className="mr-2 h-4 w-4" /> Ekspor PDF
            </Button>
            <Button variant="outline" onClick={exportExcel} className="rounded-2xl py-6">
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Ekspor Excel
            </Button>
          </section>

          <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold">Detail Transaksi</h2>
            {reportData.list.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground">Tidak ada transaksi.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {reportData.list.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{t.category}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                    </div>
                    <p className={t.type === "income" ? "text-sm font-semibold text-income" : "text-sm font-semibold text-expense"}>
                      {t.type === "income" ? "+" : "-"} {formatRupiah(t.amount)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
