import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCategories, addCategory, updateCategory, deleteCategory } from "@/lib/cloud-store";
import type { Category } from "@/lib/budget-types";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pengaturan/kategori")({
  component: KategoriPage,
});

function KategoriPage() {
  const categories = useCategories();
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <AppShell
      title="Kategori"
      subtitle={`${categories.length} kategori`}
      action={
        <Button size="sm" className="rounded-full" onClick={() => { setEditing(null); setOpenForm(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Tambah
        </Button>
      }
    >
      <Link to="/pengaturan" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Pengaturan
      </Link>

      <ul className="space-y-2">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold">{c.name}</p>
                {!c.isActive && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">Nonaktif</span>}
              </div>
              {c.description && <p className="truncate text-xs text-muted-foreground">{c.description}</p>}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(c); setOpenForm(true); }}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-expense" onClick={() => setDeleteId(c.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>

      <CategoryFormDialog open={openForm} onOpenChange={setOpenForm} initial={editing} />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus kategori?</AlertDialogTitle>
            <AlertDialogDescription>
              Budget item terkait akan ikut terhapus. Transaksi yang sudah ada tidak terhapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-expense text-expense-foreground hover:bg-expense/90"
              onClick={() => {
                if (deleteId) { deleteCategory(deleteId); toast.success("Kategori dihapus"); setDeleteId(null); }
              }}
            >Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function CategoryFormDialog({
  open, onOpenChange, initial,
}: { open: boolean; onOpenChange: (v: boolean) => void; initial: Category | null }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (initial) { setName(initial.name); setDescription(initial.description); setIsActive(initial.isActive); }
    else { setName(""); setDescription(""); setIsActive(true); }
  }, [open, initial]);

  const submit = () => {
    try {
      if (initial) {
        updateCategory(initial.id, { name, description: description.trim(), isActive });
        toast.success("Kategori diperbarui");
      } else {
        addCategory({ name, description, isActive });
        toast.success("Kategori ditambahkan");
      }
      onOpenChange(false);
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Kategori" : "Tambah Kategori"}</DialogTitle>
          <DialogDescription>Kategori dipakai pada budget item & transaksi.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Nama</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Misal: Konsumsi" />
          </div>
          <div className="space-y-1.5">
            <Label>Deskripsi</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opsional" />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
            <Label>Aktif</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
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
