# AGENTS.md - Panduan & Peraturan untuk AI Coding Agent

Dokumen ini berisi panduan, instruksi, serta peraturan baku untuk AI Coding Agent yang bekerja pada repositori **WAF** (WhatsApp Bot Framework). Semua AI Agent wajib membaca dan mematuhi dokumen ini sebelum melakukan perubahan kode atau menjalankan tugas.

---

## 1. Ringkasan Proyek

- **Nama Proyek:** WAF (WhatsApp Bot Framework)
- **Package Manager:** **PNPM** (`pnpm-lock.yaml`, `pnpm-workspace.yaml`). **DILARANG** menggunakan `npm` atau `yarn` untuk menginstall dependency atau menjalankan script!
- **Bahasa Utama:** TypeScript (ESNext / Node.js ES Modules, `tsconfig.json`)
- **Library Utama:**
    - `@whiskeysockets/baileys` (Koneksi & Handler WhatsApp Web API)
    - `groq-sdk` (AI Speech-to-Text & LLM Function Calling)
    - `@supabase/supabase-js` (Database & Storage Backend)
    - `sharp` & `@img/sharp-wasm32` (Pengolahan gambar / stiker)
    - `ffmpeg-static` (Pengolahan media audio/video/stiker bergerak)
    - `pino` (Logging system)

---

## 2. Struktur Proyek & Perintah Utama

### 📁 Struktur Direktori

- `src/` - Kode sumber utama TypeScript.
- `dist/` - Hasil kompilasi JavaScript (output dari `pnpm build`).
- `.agents/skills/` - Modul panduan & instruksi khusus untuk agent (misal: Baileys LID compatibility, FFmpeg buffer handling, Groq API rules, dll).
- `auth_info_baileys/` - Menyimpan kredensial sesi WhatsApp (Jangan di-commit / diubah secara manual).

### 🛠 Perintah Utama (PNPM Scripts)

| Perintah            | Fungsi                                                                     |
| :------------------ | :------------------------------------------------------------------------- |
| `pnpm dev`          | Menjalankan aplikasi dalam mode pengembangan (`tsx src/index.ts`)          |
| `pnpm build`        | Memproses kompilasi TypeScript (`tsc`) ke folder `dist/`                   |
| `pnpm typecheck`    | Memeriksa error tipe TypeScript tanpa menulis file output (`tsc --noEmit`) |
| `pnpm lint`         | Memeriksa kepatuhan kode dengan aturan ESLint                              |
| `pnpm format`       | Melakukan formatting otomatis menggunakan Prettier                         |
| `pnpm add <pkg>`    | Menambahkan paket dependency baru                                          |
| `pnpm add -D <pkg>` | Menambahkan paket devDependency baru                                       |
| `pnpm install`      | Menginstall seluruh dependency berdasarkan `pnpm-lock.yaml`                |

---

## 3. Peraturan Utama (Core Rules for AI Agent)

### A. Penggunaan PNPM & TypeScript

- **PNPM Exclusivity:** Proyek ini dikelola penuh dengan PNPM. Dilarang menjalankan perintah `npm install`, `npm run`, `yarn`, dll. Selalu gunakan `pnpm`.
- **TypeScript Strictness:** Semua file baru atau perubahan file wajib ditulis menggunakan TypeScript (`.ts`) yang valid sesuai dengan `tsconfig.json`. Pastikan tipe data eksplisit dan hindari penggunaan `any` tanpa alasan kuat.

### B. Verifikasi Mutlak Sebelum Mengklaim Selesai

- **DILARANG** mengklaim perbaikan atau fitur telah selesai tanpa menjalankan verifikasi empiris.
- Setelah mengedit kode, AI Agent wajib setidaknya menjalankan:
    1. `pnpm typecheck`
    2. `pnpm lint`
    3. `pnpm build` (jika diperlukan untuk memastikan kompilasi dist bersih)

### C. Logging & Debugging

