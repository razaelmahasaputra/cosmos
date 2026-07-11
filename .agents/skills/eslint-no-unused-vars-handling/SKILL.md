---
name: eslint-no-unused-vars-handling
description: Cara mencegah dan memperbaiki kesalahan variabel tidak terpakai (no-unused-vars) saat pengeditan kode agar lolos verifikasi linting ESLint.
---

# Penanganan no-unused-vars ESLint

Jika berkas JavaScript gagal dalam proses linting akibat aturan `no-unused-vars` (variabel dideklarasikan atau diubah nilainya tetapi tidak pernah dibaca):

1. **Identifikasi Variabel**: Periksa variabel yang dilaporkan oleh ESLint error message.
2. **Hapus Deklarasi dan Assignment**: Jika variabel tersebut tidak digunakan di tempat lain dalam logika fungsi, hapus deklarasi `let`/`const` serta semua baris penugasan nilai (`variable = value`).
3. **Optimasi Impor**: Jika variabel tersebut berasal dari `import` yang tidak terpakai, hapus impor tersebut.
