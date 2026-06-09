import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Heart } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/pengaturan/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <AppShell title="Tentang">
      <Link to="/pengaturan" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Pengaturan
      </Link>

      <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Heart className="h-7 w-7" />
        </div>
        <h2 className="mt-3 text-lg font-bold">Kantong Aman</h2>
        <p className="text-xs text-muted-foreground">v3.0 · Kategori & PIC per Item Budget</p>
        <p className="mt-4 text-xs text-muted-foreground">
          Aplikasi pencatatan budget & pengeluaran untuk individu maupun organisasi.
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold">Pengembang</h3>
        <p className="text-xs text-muted-foreground">Dibuat dengan Lovable · TanStack Start · Tailwind v4</p>
      </section>
    </AppShell>
  );
}
