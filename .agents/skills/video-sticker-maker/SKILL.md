---
name: video-sticker-maker
description: Pedoman dan instruksi teknis untuk memproses stiker video/GIF pada WhatsApp Bot.
---

# Video Sticker Maker Skill

Skill ini berisi pedoman, struktur, dan batasan dalam mengimplementasikan, memodifikasi, dan menguji fitur pembuatan stiker video atau GIF animasi pada WhatsApp Bot.

## Kriteria Teknis Stiker Video WhatsApp
1. **Durasi**: Maksimal 5 detik. Durasi lebih panjang dapat menyebabkan ukuran file membengkak atau tidak diputar di aplikasi WhatsApp.
2. **Dimensi**: Harus 1:1, tepatnya 512x512 piksel.
3. **Format**: WebP Animasi (`.webp`).
4. **Ukuran File**: Maksimal 1MB (1,048,576 byte). Jika ukuran file lebih dari 1MB, WhatsApp tidak akan merender animasi stiker.
5. **Frame Rate (FPS)**: Disarankan 10-15 FPS (default 12 FPS) untuk menjaga ukuran file tetap kecil di bawah 1MB.

## Strategi Pemrosesan & Fallback
Aplikasi menggunakan sistem fallback multi-tahap untuk kompatibilitas lingkungan runtime (Termux, Pterodactyl Container, VM):
1. **FFmpeg-Static (Path Lokal)**: Mengecek apakah library `ffmpeg-static` terinstal secara lokal dan menggunakannya jika ada.
2. **System FFmpeg (Global)**: Jika `ffmpeg-static` tidak terinstal (misal di Android/Termux), mengecek apakah `ffmpeg` global tersedia di terminal host.
3. **Sharp (GIF Native Fallback)**: Jika FFmpeg tidak tersedia sama sekali, bot menggunakan library `sharp` dengan opsi `{ animated: true }` untuk memproses input GIF secara native. File video `.mp4` tidak dapat diproses jika FFmpeg tidak terinstal.

## Pembersihan File Sementara
Selalu hapus semua file input/output sementara yang dibuat selama pemrosesan di dalam blok `finally` untuk menghindari penumpukan ruang penyimpanan (disk space).
