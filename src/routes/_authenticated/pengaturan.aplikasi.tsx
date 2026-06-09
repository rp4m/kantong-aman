import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Moon, Sun, CircleDollarSign, Calendar } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/lib/cloud-store";

export const Route = createFileRoute("/_authenticated/pengaturan/aplikasi")({
  component: AplikasiPage,
});

function AplikasiPage() {
  const { theme, setTheme } = useTheme();
  return (
    <AppShell title="Preferensi Aplikasi">
      <Link to="/pengaturan" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Pengaturan
      </Link>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Tampilan</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {theme === "dark" ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
            <div>
              <p className="text-sm font-medium">Mode Gelap</p>
              <p className="text-xs text-muted-foreground">
                {theme === "dark" ? "Tema gelap aktif" : "Tema terang aktif"}
              </p>
            </div>
          </div>
          <Switch checked={theme === "dark"} onCheckedChange={(v) => setTheme(v ? "dark" : "light")} />
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Format</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CircleDollarSign className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium">Mata Uang</p>
              <p className="text-xs text-muted-foreground">Rupiah (IDR)</p>
            </div>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">Rp</span>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium">Format Tanggal</p>
              <p className="text-xs text-muted-foreground">Indonesia (DD MMM YYYY)</p>
            </div>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">id-ID</span>
        </div>
      </section>
    </AppShell>
  );
}