- **Pterodactyl Console Visibility:** Pastikan setiap log penting dan pesan error dicetak ke `console.log` / `console.error` agar muncul di terminal panel Pterodactyl. Jangan hanya menyimpan log ke file JSON/TXT saja.
- **Investigasi Log Lengkap:** Jika terjadi runtime error, baca log lengkap (stack trace) sebelum mendiagnosis. Dilarang melakukan patch superfisial (seperti membungkus kode dengan `try/catch` kosong atau menutupi exception).

### D. Penanganan Media & FFmpeg

- **Buffer ke Temporary File:** Sebelum menjalankan perintah FFmpeg eksternal, pastikan media buffer telah ditulis terlebih dahulu ke temporary file di disk (misalnya menggunakan `fs.writeFileSync` ke path temp). Jangan melewatkan buffer mentah langsung jika library memerlukan file path.
- **Stiker Video / GIF:** Perhatikan batas ukuran, fps, dan format output WebP agar stiker dapat dirender dengan sempurna di WhatsApp.

### E. Integrasi Baileys (WhatsApp API)

- **Kompatibilitas JID vs LID:** Di Baileys v7+, identifikasi pengguna dapat berupa JID (`@s.whatsapp.net`) atau LID (`@lid`). Gunakan helper/logic pencocokan yang mendukung kedua format tersebut agar identifikasi pengguna tidak mismatch.

### F. Integrasi Groq SDK & LLM

- **Native Function Calling:** Gunakan Native Function Calling dari Groq SDK. Jangan membuat tag XML manual (seperti `<function=...>` atau `<tool_call>`) di dalam teks prompt atau output.
- **Upload File Audio Groq:** Saat mengirimkan buffer binary ke API transkripsi Groq Whisper di Node.js, manfaatkan helper `toFile` dari `groq-sdk` agar pengiriman stream/buffer valid.

### G. Kepatuhan Kode & ESLint

- **No Unused Variables:** Hindari mendeklarasikan variabel, parameter, atau import yang tidak digunakan. Pastikan kode lolos periksa ESLint (`eslint-no-unused-vars-handling`).
- **Modul ES (ESM):** Proyek ini menggunakan `"type": "module"`. Pastikan sintaks import/export konsisten.

### H. Penggunaan Bahasa Inggris Formal untuk String Output

- **Formal English Output Strings:** Semua string bertipe output ke pengguna (pesan respon bot, deskripsi tool/command, pesan error, log sistem, dan prompt AI) WAJIB ditulis dalam Bahasa Inggris Formal (_Formal English_), bukan Bahasa Indonesia baku atau tidak baku (rujuk panduan di `.agents/skills/formal-english-output-strings/SKILL.md`).

### I. Manajemen Versi Lokal (Git Local Commits)

- **Wajib Commit Lokal:** Setiap kali menyelesaikan sebuah tugas atau perubahan kode, AI Agent **WAJIB** melakukan commit secara lokal (`git add .` dan `git commit -m "..."`) tanpa perlu melakukan `push`. Hal ini bertujuan agar diff kode selalu tercatat, konteks pekerjaan tidak hilang antar-sesi, dan meminimalisir risiko perubahan dari sesi sebelumnya tertinggal saat sesi berikutnya diinstruksikan untuk melakukan `push`.

---

## 4. Workflow Kerja AI Agent

1. **Pahami Kebutuhan:** Analisis permintaan pengguna dan periksa file terkait di `src/` atau panduan di `.agents/skills/`.
2. **Inspeksi Kode:** Selalu periksa file sumber asli sebelum mengubah logika atau nama fungsi/tipe.
3. **Eksekusi Perubahan:** Lakukan pengeditan kode secara presisi dan bersih dalam TypeScript.
4. **Jalankan Verifikasi:** Jalankan `pnpm typecheck` dan `pnpm lint` untuk memastikan tidak ada syntax error atau tipe mismatch.
5. **Lakukan Git Commit:** Lakukan commit lokal atas semua perubahan yang telah selesai dan terverifikasi.
6. **Ringkaskan Hasil:** Berikan penjelasan singkat, padat, dan jelas mengenai perubahan yang telah dilakukan beserta bukti verifikasi.
