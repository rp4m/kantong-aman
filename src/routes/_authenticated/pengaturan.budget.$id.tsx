import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  ArrowLeft, Plus, Pencil, Trash2, FileSpreadsheet, FileText,
  TrendingUp, TrendingDown, Wallet, Users, ChevronDown, ChevronUp,
  Download, AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CategoryTransactionsDialog } from "@/components/CategoryTransactionsDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useBudgetPeriods, useBudgetItems, useCategories, usePICs,
  addBudgetItem, updateBudgetItem, deleteBudgetItem, getRealizationForItem, canEditBudget,
} from "@/lib/cloud-store";
import type { BudgetItem } from "@/lib/budget-types";
import { CollaboratorsSection } from "@/components/CollaboratorsSection";
import { formatRupiah, formatDateRange } from "@/lib/budget-format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { buildExportData, exportToExcel, exportToPDF } from "@/lib/budget-export";

export const Route = createFileRoute("/_authenticated/pengaturan/budget/$id")({
  component: BudgetDetailPage,
});

// ===================== Stat Card =====================
function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-card border border-border p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <div className={cn("rounded-xl p-1.5", color)}>
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
      </div>
      <p className="text-base font-bold text-foreground leading-tight mt-1">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ===================== PIC Group Table =====================
function PICGroupTable({
  pic,
  rows,
  subtotalBudget,
  subtotalRealized,
  subtotalRemaining,
  subtotalPct,
  isOwner,
  onEdit,
  onDelete,
  onClickCategory,
}: {
  pic: { name: string; email?: string };
  rows: { item: BudgetItem; cat: string; realized: number; pct: number }[];
  subtotalBudget: number;
  subtotalRealized: number;
  subtotalRemaining: number;
  subtotalPct: number;
  isOwner: boolean;
  onEdit: (item: BudgetItem) => void;
  onDelete: (id: string) => void;
  onClickCategory: (catName: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const utilTone = subtotalPct >= 100 ? "expense" : subtotalPct >= 80 ? "warning" : "primary";

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* PIC Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none bg-gradient-to-r from-primary/8 to-primary/3 hover:from-primary/12 hover:to-primary/6 transition-colors"
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/15 shrink-0">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">{pic.name}</p>
            {pic.email && <p className="text-[11px] text-muted-foreground truncate">{pic.email}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* Mini stat chips */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[11px] font-semibold">
              {formatRupiah(subtotalBudget)}
            </span>
            <span className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold",
              utilTone === "expense" && "bg-expense-soft text-expense",
              utilTone === "warning" && "bg-warning/20 text-amber-700 dark:text-amber-400",
              utilTone === "primary" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
            )}>
              {subtotalPct.toFixed(0)}% terpakai
            </span>
          </div>
          {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Progress bar for PIC */}
          <div className="px-4 py-2 border-b border-border/50 bg-muted/20">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
              <span>Realisasi: {formatRupiah(subtotalRealized)}</span>
              <span>Sisa: {formatRupiah(subtotalRemaining)}</span>
            </div>
            <Progress
              value={Math.min(subtotalPct, 100)}
              className={cn(
                "h-2",
                utilTone === "expense" && "[&>div]:bg-expense",
                utilTone === "warning" && "[&>div]:bg-amber-500",
                utilTone === "primary" && "[&>div]:bg-emerald-500",
              )}
            />
          </div>

          {/* Items table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border/60">
                  <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">Kategori</th>
                  {/* <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground hidden md:table-cell">Catatan</th> */}
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Budget</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Realisasi</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground hidden sm:table-cell">Sisa</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-muted-foreground">%</th>
                  {isOwner && <th className="py-2.5 px-2 w-16" />}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ item, cat, realized, pct }) => {
                  const tone = pct >= 100 ? "expense" : pct >= 80 ? "warning" : "ok";
                  const remaining = item.amount - realized;
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-border/40 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => onClickCategory(cat)}
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            tone === "expense" && "bg-expense",
                            tone === "warning" && "bg-amber-500",
                            tone === "ok" && "bg-emerald-500",
                          )} />
                          <span className="font-medium text-foreground">{cat}</span>
                        </div>
                      </td>
                      {/* <td className="py-3 px-3 text-muted-foreground hidden md:table-cell max-w-[180px]">
                        <span className="line-clamp-2">{item.notes || <span className="italic opacity-50">—</span>}</span>
                      </td> */}
                      <td className="py-3 px-3 text-right font-semibold">{formatRupiah(item.amount)}</td>
                      <td className="py-3 px-3 text-right">
                        <span className={cn(
                          "font-semibold",
                          tone === "expense" && "text-expense",
                          tone === "warning" && "text-amber-600 dark:text-amber-400",
                          tone === "ok" && "text-emerald-600 dark:text-emerald-400",
                        )}>{formatRupiah(realized)}</span>
                      </td>
                      <td className="py-3 px-3 text-right hidden sm:table-cell text-muted-foreground">{formatRupiah(remaining)}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                          tone === "expense" && "bg-expense-soft text-expense",
                          tone === "warning" && "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
                          tone === "ok" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
                        )}>
                          {pct >= 100 && <AlertTriangle className="inline h-2.5 w-2.5 mr-0.5" />}
                          {pct.toFixed(0)}%
                        </span>
                      </td>
                      {isOwner && (
                        <td className="py-3 px-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-0.5">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(item)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-expense" onClick={() => onDelete(item.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              {/* Subtotal footer */}
              <tfoot>
                <tr className="bg-primary/5 border-t-2 border-primary/20">
                  <td className="py-3 px-3 font-bold text-primary text-xs">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Subtotal PIC
                    </div>
                  </td>
                  {/* <td className="hidden md:table-cell" /> */}
                  <td className="py-3 px-3 text-right font-bold text-primary">{formatRupiah(subtotalBudget)}</td>
                  <td className="py-3 px-3 text-right font-bold text-primary">{formatRupiah(subtotalRealized)}</td>
                  <td className="py-3 px-3 text-right font-bold text-muted-foreground hidden sm:table-cell">{formatRupiah(subtotalRemaining)}</td>
                  <td className="py-3 px-3 text-center">
                    <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[10px] font-bold">
                      {subtotalPct.toFixed(0)}%
                    </span>
                  </td>
                  {isOwner && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ===================== Main Page =====================
function BudgetDetailPage() {
  const { id } = Route.useParams();
  const periods = useBudgetPeriods();
  const items = useBudgetItems();
  const categories = useCategories();
  const pics = usePICs();
  const period = periods.find((p) => p.id === id);
  const periodItems = useMemo(() => items.filter((it) => it.budgetPeriodId === id), [items, id]);
  const isOwner = canEditBudget(id);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const picById = useMemo(() => new Map(pics.map((p) => [p.id, p])), [pics]);

  const rows = useMemo(() => {
    return periodItems.map((it) => {
      const realized = getRealizationForItem(it);
      const pct = it.amount > 0 ? (realized / it.amount) * 100 : 0;
      return { item: it, realized, pct };
    });
  }, [periodItems, items]);

  // Grand totals (all PICs)
  const grandTotalBudget = rows.reduce((a, r) => a + r.item.amount, 0);
  const grandTotalReal = rows.reduce((a, r) => a + r.realized, 0);
  const grandTotalRemaining = grandTotalBudget - grandTotalReal;
  const grandTotalUtil = grandTotalBudget > 0 ? (grandTotalReal / grandTotalBudget) * 100 : 0;

  // Group by PIC
  const picGroups = useMemo(() => {
    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const picId = row.item.picId;
      if (!groups.has(picId)) groups.set(picId, []);
      groups.get(picId)!.push(row);
    }
    return Array.from(groups.entries()).map(([picId, picRows]) => {
      const pic = picById.get(picId);
      const subtotalBudget = picRows.reduce((a, r) => a + r.item.amount, 0);
      const subtotalRealized = picRows.reduce((a, r) => a + r.realized, 0);
      return {
        picId,
        pic,
        picRows: picRows.map((r) => ({
          item: r.item,
          cat: catById.get(r.item.categoryId)?.name ?? "—",
          realized: r.realized,
          pct: r.pct,
        })),
        subtotalBudget,
        subtotalRealized,
        subtotalRemaining: subtotalBudget - subtotalRealized,
        subtotalPct: subtotalBudget > 0 ? (subtotalRealized / subtotalBudget) * 100 : 0,
      };
    });
  }, [rows, picById, catById]);

  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedCategoryForDetail, setSelectedCategoryForDetail] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<BudgetItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<"excel" | "pdf" | null>(null);

  const handleExportExcel = async () => {
    if (!period) return;
    setIsExporting("excel");
    try {
      const exportData = buildExportData(period, periodItems, catById, picById, getRealizationForItem);
      await exportToExcel(exportData);
      toast.success("File Excel berhasil diunduh");
    } catch (e) {
      toast.error("Gagal mengekspor Excel: " + (e as Error).message);
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportPDF = async () => {
    if (!period) return;
    setIsExporting("pdf");
    try {
      const exportData = buildExportData(period, periodItems, catById, picById, getRealizationForItem);
      await exportToPDF(exportData);
      toast.success("File PDF berhasil diunduh");
    } catch (e) {
      toast.error("Gagal mengekspor PDF: " + (e as Error).message);
    } finally {
      setIsExporting(null);
    }
  };

  if (!period) {
    return (
      <AppShell title="Detail Budget">
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm">
          Periode tidak ditemukan.{" "}
          <Link to="/pengaturan/budget" className="font-medium text-primary">Kembali</Link>
        </div>
      </AppShell>
    );
  }

  const statusColor = period.status === "active"
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
    : period.status === "draft"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
      : "bg-muted text-muted-foreground";

  const statusIcon = period.status === "active"
    ? <CheckCircle2 className="h-3 w-3" />
    : period.status === "draft"
      ? <Clock className="h-3 w-3" />
      : null;

  const utilizationTone = grandTotalUtil >= 100 ? "expense" : grandTotalUtil >= 80 ? "warning" : "ok";

  return (
    <AppShell
      title={period.name}
      subtitle={formatDateRange(period.startDate, period.endDate)}
      action={
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full gap-1.5"
                disabled={!!isExporting || periodItems.length === 0}
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {isExporting ? "Mengekspor…" : "Export"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={handleExportExcel} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                Export Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF} className="gap-2 cursor-pointer">
                <FileText className="h-4 w-4 text-red-500" />
                Export PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {isOwner && (
            <Button size="sm" className="rounded-full gap-1" onClick={() => { setEditing(null); setOpenForm(true); }}>
              <Plus className="h-4 w-4" /> Item
            </Button>
          )}
        </div>
      }
    >
      <Link to="/pengaturan/budget" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Daftar Budget
      </Link>

      <CollaboratorsSection budgetPeriodId={id} />

      {/* ── Hero Banner ── */}
      <section className="mt-4 rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-5 text-white shadow-lg relative overflow-hidden">
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -top-8 -right-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-white/8 blur-xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-4 w-4 opacity-80" />
            <p className="text-xs uppercase tracking-wider opacity-80">Grand Total Budget</p>
            <span className={cn("ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", statusColor)}>
              {statusIcon}{period.status}
            </span>
          </div>
          <p className="text-3xl font-bold tracking-tight">{formatRupiah(grandTotalBudget)}</p>

          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-xl bg-white/15 p-2.5 backdrop-blur">
              <div className="flex items-center gap-1 opacity-80 mb-0.5">
                <TrendingDown className="h-3 w-3" />
                <span>Realisasi</span>
              </div>
              <p className="font-bold">{formatRupiah(grandTotalReal)}</p>
            </div>
            <div className="rounded-xl bg-white/15 p-2.5 backdrop-blur">
              <div className="flex items-center gap-1 opacity-80 mb-0.5">
                <TrendingUp className="h-3 w-3" />
                <span>Sisa</span>
              </div>
              <p className="font-bold">{formatRupiah(grandTotalRemaining)}</p>
            </div>
            <div className="rounded-xl bg-white/15 p-2.5 backdrop-blur">
              <p className="opacity-80 mb-0.5">Utilisasi</p>
              <p className="font-bold">{grandTotalUtil % 1 === 0 ? grandTotalUtil.toFixed(0) : grandTotalUtil.toFixed(1)}%</p>
            </div>
          </div>

          {/* Utilization bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] opacity-70 mb-1">
              <span>Progress penggunaan</span>
              <span>{Math.min(grandTotalUtil, 100).toFixed(0)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/20">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  utilizationTone === "expense" && "bg-red-400",
                  utilizationTone === "warning" && "bg-amber-400",
                  utilizationTone === "ok" && "bg-emerald-400",
                )}
                style={{ width: `${Math.min(grandTotalUtil, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stat Cards ── */}
      {/* <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Item"
          value={String(periodItems.length)}
          sub={`${picGroups.length} PIC aktif`}
          icon={Wallet}
          color="bg-indigo-600"
        />
        <StatCard
          label="Jumlah PIC"
          value={String(picGroups.length)}
          sub="orang bertugas"
          icon={Users}
          color="bg-violet-600"
        />
        <StatCard
          label="Total Terpakai"
          value={formatRupiah(grandTotalReal)}
          sub={`${grandTotalUtil.toFixed(1)}% dari budget`}
          icon={TrendingDown}
          color={grandTotalUtil >= 100 ? "bg-red-500" : grandTotalUtil >= 80 ? "bg-amber-500" : "bg-emerald-600"}
        />
        <StatCard
          label="Total Sisa"
          value={formatRupiah(grandTotalRemaining)}
          sub={grandTotalRemaining < 0 ? "⚠ Melebihi budget!" : "masih tersedia"}
          icon={TrendingUp}
          color={grandTotalRemaining < 0 ? "bg-red-500" : "bg-cyan-600"}
        />
      </div> */}

      {/* ── Per-PIC Tables ── */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-foreground">Detail Budget per PIC</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {picGroups.length} kelompok PIC • {periodItems.length} total item
            </p>
          </div>
        </div>

        {picGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-10 text-center">
            <Wallet className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Belum ada item budget</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Tambahkan item dengan klik tombol + Item</p>
          </div>
        ) : (
          <div className="space-y-4">
            {picGroups.map(({ picId, pic, picRows, subtotalBudget, subtotalRealized, subtotalRemaining, subtotalPct }) => (
              <PICGroupTable
                key={picId}
                pic={pic ?? { name: "Unknown PIC" }}
                rows={picRows}
                subtotalBudget={subtotalBudget}
                subtotalRealized={subtotalRealized}
                subtotalRemaining={subtotalRemaining}
                subtotalPct={subtotalPct}
                isOwner={isOwner}
                onEdit={(item) => { setEditing(item); setOpenForm(true); }}
                onDelete={(id) => setDeleteId(id)}
                onClickCategory={(catName) => { setSelectedCategoryForDetail(catName); setIsDetailDialogOpen(true); }}
              />
            ))}

            {/* Grand Total Footer Card */}
            {/* {picGroups.length > 1 && (
              <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-violet-500/5 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="rounded-xl bg-primary p-1.5">
                    <Wallet className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="text-sm font-bold text-primary">Grand Total — Semua PIC</span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                  {[
                    { label: "Total Budget", value: formatRupiah(grandTotalBudget), cls: "text-foreground font-bold" },
                    { label: "Total Realisasi", value: formatRupiah(grandTotalReal), cls: cn("font-bold", grandTotalUtil >= 100 ? "text-expense" : "text-emerald-600 dark:text-emerald-400") },
                    { label: "Total Sisa", value: formatRupiah(grandTotalRemaining), cls: cn("font-bold", grandTotalRemaining < 0 ? "text-expense" : "text-foreground") },
                    { label: "Utilisasi", value: `${grandTotalUtil.toFixed(1)}%`, cls: cn("font-bold", grandTotalUtil >= 100 ? "text-expense" : grandTotalUtil >= 80 ? "text-amber-600" : "text-emerald-600 dark:text-emerald-400") },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl bg-background/60 p-3 border border-border/50">
                      <p className="text-muted-foreground mb-0.5">{stat.label}</p>
                      <p className={stat.cls}>{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )} */}
          </div>
        )}
      </section>

      {/* ── Dialogs ── */}
      <ItemFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        periodId={id}
        initial={editing}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus budget item?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-expense text-expense-foreground hover:bg-expense/90"
              onClick={() => {
                if (deleteId) { deleteBudgetItem(deleteId); toast.success("Item dihapus"); setDeleteId(null); }
              }}
            >Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CategoryTransactionsDialog
        isOpen={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        categoryName={selectedCategoryForDetail}
      />
    </AppShell>
  );
}

// ===================== Item Form Dialog =====================
function ItemFormDialog({
  open, onOpenChange, periodId, initial,
}: { open: boolean; onOpenChange: (v: boolean) => void; periodId: string; initial: BudgetItem | null }) {
  const categories = useCategories();
  const pics = usePICs();
  const active = useMemo(() => categories.filter((c) => c.isActive), [categories]);

  const [categoryId, setCategoryId] = useState("");
  const [picId, setPicId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setCategoryId(initial.categoryId);
      setPicId(initial.picId);
      setAmount(String(initial.amount));
      setNotes(initial.notes);
    } else {
      setCategoryId(active[0]?.id ?? "");
      setPicId(pics[0]?.id ?? "");
      setAmount("");
      setNotes("");
    }
  }, [open, initial, active, pics]);

  const submit = () => {
    const n = Number(amount.replace(/[^\d]/g, ""));
    if (!categoryId) return toast.error("Pilih kategori");
    if (!picId) return toast.error("Pilih PIC");
    if (!n || n <= 0) return toast.error("Nominal harus lebih dari 0");
    try {
      if (initial) {
        updateBudgetItem(initial.id, { categoryId, picId, amount: n, notes: notes.trim() });
        toast.success("Item diperbarui");
      } else {
        addBudgetItem({ budgetPeriodId: periodId, categoryId, picId, amount: n, notes });
        toast.success("Item ditambahkan");
      }
      onOpenChange(false);
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Item" : "Tambah Item"}</DialogTitle>
          <DialogDescription>Tentukan kategori, PIC, dan nominal budget.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Kategori</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
              <SelectContent>
                {active.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>PIC</Label>
            <Select value={picId} onValueChange={setPicId}>
              <SelectTrigger><SelectValue placeholder="Pilih PIC" /></SelectTrigger>
              <SelectContent>
                {pics.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Nominal</Label>
            <Input
              inputMode="numeric" placeholder="0"
              value={amount ? Number(amount.replace(/[^\d]/g, "")).toLocaleString("id-ID") : ""}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              className="text-lg font-semibold"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Catatan</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={submit}>{initial ? "Simpan" : "Tambah"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
