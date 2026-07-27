# Fitur AI Chatbot (Gemini) Kantong Aman

Saya telah berhasil mengimplementasikan fitur chatbot AI (Gemini) sebagai popup floating untuk membaca analitik data dari database budget Anda!

## Apa yang telah diselesaikan:

1. **Instalasi SDK Gemini AI**
   - Menambahkan `@google/generative-ai` ke `package.json`. Ketergantungan ini memungkinkan aplikasi untuk berkomunikasi langsung dengan model Gemini.

2. **Komponen `ChatbotPopup`**
   - Membuat komponen UI popup (mengambang di sisi kanan bawah) menggunakan desain modern dengan ikon dari `lucide-react`.
   - Mengambil state aplikasi dari `useTransactions`, `useCategories`, `useBudgetPeriods`, dll. (`cloud-store`) untuk membangun konteks data (JSON).
   - Menggunakan `GoogleGenerativeAI` bersama model `gemini-1.5-flash` dan merangkum interaksi chat menjadi riwayat (*history*) yang lengkap.

3. **Integrasi Global**
   - Menambahkan `<ChatbotPopup />` ke dalam `AppShell.tsx` agar tombol *floating* chatbot tersedia di semua halaman (beranda, detail budget, transaksi, dsb).

## Cara Menjalankan

> [!IMPORTANT]
> Fitur ini membutuhkan **API Key Gemini**.
> Karena aplikasi memanggilnya menggunakan `import.meta.env.VITE_GEMINI_API_KEY`, pastikan Anda menyetel environment variable `VITE_GEMINI_API_KEY` saat deploy (misal, di Vercel).
>
> Jika ingin diuji di lokal, buat file `.env` di *root directory* dan tambahkan baris berikut:
> `VITE_GEMINI_API_KEY=AIzaSy...`

Semua perubahan sudah tersimpan dan siap untuk digunakan. Jika Anda sudah set-up API Key di `.env` (atau di Vercel nantinya), Anda dapat langsung mencoba berinteraksi dengan AI terkait data-data budget Anda!
