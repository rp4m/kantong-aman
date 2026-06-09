import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { ArrowLeft, Plus, Copy, Pencil, Trash2, Calendar } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useBudgetPeriods, useBudgetItems,
  addBudgetPeriod, updateBudgetPeriod, deleteBudgetPeriod, cloneBudgetPeriod,
} from "@/lib/cloud-store";
import type { BudgetPeriod, BudgetPeriodStatus } from "@/lib/budget-types";
import { formatRupiah, formatDateRange, todayISO } from "@/lib/budget-format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pengaturan/budget/")({
  component: BudgetListPage,
});

const STATUS_LABEL: Record<BudgetPeriodStatus, string> = {
  draft: "Draft", active: "Aktif", closed: "Selesai",
};
const STATUS_CLASS: Record<BudgetPeriodStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-primary/15 text-primary",
  closed: "bg-balance-soft text-balance",
};

function BudgetListPage() {
  const periods = useBudgetPeriods();
  const items = useBudgetItems();
  const totalByPeriod = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((it) => m.set(it.budgetPeriodId, (m.get(it.budgetPeriodId) ?? 0) + it.amount));
    return m;
  }, [items]);
  const countByPeriod = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((it) => m.set(it.budgetPeriodId, (m.get(it.budgetPeriodId) ?? 0) + 1));
    return m;
  }, [items]);

  const sorted = useMemo(
    () => [...periods].sort((a, b) => (a.startDate < b.startDate ? 1 : -1)),
    [periods],
  );

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<BudgetPeriod | null>(null);
  const [openClone, setOpenClone] = useState(false);
  const [cloneSourceId, setCloneSourceId] = useState<string>("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <AppShell
      title="Periode Budget"
      subtitle={`${periods.length} budget`}
      action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => {
            if (periods.length === 0) return toast.error("Belum ada budget yang bisa diduplikasi");
            setCloneSourceId(periods[0].id);
            setOpenClone(true);
          }}>
            <Copy className="mr-1 h-4 w-4" /> Duplikasi
          </Button>
          <Button size="sm" className="rounded-full" onClick={() => { setEditing(null); setOpenForm(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Buat
          </Button>
        </div>
      }
    >
      <Link to="/pengaturan" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Pengaturan
      </Link>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <Calendar className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Belum ada budget periode</p>
          <p className="mt-1 text-xs text-muted-foreground">Buat budget periode pertama Anda.</p>
          <Button className="mt-4" onClick={() => { setEditing(null); setOpenForm(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Buat Budget
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((p) => (
            <li key={p.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <Link to="/pengaturan/budget/$id" params={{ id: p.id }} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", STATUS_CLASS[p.status])}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatDateRange(p.startDate, p.endDate)}</p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{countByPeriod.get(p.id) ?? 0} item</span>
                    <span className="font-semibold text-primary">{formatRupiah(totalByPeriod.get(p.id) ?? 0)}</span>
                  </div>
                </Link>
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(p); setOpenForm(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-expense" onClick={() => setDeleteId(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <PeriodFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        initial={editing}
      />

      <CloneDialog
        open={openClone}
        onOpenChange={setOpenClone}
        sourceId={cloneSourceId}
        setSourceId={setCloneSourceId}
        periods={periods}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus periode budget?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua budget item di dalam periode ini akan ikut terhapus. Transaksi tidak dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-expense text-expense-foreground hover:bg-expense/90"
              onClick={async () => {
                if (deleteId) {
                  try { await deleteBudgetPeriod(deleteId); toast.success("Periode dihapus"); }
                  catch (e) { toast.error((e as Error).message); }
                  setDeleteId(null);
                }
              }}
            >Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function PeriodFormDialog({
  open, onOpenChange, initial,
}: { open: boolean; onOpenChange: (v: boolean) => void; initial: BudgetPeriod | null }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<BudgetPeriodStatus>("active");

  useEffect(() => {
    if (open) {
      if (initial) {
        setName(initial.name); setDescription(initial.description);
        setStartDate(initial.startDate); setEndDate(initial.endDate);
        setStatus(initial.status);
      } else {
        const d = new Date(); const first = new Date(d.getFullYear(), d.getMonth(), 1);
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        setName(""); setDescription("");
        setStartDate(first.toISOString().slice(0, 10));
        setEndDate(last.toISOString().slice(0, 10));
        setStatus("active");
      }
    }
  }, [open, initial]);

  const submit = async () => {
    try {
      if (initial) {
        await updateBudgetPeriod(initial.id, { name: name.trim(), description, startDate, endDate, status });
        toast.success("Budget diperbarui");
      } else {
        await addBudgetPeriod({ name, description, startDate, endDate, status });
        toast.success("Budget dibuat");
      }
      onOpenChange(false);
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Budget" : "Buat Budget Baru"}</DialogTitle>
          <DialogDescription>Tentukan nama budget dan rentang tanggalnya.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Nama Budget</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Misal: Budget Event Ramadhan" />
          </div>
          <div className="space-y-1.5">
            <Label>Deskripsi</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opsional" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Tanggal Mulai</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal Selesai</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as BudgetPeriodStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="closed">Selesai</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={submit}>{initial ? "Simpan" : "Buat"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloneDialog({
  open, onOpenChange, sourceId, setSourceId, periods,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sourceId: string;
  setSourceId: (v: string) => void;
  periods: BudgetPeriod[];
}) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [cloneCategories, setCloneCategories] = useState(true);
  const [cloneAssignments, setCloneAssignments] = useState(true);
  const [cloneAmounts, setCloneAmounts] = useState(true);

  const submit = async () => {
    try {
      await cloneBudgetPeriod(
        sourceId,
        { name, startDate, endDate, status: "active" },
        { cloneCategories, cloneAssignments, cloneAmounts },
      );
      toast.success("Budget berhasil di-clone");
      onOpenChange(false);
      setName("");
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Duplikasi Budget</DialogTitle>
          <DialogDescription>Salin item budget dari periode yang sudah ada.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Budget Sumber</Label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {periods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Nama Budget Baru</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Misal: Budget Februari 2027" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Tanggal Mulai</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal Selesai</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2 rounded-xl bg-muted/40 p-3">
            <p className="text-xs font-semibold">Opsi Duplikasi</p>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={cloneCategories} onCheckedChange={(v) => setCloneCategories(!!v)} />
              Salin Kategori
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={cloneAssignments} onCheckedChange={(v) => setCloneAssignments(!!v)} />
              Salin Penugasan PIC
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={cloneAmounts} onCheckedChange={(v) => setCloneAmounts(!!v)} />
              Salin Nominal Budget
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={submit}>Duplikasi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
