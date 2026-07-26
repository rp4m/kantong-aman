# Revamp Halaman Analitik Selesai

Halaman "Laporan" kini telah diubah namanya menjadi **"Analitik"** dengan desain yang lebih *modern* dan pembagian fitur yang jauh lebih terstruktur menggunakan sistem *Tab*.

## Perubahan Utama

### 1. Struktur Tab Ganda
Halaman kini dibagi menjadi 2 tab utama:
- **Dashboard**: Menyajikan metrik finansial tingkat tinggi secara visual untuk memantau kesehatan keuangan bulan ini.
- **Laporan**: Mempertahankan fungsi laporan detail dengan filter mendalam dan kemampuan ekspor ke PDF & Excel.

### 2. Fitur Baru di Tab Dashboard
- **Sisa Saldo & Savings Rate**: Visualisasi elegan berbentuk *gradient card* dengan dompet (wallet) yang menunjukkan sisa uang (Saldo = Pemasukan - Pengeluaran) dan persentase yang berhasil disisihkan (Savings Rate).
- **Cash Flow Bar**: Progress bar sederhana yang langsung memperlihatkan proporsi Pemasukan vs Pengeluaran secara *real-time*.
- **Tren 6 Bulan Terakhir**: Grafik *sparklines* berbentuk bar vertikal yang membandingkan Pemasukan dan Pengeluaran bulanan.
- **Breakdown Kategori & PIC**: Menampilkan 4 kategori dan 4 PIC teratas dengan pengeluaran terbesar beserta *progress bar*.
- **Transaksi Terbaru**: Menampilkan 5 transaksi terakhir tanpa perlu berpindah ke halaman Transaksi.

### 3. Pembaruan Navigasi & UI
- Navigasi bawah (`BottomNav`) kini menampilkan label "Analitik" dengan ikon bar chart (`BarChart3`) yang lebih mencerminkan fungsi analitik yang komprehensif.
- Seluruh grafik dan metrik dibangun murni menggunakan **CSS dan SVG**, memastikan aplikasi tetap *ringan* tanpa tambahan dependensi library chart berat (seperti *Recharts* atau *Chart.js*).

## Cara Uji Coba

1. Buka aplikasi dan klik menu navigasi **Analitik** di bagian bawah.
2. Anda akan langsung mendarat di tab **Dashboard**. Coba ubah bulan/tahun di kanan atas untuk melihat perubahan metrik.
3. Gulir ke bawah untuk melihat *Tren 6 Bulan*, *Breakdown*, dan *Transaksi Terbaru*.
4. Klik tab **Laporan** untuk melihat tabel detail transaksi lama dan menguji kembali fitur **Ekspor PDF/Excel**.

> [!TIP]
> Jika data masih kosong, pastikan Anda menambahkan beberapa transaksi pemasukan dan pengeluaran terlebih dahulu di bulan ini untuk melihat bagaimana visualisasi pada dashboard bereaksi.
