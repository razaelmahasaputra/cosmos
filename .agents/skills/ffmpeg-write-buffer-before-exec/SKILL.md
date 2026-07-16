---
name: ffmpeg-write-buffer-before-exec
description: Selalu pastikan buffer media telah ditulis ke temporary file sebelum menjalankan perintah FFmpeg eksternal.
---

# FFmpeg Write Buffer Before Exec Skill

Saat melakukan pengeditan atau refaktorisasi fungsi konversi media (seperti gambar/video ke WebP stiker) yang menggunakan tool CLI eksternal (seperti `ffmpeg`):

1. **Simpan Buffer ke Disk**: Selalu pastikan buffer input telah ditulis sepenuhnya ke file temporary menggunakan `fs.promises.writeFile` sebelum menjalankan exec perintah CLI.
2. **Pembersihan**: File temporary input tersebut wajib dihapus kembali di blok `finally` atau setelah perintah selesai dieksekusi.
