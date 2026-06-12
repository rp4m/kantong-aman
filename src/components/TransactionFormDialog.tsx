import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  INCOME_CATEGORIES,
  type Transaction,
  type TransactionType,
} from "@/lib/budget-types";
import {
  addTransaction,
  updateTransaction,
  useCategories,
  getCategoryByName,
  getActiveBudgetItems,
  usePICs,
  useBudgetPeriods,
  canAddTransaction,
} from "@/lib/cloud-store";
import { formatRupiah, todayISO } from "@/lib/budget-format";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Transaction;
  defaultCategory?: string;
  defaultType?: TransactionType;
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  initial,
  defaultCategory,
  defaultType,
}: Props) {
  const categories = useCategories();
  const pics = usePICs();
  const periods = useBudgetPeriods();
  const activeExpenseCats = useMemo(
    () => categories.filter((c) => c.isActive).map((c) => c.name),
    [categories],
  );

  const [type, setType] = useState<TransactionType>("expense");
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [budgetItemId, setBudgetItemId] = useState<string>("");
  const [budgetPeriodId, setBudgetPeriodId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setType(initial.type);
      setDate(initial.date);
      setAmount(String(initial.amount));
      setCategory(initial.category);
      setNotes(initial.notes ?? "");
      setBudgetItemId(initial.budgetItemId ?? "");
      setBudgetPeriodId("");
    } else {
      const t = defaultType ?? "expense";
      setType(t);
      setDate(todayISO());
      setAmount("");
      const list: readonly string[] = t === "income" ? INCOME_CATEGORIES : activeExpenseCats;
      setCategory(defaultCategory && list.includes(defaultCategory) ? defaultCategory : list[0] ?? "");
      setNotes("");
      setBudgetItemId("");
      setBudgetPeriodId("");
    }
  }, [open, initial, defaultCategory, defaultType, activeExpenseCats]);

  useEffect(() => {
    const list: readonly string[] = type === "income" ? INCOME_CATEGORIES : activeExpenseCats;
    if (list.length && !list.includes(category)) setCategory(list[0]);
  }, [type, category, activeExpenseCats]);

  // Get active budget periods on the selected date
  const activePeriods = useMemo(() => {
    return periods.filter((p) => p.status !== "closed" && p.startDate <= date && p.endDate >= date);
  }, [periods, date]);

  // Auto-match active budget items
  const matchingItems = useMemo(() => {
    if (type !== "expense" || !date || !category) return [];
    const cat = getCategoryByName(category);
    if (!cat) return [];
    let items = getActiveBudgetItems(date, cat.id);
    if (budgetPeriodId) {
      items = items.filter((it) => it.budgetPeriodId === budgetPeriodId);
    }
    return items;
  }, [type, date, category, budgetPeriodId, periods]);

  useEffect(() => {
    if (matchingItems.length === 1) {
      setBudgetItemId(matchingItems[0].id);
    } else if (matchingItems.length === 0) {
      setBudgetItemId("");
    } else if (!matchingItems.some((it) => it.id === budgetItemId)) {
      setBudgetItemId("");
    }
  }, [matchingItems, budgetItemId]);

  const picById = useMemo(() => new Map(pics.map((p) => [p.id, p])), [pics]);
  const periodById = useMemo(() => new Map(periods.map((p) => [p.id, p])), [periods]);

  const submit = async () => {
    const numericAmount = Number(amount.replace(/[^\d]/g, ""));
    if (!date) return toast.error("Tanggal wajib diisi");
    if (!numericAmount || numericAmount <= 0) return toast.error("Nominal harus lebih dari 0");
    if (!category) return toast.error("Pilih kategori");
    if (type === "expense" && matchingItems.length > 1 && !budgetItemId) {
      return toast.error("Pilih budget yang akan digunakan");
    }
    const payload: Omit<Transaction, "id" | "createdAt"> & { budgetPeriodId?: string } = {
      type, date, amount: numericAmount, category,
      notes: notes.trim(),
      budgetItemId: type === "expense" && budgetItemId ? budgetItemId : undefined,
      budgetPeriodId: type === "expense" && budgetPeriodId ? budgetPeriodId : undefined,
    };
    try {
      if (initial) {
        updateTransaction(initial.id, payload);
        toast.success("Transaksi diperbarui");
      } else {
        await addTransaction(payload);
        if (type === "expense") {
          if (matchingItems.length === 0) {
            toast.warning("Tidak ada budget aktif untuk kategori ini");
          } else {
            toast.success("Transaksi ditambahkan");
          }
        } else {
          toast.success("Transaksi ditambahkan");
        }
      }
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const list: readonly string[] = type === "income" ? INCOME_CATEGORIES : activeExpenseCats;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Transaksi" : "Tambah Transaksi"}</DialogTitle>
          <DialogDescription>Catat pemasukan atau pengeluaran Anda.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Tabs value={type} onValueChange={(v) => setType(v as TransactionType)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="expense" className="data-[state=active]:bg-expense data-[state=active]:text-expense-foreground">Pengeluaran</TabsTrigger>
              <TabsTrigger value="income" className="data-[state=active]:bg-income data-[state=active]:text-income-foreground">Pemasukan</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="amount">Nominal</Label>
            <Input
              id="amount" inputMode="numeric" placeholder="0"
              value={amount ? Number(amount.replace(/[^\d]/g, "")).toLocaleString("id-ID") : ""}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              className="text-lg font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date">Tanggal</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder={list.length ? "Pilih kategori" : "Belum ada kategori"} /></SelectTrigger>
                <SelectContent>
                  {list.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {type === "expense" && activePeriods.length > 1 && (
            <div className="space-y-2">
              <Label>Pilih Budget Periode</Label>
              <Select value={budgetPeriodId} onValueChange={setBudgetPeriodId}>
                <SelectTrigger><SelectValue placeholder="Pilih budget periode" /></SelectTrigger>
                <SelectContent>
                  {activePeriods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "expense" && matchingItems.length > 1 && (
            <div className="space-y-2">
              <Label>Pilih Budget</Label>
              <Select value={budgetItemId} onValueChange={setBudgetItemId}>
                <SelectTrigger><SelectValue placeholder="Pilih budget" /></SelectTrigger>
                <SelectContent>
                  {matchingItems.map((it) => {
                    const period = periodById.get(it.budgetPeriodId);
                    const pic = picById.get(it.picId);
                    return (
                      <SelectItem key={it.id} value={it.id}>
                        {period?.name ?? "—"} · {pic?.name ?? "—"} · {formatRupiah(it.amount)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "expense" && matchingItems.length === 1 && (
            <p className="rounded-xl bg-primary/10 px-3 py-2 text-xs text-primary">
              Terhubung ke budget: <b>{periodById.get(matchingItems[0].budgetPeriodId)?.name}</b>
              {" · "}PIC {picById.get(matchingItems[0].picId)?.name ?? "—"}
            </p>
          )}

          {type === "expense" && matchingItems.length === 0 && category && (
            <p className="rounded-xl bg-warning/20 px-3 py-2 text-xs text-warning-foreground">
              Tidak ada budget aktif untuk kategori ini pada tanggal tersebut.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Catatan</Label>
            <Textarea id="notes" placeholder="Opsional" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={submit}>{initial ? "Simpan" : "Tambah"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
