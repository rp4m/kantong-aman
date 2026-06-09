import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef } from "react";
import { ArrowLeft, Download, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { exportAllData, importAllData } from "@/lib/cloud-store";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pengaturan/data")({
  component: DataPage,
});

function DataPage() {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleBackup = () => {
    const json = exportAllData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Cadangan berhasil diunduh");
  };

  const handleRestore = async (file: File) => {
    try {
      const text = await file.text();
      importAllData(text);
      toast.success("Data berhasil dipulihkan");
    } catch (e) {
      toast.error("Gagal memulihkan: " + (e as Error).message);
    }
  };

  return (
    <AppShell title="Manajemen Data">
      <Link to="/pengaturan" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Pengaturan
      </Link>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold">Cadangkan & Pulihkan</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Simpan seluruh data (transaksi, kategori, PIC, periode budget, item budget) ke file JSON.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={handleBackup} className="rounded-xl">
            <Download className="mr-1.5 h-4 w-4" /> Cadangkan
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="rounded-xl">
            <Upload className="mr-1.5 h-4 w-4" /> Pulihkan
          </Button>
        </div>
        <input
          ref={fileRef} type="file" accept="application/json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleRestore(f); e.target.value = ""; }}
        />
      </section>
    </AppShell>
  );
}
