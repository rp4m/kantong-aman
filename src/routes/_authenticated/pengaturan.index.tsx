import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Wallet, Tags, Users, Settings as SettingsIcon, Database, Info, ChevronRight, LogOut, User } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { signOut, useCurrentUser } from "@/lib/cloud-store";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pengaturan/")({
  component: SettingsHub,
});

const sections = [
  {
    title: "Budget Management",
    items: [
      { to: "/pengaturan/budget", label: "Periode Budget", desc: "Buat, edit, clone budget periode", icon: Wallet },
    ],
  },
  {
    title: "Master Data",
    items: [
      { to: "/pengaturan/kategori", label: "Kategori", desc: "Kelola master kategori pengeluaran", icon: Tags },
      { to: "/pengaturan/pic", label: "PIC", desc: "Person In Charge / budget owner", icon: Users },
    ],
  },
  {
    title: "Aplikasi",
    items: [
      { to: "/pengaturan/aplikasi", label: "Preferensi", desc: "Tema, mata uang, format tanggal", icon: SettingsIcon },
      { to: "/pengaturan/data", label: "Manajemen Data", desc: "Cadangkan data JSON", icon: Database },
      { to: "/pengaturan/about", label: "Tentang", desc: "Versi aplikasi & pengembang", icon: Info },
    ],
  },
] as const;

function SettingsHub() {
  const { userEmail } = useCurrentUser();
  const navigate = useNavigate();
  async function handleLogout() {
    await signOut();
    toast.success("Anda telah keluar");
    navigate({ to: "/auth" });
  }
  return (
    <AppShell title="Pengaturan" subtitle="Konfigurasi & master data">
      <section className="mb-5 rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Masuk sebagai</p>
          <p className="truncate text-sm font-medium">{userEmail}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="mr-1 h-4 w-4" /> Keluar
        </Button>
      </section>
      {sections.map((sec) => (
        <section key={sec.title} className="mb-5">
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {sec.title}
          </h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <ul className="divide-y divide-border">
              {sec.items.map(({ to, label, desc, icon: Icon }) => (
                <li key={to}>
                  <Link to={to} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{label}</p>
                      <p className="truncate text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
    </AppShell>
  );
}
