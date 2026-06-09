# Implementasi PRD Kantong Aman — Cloud + Collaboration

Skema database, RLS, dan trigger sudah jalan (profiles, budget_periods, budget_collaborators, budget_items, categories, pics, transactions, notifications). Fokus rencana ini adalah membangun lapisan aplikasi di atasnya.

## Ringkasan untuk non-teknis

Saat ini aplikasi menyimpan semua data di browser (localStorage). Setelah selesai:

1. **Login wajib** — halaman Login/Register/Lupa Password, dengan tombol "Continue with Google" sebagai metode utama.
2. **Semua data pindah ke cloud** — bisa diakses dari HP dan desktop, otomatis sinkron.
3. **Budget bisa dibagi** — pemilik bisa undang orang lewat email dengan peran Collaborator atau Viewer.
4. **Dashboard baru "Budget Saya"** — dipisah jadi "Owned" dan "Shared With Me", lengkap dengan label peran.
5. **Notifikasi** — lonceng di app yang nunjukin undangan baru, transaksi baru, dll.
6. **Audit log** — setiap transaksi nunjukin siapa yang buat & ubah.

## Tahap eksekusi

### Fase 1 — Auth & proteksi rute
- Aktifkan Google OAuth via `supabase--configure_social_auth` (provider: google).
- Buat `src/routes/auth.tsx` (publik): tab Login / Register / Forgot Password. Tombol Google di paling atas.
- Buat `src/routes/reset-password.tsx` (publik) untuk recovery link.
- Buat `src/routes/_authenticated/route.tsx` (gate `ssr:false`, redirect ke `/auth`).
- Pindahkan semua halaman aplikasi ke bawah `_authenticated/`: `index`, `transaksi`, `laporan`, `pengaturan.*`.
- Tambah tombol Logout di Settings (clear query cache → signOut → navigate `/auth`).

### Fase 2 — Data layer Supabase
Ganti `src/lib/budget-store.ts` (localStorage hooks) dengan server-functions + TanStack Query hooks. File baru di `src/lib/api/`:

- `categories.functions.ts` — list/create/update/delete (scoped owner)
- `pics.functions.ts` — sama
- `budget-periods.functions.ts` — list (owned + shared via RLS), create, update, delete
- `budget-items.functions.ts` — per period
- `transactions.functions.ts` — list with filters, create, update, delete; auto-set `created_by`
- `profiles.functions.ts` — get/update profil sendiri
- `collaborators.functions.ts` — list/invite/update role/remove
- `notifications.functions.ts` — list, mark read, mark all read

Semua pakai `requireSupabaseAuth`. Hook React: `useCategoriesQuery()`, `useCreateCategory()`, dst, pakai `useQuery`/`useMutation` + invalidation.

Update semua halaman (`index`, `transaksi`, `laporan`, `pengaturan.*`) untuk pakai hooks baru. Hapus seluruh kode localStorage kecuali untuk preferensi tema.

### Fase 3 — Kolaborasi & dashboard
- `pengaturan.budget.$id.tsx` → tambah tab "Kolaborator" dengan: list anggota + status, form undang (email + role), ubah role, hapus.
- `index.tsx` → tambah section "Budget Saya" dengan grup **Owned** / **Shared With Me** + label peran (Owner/Collaborator/Viewer). Sembunyikan aksi mutasi untuk Viewer.
- Cek role di UI: helper `useBudgetRole(budgetId)` untuk gate tombol Tambah/Edit/Hapus.

### Fase 4 — Notifikasi
- Komponen `NotificationBell` di header AppShell: badge jumlah unread, popover daftar notifikasi (mark read on click).
- Realtime subscribe ke channel `notifications` untuk user saat ini → invalidate query.
- Tambah filter/aksi sesuai tipe (klik invitation → buka budget).

### Fase 5 — Audit & polish
- Detail transaksi (dialog) tampilkan: dibuat oleh, dibuat pada, diubah oleh, diubah pada (join `profiles`).
- Validasi input dengan zod di server functions (email, length).
- Empty states, loading skeleton, error toast konsisten.

## Detail teknis

- Server functions `createServerFn` + `requireSupabaseAuth` (middleware sudah terpasang di `start.ts`).
- TanStack Query: `QueryClient` sudah ada di router context. Pakai `useQuery({ queryKey: ['budget-periods'], queryFn: () => listBudgetPeriods() })`. Invalidate setelah mutate.
- Profil auto-dibuat oleh trigger `handle_new_user` saat sign-up; tidak perlu insert manual.
- Undangan ke email yang belum punya akun: trigger `handle_new_user` otomatis link collaborator ke `user_id` baru dan ubah status ke `accepted`.
- Tipe enum dari DB (`collab_role`, `tx_type`, dll) sudah ada di `src/integrations/supabase/types.ts` (auto-gen).
- Realtime: tambahkan `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;` (migrasi singkat) untuk channel notifikasi.
- Hapus impor `budget-store` di seluruh halaman setelah hooks baru siap; jangan biarkan dua sumber data hidup berdampingan.

## Out of scope (bisa nanti)

- Email broadcast undangan (saat ini undangan hanya muncul dalam app sebagai notifikasi).
- Mobile push notifications.
- Avatar upload (cukup ambil dari Google).

Setelah Anda approve plan ini, saya eksekusi bertahap (Fase 1 dulu, validasi jalan, lanjut Fase 2, dst).