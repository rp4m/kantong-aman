import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useBudgetPeriods, useBudgetItems, useCategories, usePICs,
  addBudgetItem, updateBudgetItem, deleteBudgetItem, getRealizationForItem,
} from "@/lib/cloud-store";
import type { BudgetItem } from "@/lib/budget-types";
import { CollaboratorsSection } from "@/components/CollaboratorsSection";
import { formatRupiah, formatDateRange } from "@/lib/budget-format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pengaturan/budget/$id")({
  component: BudgetDetailPage,
});

function BudgetDetailPage() {
  const { id } = Route.useParams();
  const periods = useBudgetPeriods();
  const items = useBudgetItems();
  const categories = useCategories();
  const pics = usePICs();
  const period = periods.find((p) => p.id === id);
  const periodItems = useMemo(() => items.filter((it) => it.budgetPeriodId === id), [items, id]);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const picById = useMemo(() => new Map(pics.map((p) => [p.id, p])), [pics]);

  const rows = useMemo(() => {
    return periodItems.map((it) => {
      const realized = getRealizationForItem(it);
      const pct = it.amount > 0 ? (realized / it.amount) * 100 : 0;
      return { item: it, realized, pct };
    });
  }, [periodItems, items]);

  const totalBudget = rows.reduce((a, r) => a + r.item.amount, 0);
  const totalReal = rows.reduce((a, r) => a + r.realized, 0);
  const remaining = totalBudget - totalReal;
  const util = totalBudget > 0 ? (totalReal / totalBudget) * 100 : 0;

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<BudgetItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  return (
    <AppShell
      title={period.name}
      subtitle={formatDateRange(period.startDate, period.endDate)}
      action={
        <Button size="sm" className="rounded-full" onClick={() => { setEditing(null); setOpenForm(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Item
        </Button>
      }
    >
      <Link to="/pengaturan/budget" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Daftar Budget
      </Link>

      <CollaboratorsSection budgetPeriodId={id} />


      <section className="rounded-2xl bg-gradient-to-br from-primary via-primary to-balance p-5 text-primary-foreground shadow-lg">
        <p className="text-xs uppercase tracking-wider opacity-80">Total Budget</p>
        <p className="mt-1 text-2xl font-bold">{formatRupiah(totalBudget)}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-xl bg-white/15 p-2.5 backdrop-blur">
            <p className="opacity-80">Realisasi</p>
            <p className="mt-0.5 font-semibold">{formatRupiah(totalReal)}</p>
          </div>
          <div className="rounded-xl bg-white/15 p-2.5 backdrop-blur">
            <p className="opacity-80">Sisa</p>
            <p className="mt-0.5 font-semibold">{formatRupiah(remaining)}</p>
          </div>
          <div className="rounded-xl bg-white/15 p-2.5 backdrop-blur">
            <p className="opacity-80">Utilisasi</p>
            <p className="mt-0.5 font-semibold">{util.toFixed(0)}%</p>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Daftar Budget Item</h2>
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center text-xs text-muted-foreground">
            Belum ada item. Tambahkan kategori + PIC.
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map(({ item, realized, pct }) => {
              const cat = catById.get(item.categoryId);
              const pic = picById.get(item.picId);
              const tone = pct >= 100 ? "expense" : pct >= 80 ? "warning" : "primary";
              return (
                <li key={item.id} className="rounded-xl bg-muted/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{cat?.name ?? "—"}</p>
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          {pic?.name ?? "—"}
                        </span>
                      </div>
                      {item.notes && <p className="mt-0.5 text-xs text-muted-foreground">{item.notes}</p>}
                    </div>
                    <div className="flex">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(item); setOpenForm(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-expense" onClick={() => setDeleteId(item.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {formatRupiah(realized)} / {formatRupiah(item.amount)}
                    </span>
                    <span className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      tone === "expense" && "bg-expense-soft text-expense",
                      tone === "warning" && "bg-warning/30 text-warning-foreground",
                      tone === "primary" && "bg-primary/15 text-primary",
                    )}>{pct.toFixed(0)}%</span>
                  </div>
                  <Progress
                    value={Math.min(pct, 100)}
                    className={cn(
                      "mt-2 h-1.5",
                      tone === "expense" && "[&>div]:bg-expense",
                      tone === "warning" && "[&>div]:bg-warning",
                      tone === "primary" && "[&>div]:bg-primary",
                    )}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

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
    </AppShell>
  );
}

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
