# Revamp Halaman Laporan → "Analitik"

Halaman `/laporan` akan direname secara konseptual menjadi **"Analitik"** (nama yang mencakup dashboard + laporan sekaligus, terasa modern dan data-centric). Route tetap `/laporan` tapi title dan nav label berubah menjadi **Analitik**.

## Struktur Baru: 2 Tab Utama

### Tab 1 — Dashboard
Ringkasan visual cepat, cocok untuk cek kondisi keuangan sekilas pandang.

| Widget | Deskripsi |
|---|---|
| **KPI Cards** | Pemasukan, Pengeluaran, Saldo, Savings Rate bulan ini |
| **Cash Flow Bar** | Bar horisontal visual income vs expense, simple dan impactful |
| **Pengeluaran per Kategori** | Donut-style bar chart dengan persentase, sorted by biggest |
| **Realisasi Budget per PIC** | Card per PIC: budget vs realisasi + progress ring |
| **Tren 6 Bulan** | Sparkline bars pemasukan & pengeluaran 6 bulan terakhir |
| **Transaksi Terbaru** | 5 transaksi terbaru tanpa perlu buka tab transaksi |

### Tab 2 — Laporan
Laporan yang bisa di-filter, dianalisis, dan diekspor.

| Fitur | Deskripsi |
|---|---|
| **Filter mode** | Bulanan / Rentang tanggal / Periode budget |
| **Filter PIC & Kategori** | Filter silang |
| **Summary KPI** | Pemasukan, Pengeluaran, Selisih, Jml transaksi |
| **Breakdown Kategori** | Bar progress per kategori dengan % |
| **Breakdown per PIC** | Pengeluaran per PIC dengan bar |
| **Detail Transaksi** | Tabel scrollable lengkap |
| **Ekspor PDF & Excel** | Tetap ada |

## Perubahan File

### [MODIFY] [BottomNav.tsx](file:///c:/Ripan/Source/vanz/kantong-aman/src/components/BottomNav.tsx)
- Ganti label "Laporan" → "Analitik"
- Ganti icon `FileBarChart` → `BarChart3`

### [MODIFY] [laporan.tsx](file:///c:/Ripan/Source/vanz/kantong-aman/src/routes/_authenticated/laporan.tsx)
- Full revamp: 2 tab (Dashboard & Laporan)
- Dashboard: KPI cards, cash flow visual, kategori breakdown, PIC realisasi, tren 6 bulan, transaksi terbaru
- Laporan: filter lengkap + tabel + ekspor
- Design: modern card glass, gradient accents, smooth animations via CSS
- Title halaman: "Analitik"

> [!NOTE]
> Tidak perlu install chart library — semua visual dibuat dengan CSS/SVG murni (progress bars, sparklines, donut-style) agar tetap ringan dan sejalan dengan codebase yang ada.

## Verification Plan
- Pastikan semua data hooks (`useTransactions`, `usePICs`, `useBudgetItems`, dll.) terhubung dengan benar
- Cek ekspor PDF & Excel masih berfungsi
- Pastikan tab switching smooth dan tidak ada error TypeScript
