import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileText, FileSpreadsheet } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useTransactions, useCategories, usePICs, useBudgetPeriods, useBudgetItems,
} from "@/lib/budget-store";
import { formatRupiah, formatDate, formatDateRange, monthLabel, todayISO, toISODate } from "@/lib/budget-format";
import { MONTH_NAMES, type Transaction } from "@/lib/budget-types";
import { toast } from "sonner";

export const Route = createFileRoute("/laporan")({
  head: () => ({
    meta: [
      { title: "Laporan – Kantong Aman" },
      { name: "description", content: "Laporan bulanan, date range, dan per periode budget." },
    ],
  }),
  component: LaporanPage,
});

type Mode = "monthly" | "range" | "period";

function LaporanPage() {
  const transactions = useTransactions();
  const categories = useCategories();
  const pics = usePICs();
  const periods = useBudgetPeriods();
  const items = useBudgetItems();

  const [mode, setMode] = useState<Mode>("monthly");
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [rangeStart, setRangeStart] = useState<string>(todayISO());
  const [rangeEnd, setRangeEnd] = useState<string>(todayISO());
  const [periodId, setPeriodId] = useState<string>("");

  const [filterPic, setFilterPic] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const range = useMemo(() => {
    if (mode === "monthly") {
      const s = new Date(year, month - 1, 1);
      const e = new Date(year, month, 0);
      return { start: toISODate(s), end: toISODate(e), label: monthLabel(month, year) };
    }
    if (mode === "range") {
      return { start: rangeStart, end: rangeEnd, label: formatDateRange(rangeStart, rangeEnd) };
    }
    const p = periods.find((x) => x.id === periodId);
    if (!p) return { start: todayISO(), end: todayISO(), label: "—" };
    return { start: p.startDate, end: p.endDate, label: `${p.name} (${formatDateRange(p.startDate, p.endDate)})` };
  }, [mode, month, year, rangeStart, rangeEnd, periodId, periods]);

  const itemToPicId = useMemo(() => new Map(items.map((it) => [it.id, it.picId])), [items]);

  const data = useMemo(() => {
    const list: Transaction[] = transactions.filter((t) => {
      if (t.date < range.start || t.date > range.end) return false;
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
  }, [transactions, range, filterCategory, filterPic, itemToPicId]);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("Laporan Keuangan", 14, 16);
    doc.setFontSize(10);
    doc.text(`Periode: ${range.label}`, 14, 23);
    doc.text(`Total Pemasukan: ${formatRupiah(data.totalIncome)}`, 14, 30);
    doc.text(`Total Pengeluaran: ${formatRupiah(data.totalExpense)}`, 14, 36);
    doc.text(`Selisih: ${formatRupiah(data.selisih)}`, 14, 42);

    autoTable(doc, {
      startY: 50,
      head: [["Tanggal", "Jenis", "Kategori", "Catatan", "Nominal"]],
      body: data.list.map((t) => [
        formatDate(t.date),
        t.type === "income" ? "Pemasukan" : "Pengeluaran",
        t.category, t.notes, formatRupiah(t.amount),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 105, 105] },
    });
    doc.save(`laporan-${mode}-${Date.now()}.pdf`);
    toast.success("PDF berhasil diunduh");
  };

  const exportExcel = () => {
    const rows = data.list.map((t) => ({
      Tanggal: t.date,
      Jenis: t.type === "income" ? "Pemasukan" : "Pengeluaran",
      Kategori: t.category, Catatan: t.notes, Nominal: t.amount,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.sheet_add_aoa(ws, [
      [], ["Periode", range.label],
      ["Total Pemasukan", data.totalIncome],
      ["Total Pengeluaran", data.totalExpense],
      ["Selisih", data.selisih],
    ], { origin: -1 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan");
    XLSX.writeFile(wb, `laporan-${mode}-${Date.now()}.xlsx`);
    toast.success("Excel berhasil diunduh");
  };

  const yearOptions = Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i);

  return (
    <AppShell title="Laporan" subtitle={range.label}>
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="monthly">Bulanan</TabsTrigger>
          <TabsTrigger value="range">Rentang Tanggal</TabsTrigger>
          <TabsTrigger value="period">Periode Budget</TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "monthly" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Bulan</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tahun</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      {mode === "range" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Dari</Label><Input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} /></div>
          <div><Label className="text-xs">Sampai</Label><Input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} /></div>
        </div>
      )}
      {mode === "period" && (
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
        <StatCard label="Pemasukan" value={data.totalIncome} tone="income" />
        <StatCard label="Pengeluaran" value={data.totalExpense} tone="expense" />
        <StatCard
          label="Selisih" value={data.selisih}
          tone={data.selisih >= 0 ? "balance" : "expense"}
        />
        <StatCard label="Total Transaksi" value={data.list.length} tone="neutral" hint="item" />
      </div>

      <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Pengeluaran per Kategori</h2>
        {data.sortedCats.length === 0 ? (
          <p className="mt-3 text-center text-xs text-muted-foreground">Tidak ada pengeluaran.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.sortedCats.map(([name, amount]) => {
              const pct = data.totalExpense > 0 ? (amount / data.totalExpense) * 100 : 0;
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
        {data.list.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground">Tidak ada transaksi.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {data.list.map((t) => (
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
    </AppShell>
  );
}
